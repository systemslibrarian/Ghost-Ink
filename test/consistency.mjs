/* Anti-drift.
 *
 * The failure this file exists to prevent has happened twice in this repository:
 * the README claimed "four panels" when there were nine, "three carriers" when
 * there were four, and a jsdom test suite that was never committed. Prose is not
 * checked by a compiler, so it is checked here.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { loadCodec, appSource, htmlSource, readmeSource } from "./lib/slice.mjs";

const M = loadCodec();
const app = appSource(), html = htmlSource(), readme = readmeSource();
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const ROOT = new URL("..", import.meta.url).pathname;

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// ---------- the README may only describe tests that exist and actually run ----------
{
  const script = pkg.scripts["test:unit"] + " " + pkg.scripts["test:e2e"];
  const unitFiles = readdirSync(new URL("../test", import.meta.url))
    .filter((f) => f.endsWith(".mjs") && !["serve.mjs"].includes(f));
  for (const f of unitFiles) {
    ok(script.includes(`test/${f}`), `test/${f} exists but npm test never runs it`);
  }
  const e2eFiles = readdirSync(new URL("../e2e", import.meta.url)).filter((f) => f.endsWith(".spec.js"));
  ok(e2eFiles.length >= 4, "the browser suite has at least four spec files");
  ok(pkg.scripts["test:e2e"].includes("playwright"), "test:e2e runs playwright");

  // Every path the README names must exist.
  for (const m of readme.matchAll(/`((?:test|e2e|docs|\.github)\/[A-Za-z0-9._/-]+)`/g)) {
    ok(existsSync(new URL("../" + m[1], import.meta.url)), `README references ${m[1]}, which does not exist`);
  }
  for (const m of readme.matchAll(/\]\((docs\/[A-Za-z0-9._-]+|[A-Z-]+\.md)\)/g)) {
    ok(existsSync(new URL("../" + m[1], import.meta.url)), `README links ${m[1]}, which does not exist`);
  }
  // The specific stale claim that started this file.
  ok(!/jsdom/i.test(readme) || existsSync(new URL("../test/jsdom.mjs", import.meta.url)),
     "the README mentions jsdom but no jsdom suite is committed");
}

// ---------- counts are derived, never typed twice ----------
{
  const carriers = Object.keys(M.CARRIERS);
  eq(carriers.length, 4, "four carriers are implemented");
  // The README states the count in words; it must match the code.
  const WORDS = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six" };
  const claimed = readme.match(/\b(one|two|three|four|five|six) carriers?\b/gi) || [];
  for (const c of claimed) {
    ok(c.toLowerCase().startsWith(WORDS[carriers.length]),
       `README says "${c}" but ${carriers.length} carriers are implemented`);
  }
  // Every carrier must have a radio in the UI, and vice versa.
  const radios = [...html.matchAll(/name="carrier" value="([a-z]+)"/g)].map((m) => m[1]);
  eq(radios.sort(), carriers.sort(), "the carrier picker offers exactly the implemented carriers");

  // Panel counts: the README must not claim a number the markup contradicts.
  const cards = (html.match(/<div class="card[^"]*"/g) || []).length;
  ok(cards >= 12, `expected the exhibit to have grown past twelve cards, found ${cards}`);
  const panelClaims = readme.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen) panels?\b/gi) || [];
  for (const claim of panelClaims) {
    const word = claim.split(" ")[0].toLowerCase();
    const value = Object.entries(WORDS).find(([, w]) => w === word);
    if (value) ok(Number(value[0]) <= cards, `README claims "${claim}" but only ${cards} cards exist`);
  }
}

// ---------- the taxonomy covers everything, and points at things that exist ----------
{
  const src = app;
  const techIds = [...src.matchAll(/\{id:"([a-z]+)", layer:"([a-z]+)"/g)].map((m) => ({ id: m[1], layer: m[2] }));
  ok(techIds.length >= 10, "the taxonomy describes at least ten techniques");
  const layerBlock = src.slice(src.indexOf("const LAYERS = ["), src.indexOf("const DETECTORS"));
  const layerIds = [...layerBlock.matchAll(/\{id:"([a-z]+)"/g)].map((m) => m[1]);
  ok(layerIds.length >= 6, "at least six layers are defined");
  for (const t of techIds) {
    ok(layerIds.includes(t.layer), `technique ${t.id} sits in unknown layer ${t.layer}`);
  }
  // every anchor the matrix links to must be an id in the page
  for (const m of src.matchAll(/anchor:"#([A-Za-z0-9-]+)"/g)) {
    ok(html.includes(`id="${m[1]}"`), `taxonomy anchors #${m[1]}, which is not an id in index.html`);
  }
  // every card tagged with a technique must name one the taxonomy defines
  for (const m of html.matchAll(/data-technique="([^"]+)"/g)) {
    for (const id of m[1].split(/\s+/)) {
      ok(techIds.some((t) => t.id === id), `card claims technique "${id}", which the taxonomy does not define`);
    }
  }
  // and every technique must be demonstrated by some card
  const tagged = new Set([...html.matchAll(/data-technique="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  for (const t of techIds) {
    ok(tagged.has(t.id), `technique "${t.id}" is in the taxonomy but no card demonstrates it`);
  }
}

// ---------- the page wires up cleanly ----------
{
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  eq(dupes, [], "no duplicate element ids");
  const used = new Set([...app.matchAll(/\$\("([^"]+)"\)/g)].map((m) => m[1]));
  for (const id of used) ok(ids.includes(id), `app.js addresses #${id}, which is not in index.html`);
}

// ---------- no stale factual claims ----------
{
  const all = readme + html + app;
  ok(!/2\.37[^.]{0,40}(Feb(ruary)?\.? 11)/i.test(all), "the 2.37M peak must not be attributed to 11 February");
  ok(!/(Feb(ruary)?\.? 11)[^.]{0,40}2\.37/i.test(all), "11 February must not be labelled the 2.37M peak");
  ok(!/2\.5\s*(million|M)\b/i.test(all), "the unsourced 2.5 million figure must not reappear");
  ok(/26 February 2026|Feb 26|26&nbsp;February&nbsp;2026/.test(all), "the real peak date is stated somewhere");
  // the primary source must be cited wherever telemetry is
  ok(html.includes("microsoft.com/en-us/security/blog/2026/09/03/"), "the Microsoft primary source is linked");
  ok(readme.includes("microsoft.com/en-us/security/blog/2026/09/03/"), "the README cites the primary source");
  // the confusable subset must never be described as the standard itself
  ok(!/implements UTS ?#?39|full UTS ?#?39 (table|implementation)(?! )/i.test(readme + html.replace(/not the full UTS[^<]*/g, "")),
     "the confusable subset must not be described as an implementation of UTS #39");
  for (const doc of ["docs/KNOWN-GAPS.md", "docs/THREAT-MODEL.md"]) {
    ok(readFileSync(ROOT + doc, "utf8").includes("subset"), `${doc} records the confusable-subset limitation`);
  }
}

// ---------- the reference docs exist and are linked ----------
{
  for (const f of ["docs/THREAT-MODEL.md", "docs/REFERENCES.md", "docs/KNOWN-GAPS.md",
                   "docs/CONTAINER.md", "SECURITY.md"]) {
    ok(existsSync(ROOT + f), `${f} exists`);
    ok(readme.includes(f), `README links ${f}`);
  }
}

// ---------- the worker caches exactly the assets the build ships ----------
{
  const sw = readFileSync(ROOT + "sw.js", "utf8");
  ok(sw.includes("__CACHE__"), "the worker's cache name is injected by the build, not hand-maintained");
  ok(!/ghost-ink-v\d/.test(sw), "no hand-bumped version counter remains");
  for (const asset of ["index.html", "app.css", "app.js", "manifest.webmanifest"]) {
    ok(sw.includes(`"./${asset}"`), `the worker precaches ${asset}`);
  }
}

// ---------- no third-party dependency crept back in ----------
{
  ok(!/fonts\.googleapis|fonts\.gstatic/.test(html + readme), "no webfont CDN reference");
  ok(html.includes("__CSP__"), "index.html carries the CSP placeholder for the build to fill");
}

console.log(`ok — ${n} assertions passed`);
