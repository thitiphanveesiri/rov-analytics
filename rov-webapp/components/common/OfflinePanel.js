"use client";
import { useEffect, useState } from "react";
import { C } from "@/lib/theme";
import { getSnapshotInfo } from "@/lib/storage";
import { isStandalone, isStoragePersisted } from "@/lib/pwa";

// แผงตรวจความพร้อมใช้งานออฟไลน์ (โชว์ในเมนู ☰) — ใช้ก่อนเข้าห้องแข่งที่ปิดเน็ต
// ตรวจ: ติดตั้งเป็นแอปแล้วไหม (iPad ต้องติดตั้ง ไม่งั้น Safari ลบข้อมูลที่ไม่เปิดเกิน ~7 วัน), เก็บถาวรได้ไหม,
// snapshot ล่าสุดเมื่อไหร่ (กี่แมตช์/scout) และมีงานค้างที่ยังไม่ส่งไหม
function isIOSLike() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function Row({ ok, label, hint }) {
  return (
    <div style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:12,margin:"4px 0"}}>
      <span style={{flexShrink:0}}>{ok === true ? "✅" : ok === false ? "⚠️" : "•"}</span>
      <div><span style={{color:C.textMain}}>{label}</span>
        {hint && <div style={{color:ok === false ? "#fdcb6e" : C.textMuted,fontSize:11}}>{hint}</div>}</div>
    </div>
  );
}

export function OfflinePanel({ app, isOnline, prep, onPrepare }) {
  const [standalone, setStandalone] = useState(null);
  const [persisted, setPersisted] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setStandalone(isStandalone());
    isStoragePersisted().then(setPersisted);
  }, [prep?.running, tick]);
  useEffect(() => { const t = setInterval(() => setTick(v => v + 1), 15000); return () => clearInterval(t); }, []);

  const snap = getSnapshotInfo();
  const ios = isIOSLike();
  const when = snap.savedAt ? new Date(snap.savedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : null;

  return (
    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
      <div style={{fontWeight:800,fontSize:13,color:C.primaryLight,marginBottom:6}}>📴 พร้อมใช้งานออฟไลน์ (ห้องแข่งไม่มีเน็ต)</div>
      <Row ok={isOnline} label={isOnline ? "ออนไลน์อยู่" : "ตอนนี้ออฟไลน์"} />
      <Row ok={standalone === null ? undefined : (standalone || !ios)} label={standalone ? "เปิดเป็นแอปที่ติดตั้งแล้ว" : "ยังไม่ได้ติดตั้งเป็นแอป"}
        hint={!standalone && ios ? "iPad: กดปุ่มแชร์ → Add to Home Screen แล้วเปิดจากไอคอนนั้น (ไม่งั้น Safari อาจลบข้อมูลออฟไลน์เอง)" : undefined} />
      <Row ok={persisted === null ? undefined : persisted} label={persisted ? "เครื่องรับปากเก็บข้อมูลถาวร" : "ยังไม่ได้ขอ/ไม่ได้รับสิทธิ์เก็บถาวร"}
        hint={persisted === false ? "ติดตั้งเป็นแอปแล้วเปิดใหม่ มักจะได้สิทธิ์นี้" : undefined} />
      <Row ok={snap.savedAt ? true : false}
        label={snap.savedAt ? `ข้อมูลในเครื่องล่าสุด ${when} (${app.matches?.length || 0} แมตช์, ${app.scoutMatches?.length || 0} scout)` : "ยังไม่มีข้อมูลในเครื่อง"}
        hint={snap.savedAt ? undefined : "กด “เตรียมออฟไลน์” ตอนมีเน็ต"} />
      {snap.unsynced && <Row ok={false} label="มีการแก้ไขที่ยังไม่ส่งขึ้นระบบ" hint="จะส่งอัตโนมัติเมื่อมีเน็ต — อย่าออกจากระบบก่อน" />}
      <button disabled={!isOnline || prep?.running} onClick={onPrepare}
        style={{marginTop:8,background:C.primary,border:"none",color:"#fff",borderRadius:8,padding:"10px 16px",
          fontWeight:700,fontSize:13,minHeight:44,cursor:(!isOnline||prep?.running)?"not-allowed":"pointer",opacity:(!isOnline||prep?.running)?0.5:1}}>
        {prep?.running ? "กำลังเตรียม..." : "เตรียมออฟไลน์"}
      </button>
      {prep?.msg && <div style={{marginTop:6,fontSize:11,color:C.textMuted}}>{prep.msg}</div>}
    </div>
  );
}
