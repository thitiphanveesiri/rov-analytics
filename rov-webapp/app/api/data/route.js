import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

// GET: load the team's shared data (creates the row with defaults if it
// doesn't exist yet — handles the very first load after deploy).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const data = await prisma.teamData.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });

  return NextResponse.json(data);
}

// PUT: save the team's shared data. Body is the same shape the client
// already keeps in its `app` reducer state, so the client can send it
// almost as-is (see lib/saveTeamData.js on the client side).
export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      matches, rivals, roster, enemyRosters, scoutMatches,
      playerPhotos, heroPhotos, customHeroes, roleOverrides,
    } = body;

    const updated = await prisma.teamData.upsert({
      where: { id: SINGLETON_ID },
      update: {
        matches, rivals, roster, enemyRosters, scoutMatches,
        playerPhotos, heroPhotos, customHeroes, roleOverrides,
        updatedBy: session.user.email,
      },
      create: {
        id: SINGLETON_ID,
        matches, rivals, roster, enemyRosters, scoutMatches,
        playerPhotos, heroPhotos, customHeroes, roleOverrides,
        updatedBy: session.user.email,
      },
    });

    return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error("Save error:", err);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
