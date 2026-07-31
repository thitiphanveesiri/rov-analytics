import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { checkRateLimit } from "./rateLimit";

// ดึง client IP จาก request ที่ NextAuth ส่งเข้า authorize() —
// เขียนแบบ defensive เพราะรูปแบบของ req.headers ต่างกันได้ระหว่าง
// runtime context (บางที เป็น plain object, บางที เป็น Headers instance
// ที่มี .get()) แล้วแต่ว่า NextAuth ห่อ request มายังไงใน App Router
function getClientIp(req) {
  const headers = req?.headers;
  if (!headers) return "unknown";
  const raw = typeof headers.get === "function"
    ? headers.get("x-forwarded-for")
    : headers["x-forwarded-for"];
  return raw?.split(",")[0]?.trim() || "unknown";
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const ip = getClientIp(req);

        // ── Rate limit ป้องกัน brute force ──
        // - ต่อ IP: กันคนยิงสุ่มหลายบัญชีจากเครื่องเดียว (credential stuffing)
        // - ต่อบัญชี: กันคนเจาะรหัสบัญชีใดบัญชีหนึ่งโดยเฉพาะ ต่อให้สลับ IP ไปเรื่อยๆ
        // เช็คคู่กันทั้ง 2 แบบ ไม่ใช่แค่แบบเดียว เพราะป้องกันคนละรูปแบบการโจมตี
        const [ipOk, emailOk] = await Promise.all([
          checkRateLimit(`login:ip:${ip}`, 20, 300),      // 20 ครั้ง / 5 นาที ต่อ IP
          checkRateLimit(`login:email:${email}`, 8, 300), // 8 ครั้ง / 5 นาที ต่อบัญชี
        ]);
        if (!ipOk || !emailOk) {
          // NextAuth จะจับ Error ที่ throw ใน authorize() แล้วส่งกลับเป็น
          // error code ให้ฝั่ง client — ถ้าหน้า login ยังไม่ได้โชว์ข้อความนี้
          // ตรงๆ (เช่นโชว์แค่ "เข้าสู่ระบบไม่สำเร็จ" แบบรวมๆ) บอกได้ เดี๋ยวช่วยดู
          // หน้า login ให้ด้วย
          throw new Error("พยายาม login บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่");
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { team: { select: { name: true, inviteCode: true } } }
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        return {
          id:         user.id,
          email:      user.email,
          name:       user.name,
          teamId:     user.teamId,
          teamName:   user.team?.name,
          inviteCode: user.team?.inviteCode,
          role:       user.role,
          playerName: user.playerName,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages:   { signIn: "/login" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id         = user.id;
        token.email      = user.email;
        token.name       = user.name;
        token.teamId     = user.teamId;
        token.teamName   = user.teamName;
        token.inviteCode = user.inviteCode;
        token.role       = user.role;
        token.playerName = user.playerName;
      }
      // เมื่อฝั่ง client เรียก useSession().update({ playerName }) เพื่ออัปเดตทันที
      // โดยไม่ต้อง login ใหม่
      if (trigger === "update" && session?.playerName !== undefined) {
        token.playerName = session.playerName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id         = token.id;
        session.user.email      = token.email;
        session.user.name       = token.name;
        session.user.teamId     = token.teamId;
        session.user.teamName   = token.teamName;
        session.user.inviteCode = token.inviteCode;
        session.user.role       = token.role;
        session.user.playerName = token.playerName;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
