/* Ghost Ink service worker — offline support for the installable app.
   Everything is same-origin and static; this just makes the exhibit work
   with no network. Bump CACHE when the asset list or index.html changes. */
const CACHE = "ghost-ink-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Leave cross-origin (e.g. Google Fonts) to the browser; CSS has system fallbacks.
  if (url.origin !== self.location.origin) return;

  // Network-first for page navigations so updates land when online; cache is the offline fallback.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Cache-first for static assets, filling the cache as they're fetched.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((resp) => {
        if (resp && resp.ok) { const cp = resp.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return resp;
      })
    )
  );
});
