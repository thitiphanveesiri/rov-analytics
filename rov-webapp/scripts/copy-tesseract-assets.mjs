// scripts/copy-tesseract-assets.mjs
// คัดลอกไฟล์ที่ Tesseract.js ต้องใช้ (worker + แกน WASM + ข้อมูลภาษา eng) ลง public/tesseract/ ให้เว็บโหลดจากโดเมนตัวเอง
// เหตุผล: CSP ของแอป (next.config.js) อนุญาตโหลดสคริปต์/เชื่อมต่อได้เฉพาะ 'self' — ค่าเริ่มต้นของ Tesseract.js
// ไปโหลดจาก CDN ภายนอก จึงถูกบล็อก ; ที่นี่ไม่ throw เมื่อยังไม่ได้ติดตั้ง เพื่อไม่ให้ `npm install` พัง
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const NM = path.resolve("node_modules");
const OUT = path.resolve("public/tesseract");
const warn = (m) => console.warn(`[tesseract-assets] ${m}`);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, acc) : acc.push(p);
  }
  return acc;
}

if (!fs.existsSync(path.join(NM, "tesseract.js"))) {
  warn("ยังไม่ได้ติดตั้ง tesseract.js — ข้าม (รัน `npm install tesseract.js` แล้วรันสคริปต์นี้ใหม่)");
  process.exit(0);
}

fs.mkdirSync(path.join(OUT, "lang"), { recursive: true });
let ok = true;

// 1) worker
const worker = path.join(NM, "tesseract.js", "dist", "worker.min.js");
if (fs.existsSync(worker)) fs.copyFileSync(worker, path.join(OUT, "worker.min.js"));
else { warn("ไม่พบ tesseract.js/dist/worker.min.js"); ok = false; }

// 2) แกน WASM (ทุกตัวแปร: simd / lstm / ปกติ — Tesseract.js เลือกตามเบราว์เซอร์เอง)
const coreFiles = walk(path.join(NM, "tesseract.js-core")).filter(p => /tesseract-core.*\.(js|wasm)$/.test(path.basename(p)) && !p.includes(`${path.sep}node_modules${path.sep}tesseract.js-core${path.sep}node_modules`));
if (coreFiles.length) coreFiles.forEach(p => fs.copyFileSync(p, path.join(OUT, path.basename(p))));
else { warn("ไม่พบไฟล์ tesseract.js-core"); ok = false; }

// 3) ข้อมูลภาษา eng (ใช้อ่านตัวเลขอย่างเดียว รุ่นเล็ก/fast พอ) — ถ้าไม่มีแพ็กเกจ @tesseract.js-data/eng ต้องวางไฟล์เอง
const dataPkg = path.join(NM, "@tesseract.js-data", "eng");
const cands = walk(dataPkg).filter(p => /eng\.traineddata(\.gz)?$/.test(p));
const pick = cands.find(p => p.includes("fast")) || cands.find(p => p.includes("4.0.0")) || cands[0];
if (pick) {
  const dest = path.join(OUT, "lang", "eng.traineddata.gz");
  if (pick.endsWith(".gz")) fs.copyFileSync(pick, dest);
  else fs.writeFileSync(dest, zlib.gzipSync(fs.readFileSync(pick)));
} else {
  warn("ไม่พบ eng.traineddata — รัน `npm install @tesseract.js-data/eng` หรือวางไฟล์ eng.traineddata.gz ไว้ที่ public/tesseract/lang/");
  ok = false;
}

console.log(ok ? "[tesseract-assets] พร้อมใช้ → public/tesseract/" : "[tesseract-assets] คัดลอกไม่ครบ — ดูคำเตือนด้านบน");
