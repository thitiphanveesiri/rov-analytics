import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthUrl } from "@/lib/googleCalendar";

// ── GET /api/google-calendar/connect ──
// Redirects the user to Google's OAuth consent screen. `state` carries the
// userId so the callback route knows who to attach the tokens to — the
// callback still re-checks the session independently, this isn't the only
// verification, just how we thread the userId through Google's redirect.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));

  const url = getAuthUrl(session.user.id);
  return NextResponse.redirect(url);
}
