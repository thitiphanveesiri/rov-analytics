// lib/googleCalendar.js
// Calendar-specific event sync — OAuth/token handling now lives in
// lib/googleAuth.js, shared with lib/youtube.js (one Google connection
// covers both features).

import { prisma } from "./prisma";
import { getValidAccessToken } from "./googleAuth";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

function scheduleToEvent(s) {
  const start = new Date(`${s.date}T${s.time || "18:00"}`);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // default 2-hour block
  const title = s.tournament || (s.rival ? `แข่ง vs ${s.rival}` : "นัดหมายทีม");
  const descParts = [
    s.category ? `ประเภท: ${s.category}` : null,
    s.rival && s.tournament ? `คู่แข่ง: ${s.rival}` : null,
    s.note || null,
  ].filter(Boolean);
  return {
    summary: title,
    description: descParts.join("\n") || undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
}

async function createEvent(accessToken, schedule) {
  const res = await fetch(CALENDAR_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(scheduleToEvent(schedule)),
  });
  if (!res.ok) throw new Error(`Create event failed: ${await res.text()}`);
  return res.json();
}

async function updateEvent(accessToken, googleEventId, schedule) {
  const res = await fetch(`${CALENDAR_API}/${googleEventId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(scheduleToEvent(schedule)),
  });
  if (res.status === 404 || res.status === 410) return { deleted: true };
  if (!res.ok) throw new Error(`Update event failed: ${await res.text()}`);
  return res.json();
}

async function deleteEvent(accessToken, googleEventId) {
  const res = await fetch(`${CALENDAR_API}/${googleEventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Delete event failed: ${await res.text()}`);
  }
}

async function syncScheduleForUser(userId, teamId, schedules) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return;

  const existingSyncs = await prisma.googleCalendarSync.findMany({ where: { userId, teamId } });
  const syncByScheduleId = new Map(existingSyncs.map(s => [s.scheduleId, s]));
  const currentIds = new Set(schedules.map(s => String(s.id)));

  for (const s of schedules) {
    const scheduleId = String(s.id);
    const existing = syncByScheduleId.get(scheduleId);
    try {
      if (!existing) {
        const created = await createEvent(accessToken, s);
        await prisma.googleCalendarSync.create({
          data: { teamId, userId, scheduleId, googleEventId: created.id },
        });
      } else {
        const result = await updateEvent(accessToken, existing.googleEventId, s);
        if (result.deleted) {
          const created = await createEvent(accessToken, s);
          await prisma.googleCalendarSync.update({
            where: { id: existing.id },
            data: { googleEventId: created.id },
          });
        }
      }
    } catch (err) {
      console.error(`Google Calendar sync failed for schedule ${scheduleId}, user ${userId}:`, err);
    }
  }

  for (const sync of existingSyncs) {
    if (currentIds.has(sync.scheduleId)) continue;
    try {
      await deleteEvent(accessToken, sync.googleEventId);
    } catch (err) {
      console.error(`Google Calendar delete failed for schedule ${sync.scheduleId}, user ${userId}:`, err);
    }
    await prisma.googleCalendarSync.delete({ where: { id: sync.id } }).catch(() => {});
  }
}

export async function syncScheduleForTeam(teamId, schedules) {
  if (!Array.isArray(schedules)) return;
  const connectedMembers = await prisma.user.findMany({
    where: { teamId, googleCalendar: { isNot: null } },
    select: { id: true },
  });
  for (const member of connectedMembers) {
    await syncScheduleForUser(member.id, teamId, schedules).catch(err =>
      console.error(`Calendar sync failed entirely for user ${member.id}:`, err)
    );
  }
}
