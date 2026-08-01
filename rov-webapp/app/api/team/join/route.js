import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";

// ── POST /api/team/join ──
// For an already-logged-in user who currently has no team (removed by an
// admin, or somehow never completed joining one) to attach to a team via
// invite code — without going through /api/register again (that flow
// creates a brand-new account, which doesn't make sense for someone who
// already has one).
//
// Same approval gate as the register "join" flow: this sets status to
// "pending", not "active" — an admin still has to approve them, whether
// they're joining for the first time or rejoining after being removed.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "ไม่ได้ login" }, { status: 401 });

  // Light rate limit on invite-code guesses — codes are cuid()-based (high
  // entropy) so brute force isn't really practical, but cheap insurance.
  if (!(await checkRateLimit(`team-join:${session.user.email}`, 10, 300))) {
    return NextResponse.json({ error: "ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const inviteCode = body.inviteCode?.trim();
  if (!inviteCode) return NextResponse.json({ error: "กรุณากรอก Invite Code" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, teamId: true },
  });
  if (!user) return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });

  // ป้องกันสลับทีมเงียบๆ ผ่าน endpoint นี้ — ถ้ามีทีมอยู่แล้วต้องให้ admin
  // เอาออกจากทีมเดิมก่อน (ผ่าน DELETE /api/admin/members) ถึงจะย้ายได้
  if (user.teamId) {
    return NextResponse.json({ error: "บัญชีนี้อยู่ในทีมอยู่แล้ว" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { inviteCode } });
  if (!team) return NextResponse.json({ error: "Invite Code ไม่ถูกต้อง" }, { status: 404 });

  await prisma.user.update({
    where: { id: user.id },
    data: { teamId: team.id, role: "member", status: "pending" },
  });

  return NextResponse.json({
    ok: true,
    message: `เข้าร่วมทีม "${team.name}" สำเร็จ — กรุณารอ Admin อนุมัติก่อนเริ่มใช้งาน`,
    pending: true,
  });
}
