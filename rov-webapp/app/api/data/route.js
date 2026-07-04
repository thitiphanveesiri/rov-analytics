import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// NOTE: no body-size-limit config for App Router Route Handlers.
// Photos are stored as Vercel Blob URLs (not base64) so payload stays small.

async function getTeamId(session) {
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { teamId: true }
  });
  return user?.teamId;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const teamId = await getTeamId(session);
  if (!teamId) return NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });

  const data = await prisma.teamData.upsert({
    where: { teamId },
    update: {},
    create: { teamId },
  });

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true, inviteCode: true }
  });

  return NextResponse.json({ ...data, teamName: team?.name, inviteCode: team?.inviteCode });
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const teamId = await getTeamId(session);
  if (!teamId) return NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });

  try {
    const body = await req.json();
    const {
      matches, rivals, roster, enemyRosters, scoutMatches,
      playerPhotos, heroPhotos, customHeroes, roleOverrides, videos,
      teamLogo, rivalLogos, schedules,
    } = body;

    const updated = await prisma.teamData.upsert({
      where: { teamId },
      update: {
        matches, rivals, roster, enemyRosters, scoutMatches,
        playerPhotos, heroPhotos, customHeroes, roleOverrides, videos,
        teamLogo, rivalLogos, schedules,
        updatedBy: session.user.email,
      },
      create: {
        teamId,
        matches, rivals, roster, enemyRosters, scoutMatches,
        playerPhotos, heroPhotos, customHeroes, roleOverrides, videos,
        teamLogo, rivalLogos, schedules,
        updatedBy: session.user.email,
      },
    });

    return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error("Save error:", err);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
