/* Carrier tests. Unlike roundtrip.mjs — which is a deliberately independent
 * re-implementation — this suite exercises the page's OWN codec, sliced out of
 * app.js by test/lib/slice.mjs, so all four carriers (Unicode Tags, variation
 * selectors, zero-width, trailing whitespace) are checked exactly as shipped.
 */
import assert from "node:assert/strict";
import { loadCodec } from "./lib/slice.mjs";

const M = loadCodec();

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
    // Every produced character must be one the inspector accounts for. The
    // Unicode carriers are caught per-codepoint by classify(); SNOW's plain
    // spaces are not, by design — those are caught positionally instead.
    ok([...payload].every(ch => M.classify(ch.codePointAt(0)) === C.cat || (C.appendOnly && ch === " ")),
       `${key}: produced a character the detector cannot account for`);
  }
}

// --- carriers survive weaving, in both placements ---
const cover = "Thanks for the update — talk soon.";
for (const key of Object.keys(M.CARRIERS)) {
  // an appendOnly carrier lives in the trailing whitespace; scattering it would
  // both destroy the payload and be plainly visible, so the page forbids it
  const modes = M.CARRIERS[key].appendOnly ? ["append"] : ["append", "scatter"];
  for (const mode of modes) {
    const stego = M.weave(cover, M.CARRIERS[key].encode(M.packPlain("payload " + key)), mode);
    const found = M.extractPayload(stego);
    eq(found.carrier, key, `${key}/${mode}: extractPayload picked the wrong carrier`);
    eq((await M.unpack(found.bytes, null)).text, "payload " + key, `${key}/${mode}: decode after weave`);
    // visible text must be untouched
    const visible = [...stego].filter(ch => !M.classify(ch.codePointAt(0))).join("");
    eq(M.CARRIERS[key].appendOnly ? visible.replace(/[ \t]+$/, "") : visible, cover, `${key}/${mode}: visible text changed`);
  }
}

// --- encrypted payloads work on every carrier ---
for (const key of Object.keys(M.CARRIERS)) {
  const bytes = await M.packEnc("classified", "correct horse");
  const stego = M.weave(cover, M.CARRIERS[key].encode(bytes), M.CARRIERS[key].appendOnly ? "append" : "scatter");
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

// --- SNOW's blind spot, asserted rather than assumed ---
{
  const snowed = cover + M.CARRIERS.snow.encode(M.packPlain("hi"));
  ok([...snowed].every(ch => M.classify(ch.codePointAt(0)) === null || ch === "\t"),
     "snow: a codepoint-only detector should see nothing but tabs here");
  ok(/[ \t]{4,}$/.test(snowed), "snow: payload must land in a trailing run the positional pass can find");
  eq((await M.unpack(M.extractPayload(snowed).bytes, null)).text, "hi", "snow: decodes off the trailing run");
}

// --- look-alikes fold to their ASCII skeleton rather than being deleted ---
{
  const spoofed = "\u0430pple-\u0455upport.com";       // Cyrillic а and ѕ
  ok(spoofed !== "apple-support.com", "confusables: the impostor is a different string");
  eq(M.skeleton(spoofed), "apple-support.com", "confusables: skeleton folds to ASCII");
  eq(M.skeleton("ordinary text"), "ordinary text", "confusables: clean text is left alone");
}

console.log(`ok — ${n} assertions passed`);
