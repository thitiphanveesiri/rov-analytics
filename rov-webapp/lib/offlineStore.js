// lib/offlineStore.js
// IndexedDB key-value แบบเล็กที่สุด (ไม่พึ่ง library) — เก็บ snapshot ข้อมูลทีมสำหรับใช้ตอนไม่มีเน็ต
// ทำไม IndexedDB ไม่ใช่ localStorage: จุได้มากกว่า (localStorage ~5MB) และบน iOS ทนต่อการถูกล้างกว่า
// ทุกฟังก์ชัน best-effort — ถ้า IndexedDB ใช้ไม่ได้ (private mode ฯลฯ) จะ reject ให้ผู้เรียก catch เอง
const DB_NAME = "rov-offline";
const STORE = "kv";

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const idbGet = (key) => run("readonly", s => s.get(key));
export const idbSet = (key, value) => run("readwrite", s => s.put(value, key));
export const idbDel = (key) => run("readwrite", s => s.delete(key));
export const idbClear = () => run("readwrite", s => s.clear());
