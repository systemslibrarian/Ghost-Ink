/* Ghost Ink service worker — offline support for the installable app.
 *
 * The cache name is injected by build.mjs from a hash of the asset contents, so
 * it cannot be forgotten when a file changes: any edit to index.html, app.css,
 * app.js or the manifest produces a different cache and a clean activation.
 * test/build.mjs asserts that the deployed name matches the deployed bytes.
 */
const CACHE = "__CACHE__";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
  // Ghost Ink has no third-party dependency; anything cross-origin is not ours.
  if (url.origin !== self.location.origin) return;

  // Network-first for navigations and for the app's own code, so a deploy lands
  // as soon as the user is online rather than waiting for a cache to expire.
  const codePath = /\/(index\.html|app\.js|app\.css|manifest\.webmanifest)$/.test(url.pathname);
  if (req.mode === "navigate" || codePath) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
          return r;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")).then((r) => r || caches.match("./")))
    );
    return;
  }

  // Cache-first for immutable assets (icons), filling the cache as they're fetched.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((resp) => {
        if (resp && resp.ok) { const cp = resp.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return resp;
      })
    )
  );
});
