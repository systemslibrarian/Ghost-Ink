// Carrier tests. Unlike roundtrip.mjs — which is a deliberately independent
// re-implementation — this one slices the page's OWN pure codec section out of
// index.html and exercises it, so the three carriers (Tags, variation selectors,
// zero-width) are checked as shipped. No DOM is needed: the sliced region is pure.
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const start = script.indexOf("const TAG_BASE");
const end = script.indexOf("/* =========================================================\n     HERO");
assert.ok(start > 0 && end > start, "could not slice the codec section");
const body = script.slice(start, end);

const document = { getElementById: () => null };
const fn = new Function("crypto", "document", body + `
  return {CARRIERS, extractPayload, packPlain, packEnc, unpack, peek, weave, toTags,
          tagsToAscii, bytesToB64, b64ToBytes, classify, isTag};`);
const M = fn(webcrypto, document);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// --- every carrier round-trips arbitrary bytes ---
for (const key of Object.keys(M.CARRIERS)) {
  const C = M.CARRIERS[key];
  for (const secret of ["meet at the north gate, 9pm", "emoji 🎯 ✓", "$5M / 60% — a+b", "x"]) {
    const bytes = M.packPlain(secret);
    const payload = C.encode(bytes);
    eq([...C.decode(payload)], [...bytes], `${key}: byte round trip`);
    eq((await M.unpack(C.decode(payload), null)).text, secret, `${key}: text round trip`);
    // cost() must match what encode() actually produces
    eq(C.cost(bytes.length), [...payload].length, `${key}: cost() != actual length`);
    // every produced character must be invisible, and classified as this carrier's category
    ok([...payload].every(ch => M.classify(ch.codePointAt(0)) === C.cat), `${key}: produced a character the detector misses`);
  }
}

// --- carriers survive weaving, in both placements ---
const cover = "Thanks for the update — talk soon.";
for (const key of Object.keys(M.CARRIERS)) {
  for (const mode of ["append", "scatter"]) {
    const stego = M.weave(cover, M.CARRIERS[key].encode(M.packPlain("payload " + key)), mode);
    const found = M.extractPayload(stego);
    eq(found.carrier, key, `${key}/${mode}: extractPayload picked the wrong carrier`);
    eq((await M.unpack(found.bytes, null)).text, "payload " + key, `${key}/${mode}: decode after weave`);
    // visible text must be untouched
    eq([...stego].filter(ch => !M.classify(ch.codePointAt(0))).join(""), cover, `${key}/${mode}: visible text changed`);
  }
}

// --- encrypted payloads work on every carrier ---
for (const key of Object.keys(M.CARRIERS)) {
  const bytes = await M.packEnc("classified", "correct horse");
  const stego = M.weave(cover, M.CARRIERS[key].encode(bytes), "scatter");
  const found = M.extractPayload(stego);
  ok(M.peek(found.bytes).encrypted, `${key}: peek missed the encryption flag`);
  eq((await M.unpack(found.bytes, "correct horse")).text, "classified", `${key}: encrypted round trip`);
  await assert.rejects(() => M.unpack(found.bytes, "wrong"), `${key}: wrong passphrase must throw`); n++;
}

// --- negative cases ---
eq(M.extractPayload("nothing hidden here at all"), null, "clean text must report nothing");
{
  // invisible characters that are not a Ghost Ink container
  const junk = cover + "​‌‍";
  const f = M.extractPayload(junk);
  ok(f && f.count === 3 && f.bytes === null, "junk invisibles must be reported but not decoded");
}
{
  // VS block boundaries: byte 0, 15, 16 and 255 must all round-trip
  const edge = new Uint8Array([0, 15, 16, 255]);
  eq([...M.CARRIERS.vs.decode(M.CARRIERS.vs.encode(edge))], [...edge], "vs: block-boundary bytes");
}

console.log(`ok — ${n} assertions passed`);
