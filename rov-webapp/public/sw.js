// Minimal service worker — exists mainly so the app qualifies as an
// installable PWA (Chrome/Android require an active SW + manifest).
//
// Deliberately does NOT cache app pages/JS aggressively: this app updates
// often, and a caching SW is the #1 cause of "why am I seeing an old
// version after you said you fixed it" support tickets. Network-first,
// falling back to cache only when fully offline.
const CACHE_NAME = "rov-analytics-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
