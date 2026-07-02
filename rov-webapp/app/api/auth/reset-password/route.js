// app/api/auth/reset-password/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    }

    // หา user จาก token
    const user = await prisma.user.findUnique({ where: { resetToken: token } });

    if (!user || !user.resetTokenExpiry) {
      return NextResponse.json({ error: "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 });
    }

    if (new Date() > user.resetTokenExpiry) {
      // ลบ token เก่าทิ้ง
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: null, resetTokenExpiry: null },
      });
      return NextResponse.json({ error: "ลิงก์หมดอายุแล้ว กรุณาขอใหม่" }, { status: 400 });
    }

    // อัพเดต password และลบ token ทิ้ง
    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    });

    return NextResponse.json({ ok: true, message: "รีเซ็ตรหัสผ่านสำเร็จ" });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
