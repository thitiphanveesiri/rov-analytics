// lib/googleAuth.js
// Shared Google OAuth plumbing — encryption, token exchange/refresh, the
// connection record. Both lib/googleCalendar.js (event sync) and
// lib/youtube.js (channel/video access) use this SAME connection: one
// Google login grants both Calendar and YouTube access, since they're
// requested together in one consent screen. That's also the reason
// YouTube switched from a plain API key to OAuth — an API key can only
// ever see PUBLIC videos; seeing a channel's UNLISTED uploads requires
// being authenticated as that channel's owner, same as Calendar already
// needed per-user OAuth for.

import crypto from "node:crypto";
import { prisma } from "./prisma";

const GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// NOTE: adding youtube.readonly here means anyone who connected BEFORE
// this scope was added needs to reconnect once to pick it up — Google
// only grants scopes a token was actually consented to, so an old token
// from before this change won't have YouTube access until they redo the
// consent screen (getAuthUrl below forces `prompt=consent` every time,
// so a fresh "Connect" click always re-grants the current full scope list).
const SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

// ── Token encryption (AES-256-GCM) ──
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

export function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
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
  return res.json();
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
  return res.json();
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
  await prisma.youtubeWatchChannel.deleteMany({ where: { userId } });
}

// Returns a valid (non-expired) access token for this user, refreshing via
// the stored refresh token if needed. Returns null if not connected.
export async function getValidAccessToken(userId) {
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  if (!conn) return null;

  if (conn.expiresAt.getTime() > Date.now() + 60000) {
    return decrypt(conn.accessTokenEnc);
  }

  const refreshToken = decrypt(conn.refreshTokenEnc);
  if (!refreshToken) return null;
  const refreshed = await refreshAccessToken(refreshToken);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await prisma.googleCalendarConnection.update({
    where: { userId },
    data: { accessTokenEnc: encrypt(refreshed.access_token), expiresAt },
  });
  return refreshed.access_token;
}
