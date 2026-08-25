"use client";
// components/shared/HelpPage.js
// ── New page: in-app user guide ──
// Accordion-style help content, written to match how this specific app
// actually works (not generic boilerplate) — covers onboarding basics for
// new players and feature-specific detail for coaches/admins. Lives
// inside the app (not a separate document) so it's one less thing that
// can silently go stale in a repo nobody remembers to update, and one
// less file for new members to have to go find.

import { useState } from "react";
import { C } from "@/lib/theme";

const SECTIONS = [
  {
    id: "start",
    icon: "🚀",
    title: "เริ่มต้นใช้งาน",
    body: (
      <>
        <p>เข้าทีมด้วย <b>invite code</b> จากโค้ช/แอดมิน — หลังกรอกโค้ดสำเร็จ บัญชีจะอยู่ในสถานะ <b>"รออนุมัติ"</b> ก่อน เห็นเมนู/ชื่อทีมได้ปกติ แต่ยังดูข้อมูลจริงของทีมไม่ได้จนกว่าแอดมินจะกดอนุมัติ (ดูได้ที่หน้า ⚙️ Admin)</p>
        <p>เมื่ออนุมัติแล้ว ไปที่ <b>👤 My Stats</b> เพื่อเลือกว่าตัวเองคือผู้เล่นคนไหนใน Roster — ต้องทำขั้นตอนนี้ก่อน ถึงจะเห็นสถิติส่วนตัวของตัวเองได้</p>
      </>
    ),
  },
  {
    id: "permissions",
    icon: "🔐",
    title: "สิทธิ์การใช้งาน — member / coach / admin",
    body: (
      <>
        <p><b>Member</b> (ผู้เล่นทั่วไป): ดูข้อมูลส่วนใหญ่ได้ แต่แก้ไขข้อมูลบางอย่างไม่ได้ (เช่น ตารางแข่ง, patch notes) และ <b>ไม่เห็นข้อมูล scout ประเภท "ซ้อม/scrim"</b> ของคู่แข่ง (เห็นเฉพาะที่มาจากแมตช์แข่งจริงที่เผยแพร่แล้ว) — ป้องกันข้อมูลรั่วไปถึงทีมที่ถูกสอดแนม</p>
        <p><b>Coach</b>: แก้ไขข้อมูลได้เกือบทั้งหมด รวมถึง Live Draft, scout log ทุกประเภท, ตารางแข่ง, patch notes, เปลี่ยนโลโก้ทีม/คู่แข่ง</p>
        <p><b>Admin</b>: ทำได้ทุกอย่างที่ coach ทำได้ บวกกับจัดการสมาชิก (อนุมัติ/ปฏิเสธ/เปลี่ยน role/ลบสมาชิก) ที่หน้า ⚙️ Admin</p>
      </>
    ),
  },
  {
    id: "patch",
    icon: "🗂️",
    title: "Patch Selector (มุมขวาบน) — สำคัญมาก",
    body: (
      <>
        <p>Dropdown เลือก patch ที่ header ด้านบน <b>มีผลกรองข้อมูลหลายหน้าพร้อมกัน</b>: Overview, Roster, Rivals, Scout, และ Match Log (ประวัติ) — เลือก patch ไหนไว้ หน้าพวกนี้จะโชว์เฉพาะข้อมูลของ patch นั้น</p>
        <p>การเพิ่ม patch ใหม่เข้าระบบ ทำที่หน้า <b>Patch Version Log</b> โดยระบุ "วันที่เริ่มมีผล" — ระบบจะเทียบวันที่แมตช์กับวันนี้เพื่อจัดหมวดหมู่อัตโนมัติ (ไม่ต้องไปแท็ก patch ทีละแมตช์เอง)</p>
        <p>เลือก <b>"ทั้งหมด (all-time)"</b> ถ้าอยากเห็นข้อมูลทุก patch รวมกัน</p>
      </>
    ),
  },
  {
    id: "overview",
    icon: "📊",
    title: "📊 Overview",
    body: (
      <>
        <p>ภาพรวมสถิติทีม (win rate, จำนวนเกม, ฮีโร่ที่ใช้บ่อย) ตาม patch ที่เลือกไว้</p>
        <p><b>สรุปผลรายสัปดาห์/รายเดือน</b>: เลื่อนดูย้อนหลังได้ และ "ฮีโร่ที่เล่นบ่อยสุด" ในกล่องนี้อ้างอิงเฉพาะเกมของสัปดาห์/เดือนนั้นจริง ๆ (ไม่ปนกับข้อมูลช่วงอื่น) — เกณฑ์ "ฮีโร่ที่ win rate สูงสุด" ต้องเล่นอย่างน้อยครึ่งหนึ่งของเกมทั้งหมดในช่วงนั้น ถึงจะนับ กันฮีโร่ที่เล่นแค่เกมเดียวแล้วชนะดันอันดับสูงลอย ๆ</p>
      </>
    ),
  },
  {
    id: "draft",
    icon: "⚔️",
    title: "⚔️ Live Draft (coach เท่านั้น)",
    body: (
      <>
        <p>ใช้ตอนแบน/เลือกฮีโร่สดระหว่างแข่ง/ซ้อม — จบ session แล้วกด "บันทึกแมตช์" ระบบจะเพิ่มเข้า Match Log ให้อัตโนมัติ</p>
        <p>การบันทึกใช้ระบบ autosave (ไม่ต้องกดปุ่ม save เอง) — ถ้าเห็นข้อความ "มีการแก้ไขจากที่อื่น" เป็นเรื่องปกติเวลาหลายคนใช้แอปพร้อมกัน ระบบจะพยายามรวมข้อมูลให้อัตโนมัติ ไม่ต้องกังวล</p>
      </>
    ),
  },
  {
    id: "matches",
    icon: "📋",
    title: "📋 Match Log (ประวัติ)",
    body: (
      <>
        <p>ดูประวัติแมตช์ทั้งหมด กรองได้ทั้งตามหมวด (ซ้อม/แข่ง) และตาม patch tag เฉพาะ (แยกจาก Patch Selector ที่ header — อันนี้เป็น tag manual ต่อแมตช์)</p>
        <p>กด "✏️ แก้ไขข้อมูลเกม" เพื่อแก้ hero/ผู้เล่นทั้งฝั่งเราและฝั่งคู่แข่งได้ (รวมถึงชื่อผู้เล่นคู่แข่งด้วย)</p>
        <p>Export CSV/PDF จะ export เฉพาะข้อมูลที่กรองด้วย Patch Selector อยู่ตอนนั้น</p>
      </>
    ),
  },
  {
    id: "rivals",
    icon: "🎯",
    title: "🎯 Rivals",
    body: (
      <>
        <p>รายชื่อทีมคู่แข่งทั้งหมด แต่ละทีมมีการ์ดโลโก้ของตัวเอง — coach เปลี่ยนโลโก้/ลบทีมได้จากปุ่มบนการ์ด</p>
        <p>คลิกเข้าไปในทีมจะเห็น 2 แท็บ: <b>History</b> (แมตช์ที่เจอกันจริง) กับ <b>Scout</b> (ข้อมูลสอดแนมที่บันทึกไว้ล่วงหน้า — member ทั่วไปเห็นเฉพาะ scout จากแมตช์แข่งจริง ไม่เห็น scrim)</p>
      </>
    ),
  },
  {
    id: "roster",
    icon: "👥",
    title: "👥 Roster",
    body: (
      <>
        <p>2 แท็บ: <b>ทีมเรา</b> กับ <b>คู่แข่ง</b> — แต่ละคนมีการ์ดรูปประจำตัว กดที่การ์ดผู้เล่นเพื่อดู Player Profile</p>
        <p>coach เพิ่ม/ลบ/แก้ไขชื่อ-รูปผู้เล่นได้จากปุ่มบนการ์ด — อัปโหลดรูปจะมีหน้าต่างให้ปรับตำแหน่ง/ซูมก่อนบันทึกเสมอ</p>
      </>
    ),
  },
  {
    id: "schedule",
    icon: "📅",
    title: "📅 ตารางแข่ง",
    body: (
      <>
        <p>coach เพิ่มนัดซ้อม/แข่งได้ — member ทั่วไปดูได้อย่างเดียว</p>
        <p>เชื่อมต่อ Google Calendar ส่วนตัวได้ (ปุ่มด้านบนหน้านี้) — เชื่อมแล้วนัดหมายทุกอันจะ sync เข้าปฏิทินของตัวเองอัตโนมัติทุกครั้งที่มีการเพิ่ม/แก้/ลบ ไม่ต้องเชื่อมใหม่ทุกครั้ง</p>
        <p>มีระบบแจ้งเตือนอัตโนมัติสำหรับนัดที่ใกล้ถึงภายใน 24 ชม. โผล่เป็น banner ในแอป (เปิด browser notification เพิ่มได้ถ้าอยากได้แจ้งเตือนแม้ไม่ได้เปิดแท็บอยู่)</p>
      </>
    ),
  },
  {
    id: "video",
    icon: "🎬",
    title: "🎬 Video",
    body: (
      <>
        <p>เพิ่มวิดีโอทีละคลิป หรือเชื่อม YouTube channel ตัวเองแล้วให้ระบบดึงคลิปใหม่เข้ามาอัตโนมัติทุก ~15 นาที (ตั้งคำขึ้นต้นชื่อคลิปที่ต้องการดึงได้ — รองรับ Unlisted ด้วย ไม่ใช่แค่ Public)</p>
        <p>เปิดคลิปแล้วกด "✏️ วาดอธิบายทับคลิป" เพื่อวาดเส้น/ลูกศรอธิบายสดได้ — มี <b>ยางลบ (⌫)</b> ลากทับเพื่อลบเฉพาะจุดที่วาดผิด โดยไม่ต้องล้างทั้งแผ่น (ปุ่ม "🧹 ลบทั้งหมด" ไว้ล้างรวดเดียวถ้าต้องการ)</p>
      </>
    ),
  },
  {
    id: "board",
    icon: "🗺️",
    title: "🗺️ Whiteboard",
    body: (
      <>
        <p>กระดานวางแผนแท็คติก มีเครื่องมือปากกา/ลูกศร/ข้อความ/วางฮีโร่ ในแถบซ้ายมือ</p>
        <p>กด <b>⌫ (Erase)</b> แล้วคลิกที่เส้น/ลูกศร/ข้อความ/ฮีโร่ที่วาดไว้ เพื่อลบชิ้นนั้นออกทีละชิ้น</p>
      </>
    ),
  },
  {
    id: "admin",
    icon: "⚙️",
    title: "⚙️ Admin (admin เท่านั้น)",
    body: (
      <>
        <p>อนุมัติ/ปฏิเสธสมาชิกใหม่ที่กรอก invite code เข้ามารออยู่ที่นี่ — เปลี่ยน role คนอื่นได้ (แต่ลด role ตัวเองจาก admin ไม่ได้ถ้าเป็น admin คนสุดท้ายของทีม กันทีมไม่มี admin เหลือ)</p>
        <p>ลบสมาชิก = เอาออกจากทีม ไม่ได้ลบ account ทิ้ง — คนนั้นกลับไปสถานะ "ยังไม่เข้าทีม" ถ้าอยากกลับมาต้องขอ invite code ใหม่</p>
      </>
    ),
  },
];

export function HelpPage() {
  const [openId, setOpenId] = useState("start");

  return (
    <div>
      <h2 style={{margin:"0 0 6px",fontSize:24,fontWeight:800}}>❓ คู่มือการใช้งาน</h2>
      <p style={{margin:"0 0 20px",color:C.textMuted,fontSize:13}}>
        กดที่หัวข้อเพื่อดูรายละเอียด — ถ้ายังหาคำตอบไม่เจอ ถามโค้ช/แอดมินของทีมได้เลย
      </p>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {SECTIONS.map(s => {
          const open = openId === s.id;
          return (
            <div key={s.id} style={{background:C.bgPanel,border:`1px solid ${C.border}`,
              borderRadius:12,overflow:"hidden"}}>
              <button onClick={()=>setOpenId(open ? null : s.id)}
                style={{width:"100%",background:"transparent",border:"none",color:C.textMain,
                  padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",
                  cursor:"pointer",fontSize:14,fontWeight:800,textAlign:"left"}}>
                <span>{s.icon} {s.title}</span>
                <span style={{color:C.textMuted,fontSize:12,fontWeight:400}}>{open ? "▲" : "▼"}</span>
              </button>
              {open && (
                <div style={{padding:"0 18px 16px",borderTop:`1px solid ${C.border}`,
                  fontSize:13,lineHeight:1.7,color:C.textMuted}}>
                  <div style={{marginTop:12}}>{s.body}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
