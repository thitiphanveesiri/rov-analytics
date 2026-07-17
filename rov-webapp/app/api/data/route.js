import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateTeamData } from "@/lib/validation";
import { syncMatchesToRelational } from "@/lib/matchSync";

// NOTE: no body-size-limit config for App Router Route Handlers.
// Photos are stored as Vercel Blob URLs (not base64) so payload stays small.

async function getTeamUser(session) {
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { teamId: true, role: true }
  });
  return user;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await getTeamUser(session);
  const teamId = user?.teamId;
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

  const user = await getTeamUser(session);
  const teamId = user?.teamId;
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
    expectedUpdatedAt, // เวลาที่ client เห็นข้อมูลล่าสุดตอนโหลด — ใช้เช็ค conflict
  } = validation.data;

  const writeData = {
    matches, rivals, roster, enemyRosters, scoutMatches,
    playerPhotos, heroPhotos, customHeroes, roleOverrides, videos,
    teamLogo, rivalLogos, schedules, patchInfo, heroTiers, practiceAssignments,
    updatedBy: session.user.email,
  };

  // ── Field-level permission gate ──
  // Patch notes & the meta tier list are meant to be coach/admin-managed
  // calls, but the UI restriction alone is client-side and trivially
  // bypassed by calling this endpoint directly. If a plain "member" tries
  // to change either field, silently keep the existing DB value instead —
  // this protects the data without failing the rest of their (legitimate)
  // save in the same request.
  const isCoachOrAdmin = user.role === "admin" || user.role === "coach";
  if (!isCoachOrAdmin && (writeData.patchInfo !== undefined || writeData.heroTiers !== undefined)) {
    const existing = await prisma.teamData.findUnique({
      where: { teamId },
      select: { patchInfo: true, heroTiers: true },
    });
    if (existing) {
      if (writeData.patchInfo !== undefined) writeData.patchInfo = existing.patchInfo;
      if (writeData.heroTiers !== undefined) writeData.heroTiers = existing.heroTiers;
    }
  }

  try {
    let updated;

    if (expectedUpdatedAt) {
      // ── Optimistic locking: ป้องกันคนสองคน (หรือ 2 แท็บของคนเดียว) save
      //    พร้อมกันแล้วคนหลังทับข้อมูลคนแรกแบบเงียบๆ ──
      // updateMany + WHERE ที่รวม updatedAt เดิมไว้ด้วย เป็น atomic
      // compare-and-swap ระดับ DB กัน race condition ระหว่างเช็คกับเขียนจริง
      const result = await prisma.teamData.updateMany({
        where: { teamId, updatedAt: new Date(expectedUpdatedAt) },
        data: writeData,
      });

      if (result.count === 0) {
        const existing = await prisma.teamData.findUnique({ where: { teamId } });
        if (existing) {
          // มีข้อมูลอยู่แล้ว แต่ updatedAt ไม่ตรงกับที่ client เห็นล่าสุด
          // แปลว่ามีคนอื่น (หรือแท็บอื่น) save ทับไปก่อนหน้านี้แล้ว
          return NextResponse.json({
            error: "CONFLICT",
            message: "ข้อมูลถูกแก้ไขจากที่อื่นระหว่างที่คุณกำลังแก้ไข กรุณารีเฟรชหน้าเพื่อดูข้อมูลล่าสุดก่อนบันทึกต่อ",
            currentUpdatedAt: existing.updatedAt,
          }, { status: 409 });
        }
        // ยังไม่เคยมีแถวนี้เลย (ทีมใหม่ที่ยังไม่เคย save) — สร้างใหม่
        updated = await prisma.teamData.create({ data: { teamId, ...writeData } });
      } else {
        updated = await prisma.teamData.findUnique({ where: { teamId } });
      }
    } else {
      // ไม่มี expectedUpdatedAt ส่งมา (client เก่า หรือ save ครั้งแรกในเซสชัน) —
      // ยัง upsert ตามปกติเพื่อ backward compatibility
      updated = await prisma.teamData.upsert({
        where: { teamId },
        update: writeData,
        create: { teamId, ...writeData },
      });
    }

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
