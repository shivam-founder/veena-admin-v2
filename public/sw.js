// Veena Admin PWA — simple offline shell
const CACHE = "veena-admin-v1";
const SHELL = [
  "/style.css",
  "/app.js",
  "/manifest.json",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for pages/API, cache fallback for shell assets
self.addEventListener("fetch", (e) => {
  const url = e.request.url;

  // API calls — hamesha network (offline me fail gracefully)
  if (url.includes("/api/")) return;

  // Static assets — cache first, network fallback
  if (SHELL.some((s) => url.includes(s)) || url.includes("/icon-")) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, clone));
        return res;
      }).catch(() => cached))
    );
  }
});
