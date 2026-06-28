import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Client-upload endpoint for player/hero photos.
// The browser talks to THIS route to get a short-lived upload token, then
// uploads the file straight to Vercel Blob — the file bytes never pass
// through /api/data (or this route's own body), so the 4.5MB Vercel function
// body limit never comes into play for images.
export async function POST(request) {
  // Same auth check as /api/data — without this, anyone could request an
  // upload token and write into your Blob store.
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });
  }

  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          addRandomSuffix: true,
          // matches the existing 1.5MB client-side check in PhotoPicker —
          // kept here too so the limit holds even if someone bypasses the UI
          maximumSizeInBytes: 1.5 * 1024 * 1024,
          tokenPayload: JSON.stringify({ uploadedBy: session.user.email }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Optional: log who uploaded what. Not persisting anything here —
        // the resulting blob.url gets saved into playerPhotos/heroPhotos
        // via the normal /api/data PUT, same as before.
        console.log("Blob upload completed:", blob.url, tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
