"use client";
import { useRef, useState } from "react";
import { C } from "@/lib/theme";
import { buildStatsFromMapping, mergeStats } from "@/lib/scoreboardMatch";
import { readScoreboards, detectKind, summaryThumbBoxes } from "@/lib/scoreboardOcr";

// ═══════════════════════════════════════════
//  อ่านสกอร์จากภาพสรุปผลแมตช์ → เติม K/D/A/Gold/Dmg/DmgTaken อัตโนมัติ  (ฟรี: Tesseract.js รันในเบราว์เซอร์ ไม่เรียก API/ไม่มี key)
//  ใส่ภาพได้ 1–2 รูป: หน้า "สรุป" (K/D/A, ทอง, สกอร์) และ/หรือหน้า "ข้อมูล" (ดาเมจที่ทำ/รับ)
//  แถวในภาพ → slot: อ่านชื่อฮีโร่จากภาพไม่ได้ (ตัวหนังสือซ้อนบนรูป) และลำดับในภาพมักไม่ตรงกับลำดับ slot ในเว็บ
//  จึงแสดงภาพย่อของแต่ละแถว + ช่องให้เลือก slot เอง (ค่าเริ่มต้น = ตามลำดับ) — ไม่เขียนทับเองโดยไม่ให้ผู้ใช้ยืนยัน
// ═══════════════════════════════════════════

async function fileToBitmap(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { width: d.width, height: d.height, data: d.data, _bmp: bmp };
}

// ภาพย่อของแต่ละแถว (รูปโปรไฟล์ฮีโร่) จากหน้าสรุป → dataURL[team][row]
function makeThumbs(bm) {
  const out = [[], []];
  summaryThumbBoxes(bm).forEach((rows, t) => rows.forEach(([x0, y0, x1, y1]) => {
    const c = document.createElement("canvas"); c.width = 120; c.height = 60;
    c.getContext("2d").drawImage(bm._bmp, x0, y0, x1 - x0, y1 - y0, 0, 0, 120, 60);
    out[t].push(c.toDataURL("image/jpeg", 0.8));
  }));
  return out;
}

// ตัวอ่านตัวเลข: Tesseract worker ตัวเดียว (โหลดครั้งแรกประมาณ 2–10 MB แล้วแคชไว้ในเบราว์เซอร์)
async function createRecognizer() {
  const { createWorker } = await import("tesseract.js");
  // โหลดทุกอย่างจาก /tesseract (คัดลอกโดย scripts/copy-tesseract-assets.mjs) — CSP ไม่อนุญาต CDN ภายนอก
  // workerBlobURL:false = ไม่สร้าง worker จาก blob: (CSP ไม่มี worker-src blob:) ให้โหลดไฟล์จากโดเมนเราตรงๆ
  const worker = await createWorker("eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract",
    langPath: "/tesseract/lang",
    workerBlobURL: false,
    gzip: true,
  });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let cur = "";
  return {
    async recognize(img, { whitelist }) {
      if (cur !== whitelist) {
        await worker.setParameters({ tessedit_char_whitelist: whitelist, tessedit_pageseg_mode: "7" });
        cur = whitelist;
      }
      canvas.width = img.w; canvas.height = img.h;
      const id = ctx.createImageData(img.w, img.h);
      for (let i = 0; i < img.g.length; i++) {
        const v = img.g[i];
        id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
      const { data } = await worker.recognize(canvas);
      return data.text || "";
    },
    terminate: () => worker.terminate(),
  };
}

export default function ScoreboardImport({ ourPicks, enemyPicks, gameStats, onChangeStats }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState(null);
  const [side, setSide] = useState("first");   // ทีมเราคือทีมซ้าย(สีน้ำเงิน) — ค่ามาตรฐานของ RoV
  const [kindSel, setKindSel] = useState("auto");   // ชนิดภาพ: auto = ให้ระบบเดาจากตำแหน่งแถบหัวตาราง
  const [thumbs, setThumbs] = useState(null);   // [team][row] → dataURL (เฉพาะเมื่อมีภาพหน้าสรุป)
  const [mapFirst, setMapFirst] = useState([0, 1, 2, 3, 4]);    // แถวในภาพ (ทีมซ้าย) → slot
  const [mapSecond, setMapSecond] = useState([0, 1, 2, 3, 4]);  // แถวในภาพ (ทีมขวา) → slot

  async function handleFiles(fileList) {
    const files = [...(fileList || [])].filter(f => /^image\/(jpeg|png|webp)$/.test(f.type)).slice(0, 2);
    if (!files.length) { setError("รองรับเฉพาะไฟล์ JPG / PNG / WebP (เลือกได้สูงสุด 2 ภาพ)"); return; }
    setError(""); setParsed(null); setThumbs(null); setProgress(0); setBusy(true);
    setMapFirst([0, 1, 2, 3, 4]); setMapSecond([0, 1, 2, 3, 4]);
    let rec;
    try {
      const images = [];
      for (const f of files) images.push({ bitmap: await fileToBitmap(f), kind: kindSel });
      rec = await createRecognizer();
      const total = files.length * 10; let done = 0;
      const result = await readScoreboards(images, rec.recognize, () => setProgress(Math.min(1, ++done / total)));
      const sm = images.find(im => (im.kind !== "auto" ? im.kind : detectKind(im.bitmap)) === "summary");
      setThumbs(sm ? makeThumbs(sm.bitmap) : null);
      setParsed(result);
    } catch (e) {
      console.error(e);
      setError("อ่านภาพไม่สำเร็จ — ลองภาพต้นฉบับที่ไม่ถูกบีบอัด หรือกรอกเอง");
    } finally {
      try { await rec?.terminate(); } catch {}
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const preview = parsed
    ? buildStatsFromMapping(parsed, side === "first", mapFirst, mapSecond)
    : null;
  const warnings = preview ? [...parsed.warnings, ...preview.duplicates] : [];
  const mappedCount = (m, n) => m.slice(0, n).filter(x => x >= 0).length;

  function apply() {
    onChangeStats(mergeStats(gameStats, preview.gameStats));
    setParsed(null);
  }

  const btn = { background: "transparent", border: `1px solid ${C.border}`, color: C.textMain,
    borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700 };

  return (
    <div style={{ padding: "10px 12px", background: "#0f0c22", borderBottom: `1px solid ${C.border}` }}
      onPaste={e => { const fs = [...(e.clipboardData?.files || [])].filter(x => x.type.startsWith("image/")); if (fs.length) { e.preventDefault(); handleFiles(fs); } }}
      tabIndex={0}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
          onChange={e => handleFiles(e.target.files)} />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
          style={{ ...btn, background: C.primary, border: "none", color: "#fff", opacity: busy ? 0.6 : 1 }}>
          {busy ? `⏳ กำลังอ่านภาพ… ${Math.round(progress * 100)}%` : "📸 อ่านสกอร์จากภาพ"}
        </button>
        <select value={kindSel} onChange={e => setKindSel(e.target.value)} disabled={busy} title="ใช้เมื่อระบบเดาชนิดภาพผิด"
          style={{ background: C.bgCard, border: `1px solid ${C.border}`, color: C.textMain, borderRadius: 6, padding: "4px 6px", fontSize: 11 }}>
          <option value="auto">ชนิดภาพ: อัตโนมัติ</option>
          <option value="summary">หน้าสรุป (K/D/A, ทอง)</option>
          <option value="damage">หน้าข้อมูล (ดาเมจ)</option>
        </select>
        <span style={{ fontSize: 10, color: C.textMuted }}>
          เลือก 1–2 ภาพ (หน้าสรุป + หน้าข้อมูล) หรือคลิกตรงนี้แล้ววาง (Ctrl+V) · ใช้ภาพต้นฉบับ ไม่ผ่านการบีบอัด
        </span>
      </div>

      {error && <div style={{ marginTop: 8, fontSize: 11, color: C.lose }}>⚠️ {error}</div>}

      {preview && (
        <div style={{ marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.primaryLight, marginBottom: 6 }}>
            อ่านได้: {parsed.teams[0].rows.length} + {parsed.teams[1].rows.length} แถว
            <span style={{ fontWeight: 600, color: C.textMuted }}> ({parsed.kinds.map(k => k === "summary" ? "หน้าสรุป" : "หน้าข้อมูล").join(" + ")})</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 11, color: C.textMuted }}>
            ทีมเราในภาพคือ
            <select value={side} onChange={e => setSide(e.target.value)}
              style={{ background: C.bgCard, border: `1px solid ${C.border}`, color: C.textMain, borderRadius: 6, padding: "3px 6px", fontSize: 11 }}>
              <option value="first">ทีมซ้าย / สีน้ำเงิน</option>
              <option value="second">ทีมขวา / สีแดง</option>
            </select>
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
            ℹ️ อ่านชื่อฮีโร่จากภาพไม่ได้ — ดูภาพย่อของแต่ละแถว แล้วเลือก slot ให้ตรงกับฮีโร่ตัวนั้น (ค่าเริ่มต้น = ตามลำดับบน→ล่าง)
          </div>
          {[0, 1].map(t => (
            <TeamRows key={t} title={`${t === 0 ? "ทีมซ้าย" : "ทีมขวา"} · ${(t === 0) === (side === "first") ? "ทีมเรา" : "คู่แข่ง"}`}
              rows={parsed.teams[t].rows} thumbs={thumbs?.[t]}
              map={t === 0 ? mapFirst : mapSecond} setMap={t === 0 ? setMapFirst : setMapSecond}
              picks={(t === 0) === (side === "first") ? ourPicks : enemyPicks} />
          ))}
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 11, color: C.lose, marginBottom: 2 }}>⚠️ {w}</div>
          ))}
          <div style={{ fontSize: 10, color: C.textMuted, margin: "6px 0" }}>
            ตัวตรวจในระบบมีแค่คิลรวม = สกอร์ทีม (และดาเมจเทียบ %) — K/D/A/ทอง แถวที่ไม่มี ⚠️ ก็ควรกวาดตาเทียบภาพก่อนบันทึก
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={apply} style={{ ...btn, background: C.win, border: "none", color: "#000" }}>
              ✅ เติมลงตาราง ({mappedCount(mapFirst, parsed.teams[0].rows.length) + mappedCount(mapSecond, parsed.teams[1].rows.length)} แถว)
            </button>
            <button type="button" onClick={() => setParsed(null)} style={btn}>ยกเลิก</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamRows({ title, rows, thumbs, map, setMap, picks }) {
  const slotLabel = (p, i) => `${i + 1}. ${p?.hero?.name || "—"}${p?.player ? ` (${p.player})` : ""}`;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.textMain, marginBottom: 4 }}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", borderTop: i ? `1px solid ${C.border}` : "none", flexWrap: "wrap" }}>
          {thumbs?.[i]
            ? <img src={thumbs[i]} alt={`แถว ${i + 1}`} style={{ width: 96, height: 48, borderRadius: 4, objectFit: "cover" }} />
            : <span style={{ width: 96, fontSize: 10, color: C.textMuted }}>แถว {i + 1}</span>}
          <span style={{ fontSize: 11, color: C.textMain, minWidth: 190 }}>
            {r.kills ?? "?"}/{r.deaths ?? "?"}/{r.assists ?? "?"} · ทอง {r.gold ?? "?"}
            {r.damage != null && <> · Dmg {r.damage}</>}
            {(r._flag || r.unread) && <span style={{ color: C.lose }}> ⚠️</span>}
          </span>
          <select value={map[i] ?? -1}
            onChange={e => setMap(m => m.map((v, j) => (j === i ? Number(e.target.value) : v)))}
            style={{ background: C.bgCard, border: `1px solid ${C.border}`, color: C.textMain, borderRadius: 6, padding: "3px 6px", fontSize: 11 }}>
            {[0, 1, 2, 3, 4].map(k => <option key={k} value={k}>{slotLabel(picks?.[k], k)}</option>)}
            <option value={-1}>ข้ามแถวนี้</option>
          </select>
        </div>
      ))}
    </div>
  );
}
