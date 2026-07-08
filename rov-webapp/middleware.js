export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except: login, register, NextAuth's own API routes,
  // the register API route, and Next.js static/internal assets.
  matcher: [
  "/((?!login|register|forgot-password|reset-password|api/auth|api/register|api/upload|api/admin|_next/static|_next/image|favicon.ico).*)"
],

};
