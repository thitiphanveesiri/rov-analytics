import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { team: { include: { members: { select: { id:true, name:true, email:true, role:true } } } } }
  });

  if (!user?.team) return NextResponse.json({ error: "ยังไม่ได้เข้าทีม" }, { status: 403 });

  return NextResponse.json({
    teamId:     user.team.id,
    teamName:   user.team.name,
    inviteCode: user.team.inviteCode,
    role:       user.role,
    members:    user.team.members,
  });
}
