import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { isActiveUser } from "@/lib/permissions";

// Client-upload endpoint for player/hero/logo photos.
// The browser talks to THIS route to get a short-lived upload token, then
// uploads the file straight to Vercel Blob — the file bytes never pass
// through /api/data (or this route's own body), so the 4.5MB Vercel function
// body limit never comes into play for images.
//
// ── ทำไมเช็คสิทธิ์ใน onBeforeGenerateToken ไม่ใช่บนสุดของ route ──
// handleUpload รับ request 2 แบบ: (1) "blob.generate-client-token" จากเบราว์เซอร์ผู้ใช้ (มี cookie)
// และ (2) "blob.upload-completed" ที่ server ของ Vercel ยิงกลับมาเอง (ไม่มี cookie/session เลย)
// ถ้าเช็ค session บนสุดของ route แบบเดิม request แบบที่ 2 จะโดน 401 ตลอด (callback ไม่เคยทำงาน)
// handleUpload ตรวจลายเซ็นของ callback แบบที่ 2 เองอยู่แล้ว เราจึงเช็ค session เฉพาะตอนออก token
export async function POST(request) {
  try {
    const body = await request.json();

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await getServerSession(authOptions);
        const email = session?.user?.email;
        if (!email) throw new Error("unauthorized");

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, teamId: true, role: true, status: true },
        });
        // ต้องอยู่ในทีม + ผ่านการอนุมัติ — คนที่ pending/ถูกเตะออกห้ามใช้พื้นที่ Blob ของเรา
        if (!user?.teamId || !isActiveUser(user)) throw new Error("forbidden");
        // ตอนนี้ member ที่ active อัปโหลดได้ เพราะหน้า Hero Images/Video ยังเปิดให้ member ใช้ (heroPhotos ไม่อยู่ใน
        // COACH_ONLY_FIELDS) — ถ้าทีมตัดสินใจให้รูปทั้งหมดเป็นงานของ coach ให้เปิดบรรทัดนี้พร้อมเพิ่ม heroPhotos
        // ใน COACH_ONLY_FIELDS (lib/permissions.js):
        // if (!isCoachOrAdmin(user.role)) throw new Error("forbidden");

        // กันยิงขอ token รัว (เปลืองโควตา/ค่าใช้จ่าย Blob) — รูปที่ผ่าน crop มาทีละรูป 20 รูป/10 นาที เหลือเฟือ
        const ok = await checkRateLimit(`upload:${user.id}`, 20, 600);
        if (!ok) throw new Error("rate_limited");

        // ชื่อไฟล์จาก client เชื่อไม่ได้ (path traversal / นามสกุลแปลก) — บังคับรูปแบบง่ายๆ
        if (!/^[\w.\-]{1,80}\.(jpe?g|png|webp|gif)$/i.test(pathname)) throw new Error("bad_filename");

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          addRandomSuffix: true,
          // matches the existing 1.5MB client-side check in PhotoPicker/LogoUploader —
          // kept here too so the limit holds even if someone bypasses the UI
          maximumSizeInBytes: 1.5 * 1024 * 1024,
          tokenPayload: JSON.stringify({ teamId: user.teamId, userId: user.id }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // บันทึกว่าไฟล์นี้เป็นของทีมไหน — ใช้ตรวจสิทธิ์ตอนลบรูป (deleteBlobUrls) และเก็บกวาดไฟล์ที่ไม่ถูกอ้างอิง
        // Model `BlobAsset` อยู่ใน schema.prisma แล้ว (รอบนี้) แต่ยังต้องรัน migration ก่อนถึงจะมีตารางจริง —
        // ใช้ `?.` กันพังถ้า deploy โค้ดนี้ก่อน migrate เสร็จ (ดู Process.md) แถวนี้คือสิ่งที่
        // app/api/upload/delete/route.js ใช้ตรวจว่า URL เป็นของทีมไหนตอนลบ
        try {
          const { teamId, userId } = JSON.parse(tokenPayload || "{}");
          await prisma.blobAsset?.create({ data: { url: blob.url, teamId, uploadedById: userId } });
        } catch (err) {
          console.error("blobAsset record failed (non-fatal):", err);
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    // ไม่คืน error.message ดิบให้ client (อาจมีรายละเอียดภายใน) — log ไว้ฝั่ง server แทน
    console.error("upload route error:", error?.message || error);
    return NextResponse.json({ error: "ไม่สามารถอัปโหลดได้" }, { status: 400 });
  }
}
