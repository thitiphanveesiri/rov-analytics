import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateTeamData } from "@/lib/validation";
import { syncMatchesToRelational } from "@/lib/matchSync";

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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (invalid JSON)" }, { status: 400 });
  }

  // ── Schema validation ──
  // Rejects structurally malformed payloads (wrong types, oversized text,
  // unexpected shapes) before they ever reach the database. This is what
  // makes it safe to eventually open this app to other teams: right now
  // ANY authenticated user could write literally any JSON shape into
  // TeamData, and every page that reads app.matches/app.roster/etc. would
  // just break with no clear error.
  const validation = validateTeamData(body);
  if (!validation.success) {
    console.error("Validation error for team", teamId, validation.error);
    return NextResponse.json(
      { error: "ข้อมูลไม่ผ่านการตรวจสอบ", details: validation.error },
      { status: 400 }
    );
  }

  const {
    matches, rivals, roster, enemyRosters, scoutMatches,
    playerPhotos, heroPhotos, customHeroes, roleOverrides, videos,
    teamLogo, rivalLogos, schedules, patchInfo, heroTiers, practiceAssignments,
  } = validation.data;

  try {
    const updated = await prisma.teamData.upsert({
      where: { teamId },
      update: {
        matches, rivals, roster, enemyRosters, scoutMatches,
        playerPhotos, heroPhotos, customHeroes, roleOverrides, videos,
        teamLogo, rivalLogos, schedules, patchInfo, heroTiers, practiceAssignments,
        updatedBy: session.user.email,
      },
      create: {
        teamId,
        matches, rivals, roster, enemyRosters, scoutMatches,
        playerPhotos, heroPhotos, customHeroes, roleOverrides, videos,
        teamLogo, rivalLogos, schedules, patchInfo, heroTiers, practiceAssignments,
        updatedBy: session.user.email,
      },
    });

    // Best-effort mirror into normalized tables for analytics. Deliberately
    // NOT allowed to fail the save: if this throws (bad data shape we didn't
    // anticipate, transient DB hiccup), the user's actual save already
    // succeeded above and must not be rolled back or reported as failed —
    // analytics being briefly stale is fine, losing a coach's match entry
    // because of an analytics bug is not.
    // NOTE: awaited (not fire-and-forget) — on Vercel, a serverless function
    // can freeze/terminate the instant the response is sent, so a detached
    // background promise here would randomly never finish.
    if (matches) {
      try {
        await syncMatchesToRelational(teamId, matches, customHeroes || [], roleOverrides || {});
      } catch (err) {
        console.error("matchSync error (non-fatal) for team", teamId, err);
      }
    }

    return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error("Save error:", err);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
