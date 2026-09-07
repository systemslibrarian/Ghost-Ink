/* Assembles dist/ — the only thing that gets deployed.
 *
 * Two things are computed here rather than maintained by hand, because both are
 * the kind of thing that silently rots:
 *
 *   1. The CSP hash for the sandbox stylesheet. The scraper panel renders inside
 *      a srcdoc iframe, which inherits this document's policy, so the constant
 *      stylesheet it carries needs its sha256 in style-src.
 *   2. The service-worker cache name, derived from the hash of the assets it
 *      caches. A content change therefore cannot ship with a stale cache key.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL(".", import.meta.url).pathname;
const OUT = join(ROOT, "dist");

// Everything the deployed application consists of. Nothing else is published.
export const ASSETS = ["index.html", "app.css", "app.js", "sw.js", "manifest.webmanifest"];
export const ICONS = ["icon.svg", "icon-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon.png"];

const sha256b64 = (s) => createHash("sha256").update(s, "utf8").digest("base64");

export function sandboxCss(appJs) {
  const m = appJs.match(/SANDBOX_CSS_START[\s\S]*?const SANDBOX_CSS = `([\s\S]*?)`;/);
  if (!m) throw new Error("build: could not find SANDBOX_CSS between its markers in app.js");
  if (m[1].includes("${")) throw new Error("build: SANDBOX_CSS must be a constant, not an interpolated template");
  return m[1];
}

export function cspFor(styleHash) {
  return [
    "default-src 'none'",
    "script-src 'self'",
    `style-src 'self' 'sha256-${styleHash}'`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-src 'self'",
    "child-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function cacheName(files) {
  const h = createHash("sha256");
  for (const [name, body] of files) h.update(name).update("\0").update(body);
  return "ghost-ink-" + h.digest("hex").slice(0, 12);
}

export function build({ quiet = false } = {}) {
  const read = (f) => readFileSync(join(ROOT, f), "utf8");
  const appJs = read("app.js");
  const csp = cspFor(sha256b64(sandboxCss(appJs)));

  let html = read("index.html");
  if (!html.includes("__CSP__")) throw new Error("build: index.html has no __CSP__ placeholder");
  html = html.replace("__CSP__", csp);

  const contents = new Map([
    ["index.html", html],
    ["app.css", read("app.css")],
    ["app.js", appJs],
    ["manifest.webmanifest", read("manifest.webmanifest")],
  ]);
  const version = cacheName([...contents]);

  let sw = read("sw.js");
  if (!sw.includes("__CACHE__")) throw new Error("build: sw.js has no __CACHE__ placeholder");
  contents.set("sw.js", sw.replace("__CACHE__", version));

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  for (const [name, body] of contents) writeFileSync(join(OUT, name), body);
  cpSync(join(ROOT, "icons"), join(OUT, "icons"), { recursive: true });
  writeFileSync(join(OUT, ".nojekyll"), "");

  if (!quiet) console.log(`built dist/ — cache ${version}, ${contents.size} files + icons`);
  return { version, csp, files: contents };
}

// Run only when this file is the entry point. Comparing basenames would also
// fire when test/build.mjs is the entry point, which silently re-ran the build.
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) build();
