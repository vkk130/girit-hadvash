// Service worker מינימלי: מאפשר התקנה כאפליקציה ועובד גם כשהרשת חלשה.
// קודם רשת (כדי שעדכונים יופיעו מיד), ואם אין רשת — מהמטמון.
const CACHE = "gerit-v1";
const CORE = ["./", "index.html", "style.css", "script.js", "facts.js", "trivia.js", "assets/badger.svg", "assets/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Firebase וגוגל — ישירות לרשת
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))),
  );
});
