/** @type {import('next').NextConfig} */

// ── Content-Security-Policy ──
// สร้างจากรายชื่อโดเมน/บริการที่แอปนี้ใช้จริง (ต่างจากไฟล์เดิมที่ comment บอกว่าเคยลองแล้วพัง — รอบนี้
// จงใจ "ไม่" ตั้ง default-src ให้เข้มจนบล็อก inline style, เพราะทั้งแอปใช้ style={{...}} ของ React
// (React render เป็น attribute `style="..."` บน DOM element จริง) เป็นพันจุด การบล็อก inline style จะทำให้
// ทั้งแอปไม่มีสไตล์ทันที — ต้อง 'unsafe-inline' ใน style-src ไปก่อนจนกว่าจะย้ายไป CSS module/Tailwind จริงจัง
// เช่นเดียวกับ script-src: Next.js ฝัง JSON hydration data ไว้ใน <script id="__NEXT_DATA__"> แบบ inline —
// ต้องมี 'unsafe-inline' ด้วย ไม่งั้นแอปจะ hydrate ไม่ติด (หน้าขาว) ตั้ง CSP ให้ "เข้มขึ้นกว่าไม่มีเลย" แต่ไม่ใช่
// strict CSP แบบเต็มรูปแบบ (ที่ต้องใช้ nonce ต่อ request ซึ่งเป็นงานแยกอีกก้อนถ้าอยากทำต่อ)
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://static.wikia.nocookie.net https://*.fandom.com https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  // เว็บ embed ที่ components/shared/VideoLibrary.js อนุญาตให้ฝังเป็น iframe (ดู EMBED_HOST_ALLOWLIST
  // ในไฟล์นั้น) — บังคับซ้ำที่ระดับ browser ด้วย เผื่อ allowlist ฝั่ง JS ถูกข้ามผ่านช่องโหว่อื่นในอนาคต
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://drive.google.com https://player.vimeo.com https://player.twitch.tv https://clips.twitch.tv https://streamable.com",
  "connect-src 'self'",
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
