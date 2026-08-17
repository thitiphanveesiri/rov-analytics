import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateTeamData } from "@/lib/validation";
import { syncMatchesToRelational } from "@/lib/matchSync";
import { syncScheduleForTeam } from "@/lib/googleCalendar";
import { checkRateLimit } from "@/lib/rateLimit";

// NOTE: no body-size-limit config for App Router Route Handlers.
// Photos are stored as Vercel Blob URLs (not base64) so payload stays small.

async function getTeamUser(session) {
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { teamId: true, role: true, status: true }
  });
  return user;
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
    else if (JSON.stringify(beforeArr) !== JSON.stringify(afterArr)) parts.push(`แก้ไข${label}`);
  };

  arrayDelta("แมตช์", before.matches, after.matches);
  arrayDelta("ตารางนัด", before.schedules, after.schedules);
  arrayDelta("scout log", before.scoutMatches, after.scoutMatches);
  arrayDelta("วิดีโอ", before.videos, after.videos);

  if (after.roster !== undefined && JSON.stringify(before.roster) !== JSON.stringify(after.roster)) {
    parts.push("แก้ไข roster ทีม");
  }

  return parts.length ? parts.join(", ") : null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await getTeamUser(session);
  const teamId = user?.teamId;
  if (!teamId) return NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true, inviteCode: true }
  });

  // ── Pending-approval gate ──
  // คนที่เข้าทีมผ่าน invite code ยังไม่ได้รับอนุมัติจาก admin — ให้เข้าแอปได้
  // ปกติ (เห็นเมนู, เห็นชื่อทีม) แต่ "ไม่เห็นข้อมูลทีมจริง" ตามที่ตกลงกันไว้
  // เลย return ไปแค่ pending:true โดยไม่แตะ/ส่ง TeamData เลย ฝั่ง client
  // (lib/storage.js) จะ fallback เป็นค่า default ว่างๆ ให้เองเมื่อไม่เจอ field
  // พวกนั้นในผลลัพธ์ + โชว์ banner "รออนุมัติ" จาก flag pending นี้
  if (user.status === "pending") {
    return NextResponse.json({ pending: true, teamName: team?.name });
  }

  const data = await prisma.teamData.upsert({
    where: { teamId },
    update: {},
    create: { teamId },
  });

  // ── Scout log visibility gate (scrim/practice scouting only) ──
  // Coaches wanted opponent PRACTICE scouting hidden from regular players
  // specifically — the concern being a player could leak it to someone on
  // the scouted team. Official TOURNAMENT scouting stays visible to
  // everyone as before (that's public information once it's been played).
  // This has to happen here, not just hidden in the UI — the whole point
  // is that a player shouldn't be able to see this even via devtools/the
  // network tab, so it's filtered out of the response entirely rather
  // than sent and hidden client-side.
  let scoutMatches = data.scoutMatches;
  const isCoachOrAdminForRead = user.role === "admin" || user.role === "coach";
  if (!isCoachOrAdminForRead && Array.isArray(scoutMatches)) {
    scoutMatches = scoutMatches.filter(sm => sm.category !== "scrim");
  }

  return NextResponse.json({
    ...data,
    scoutMatches,
    teamName: team?.name,
    inviteCode: team?.inviteCode,
  });
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await getTeamUser(session);
  const teamId = user?.teamId;
  if (!teamId) return NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });

  // pending user บันทึกอะไรไม่ได้เลยจนกว่าจะได้รับอนุมัติ — กันไว้ตั้งแต่
  // ต้นทาง ต่อให้ client ถูกแก้ให้ส่ง PUT มาตรงๆ ก็ยังโดนบล็อกที่นี่อยู่ดี
  if (user.status === "pending") {
    return NextResponse.json(
      { error: "บัญชีของคุณยังไม่ได้รับอนุมัติจาก Admin ของทีม กรุณารอก่อนบันทึกข้อมูล" },
      { status: 403 }
    );
  }

  // ── Rate limit ──
  // Unlike /login, this endpoint previously had no limit at all — normal
  // autosave (600ms debounce, client-serialized) stays way under this, so
  // it only kicks in for abusive/bugged traffic (e.g. a client stuck in a
  // retry loop). Keyed per-team, not per-user, since a save conflict from
  // ANY teammate can trigger the same team's data to be re-saved.
  const rateOk = await checkRateLimit(`save-data:${teamId}`, 60, 60); // 60 ครั้ง / 60 วินาที ต่อทีม
  if (!rateOk) {
    return NextResponse.json(
      { error: "บันทึกถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (invalid JSON)" }, { status: 400 });
  }

  // ── Schema validation ──
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
    whiteboardElements, whiteboardFormations, whiteboardMapUrl,
    expectedUpdatedAt, // เวลาที่ client เห็นข้อมูลล่าสุดตอนโหลด — ใช้เช็ค conflict
  } = validation.data;

  const writeData = {
    matches, rivals, roster, enemyRosters, scoutMatches,
    playerPhotos, heroPhotos, customHeroes, roleOverrides, videos,
    teamLogo, rivalLogos, schedules, patchInfo, heroTiers, practiceAssignments,
    whiteboardElements, whiteboardFormations, whiteboardMapUrl,
    updatedBy: session.user.email,
  };

  // ── Field-level permission gate ──
  // Patch notes & the meta tier list are meant to be coach/admin-managed
  // calls — if a plain "member" tries to change either field, silently
  // keep the existing DB value instead of failing the whole save.
  //
  // schedules is gated the same way — the Schedule page UI only lets a
  // coach/admin add/edit schedule entries ("รอ Coach เพิ่มตารางแข่ง" is
  // shown to plain members instead of the add form), so a member's client
  // should never be sending a changed `schedules` array in the first
  // place. Without this gate that intent was only enforced in the UI —
  // anyone could still PUT straight to /api/data with a hand-edited
  // schedules array (delete every match date, plant a fake one, etc.)
  // and the server would accept it. Same non-fatal pattern as the other
  // gated fields: revert to what's already in the DB rather than fail
  // the whole save.
  //
  // scoutMatches gets the same treatment for a different reason: members
  // never receive the scrim-category entries in the first place (see the
  // GET handler above), so their client-side scoutMatches array is
  // ALREADY missing those entries. If we let their PUT write it back
  // as-is, autosave would silently wipe every hidden scrim scout entry
  // out of the database — this isn't a permission nicety here, it's
  // preventing real data loss from an incomplete read being written back.
  const isCoachOrAdmin = user.role === "admin" || user.role === "coach";
  if (!isCoachOrAdmin && (
    writeData.patchInfo !== undefined ||
    writeData.heroTiers !== undefined ||
    writeData.scoutMatches !== undefined ||
    writeData.schedules !== undefined
  )) {
    const existing = await prisma.teamData.findUnique({
      where: { teamId },
      select: { patchInfo: true, heroTiers: true, scoutMatches: true, schedules: true },
    });
    if (existing) {
      if (writeData.patchInfo !== undefined) writeData.patchInfo = existing.patchInfo;
      if (writeData.heroTiers !== undefined) writeData.heroTiers = existing.heroTiers;
      if (writeData.scoutMatches !== undefined) writeData.scoutMatches = existing.scoutMatches;
      if (writeData.schedules !== undefined) writeData.schedules = existing.schedules;
    }
  }

  // ── Snapshot "before" state for the activity log ──
  // Fetched regardless of role/gate — separate from the coach-only field
  // gate above, which only fetches patchInfo/heroTiers/scoutMatches for a
  // different reason (reverting a member's incomplete write). This is a
  // small extra query on every save, but it's what lets the team see a
  // real "who changed what, when" log instead of just "who saved last".
  const beforeState = await prisma.teamData.findUnique({
    where: { teamId },
    select: { matches: true, roster: true, schedules: true, scoutMatches: true, videos: true },
  });

  try {
    let updated;

    if (expectedUpdatedAt) {
      // ── Optimistic locking: ป้องกันคนสองคน (หรือ 2 แท็บของคนเดียว) save
      //    พร้อมกันแล้วคนหลังทับข้อมูลคนแรกแบบเงียบๆ ──
      const result = await prisma.teamData.updateMany({
        where: { teamId, updatedAt: new Date(expectedUpdatedAt) },
        data: writeData,
      });

      if (result.count === 0) {
        const existing = await prisma.teamData.findUnique({ where: { teamId } });
        if (existing) {
          return NextResponse.json({
            error: "CONFLICT",
            message: "ข้อมูลถูกแก้ไขจากที่อื่นระหว่างที่คุณกำลังแก้ไข กรุณารีเฟรชหน้าเพื่อดูข้อมูลล่าสุดก่อนบันทึกต่อ",
            currentUpdatedAt: existing.updatedAt,
          }, { status: 409 });
        }
        updated = await prisma.teamData.create({ data: { teamId, ...writeData } });
      } else {
        updated = await prisma.teamData.findUnique({ where: { teamId } });
      }
    } else {
      updated = await prisma.teamData.upsert({
        where: { teamId },
        update: writeData,
        create: { teamId, ...writeData },
      });
    }

    if (matches) {
      try {
        await syncMatchesToRelational(teamId, matches, customHeroes || [], roleOverrides || {});
      } catch (err) {
        console.error("matchSync error (non-fatal) for team", teamId, err);
      }
    }

    // Best-effort Google Calendar sync for every connected team member —
    // same non-fatal pattern as matchSync above: a calendar sync failure
    // (expired refresh token, Google API hiccup, whatever) must never make
    // the user's actual save look like it failed. Only runs the network
    // calls at all if `schedules` was part of this save; most saves touch
    // other fields and shouldn't pay this cost.
    if (schedules) {
      try {
        await syncScheduleForTeam(teamId, schedules);
      } catch (err) {
        console.error("Google Calendar sync error (non-fatal) for team", teamId, err);
      }
    }

    // Best-effort activity log for the team (visible to everyone, not
    // just admins) — separate from matchSync/calendar sync above, but
    // same non-fatal pattern: never let a logging failure make the
    // user's actual save look like it failed.
    try {
      const summary = buildActivitySummary(beforeState, { matches, roster, schedules, scoutMatches, videos });
      if (summary) {
        await prisma.activityLog.create({
          data: { teamId, userEmail: session.user.email, summary },
        });
      }
    } catch (err) {
      console.error("Activity log write error (non-fatal) for team", teamId, err);
    }

    return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error("Save error:", err);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
