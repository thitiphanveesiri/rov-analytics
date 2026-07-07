// middleware.js
export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except: login, register, NextAuth's own API routes,
  // the register API route, PWA static assets, and Next.js static/internal assets.
  matcher: [
    "/((?!login|register|forgot-password|reset-password|api/auth|api/register|api/upload|api/admin|manifest\\.json|sw\\.js|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png|_next/static|_next/image|favicon\\.ico).*)",
  ],
};