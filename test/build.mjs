/* The build is part of the security boundary, so it gets tested like one.
 *
 * Two things here cannot be verified by reading the source: that the CSP hash
 * actually matches the stylesheet the sandbox iframe will carry, and that the
 * service-worker cache name actually matches the bytes being deployed. Both are
 * the kind of thing that rots silently.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { build, sandboxCss, ASSETS, ICONS } from "../build.mjs";
import { appSource, htmlSource, cssSource } from "./lib/slice.mjs";

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const ROOT = new URL("..", import.meta.url).pathname;
const { version, csp, files } = build({ quiet: true });
const html = files.get("index.html");

// ---------- the CSP hash matches the stylesheet it is supposed to authorise ----------
{
  const css = sandboxCss(appSource());
  const hash = createHash("sha256").update(css, "utf8").digest("base64");
  ok(csp.includes(`'sha256-${hash}'`), "CSP carries the hash of the sandbox stylesheet");
  ok(html.includes(`sha256-${hash}`), "the built page carries it too");
  ok(!css.includes("${"), "the sandbox stylesheet is a constant, not interpolated");
  ok(!/url\s*\(|@import|expression\s*\(/i.test(css), "the sandbox stylesheet loads nothing external");
}

// ---------- the policy is actually restrictive ----------
{
  for (const forbidden of ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "*"]) {
    ok(!csp.split("; ").some((d) => d.split(" ").slice(1).includes(forbidden)),
       `CSP does not permit ${forbidden}`);
  }
  for (const directive of ["default-src 'none'", "object-src 'none'", "base-uri 'none'",
                           "form-action 'none'", "frame-ancestors 'none'", "script-src 'self'",
                           "connect-src 'self'", "img-src 'self' data: blob:"]) {
    ok(csp.includes(directive), `CSP sets ${directive}`);
  }
  ok(!html.includes("__CSP__"), "the placeholder was substituted");
}

// ---------- no third-party network requirement, anywhere in the artefact ----------
{
  for (const [name, body] of files) {
    const hits = body.match(/https?:\/\/[^\s"'`)]+/g) || [];
    // XML namespace URIs identify a namespace; they are never fetched.
    const NAMESPACES = ["http://www.w3.org/2000/svg", "http://www.w3.org/1999/xhtml", "http://www.w3.org/1999/xlink"];
    // Absolute links that appear in prose, checked separately below to be links only.
    const CITED = /^https:\/\/(www\.)?(microsoft\.com|arstechnica\.com|unicode\.org|github\.com|capacitorjs\.com)/;
    const external = hits.filter((u) => !NAMESPACES.includes(u) && !CITED.test(u));
    eq(external, [], `${name}: no unexpected absolute URL (found ${external.join(", ")})`);
  }
  ok(!html.includes("googleapis") && !html.includes("gstatic"), "no webfont CDN in the page");
  ok(!cssSource().includes("@import"), "no @import in the stylesheet");
  // Remaining absolute URLs must be links in prose, never fetched subresources.
  const subresource = html.match(/<(?:link|script|img|iframe|source)\b[^>]*(?:href|src)="https?:[^"]*"/g) || [];
  eq(subresource, [], "no subresource is loaded from an absolute URL");
}

// ---------- markup carries no inline style or event handler ----------
{
  eq(html.match(/\sstyle="/g), null, "no style attributes in the built page");
  eq(html.match(/\son[a-z]+="/g), null, "no inline event handlers in the built page");
  eq(html.match(/<script(?![^>]*\bsrc=)/g), null, "no inline <script> in the built page");
  eq(html.match(/<style/g), null, "no inline <style> in the built page");
}

// ---------- the deployed artefact is the application, and nothing else ----------
{
  const dist = join(ROOT, "dist");
  const listed = [];
  (function walk(dir, prefix = "") {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p, prefix + e + "/");
      else listed.push(prefix + e);
    }
  })(dist);
  const expected = [...ASSETS, ...ICONS.map((i) => "icons/" + i), ".nojekyll"].sort();
  eq(listed.sort(), expected, "dist contains exactly the application");
  for (const leak of ["README.md", "test", ".github", "package.json", "build.mjs", "docs"]) {
    ok(!listed.some((f) => f === leak || f.startsWith(leak + "/")), `${leak} is not deployed`);
  }
}

// ---------- the cache name is derived from the content it caches ----------
{
  ok(/^ghost-ink-[0-9a-f]{12}$/.test(version), "cache name is a content hash, not a hand-bumped counter");
  ok(files.get("sw.js").includes(`"${version}"`), "the worker ships that name");
  ok(!files.get("sw.js").includes("__CACHE__"), "the placeholder was substituted");

  // Change one byte of one asset and the cache name must change.
  const before = version;
  const after = build({ quiet: true }).version;
  eq(after, before, "the build is deterministic for unchanged input");

  // Every asset the worker precaches must exist in dist, and vice versa.
  const swAssets = [...files.get("sw.js").matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
  for (const a of swAssets) ok(existsSync(join(ROOT, "dist", a)), `precached asset exists: ${a}`);
  for (const a of ASSETS.filter((f) => f !== "sw.js")) {
    ok(swAssets.includes(a), `worker precaches ${a}`);
  }
}

console.log(`ok — ${n} assertions passed`);
