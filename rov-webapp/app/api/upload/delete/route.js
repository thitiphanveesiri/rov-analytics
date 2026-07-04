import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { del } from "@vercel/blob";

// Deletes old Vercel Blob files after a photo/logo is replaced or removed,
// so orphaned files don't pile up (and keep costing storage) forever.
// Best-effort: called fire-and-forget from the client, never blocks the UI.
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const urls = Array.isArray(body?.urls) ? body.urls : [];
  if (urls.length === 0) {
    return NextResponse.json({ error: "ไม่มี url ให้ลบ" }, { status: 400 });
  }

  // Defense in depth: only ever allow deleting real Vercel Blob URLs, never
  // arbitrary URLs, even though the client already filters these.
  const blobUrls = urls.filter(
    (u) => typeof u === "string" && /\.public\.blob\.vercel-storage\.com\//.test(u)
  );

  const results = await Promise.allSettled(blobUrls.map((u) => del(u)));
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ ok: true, deleted: blobUrls.length - failed, failed });
}
