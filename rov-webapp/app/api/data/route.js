import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateTeamData } from "@/lib/validation";
import { syncMatchesToRelational } from "@/lib/matchSync";
import { syncScheduleForTeam } from "@/lib/googleCalendar";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  isActiveUser, visibleScoutMatches,
  applyWritePolicy, detectShrink, sameJson,
} from "@/lib/permissions";

// ข้อมูลทีมต้องสดเสมอ ห้ามให้ Next/CDN แคช response ของ route นี้
export const dynamic = "force-dynamic";

// เพดาน body ของ Vercel Functions คือ ~4.5MB — ตัดก่อนถึงเพดานเพื่อให้ได้ error ที่อ่านรู้เรื่อง
// (ไม่ใช่ 413 เปล่าๆ จากแพลตฟอร์ม) และ log เตือนล่วงหน้าเมื่อเริ่มโตใกล้เพดาน
const MAX_BODY_BYTES  = 4_200_000;
const WARN_BODY_BYTES = 3_000_000;

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body, init = {}) =>
  NextResponse.json(body, { ...init, headers: { ...NO_STORE, ...(init.headers || {}) } });

async function getTeamUser(session) {
  const email = session?.user?.email;
  if (!email) return null;
  return prisma.user.findUnique({
    where: { email },
    // playerName ใช้ตัดสินว่า member ติ๊ก "เสร็จ" การบ้านของตัวเองได้เฉพาะแถวไหน
    // (ดู sanitizeMemberAssignments ใน lib/permissions.js) — ไม่มี field นี้จะทำให้ gate
    // ปฏิเสธการแก้ practiceAssignments ของ member ทุกคนเงียบๆ (ปลอดภัยแต่ใช้งานไม่ได้)
    select: { teamId: true, role: true, status: true, playerName: true },
  });
}

// Compares the "before" snapshot against the fields present in this save
// and produces one short, human-readable summary line — not a deep diff
// of exactly which values changed, just enough for the team to see "who
// touched what" at a glance. Only looks at array-length deltas (added N /
// removed N) since that's cheap, reliable, and covers the common cases
// (someone added a match, added a video, edited the roster) without
// needing to deep-compare every nested field.
function buildActivitySummary(before, after) {
  if (!before) return null; // first-ever save for this team — nothing to diff against
  const parts = [];

  const arrayDelta = (label, beforeArr, afterArr) => {
    if (afterArr === undefined) return; // this field wasn't part of this save
    const b = Array.isArray(beforeArr) ? beforeArr.length : 0;
    const a = Array.isArray(afterArr) ? afterArr.length : 0;
    if (a > b) parts.push(`เพิ่ม${label} ${a - b} รายการ`);
    else if (a < b) parts.push(`ลบ${label} ${b - a} รายการ`);
    else if (!sameJson(beforeArr, afterArr)) parts.push(`แก้ไข${label}`);
  };

  arrayDelta("แมตช์", before.matches, after.matches);
  arrayDelta("ตารางนัด", before.schedules, after.schedules);
  arrayDelta("scout log", before.scoutMatches, after.scoutMatches);
  arrayDelta("วิดีโอ", before.videos, after.videos);

  if (after.roster !== undefined && !sameJson(before.roster, after.roster)) {
    parts.push("แก้ไข roster ทีม");
  }

  return parts.length ? parts.join(", ") : null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await getTeamUser(session);
  const teamId = user?.teamId;
  if (!teamId) return json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true, inviteCode: true },
  });

  // ── Pending-approval gate ──
  // คนที่เข้าทีมผ่าน invite code ยังไม่ได้รับอนุมัติจาก admin — ให้เข้าแอปได้
  // ปกติ (เห็นเมนู, เห็นชื่อทีม) แต่ "ไม่เห็นข้อมูลทีมจริง" — return แค่ pending:true
  // โดยไม่แตะ/ส่ง TeamData เลย ใช้ allowlist (active) แทน blacklist (pending) เพื่อให้
  // status แปลกๆ/ที่เพิ่มทีหลัง (เช่น suspended) ถูกบล็อกโดยอัตโนมัติ
  if (!isActiveUser(user)) {
    return json({ pending: true, teamName: team?.name });
  }

  // อ่านก่อน สร้างเมื่อไม่มี — เดิมใช้ upsert ทุกครั้งที่โหลด ซึ่งเขียน DB ตอนอ่าน
  // และมีโอกาสชนกัน (unique) เมื่อสองคนเปิดแอปพร้อมกันตอนทีมเพิ่งสร้าง
  let data = await prisma.teamData.findUnique({ where: { teamId } });
  if (!data) {
    try {
      data = await prisma.teamData.create({ data: { teamId } });
    } catch {
      data = await prisma.teamData.findUnique({ where: { teamId } }); // อีกคนสร้างไปก่อนพอดี
    }
  }
  if (!data) return json({ error: "โหลดข้อมูลทีมไม่สำเร็จ" }, { status: 500 });

  // ── Scout log visibility gate (allowlist: member เห็นเฉพาะ "tournament") ──
  // ต้องกรองที่ server — ไม่ใช่แค่ซ่อนใน UI — เพื่อให้ member เปิด DevTools ก็ไม่เห็น
  // (ดูเหตุผล/ข้อมูลเก่าที่ไม่มี category ใน lib/permissions.js)
  const scoutMatches = visibleScoutMatches(data.scoutMatches, user.role);

  return json({
    ...data,
    scoutMatches,
    teamName: team?.name,
    // invite code = กุญแจเข้าทีม → ส่งให้ admin เท่านั้น (เดิมส่งให้สมาชิกทุกคน)
    inviteCode: user.role === "admin" ? team?.inviteCode : undefined,
    // อีเมลคนแก้ล่าสุดไม่จำเป็นต่อ client (ไม่มีหน้าไหนใช้)
    updatedBy: undefined,
  });
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session) return json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await getTeamUser(session);
  const teamId = user?.teamId;
  if (!teamId) return json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });

  // pending/ถูกระงับ บันทึกอะไรไม่ได้เลย — กันไว้ตั้งแต่ต้นทาง ต่อให้ client ถูกแก้ให้ส่ง PUT ตรงๆ
  if (!isActiveUser(user)) {
    return json(
      { error: "บัญชีของคุณยังไม่ได้รับอนุมัติจาก Admin ของทีม กรุณารอก่อนบันทึกข้อมูล" },
      { status: 403 }
    );
  }

  // ── Rate limit (2 ชั้น) ──
  // ต่อทีม: กัน retry loop/traffic ผิดปกติ (คนในทีม save ชนกันก็ทำให้ทั้งทีมยิงซ้ำได้)
  // ต่อคน: กันสมาชิกคนเดียวยิงรัวจนกิน quota ของทีม แล้วทำให้ autosave ของโค้ชโดน 429
  const email = session.user.email;
  const [teamOk, userOk] = await Promise.all([
    checkRateLimit(`save-data:${teamId}`, 60, 60),       // 60 ครั้ง / 60 วินาที ต่อทีม
    checkRateLimit(`save-data-user:${email}`, 30, 60),   // 30 ครั้ง / 60 วินาที ต่อคน
  ]);
  if (!teamOk || !userOk) {
    return json({ error: "บันทึกถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" }, { status: 429 });
  }

  // ── อ่าน body เป็นข้อความก่อน เพื่อวัดขนาดจริง ──
  const declaredLen = Number(req.headers.get("content-length") || 0);
  if (declaredLen > MAX_BODY_BYTES) {
    return json({ error: "ข้อมูลทีมใหญ่เกินกว่าจะบันทึกได้ในครั้งเดียว", code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }
  let raw;
  try {
    raw = await req.text();
  } catch {
    return json({ error: "อ่านข้อมูลที่ส่งมาไม่สำเร็จ" }, { status: 400 });
  }
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes > MAX_BODY_BYTES) {
    return json({ error: "ข้อมูลทีมใหญ่เกินกว่าจะบันทึกได้ในครั้งเดียว", code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }
  if (bytes > WARN_BODY_BYTES) {
    // เตือนล่วงหน้า — ถ้าเห็น log นี้บ่อย ถึงเวลาแยก field ก้อนใหญ่ (whiteboard/scout) ออกเป็น endpoint ของตัวเอง
    console.warn(`[data PUT] payload ${(bytes / 1e6).toFixed(2)}MB approaching limit — team ${teamId}`);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (invalid JSON)" }, { status: 400 });
  }

  // ── Schema validation ──
  const validation = validateTeamData(body);
  if (!validation.success) {
    console.error("Validation error for team", teamId, validation.error);
    return json({ error: "ข้อมูลไม่ผ่านการตรวจสอบ", details: validation.error }, { status: 400 });
  }

  const {
    matches, rivals, roster, enemyRosters, scoutMatches,
    playerPhotos, heroPhotos, customHeroes, roleOverrides, videos,
    teamLogo, rivalLogos, schedules, patchInfo, heroTiers, practiceAssignments,
    whiteboardElements, whiteboardFormations, whiteboardMapUrl,
    expectedUpdatedAt, // เวลาที่ client เห็นข้อมูลล่าสุดตอนโหลด — ใช้เช็ค conflict
  } = validation.data;

  // ── Optimistic lock บังคับใช้เสมอ ──
  // เดิมถ้า client ไม่ส่ง expectedUpdatedAt จะ upsert ทับตรงๆ ข้าม lock ทั้งหมด (client เก่า/ที่ถูกดัดแปลง
  // เลี่ยง lock ได้) — client ปกติส่งเสมอหลังโหลดสำเร็จ (storage.js) จึงไม่กระทบผู้ใช้จริง
  if (!expectedUpdatedAt) {
    return json(
      { error: "MISSING_VERSION", message: "ไม่พบเลขเวอร์ชันของข้อมูล กรุณารีเฟรชหน้าแล้วลองใหม่" },
      { status: 428 }
    );
  }

  const requestedWrite = {
    matches, rivals, roster, enemyRosters, scoutMatches,
    playerPhotos, heroPhotos, customHeroes, roleOverrides, videos,
    teamLogo, rivalLogos, schedules, patchInfo, heroTiers, practiceAssignments,
    whiteboardElements, whiteboardFormations, whiteboardMapUrl,
  };

  // ── สถานะปัจจุบันใน DB (อ่านครั้งเดียว ใช้ทั้ง permission / shrink guard / activity log) ──
  const currentState = await prisma.teamData.findUnique({
    where: { teamId },
    select: {
      updatedAt: true,
      matches: true, rivals: true, roster: true, enemyRosters: true, scoutMatches: true,
      playerPhotos: true, teamLogo: true, rivalLogos: true,
      schedules: true, videos: true, patchInfo: true, heroTiers: true, practiceAssignments: true,
    },
  });

  // ── Field-level permission (whitelist ต่อ role) ──
  // แทนที่บล็อก gate เดิมที่ครอบแค่ 4 field — ตอนนี้ทุก field ที่ตั้งเป็น coach-only จะถูกตัดออก
  // (undefined = ไม่เขียน) เมื่อผู้เรียกเป็น member ไม่ว่า client จะส่งอะไรมา
  const { writeData: gated, ignored } = applyWritePolicy({
    role: user.role,
    // ใช้ user.playerName (อ่านสดจาก DB ใน getTeamUser ด้านบน) ไม่ใช่ session.user.playerName —
    // session มาจาก JWT ที่ sync กับ DB แค่ตอน login/ทุก ~5 นาที (ดู lib/auth.js) การอ่านสดตรงนี้
    // (ซึ่งต้อง query DB อยู่แล้วเพื่อเอา role/teamId) ตัดปัญหา JWT ค้างค่าเก่าออกไปได้ฟรี
    playerName: user.playerName,
    writeData: requestedWrite,
    current: currentState,
  });
  const writeData = { ...gated, updatedBy: email };

  // ── Shrink guard ──
  // แมตช์/scout หายเกิน 30% ในการบันทึกครั้งเดียว (เมื่อเดิมมี >10 รายการ) เกือบแน่ว่า bug หรือ
  // client เก่าค้างส่งอาร์เรย์ว่างมาทับ — ปฏิเสธแล้วให้ client โหลดข้อมูลจริงใหม่ ดีกว่าเขียนทับเงียบๆ
  const shrink = detectShrink(currentState, writeData);
  if (shrink) {
    console.error("Shrink guard blocked save", teamId, email, shrink);
    return json({
      error: "SHRINK_GUARD",
      message: `ข้อมูล${shrink.field === "matches" ? "แมตช์" : "scout"}ลดลงผิดปกติ (${shrink.before} → ${shrink.after}) ระบบจึงไม่บันทึกเพื่อป้องกันข้อมูลหาย กรุณารีเฟรชหน้า`,
    }, { status: 422 });
  }

  const hasRealWrite = Object.entries(writeData).some(([k, v]) => k !== "updatedBy" && v !== undefined);

  try {
    let updatedAt;

    if (!hasRealWrite) {
      // ไม่มี field ไหนที่ผู้เรียกมีสิทธิ์เขียน (เช่น member ที่แก้แต่ส่วนของ coach) —
      // ไม่ต้องเขียน DB ซึ่งจะเป็นแค่การขยับเลขเวอร์ชันแล้วทำให้คนอื่นเจอ conflict ลอยๆ
      // แต่ยังต้องเช็คว่าเวอร์ชันที่ client ถืออยู่ยังตรงกับปัจจุบันไหม
      if (currentState && new Date(expectedUpdatedAt).getTime() !== currentState.updatedAt.getTime()) {
        return json({
          error: "CONFLICT",
          message: "ข้อมูลถูกแก้ไขจากที่อื่นระหว่างที่คุณกำลังแก้ไข กรุณารีเฟรชหน้าเพื่อดูข้อมูลล่าสุดก่อนบันทึกต่อ",
          currentUpdatedAt: currentState.updatedAt,
        }, { status: 409 });
      }
      updatedAt = currentState?.updatedAt ?? new Date();
    } else {
      // ── Optimistic locking: ป้องกันคนสองคน (หรือ 2 แท็บของคนเดียว) save พร้อมกันแล้วคนหลังทับคนแรกเงียบๆ ──
      // server กำหนด updatedAt เอง แล้วคืนค่านั้นให้ client เลย (เดิมอ่านซ้ำด้วย findUnique ซึ่งถ้ามีคนอื่น save แทรก
      // ตรงกลาง client จะได้เวอร์ชันของ "อีกคน" ไปเป็นฐาน แล้ว save ถัดไปจะผ่าน lock ทั้งที่ยังไม่เคยเห็นข้อมูลนั้น)
      const now = new Date();
      const result = await prisma.teamData.updateMany({
        where: { teamId, updatedAt: new Date(expectedUpdatedAt) },
        data: { ...writeData, updatedAt: now },
      });

      if (result.count === 0) {
        const existing = await prisma.teamData.findUnique({ where: { teamId }, select: { updatedAt: true } });
        if (existing) {
          return json({
            error: "CONFLICT",
            message: "ข้อมูลถูกแก้ไขจากที่อื่นระหว่างที่คุณกำลังแก้ไข กรุณารีเฟรชหน้าเพื่อดูข้อมูลล่าสุดก่อนบันทึกต่อ",
            currentUpdatedAt: existing.updatedAt,
          }, { status: 409 });
        }
        const created = await prisma.teamData.create({ data: { teamId, ...writeData } });
        updatedAt = created.updatedAt;
      } else {
        updatedAt = now;
      }

      // ── Deferred, best-effort post-save work ──
      // after() รันหลังส่ง response ไปแล้ว (ต้อง Next.js 14.1+/15) — ใช้ "writeData" (ค่าหลังผ่านสิทธิ์)
      // เท่านั้น ห้ามใช้ค่าดิบจาก client: เดิมใช้ `schedules` ดิบ ทำให้ member ที่ถูกตัดสิทธิ์แล้วก็ยังสั่ง
      // sync ตารางปลอมเข้า Google Calendar ของทั้งทีมได้ และ activity log ก็จดตามค่าดิบ
      // นอกจากนี้ sync เฉพาะเมื่อข้อมูลเปลี่ยนจริง — client ส่งทุก field ทุก autosave การยิง Google API
      // /matchSync ทุกครั้งเปลือง quota โดยไม่จำเป็น
      const before = currentState;
      after(async () => {
        if (writeData.matches !== undefined && !sameJson(before?.matches, writeData.matches)) {
          try {
            await syncMatchesToRelational(teamId, writeData.matches, writeData.customHeroes || [], writeData.roleOverrides || {});
          } catch (err) {
            console.error("matchSync error (non-fatal) for team", teamId, err);
          }
        }

        if (writeData.schedules !== undefined && !sameJson(before?.schedules, writeData.schedules)) {
          try {
            await syncScheduleForTeam(teamId, writeData.schedules);
          } catch (err) {
            console.error("Google Calendar sync error (non-fatal) for team", teamId, err);
          }
        }

        try {
          const summary = buildActivitySummary(before, writeData);
          if (summary) {
            await prisma.activityLog.create({ data: { teamId, userEmail: email, summary } });
          }
        } catch (err) {
          console.error("Activity log write error (non-fatal) for team", teamId, err);
        }
      });
    }

    return json({
      ok: true,
      updatedAt,
      // field ที่ผู้เรียกพยายามแก้แต่ไม่มีสิทธิ์ (ไม่รวมกรณีค่าเท่าเดิม) — ให้ client แจ้งผู้ใช้
      ...(ignored.length ? { ignoredFields: ignored } : {}),
    });
  } catch (err) {
    console.error("Save error:", err);
    return json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
