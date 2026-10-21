// lib/pwa.js — client-only helpers สำหรับใช้งานแบบ offline (service worker, ติดตั้งเป็นแอป, cache รูป)
export const IMG_CACHE = "rov-img-v1"; // ต้องตรงกับ public/sw.js

// ลงทะเบียน service worker (เฉพาะ production — dev จะ cache ไฟล์ HMR จนงง) + ผูก manifest/apple icon
// ถ้า app/layout.js ยังไม่มี <link rel="manifest"> ให้เติมที่นี่ (iOS อ่านตอนกด Add to Home Screen)
export function setupPwa() {
  if (typeof window === "undefined") return;
  try {
    const head = document.head;
    if (!head.querySelector('link[rel="manifest"]')) {
      const l = document.createElement("link"); l.rel = "manifest"; l.href = "/manifest.webmanifest"; head.appendChild(l);
    }
    if (!head.querySelector('link[rel="apple-touch-icon"]')) {
      const l = document.createElement("link"); l.rel = "apple-touch-icon"; l.href = "/icon-192.png"; head.appendChild(l);
    }
    if (!head.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const m = document.createElement("meta"); m.name = "apple-mobile-web-app-capable"; m.content = "yes"; head.appendChild(m);
    }
  } catch {}
  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(err => console.warn("SW register failed (non-fatal):", err));
  }
  // iOS ลบข้อมูลเว็บที่ไม่ได้เปิดนานได้ — ขอเก็บถาวร (PWA ที่ติดตั้งแล้วมักได้)
  try { navigator.storage?.persist?.(); } catch {}
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches === true;
}

export async function isStoragePersisted() {
  try { return (await navigator.storage?.persisted?.()) === true; } catch { return false; }
}

// ดึงรูปไปเก็บใน Cache ที่ SW อ่าน — รูป cross-origin (Vercel Blob) ใช้ no-cors (ได้ opaque response ซึ่ง <img> ใช้ได้)
export async function precacheImages(urls, onProgress) {
  if (typeof caches === "undefined") return { ok: 0, failed: urls.length };
  const cache = await caches.open(IMG_CACHE);
  let ok = 0, failed = 0, done = 0;
  const queue = [...new Set(urls.filter(Boolean))];
  const total = queue.length;
  async function worker() {
    while (queue.length) {
      const url = queue.shift();
      try {
        const sameOrigin = new URL(url, location.href).origin === location.origin;
        const res = await fetch(url, sameOrigin ? {} : { mode: "no-cors" });
        if (res.ok || res.type === "opaque") { await cache.put(url, res); ok++; } else failed++;
      } catch { failed++; }
      onProgress?.(++done, total);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]); // 4 ขนาน
  return { ok, failed };
}

// เก็บ HTML ของหน้าปัจจุบันลง cache ที่ SW ใช้เป็น fallback ตอน offline (ตรงกับ public/sw.js)
export async function precachePageShell() {
  try {
    if (typeof caches === "undefined") return false;
    const res = await fetch(location.href, { cache: "reload", credentials: "same-origin" });
    if (!res.ok || res.type !== "basic") return false;
    const cache = await caches.open("rov-shell-v1");
    await cache.put(location.href, res.clone());
    await cache.put("/__last_nav__", res.clone());
    return true;
  } catch { return false; }
}
