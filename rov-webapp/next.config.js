/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
      { protocol: "https", hostname: "*.fandom.com" },
    ],
  },
  // NOTE: removed the old `experimental.serverActions.bodySizeLimit` +
  // the custom `headers()` block that forced Content-Type: application/json
  // on every /api/* response — that header override was breaking
  // next-auth's credentials callback (it doesn't always return plain JSON,
  // e.g. redirects/Set-Cookie responses), causing login to fail with a
  // JSON.parse error in production.
  //
  // Body size isn't a concern anymore either: photo uploads now go
  // straight to Vercel Blob (see app/api/upload/route.js) instead of
  // through API routes as base64, so no route here needs a raised limit.
};

module.exports = nextConfig;