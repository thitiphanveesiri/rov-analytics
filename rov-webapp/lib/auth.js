import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { checkRateLimit } from "./rateLimit";

// ── Timing side-channel fix ──
// bcrypt.compare() is deliberately slow (~50-150ms depending on cost
// factor). If we only run it when a matching user exists — `if (!user)
// return null` before ever touching bcrypt — a request for an email that
// doesn't exist returns almost instantly, while one for a real email
// takes noticeably longer. That timing gap alone lets someone enumerate
// which emails have accounts on this team without ever guessing a
// password. Fix: always run a bcrypt.compare with the same cost factor,
// even for a nonexistent user, against a fixed dummy hash — this hash's
// plaintext is unknown/irrelevant, it exists purely so the "user not
// found" path costs the same wall-clock time as "user found, wrong
// password". Real user's own password is still compared against their
// own real hash, so this changes nothing about actual auth correctness.
const DUMMY_HASH = "$2b$10$bwTWPenqmDatdPyzFyweZuXKdPSNBRLw3ycmkhw/pvtrgR5e985ha"; // bcrypt hash of an arbitrary unused string — never a real password's hash

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
          include: { team: { select: { name: true } } }
        });

        // ── always pay the bcrypt cost, whether or not `user` exists ──
        // see DUMMY_HASH comment above for why this matters.
        const valid = await bcrypt.compare(credentials.password, user?.password || DUMMY_HASH);
        if (!user || !valid) return null;

        return {
          id:         user.id,
          email:      user.email,
          name:       user.name,
          teamId:     user.teamId,
          teamName:   user.team?.name,
          // ── ไม่ใส่ inviteCode ที่นี่ ──
          // เดิมทุก user (ไม่ใช่แค่ admin) ได้ inviteCode ติดไปใน JWT/session ของตัวเอง — ใครก็เปิด
          // DevTools แล้วอ่าน useSession() ดู invite code ของทีมได้หมด ทั้งที่ควรเป็นความลับระดับ admin
          // AdminPanel ดึง inviteCode สดจาก GET /api/data แทน (route นั้น gate ด้วย role จริงทุก request
          // อยู่แล้ว — ดู app/api/data/route.js) จึงไม่ต้องพก secret นี้ไว้ใน token ของทุกคนเลย
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
        token.role       = user.role;
        token.roleCheckedAt = Date.now(); // ใช้คู่กับ periodic re-check ด้านล่าง
        token.playerName = user.playerName;
      }
      // เมื่อฝั่ง client เรียก useSession().update({ playerName }) เพื่ออัปเดตทันที
      // โดยไม่ต้อง login ใหม่
      if (trigger === "update" && session?.playerName !== undefined) {
        token.playerName = session.playerName;
      }

      // ── Periodic re-check ของ role/team จาก DB ──
      // session ใช้ JWT strategy (ไม่แตะ DB ทุก request) อายุ 30 วัน — ทุก endpoint ที่เขียนข้อมูล
      // (app/api/data, app/api/upload) เช็ค role/status/teamId สดจาก DB เองอยู่แล้วทุกครั้ง ดังนั้นการที่
      // token นี้ค้างค่าเก่าไม่ใช่ช่องโหว่ความปลอดภัย — แต่เป็นเรื่อง UX: คนที่เพิ่งถูกลด role จาก coach
      // เป็น member (หรือถูกเตะออกจากทีม) จะยังเห็นเมนู/ปุ่มตามสิทธิ์เดิมจนกว่าจะ login ใหม่ ซึ่งกดแล้ว
      // จะโดน server เงียบๆ เพิกเฉย (ผ่าน lib/permissions.js) — งงได้โดยไม่จำเป็น จึง sync ทุก ~5 นาที
      // แทนที่จะรอเต็ม 30 วัน โดยไม่ต้องแตะ DB ทุก request (เช็คด้วย roleCheckedAt ก่อน)
      const ROLE_RECHECK_MS = 5 * 60 * 1000;
      if (token.id && (!token.roleCheckedAt || Date.now() - token.roleCheckedAt > ROLE_RECHECK_MS)) {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id },
            select: { role: true, teamId: true, team: { select: { name: true } } },
          });
          if (fresh) {
            token.role     = fresh.role;
            token.teamId   = fresh.teamId;
            token.teamName = fresh.team?.name;
          } else {
            // บัญชีถูกลบไปแล้ว — เคลียร์ทีม/สิทธิ์ ไม่ต้องรอให้ server route อื่นมาปฏิเสธทีละครั้ง
            token.role = null; token.teamId = null; token.teamName = null;
          }
        } catch (err) {
          // ล้มเหลว (DB ชั่วคราว) ก็ยังใช้ token เดิมต่อไปได้ — ไม่ทำให้คน login ไม่ได้เพราะ DB สะดุดแป๊บเดียว
          console.error("jwt role re-check failed (non-fatal):", err);
        }
        token.roleCheckedAt = Date.now();
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
        session.user.role       = token.role;
        session.user.playerName = token.playerName;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
