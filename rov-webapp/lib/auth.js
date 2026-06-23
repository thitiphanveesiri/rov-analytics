import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
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
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages:   { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id         = user.id;
        token.email      = user.email;
        token.name       = user.name;
        token.teamId     = user.teamId;
        token.teamName   = user.teamName;
        token.inviteCode = user.inviteCode;
        token.role       = user.role;
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
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
