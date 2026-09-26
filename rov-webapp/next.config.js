/** @type {import('next').NextConfig} */

// ── Content-Security-Policy ──
// สร้างจากรายชื่อโดเมน/บริการที่แอปนี้ใช้จริง (ต่างจากไฟล์เดิมที่ comment บอกว่าเคยลองแล้วพัง — รอบนี้
// จงใจ "ไม่" ตั้ง default-src ให้เข้มจนบล็อก inline style, เพราะทั้งแอปใช้ style={{...}} ของ React
// (React render เป็น attribute `style="..."` บน DOM element จริง) เป็นพันจุด การบล็อก inline style จะทำให้
// ทั้งแอปไม่มีสไตล์ทันที — ต้อง 'unsafe-inline' ใน style-src ไปก่อนจนกว่าจะย้ายไป CSS module/Tailwind จริงจัง
// เช่นเดียวกับ script-src: Next.js ฝัง JSON hydration data ไว้ใน <script id="__NEXT_DATA__"> แบบ inline —
// ต้องมี 'unsafe-inline' ด้วย ไม่งั้นแอปจะ hydrate ไม่ติด (หน้าขาว) ตั้ง CSP ให้ "เข้มขึ้นกว่าไม่มีเลย" แต่ไม่ใช่
// strict CSP แบบเต็มรูปแบบ (ที่ต้องใช้ nonce ต่อ request ซึ่งเป็นงานแยกอีกก้อนถ้าอยากทำต่อ)
//
// ⚠️ ROUND 2 FIX (หลัง deploy จริงแล้วเจอบั๊ก): CSP รอบแรกมีรูโหว่ที่ทำให้ "อัปโหลดรูปพังทั้งหมด"
// (เลือกไฟล์แล้วขึ้นกรอบดำ ค้างตลอด ไม่มี error ให้เห็น) สาเหตุคือ 2 จุด:
//   1) img-src ไม่มี blob: — พรีวิวรูปก่อนอัปโหลด (ImageCropModal ใช้ URL.createObjectURL(file)) โหลดไม่ขึ้น
//   2) connect-src มีแค่ 'self' — @vercel/blob/client ที่ใช้อัปโหลดจริง หลังขอ token จาก /api/upload
//      (same-origin) แล้ว จะ PUT ไฟล์ตรงไปที่ https://vercel.com/api/blob (โดเมนคงที่ในตัว SDK เอง
//      ไม่ใช่ *.public.blob.vercel-storage.com ที่ใช้แค่ตอน "อ่าน" ไฟล์ที่อัปโหลดเสร็จแล้ว) ถูก CSP
//      บล็อกเงียบๆ ตั้งแต่ก่อนส่ง request เลย ทำให้ upload() ค้างไม่ resolve/reject ตลอดไป
// แก้แล้วทั้ง 2 จุดด้านล่าง พร้อมเพิ่ม media-src ป้องกันบั๊กแบบเดียวกันสำหรับวิดีโอไฟล์แนบในเครื่อง
// (VideoLibrary.js type:"file" ก็ใช้ blob: เหมือนกัน) ไว้ล่วงหน้า แม้ยังไม่มีรายงานว่าพังก็ตาม
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://static.wikia.nocookie.net https://*.fandom.com https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  // VideoLibrary.js รองรับแนบไฟล์วิดีโอในเครื่อง (type:"file") ซึ่งเล่นผ่าน <video src="blob:..."> —
  // ต้องมี media-src ครอบ blob: ไว้เอง ไม่งั้นตกไปใช้ default-src ('self' เฉยๆ ไม่มี blob:) แล้วเจอ
  // ปัญหาแบบเดียวกับรูปโปรไฟล์ (จอดำ เล่นไม่ขึ้น ไม่มี error ให้เห็นชัดเจน)
  "media-src 'self' blob:",
  // เว็บ embed ที่ components/shared/VideoLibrary.js อนุญาตให้ฝังเป็น iframe (ดู EMBED_HOST_ALLOWLIST
  // ในไฟล์นั้น) — บังคับซ้ำที่ระดับ browser ด้วย เผื่อ allowlist ฝั่ง JS ถูกข้ามผ่านช่องโหว่อื่นในอนาคต
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://drive.google.com https://player.vimeo.com https://player.twitch.tv https://clips.twitch.tv https://streamable.com",
  // ── connect-src: ทำไมต้องมี https://vercel.com ──
  // (แก้ไขจากรอบก่อน ที่มีแค่ 'self' — ทำให้อัปโหลดรูปพังทุกครั้ง ดู commit message/Process.md)
  // การอัปโหลดรูปในแอปนี้ใช้ @vercel/blob/client แบบ "client upload": เบราว์เซอร์เรียก /api/upload
  // (same-origin, 'self' ครอบอยู่แล้ว) เพื่อขอ token ก่อน แต่การ PUT ไฟล์จริงหลังจากนั้น เบราว์เซอร์ยิง
  // ตรงไปที่ endpoint ของ Vercel Blob เอง — endpoint นี้เป็นโดเมนคงที่ https://vercel.com/api/blob
  // (ฝังไว้ใน SDK เป็น defaultVercelBlobApiUrl) ไม่ใช่ *.public.blob.vercel-storage.com ตามที่อาจเข้าใจผิด
  // ได้ง่าย (โดเมนนั้นใช้แค่ตอน "อ่าน" ไฟล์ที่อัปโหลดเสร็จแล้ว เช่นใน <img>/next-image ผ่าน img-src ด้านบน
  // — คนละ directive กับที่ควบคุมการ "เขียน"/PUT ซึ่งคือ connect-src นี้) ถ้าไม่มีโดเมนนี้ Chrome จะ block
  // การ PUT เงียบๆ ตั้งแต่ก่อนส่ง (ไม่มี network request ให้เห็นด้วยซ้ำ) แล้ว upload() promise จะค้าง
  // ไม่ resolve ไม่ reject เลย — หน้า crop modal ที่รอผลจึงค้างเป็นกรอบดำเปล่าๆ ตามที่เจอ
  "connect-src 'self' https://vercel.com",
  "frame-ancestors 'none'", // ไม่ให้เว็บอื่นฝังแอปนี้เป็น iframe (กัน clickjacking) — เทียบเท่า X-Frame-Options: DENY
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

async function securityHeaders() {
  // เฉพาะ production เท่านั้น — dev server ของ Next.js (React Refresh, source maps) มักต้องการ
  // exception เพิ่มที่ต่างจาก prod build และเราไม่มีทางเทสต์ CSP กับ dev server จริงในบทสนทนานี้
  if (process.env.NODE_ENV !== "production") return [];
  return [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
      ],
    },
  ];
}

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
      { protocol: "https", hostname: "*.fandom.com" },
      // Vercel Blob storage — team logos, player/hero photos, rival logos
      // all get uploaded here (see app/api/upload/route.js). Wildcard
      // because Blob assigns a random subdomain per store, not one fixed
      // hostname.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  headers: securityHeaders,
  // NOTE: removed the old `experimental.serverActions.bodySizeLimit` +
  // the custom `headers()` block that forced Content-Type: application/json
  // on every /api/* response — that header override was breaking
  // next-auth's credentials callback (it doesn't always return plain JSON,
  // e.g. redirects/Set-Cookie responses), causing login to fail with a
  // JSON.parse error in production. The `headers()` added back above only
  // sets security headers (CSP/X-Frame-Options/etc) — it never touches
  // Content-Type, so it doesn't reintroduce that bug.
  //
  // Body size isn't a concern anymore either: photo uploads now go
  // straight to Vercel Blob (see app/api/upload/route.js) instead of
  // through API routes as base64, so no route here needs a raised limit.
  // /api/data's own JSON body IS capped, but that's enforced in the route
  // handler itself (see MAX_BODY_BYTES in app/api/data/route.js), not here.
};

module.exports = nextConfig;
