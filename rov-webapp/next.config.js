/** @type {import('next').NextConfig} */
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