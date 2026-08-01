// lib/googleCalendar.js
// Google Calendar OAuth + sync helpers.
//
// Design: each team member connects their OWN Google account. When
// schedules change (app/api/data PUT), every connected member's calendar
// gets synced independently — each person ends up with their own copy of
// each event in their own calendar, not one shared calendar owned by the
// team. GoogleCalendarSync tracks the (user, schedule item) → Google event
// id mapping so re-syncs update/delete the right event instead of
// duplicating it every time.

import crypto from "node:crypto";
import { prisma } from "./prisma";

const GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API     = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPE             = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";

// ── Token encryption (AES-256-GCM) ──
// Refresh tokens are long-lived credentials — never store them in
// plaintext. Requires TOKEN_ENCRYPTION_KEY env var: a 32-byte key,
// base64-encoded. Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
function getKey() {
  const b64 = process.env.TOKEN_ENCRYPTION_KEY;
  if (!b64) throw new Error("TOKEN_ENCRYPTION_KEY env var is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // pack iv + tag + ciphertext into one base64 string for storage
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(packed) {
  const buf = Buffer.from(packed, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// ── OAuth flow ──

// `state` should be a signed/opaque value tying the callback back to the
// logged-in user — we use the userId directly since the callback route
// re-checks the session anyway before touching anything (defense in depth,
// not the only check).
export function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",   // needed to get a refresh_token
    prompt: "consent",        // force re-consent so we always get a refresh_token (Google only sends it on first consent otherwise)
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json(); // { access_token, refresh_token, expires_in, ... }
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return res.json(); // { access_token, expires_in, ... } — no new refresh_token usually
}

export async function fetchGoogleEmail(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email || null;
}

export async function saveConnection(userId, tokens, googleEmail) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await prisma.googleCalendarConnection.upsert({
    where: { userId },
    update: {
      googleEmail,
      accessTokenEnc: encrypt(tokens.access_token),
      // Google only returns refresh_token on first consent — keep the old
      // one if this is a re-auth that didn't get a fresh one.
      ...(tokens.refresh_token ? { refreshTokenEnc: encrypt(tokens.refresh_token) } : {}),
      expiresAt,
    },
    create: {
      userId,
      googleEmail,
      accessTokenEnc: encrypt(tokens.access_token),
      refreshTokenEnc: encrypt(tokens.refresh_token || ""),
      expiresAt,
    },
  });
}

export async function disconnectUser(userId) {
  await prisma.googleCalendarConnection.deleteMany({ where: { userId } });
  await prisma.googleCalendarSync.deleteMany({ where: { userId } });
}

// Returns a valid (non-expired) access token for this user, refreshing via
// the stored refresh token if needed. Returns null if not connected.
async function getValidAccessToken(userId) {
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  if (!conn) return null;

  if (conn.expiresAt.getTime() > Date.now() + 60000) {
    // still valid for at least another minute
    return decrypt(conn.accessTokenEnc);
  }

  const refreshToken = decrypt(conn.refreshTokenEnc);
  if (!refreshToken) return null; // never got one — user needs to reconnect
  const refreshed = await refreshAccessToken(refreshToken);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await prisma.googleCalendarConnection.update({
    where: { userId },
    data: { accessTokenEnc: encrypt(refreshed.access_token), expiresAt },
  });
  return refreshed.access_token;
}

// ── Calendar event CRUD ──

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
  return res.json(); // includes .id
}

async function updateEvent(accessToken, googleEventId, schedule) {
  const res = await fetch(`${CALENDAR_API}/${googleEventId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(scheduleToEvent(schedule)),
  });
  if (res.status === 404 || res.status === 410) return { deleted: true }; // event was removed on the Google side — caller should re-create
  if (!res.ok) throw new Error(`Update event failed: ${await res.text()}`);
  return res.json();
}

async function deleteEvent(accessToken, googleEventId) {
  const res = await fetch(`${CALENDAR_API}/${googleEventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 404/410 = already gone on Google's side, treat as success either way
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Delete event failed: ${await res.text()}`);
  }
}

// ── High-level sync ──
// Diffs the current `schedules` array against this user's existing
// GoogleCalendarSync rows and creates/updates/deletes events as needed.
// Safe to call repeatedly — idempotent given the same schedules input.
async function syncScheduleForUser(userId, teamId, schedules) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return; // not connected — nothing to do

  const existingSyncs = await prisma.googleCalendarSync.findMany({ where: { userId, teamId } });
  const syncByScheduleId = new Map(existingSyncs.map(s => [s.scheduleId, s]));
  const currentIds = new Set(schedules.map(s => String(s.id)));

  // Create or update
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
          // event vanished on Google's side — recreate and update the mapping
          const created = await createEvent(accessToken, s);
          await prisma.googleCalendarSync.update({
            where: { id: existing.id },
            data: { googleEventId: created.id },
          });
        }
      }
    } catch (err) {
      // One bad event shouldn't stop the rest of the sync — log and move on.
      console.error(`Google Calendar sync failed for schedule ${scheduleId}, user ${userId}:`, err);
    }
  }

  // Delete anything that's no longer in the schedules array
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

// Syncs every connected member of the team, not just whoever just saved —
// so if coach A adds a schedule, it still shows up on coach B's calendar
// too (each connected user gets their own copy of every team event).
export async function syncScheduleForTeam(teamId, schedules) {
  if (!Array.isArray(schedules)) return;
  const connectedMembers = await prisma.user.findMany({
    where: { teamId, googleCalendar: { isNot: null } },
    select: { id: true },
  });
  // Sequential on purpose — Google Calendar API has per-user rate limits;
  // running every member's sync concurrently risks tripping them under
  // load, and this runs in the background of a save, not blocking the UI.
  for (const member of connectedMembers) {
    await syncScheduleForUser(member.id, teamId, schedules).catch(err =>
      console.error(`Calendar sync failed entirely for user ${member.id}:`, err)
    );
  }
}
