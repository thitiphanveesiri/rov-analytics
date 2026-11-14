import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { isActiveUser } from "@/lib/permissions";
import { HERO_DATA } from "@/lib/heroes";

// อ่านภาพหน้าจอสรุปผลแมตช์ (scoreboard) ด้วย Claude Vision → คืน JSON ตัวเลขต่อผู้เล่น
// - ต้อง login + อยู่ในทีม + active (เหมือน /api/upload)
// - ใช้ ANTHROPIC_API_KEY ฝั่ง server เท่านั้น (ไม่หลุดไป browser)
// - ผลลัพธ์เป็น "ข้อเสนอ" — ฝั่ง client ให้ผู้ใช้ตรวจก่อนบันทึกทุกครั้ง
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_B64_CHARS = 4_000_000; // ~3MB ไฟล์จริง (ต่ำกว่าลิมิต body 4.5MB ของ Vercel)
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const HERO_LIST = HERO_DATA.map(h => h.name).join(", ");

const PROMPT = `You are reading a post-match scoreboard screenshot from the mobile MOBA "Arena of Valor" (RoV).
Extract the stats for the two teams exactly as displayed.

Return ONLY a JSON object, no markdown, no commentary, in this shape:
{
  "teams": [
    { "rows": [ { "hero": string|null, "player": string|null, "kills": number|null, "deaths": number|null, "assists": number|null, "damage": number|null, "damageTaken": number|null, "gold": number|null } ] },
    { "rows": [ ... ] }
  ],
  "teamKills": [number|null, number|null],
  "result": "WIN"|"LOSE"|null,
  "duration": string|null
}

Rules:
- "teams[0]" is the first team in reading order (top team, or left team if laid out side by side); "teams[1]" is the other one. Keep each team's rows in the order shown.
- "hero" must be one of these names when it matches (fix small misreads): ${HERO_LIST}. If you can't identify the hero, use null.
- Numbers must be plain integers (expand "12.5k" to 12500, remove commas). Use null for any value you cannot read with confidence. NEVER guess or invent a number.
- "teamKills" is the team kill totals shown at the top, if visible.
- "result" is the result for teams[0] if a Victory/Defeat banner is visible, otherwise null.
- "duration" is the match time as shown (e.g. "12:34") or null.
- If the image is not a scoreboard, return {"teams":[],"teamKills":[null,null],"result":null,"duration":null}.`;

function extractJson(text) {
  const t = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(t.slice(start, end + 1));
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, teamId: true, role: true, status: true },
    });
    if (!user?.teamId || !isActiveUser(user)) return NextResponse.json({ error: "ไม่มีสิทธิ์ใช้งาน" }, { status: 403 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ฝั่ง server" }, { status: 503 });
    }

    // ค่าใช้จ่ายต่อภาพ → จำกัดให้พอใช้จริง (ภาพละ 1 เกม)
    const ok = await checkRateLimit(`scoreboard-ocr:${user.id}`, 15, 600);
    if (!ok) return NextResponse.json({ error: "ใช้งานถี่เกินไป ลองใหม่ในอีกสักครู่" }, { status: 429 });

    const { image, mediaType } = await request.json();
    if (typeof image !== "string" || !ALLOWED.includes(mediaType)) {
      return NextResponse.json({ error: "รองรับเฉพาะไฟล์ JPG / PNG / WebP" }, { status: 400 });
    }
    if (image.length > MAX_B64_CHARS) {
      return NextResponse.json({ error: "ไฟล์ภาพใหญ่เกินไป" }, { status: 413 });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });

    if (!res.ok) {
      console.error("scoreboard-ocr anthropic error:", res.status, (await res.text()).slice(0, 300));
      return NextResponse.json({ error: "อ่านภาพไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 502 });
    }

    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    const parsed = extractJson(text);
    const teams = Array.isArray(parsed.teams) ? parsed.teams.slice(0, 2) : [];
    if (teams.length < 2) return NextResponse.json({ error: "ไม่พบตารางสรุปผลในภาพนี้" }, { status: 422 });

    return NextResponse.json({
      teams: teams.map(t => ({ rows: Array.isArray(t?.rows) ? t.rows.slice(0, 5) : [] })),
      teamKills: Array.isArray(parsed.teamKills) ? parsed.teamKills.slice(0, 2) : [null, null],
      result: parsed.result === "WIN" || parsed.result === "LOSE" ? parsed.result : null,
      duration: typeof parsed.duration === "string" ? parsed.duration : null,
    });
  } catch (err) {
    console.error("scoreboard-ocr error:", err?.message || err);
    return NextResponse.json({ error: "อ่านภาพไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
