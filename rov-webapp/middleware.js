export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except: login, register, NextAuth's own API routes,
  // the register API route, Next.js static/internal assets, and the PWA
  // static files (manifest/service-worker/icons — these load unauthenticated
  // on every page visit; without this exclusion they get redirected to
  // /login and the browser gets HTML back where it expected JSON, causing
  // "Manifest: Line 1 column 1 Syntax error").
  matcher: [
  "/((?!login|register|forgot-password|reset-password|api/auth|api/register|api/upload|api/admin|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|apple-touch-icon.png).*)"
],

};
