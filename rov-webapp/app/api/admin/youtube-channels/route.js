import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchMyChannel } from "@/lib/youtube";
import { getValidAccessToken } from "@/lib/googleAuth";

async function requireTeamMember() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "ไม่ได้ login", status: 401 };
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, teamId: true, role: true },
  });
  if (!user?.teamId) return { error: "ยังไม่ได้เข้าทีม", status: 403 };
  return { user };
}

// ── GET: ดูรายชื่อช่องที่เพิ่มไว้ + keyword filter ปัจจุบัน ──
export async function GET() {
  const auth = await requireTeamMember();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [channels, team] = await Promise.all([
    prisma.youtubeWatchChannel.findMany({
      where: { teamId: auth.user.teamId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.team.findUnique({
      where: { id: auth.user.teamId },
      select: { youtubeKeywords: true },
    }),
  ]);

  return NextResponse.json({ channels, keywords: team?.youtubeKeywords || [] });
}

// ── POST: เพิ่มช่องของ "ตัวเอง" (ต้องเชื่อมต่อ Google ไว้ก่อนแล้ว) ──
// ไม่รับ URL/handle ของช่องคนอื่นแล้ว — เพราะการเห็นวิดีโอ unlisted ได้ต้อง
// authenticate เป็นเจ้าของช่องเท่านั้น ระบบเลยดึงช่องจาก token ของคนที่
// login อยู่ตรงๆ (channels.list?mine=true) แทนที่จะให้พิมพ์ช่องเอง
export async function POST() {
  const auth = await requireTeamMember();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const accessToken = await getValidAccessToken(auth.user.id);
  if (!accessToken) {
    return NextResponse.json(
      { error: "ยังไม่ได้เชื่อมต่อบัญชี Google — เชื่อมต่อก่อน (ปุ่มเดียวกับที่ใช้เชื่อม Google Calendar)" },
      { status: 400 }
    );
  }

  let resolved;
  try {
    resolved = await fetchMyChannel(accessToken);
  } catch (err) {
    console.error("fetchMyChannel failed:", err);
    return NextResponse.json({ error: "เชื่อมต่อ YouTube ไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 502 });
  }
  if (!resolved || !resolved.uploadsPlaylistId) {
    return NextResponse.json({ error: "บัญชี Google นี้ไม่มีช่อง YouTube" }, { status: 404 });
  }

  const existing = await prisma.youtubeWatchChannel.findUnique({
    where: { teamId_channelId: { teamId: auth.user.teamId, channelId: resolved.channelId } },
  });
  if (existing) return NextResponse.json({ error: "ช่องนี้ถูกเพิ่มไว้แล้ว" }, { status: 409 });

  const created = await prisma.youtubeWatchChannel.create({
    data: {
      teamId: auth.user.teamId,
      userId: auth.user.id,
      channelId: resolved.channelId,
      channelTitle: resolved.channelTitle,
      uploadsPlaylistId: resolved.uploadsPlaylistId,
      addedByEmail: auth.user.email,
    },
  });

  return NextResponse.json(created);
}

// ── PATCH: แก้ keyword filter ของทีม ──
export async function PATCH(req) {
  const auth = await requireTeamMember();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { keywords } = await req.json();
  if (!Array.isArray(keywords) || keywords.some(k => typeof k !== "string")) {
    return NextResponse.json({ error: "รูปแบบ keyword ไม่ถูกต้อง" }, { status: 400 });
  }
  const cleaned = keywords.map(k => k.trim()).filter(Boolean).slice(0, 20);

  await prisma.team.update({
    where: { id: auth.user.teamId },
    data: { youtubeKeywords: cleaned },
  });

  return NextResponse.json({ ok: true, keywords: cleaned });
}

// ── DELETE: ลบช่องออกจาก watch list — เฉพาะช่องของตัวเองเท่านั้น ──
export async function DELETE(req) {
  const auth = await requireTeamMember();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ไม่ระบุ id" }, { status: 400 });

  // เฉพาะเจ้าของช่องเอง หรือ admin ของทีม ลบได้
  const target = await prisma.youtubeWatchChannel.findFirst({
    where: { id, teamId: auth.user.teamId },
  });
  if (!target) return NextResponse.json({ error: "ไม่พบช่องนี้" }, { status: 404 });
  if (target.userId !== auth.user.id && auth.user.role !== "admin") {
    return NextResponse.json({ error: "ลบได้เฉพาะช่องของตัวเอง หรือ Admin เท่านั้น" }, { status: 403 });
  }

  await prisma.youtubeWatchChannel.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
