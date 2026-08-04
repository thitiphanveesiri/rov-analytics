import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthUrl } from "@/lib/googleAuth";

// ── GET /api/google-calendar/connect ──
// One Google connection now covers both Calendar sync AND YouTube channel
// access (see lib/googleAuth.js's combined scope) — the path is still
// named "google-calendar" for historical reasons, but connecting here
// enables both features.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));

  const url = getAuthUrl(session.user.id);
  return NextResponse.redirect(url);
}
