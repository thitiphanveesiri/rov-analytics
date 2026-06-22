/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow the Fandom wiki image domain (used for hero image fallback lookups)
    remotePatterns: [
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
      { protocol: "https", hostname: "*.fandom.com" },
    ],
  },
};

module.exports = nextConfig;
