import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeCodeForTokens, fetchGoogleEmail, saveConnection } from "@/lib/googleAuth";

// ── GET /api/google-calendar/callback ──
// Google redirects here after the user approves (or denies) access.
// Exchanges the one-time `code` for access/refresh tokens, then saves the
// connection for the CURRENT SESSION's user — not blindly trusting the
// `state` param's userId alone (state could in theory be tampered with in
// transit; re-checking against the live session is the real guard here).
export async function GET(req) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const appUrl = process.env.NEXTAUTH_URL;

  if (!session) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  const error = searchParams.get("error");
  if (error) {
    // User denied consent, or Google returned some other error — send them
    // back to the app with a query flag the UI can show a message for.
    return NextResponse.redirect(new URL("/?calendar=denied", appUrl));
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code) {
    return NextResponse.redirect(new URL("/?calendar=error", appUrl));
  }

  // Defense in depth: state should match the logged-in user. If it doesn't
  // (stale link, tampered param, whatever), don't silently attach tokens
  // to the wrong account — bail out instead.
  if (state && state !== session.user.id) {
    console.error("Google Calendar callback state mismatch", { state, sessionUserId: session.user.id });
    return NextResponse.redirect(new URL("/?calendar=error", appUrl));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const googleEmail = await fetchGoogleEmail(tokens.access_token);
    await saveConnection(session.user.id, tokens, googleEmail || "ไม่ทราบอีเมล");
    return NextResponse.redirect(new URL("/?calendar=connected", appUrl));
  } catch (err) {
    console.error("Google Calendar callback failed:", err);
    return NextResponse.redirect(new URL("/?calendar=error", appUrl));
  }
}
