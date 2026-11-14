"use client";
// components/shared/HeatmapPage.js
// หน้า 🔥 Heatmap — เปิดไฟล์ tracks.json (จาก rov-tracker/track.py) ได้หลายไฟล์ แล้วเทียบ Heatmap ของ 2 ตัวเลือก
// (ฮีโร่หรือผู้เล่น) แยกตามช่วงเวลา 0–4 / 4–8 / 8–12 / 12+ นาที ; ทุกอย่างประมวลผลในเบราว์เซอร์ ไม่ส่งข้อมูลออกนอกเครื่อง
// ข้อมูลที่โหลดอยู่แค่ในหน้านี้ (ปิดหน้า/รีเฟรชแล้วหาย) — ยังไม่บันทึกลงฐานข้อมูลทีม

import { useEffect, useMemo, useRef, useState } from "react";
import { C } from "@/lib/theme";
import {
  PHASES, parseTracks, listChoices, collectPoints, buildDensity, densityToRGBA, collectPath,
} from "@/lib/trackHeatmap";

const GRID = 96;
const SIZE = 480;

function HeatCanvas({ bg, choiceId, sources, phase, showTrail, minConf }) {
  const ref = useRef(null);
  const data = useMemo(() => {
    const c = collectPoints(sources, choiceId, phase, minConf);
    return { ...c, grid: buildDensity(c.points, GRID, 0.03) };
  }, [sources, choiceId, phase, minConf]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, SIZE, SIZE);
    const draw = (img) => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      if (img) ctx.drawImage(img, 0, 0, SIZE, SIZE);
      else { ctx.fillStyle = "#101020"; ctx.fillRect(0, 0, SIZE, SIZE); }
      // กริดความหนาแน่น → ภาพเล็ก → ขยายแบบเรียบ (ได้ขอบนุ่ม ไม่ต้องคำนวณทุกพิกเซล)
      const tmp = document.createElement("canvas");
      tmp.width = tmp.height = GRID;
      tmp.getContext("2d").putImageData(new ImageData(densityToRGBA(data.grid), GRID, GRID), 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tmp, 0, 0, SIZE, SIZE);
      if (showTrail) {
        const path = collectPath(sources, choiceId, phase);
        if (path.length > 1) {
          ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1.5; ctx.beginPath();
          path.forEach(([x, y], i) => (i ? ctx.lineTo(x * SIZE, y * SIZE) : ctx.moveTo(x * SIZE, y * SIZE)));
          ctx.stroke();
        }
      }
    };
    if (bg) { const im = new Image(); im.onload = () => draw(im); im.src = bg; } else draw(null);
  }, [bg, data, showTrail, sources, choiceId, phase]);

  const pct = data.total ? Math.round((data.seen / data.total) * 100) : 0;
  return (
    <div style={{ flex: "1 1 320px", minWidth: 280 }}>
      <canvas ref={ref} width={SIZE} height={SIZE}
        style={{ width: "100%", maxWidth: SIZE, aspectRatio: "1", borderRadius: 10, border: `1px solid ${C.border}`, display: "block" }} />
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
        {data.total === 0
          ? "ไม่มีข้อมูลในช่วงนี้"
          : <>จุดข้อมูล {data.total.toLocaleString()} · เห็นจริง {pct}%{pct < 50 && <span style={{ color: C.lose }}> · ⚠️ ข้อมูลเห็นจริงน้อย ระวังตีความเกินจริง</span>}</>}
      </div>
    </div>
  );
}

export function HeatmapPage() {
  const [sources, setSources] = useState([]);     // [{...parsed, _name}]
  const [error, setError] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [phaseId, setPhaseId] = useState("all");
  const [trail, setTrail] = useState(false);
  const [onlySeen, setOnlySeen] = useState(true);
  const fileRef = useRef(null);

  const choices = useMemo(() => listChoices(sources), [sources]);
  const phase = PHASES.find(p => p.id === phaseId) || PHASES[0];
  const bg = sources.find(s => s.minimap)?.minimap || null;

  useEffect(() => {
    if (choices.length && !choices.some(c => c.id === a)) setA(choices[0].id);
    if (choices.length && !choices.some(c => c.id === b)) setB(choices[Math.min(1, choices.length - 1)].id);
  }, [choices]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onFiles(fileList) {
    setError("");
    const added = [];
    for (const f of fileList) {
      try {
        const parsed = parseTracks(await f.text());
        added.push({ ...parsed, _name: f.name });
      } catch (e) {
        setError(`${f.name}: ${e.message}`);
      }
    }
    if (added.length) setSources(prev => [...prev, ...added]);
    if (fileRef.current) fileRef.current.value = "";
  }

  const btn = { background: "transparent", border: `1px solid ${C.border}`, color: C.textMain, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 };
  const sel = { background: C.bgCard, border: `1px solid ${C.border}`, color: C.textMain, borderRadius: 8, padding: "6px 10px", fontSize: 12, minWidth: 140 };

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 4px", color: C.textMain }}>🔥 Heatmap ตำแหน่งฮีโร่</h2>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: C.textMuted }}>
        เปิดไฟล์ <code>tracks.json</code> ที่ได้จากเครื่องมือ <code>rov-tracker</code> (ใส่ได้หลายเกม ระบบจะรวมให้ตามฮีโร่/ผู้เล่นที่เลือก)
        · ข้อมูลประมวลผลในเบราว์เซอร์นี้เท่านั้น และจะหายเมื่อรีเฟรชหน้า
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={e => onFiles([...e.target.files])} />
        <button style={{ ...btn, background: C.primary, border: "none", color: "#fff" }} onClick={() => fileRef.current?.click()}>📂 เปิดไฟล์ tracks.json</button>
        {sources.length > 0 && <button style={btn} onClick={() => setSources([])}>ล้างทั้งหมด</button>}
        {sources.length > 0 && <span style={{ fontSize: 11, color: C.textMuted }}>โหลดแล้ว {sources.length} เกม: {sources.map(s => s._name).join(", ")}</span>}
      </div>
      {error && <div style={{ color: C.lose, fontSize: 12, marginBottom: 10 }}>⚠️ {error}</div>}

      {sources.length === 0 ? (
        <div style={{ textAlign: "center", padding: 50, background: C.bgPanel, borderRadius: 14, color: C.textMuted, fontSize: 13, lineHeight: 1.7 }}>
          ยังไม่มีข้อมูล — เปิดไฟล์ <b>tracks.json</b> ที่ได้จากการรัน <code>track.py</code> กับวิดีโอแมตช์<br />
          (วิธีใช้อยู่ในโฟลเดอร์ <code>rov-tracker/README.md</code>)
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            {PHASES.map(p => (
              <button key={p.id} onClick={() => setPhaseId(p.id)}
                style={{ ...btn, borderRadius: 99, border: `2px solid ${phaseId === p.id ? C.primary : C.border}`, background: phaseId === p.id ? C.primary + "30" : "transparent", color: phaseId === p.id ? C.primaryLight : C.textMuted }}>
                {p.label}
              </button>
            ))}
            <label style={{ fontSize: 12, color: C.textMuted, display: "flex", gap: 4, alignItems: "center", marginLeft: 8 }}>
              <input type="checkbox" checked={trail} onChange={e => setTrail(e.target.checked)} /> เส้นทางเดิน
            </label>
            <label style={{ fontSize: 12, color: C.textMuted, display: "flex", gap: 4, alignItems: "center" }}>
              <input type="checkbox" checked={onlySeen} onChange={e => setOnlySeen(e.target.checked)} /> เฉพาะจุดที่เห็นจริง (ไม่รวมที่ประมาณ)
            </label>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[[a, setA], [b, setB]].map(([val, set], i) => (
              <div key={i} style={{ flex: "1 1 320px", minWidth: 280 }}>
                <select value={val} onChange={e => set(e.target.value)} style={{ ...sel, marginBottom: 8, width: "100%" }}>
                  {choices.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <HeatCanvas bg={bg} choiceId={val} sources={sources} phase={phase} showTrail={trail} minConf={onlySeen ? 0.25 : 0} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
