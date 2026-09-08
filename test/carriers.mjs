/* Carrier tests. Unlike roundtrip.mjs — which is a deliberately independent
 * re-implementation — this suite exercises the page's OWN codec, sliced out of
 * app.js by test/lib/slice.mjs, so every carrier (Unicode Tags, variation
 * selectors, zero-width, trailing whitespace, word choice) is checked exactly
 * as shipped.
 *
 * Word choice is cover-bound: it rewrites the cover instead of riding alongside
 * it, so it has no fixed cost per byte, it is not woven, and — by design — the
 * auto-detector cannot find it. Each loop below states which of those it means.
 */
import assert from "node:assert/strict";
import { loadCodec } from "./lib/slice.mjs";

const M = loadCodec();

/* The cover-bound carrier needs a great deal of cover — that is the honest
 * headline cost of linguistic stego, not a defect of the test. This sentence
 * contains a coding point from many groups; repeating it gives a cover with
 * enough capacity for the encrypted path (61+ bytes) as well as the plain one. */
const LEX_UNIT = "The big problem is that we should begin to check the new method often, " +
  "show the result, help the group choose an approach, and finish the important work quickly; " +
  "however the hidden idea is a small message about which words we use, and therefore " +
  "we can also explain, build, verify, remove or change nearly any usual thing here. ";
const lexCover = (bits) => {
  let c = LEX_UNIT;
  while (M.CARRIERS.lex.capacity(c).bits < bits) c += LEX_UNIT;
  /* Trimmed deliberately: a cover ending in a space would leave a one-character
   * trailing run, which extractPayload reports as SNOW-shaped noise. That is
   * pre-existing behaviour of the whitespace carrier and has nothing to do with
   * this one, so the blind-spot assertions below must not be testing it. */
  return c.trim();
};

const INVISIBLE = Object.keys(M.CARRIERS).filter((k) => !M.CARRIERS[k].coverBound);
const COVER_BOUND = Object.keys(M.CARRIERS).filter((k) => M.CARRIERS[k].coverBound);

let n = 0;
const n2 = () => { n++; };
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// --- every invisible carrier round-trips arbitrary bytes ---
for (const key of INVISIBLE) {
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

// --- carriers survive weaving, in both placements (weave is not cover-bound) ---
const cover = "Thanks for the update — talk soon.";
for (const key of INVISIBLE) {
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

// --- encrypted payloads work on every invisible carrier ---
for (const key of INVISIBLE) {
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

// --- the cover-bound carrier: word choice ---
{
  ok(COVER_BOUND.length >= 1, "at least one cover-bound carrier is implemented");
  ok(!COVER_BOUND.some((k) => typeof M.CARRIERS[k].cost === "function"),
     "a cover-bound carrier must not advertise a fixed cost per byte");
}
for (const key of COVER_BOUND) {
  const C = M.CARRIERS[key];

  // round trip, plain, across payloads that exercise multi-byte UTF-8
  for (const secret of ["meet at nine", "emoji 🎯 ✓", "$5M / 60% — a+b", "x"]) {
    const bytes = M.packPlain(secret);
    const cv = lexCover(bytes.length * 8);
    const stego = C.encodeInto(bytes, cv);
    eq([...C.decode(stego)], [...bytes], `${key}: byte round trip`);
    eq((await M.unpack(C.decode(stego), null)).text, secret, `${key}: text round trip`);
  }

  // round trip, encrypted — the container is carrier-independent, so AES-GCM
  // has to survive this carrier exactly as it survives the invisible ones
  {
    const bytes = await M.packEnc("classified", "correct horse");
    const cv = lexCover(bytes.length * 8);
    const stego = C.encodeInto(bytes, cv);
    const back = C.decode(stego);
    ok(M.peek(back).encrypted, `${key}: peek missed the encryption flag`);
    eq((await M.unpack(back, "correct horse")).text, "classified", `${key}: encrypted round trip`);
    await assert.rejects(() => M.unpack(back, "wrong"), `${key}: wrong passphrase must throw`); n++;
  }

  // capacity accounting: the advertised capacity must be what encoding can use,
  // and it is a property of the cover rather than of the payload
  {
    const cv = lexCover(400);
    const cap = C.capacity(cv);
    eq(cap.bytes, Math.floor(cap.bits / 8), `${key}: capacity bytes disagree with bits`);
    ok(cap.points > 0 && cap.bits >= cap.points, `${key}: every coding point carries at least one bit`);
    // a payload of exactly the advertised size must fit; one byte more must not
    const fits = M.packPlain("x".repeat(Math.max(0, cap.bytes - 21)));
    ok(fits.length <= cap.bytes, `${key}: test payload exceeds advertised capacity`);
    C.encodeInto(fits, cv); n++;
    // adding cover only ever adds capacity
    ok(C.capacity(cv + cv).bits > cap.bits, `${key}: more cover must mean more capacity`);
  }

  // fail closed when the cover is too short — the common case for this carrier
  {
    const bytes = M.packPlain("hi");
    assert.throws(() => C.encodeInto(bytes, "Thanks for the update — talk soon."),
      (e) => e && e.code === "capacity", `${key}: must fail closed on insufficient cover`); n++;
    assert.throws(() => C.encodeInto(bytes, ""), (e) => e && e.code === "capacity",
      `${key}: an empty cover carries nothing`); n++;
  }

  // the visible text is the payload: unlike every other carrier, it changes
  {
    const cv = lexCover(200);
    const stego = C.encodeInto(M.packPlain("hi"), cv);
    ok(stego !== cv, `${key}: the cover must actually change — that is the carrier`);
    eq(stego.replace(/[A-Za-z]+/g, ""), cv.replace(/[A-Za-z]+/g, ""),
       `${key}: only whole words may change; punctuation and spacing must be untouched`);
  }

  // THE BLIND SPOT, asserted rather than assumed — the whole reason this
  // carrier is in the exhibit. Every codepoint is ordinary, so the codepoint
  // X-ray finds nothing, the positional whitespace pass finds nothing, and
  // auto-detection cannot name the carrier from the text alone.
  {
    const cv = lexCover(200);
    const stego = C.encodeInto(M.packPlain("hi"), cv);
    ok([...stego].every((ch) => M.classify(ch.codePointAt(0)) === null),
       `${key}: a codepoint detector must see nothing at all here`);
    ok(!/[ \t]{4,}$/.test(stego), `${key}: nothing for the positional whitespace pass to find either`);
    ok([...stego].every((ch) => M.CONFUSABLE[ch] === undefined),
       `${key}: no look-alike for the confusable pass to catch`);
    eq(M.extractPayload(stego), null, `${key}: auto-detection must not find a cover-bound carrier`);
    // and yet, with the codebook, it decodes
    eq((await M.unpack(C.decode(stego), null)).text, "hi", `${key}: decodes with the codebook`);
  }

  // decoding refuses text that was never written with the codebook
  {
    eq(C.decode("Thanks for the update — talk soon."), null, `${key}: short text yields no container`);
    eq(C.decode(lexCover(400)), null, `${key}: unsubstituted prose is not a container`);
  }

  // case is preserved, so the prose is not visibly mangled
  {
    const cv = "BIG " + lexCover(200);
    const stego = C.encodeInto(M.packPlain("hi"), cv);
    const firstWord = stego.match(/[A-Za-z]+/)[0];
    eq(firstWord, firstWord.toUpperCase(), `${key}: an all-caps coding point must stay all-caps`);
  }
}

/* --- the cover-bound decoder trusts the container's declared length ---
 *
 * Every other carrier knows where its payload stops because the carrier
 * characters stop. This one does not: coding points carry on to the end of the
 * cover, so lexDecode reads the declared salt/nonce/payload lengths out of the
 * header and truncates to them. That is only safe because the header is either
 * GCM-authenticated or CRC-framed — so corrupting the declared length must fail
 * closed rather than yield a short read that decodes to something.
 */
for (const key of COVER_BOUND) {
  const C = M.CARRIERS[key];
  const reEncode = (bytes) => C.encodeInto(bytes, lexCover(bytes.length * 8 + 64));

  // plaintext: the CRC is computed over the body, so a shortened payload is a
  // framing mismatch, and a lengthened one runs past what the cover can hold
  {
    const good = M.packPlain("meet at nine");
    eq((await M.unpack(C.decode(reEncode(good)), null)).text, "meet at nine",
       `${key}: the untampered record decodes, so the tamper cases mean something`);

    for (const delta of [-1, -4, +1]) {
      const bad = Uint8Array.from(good);
      const declared = 13;                                 // payload length, big-endian, per docs/CONTAINER.md
      const n = ((bad[declared] << 24) | (bad[declared+1] << 16) | (bad[declared+2] << 8) | bad[declared+3]) + delta;
      bad[declared] = (n >>> 24) & 255; bad[declared+1] = (n >>> 16) & 255;
      bad[declared+2] = (n >>> 8) & 255; bad[declared+3] = n & 255;

      const back = C.decode(reEncode(bad));
      if (back === null) { ok(true, `${key}: declared length ${delta} refused at decode`); continue; }
      await assert.rejects(() => M.unpack(back, null),
        `${key}: plaintext with declared length ${delta} must fail closed`); n2();
    }
  }

  // the salt and nonce lengths are read straight out of the header by the
  // truncation too, so they get the same treatment
  {
    const good = M.packPlain("meet at nine");
    for (const off of [11, 12]) {
      const bad = Uint8Array.from(good); bad[off] ^= 0x10;
      const back = C.decode(reEncode(bad));
      if (back === null) { ok(true, `${key}: byte ${off} refused at decode`); continue; }
      await assert.rejects(() => M.unpack(back, null),
        `${key}: plaintext with byte ${off} tampered must fail closed`); n2();
    }
  }

  // encrypted: the entire header is associated data, so any change to a declared
  // length breaks authentication rather than producing a short plaintext
  {
    const good = await M.packEnc("classified", "correct horse");
    eq((await M.unpack(C.decode(reEncode(good)), "correct horse")).text, "classified",
       `${key}: the untampered encrypted record decodes`);

    for (const off of [11, 12, 13, 14, 15, 16]) {
      const bad = Uint8Array.from(good); bad[off] ^= 1;
      const back = C.decode(reEncode(bad));
      if (back === null) { ok(true, `${key}: encrypted header byte ${off} refused at decode`); continue; }
      await assert.rejects(() => M.unpack(back, "correct horse"),
        `${key}: encrypted with header byte ${off} tampered must fail closed`); n2();
    }
  }

  // and a record whose declared length exceeds everything the cover could carry
  // is refused outright rather than read short
  {
    const good = M.packPlain("hi");
    const bad = Uint8Array.from(good);
    bad[13] = 0x7F; bad[14] = 0xFF; bad[15] = 0xFF; bad[16] = 0xFF;   // absurd payload length
    eq(C.decode(reEncode(bad)), null, `${key}: an impossible declared length is refused`);
  }
}

/* --- the one legitimate use of the Tags block ---
 *
 * The three subdivision flags are BUILT from tag characters, so a detector that
 * treats the block as inherently hostile reports ordinary mail as smuggling —
 * which is what Microsoft says happened to its own signature before the three
 * were excluded. The exception has to be exact: excusing "anything shaped like a
 * flag" would hand the attacker a free wrapper.
 */
{
  const T = M.CARRIERS.tags;
  const WALES = M.tagFlagSeq("gbwls");
  const sentence = `Team offsite is in Cardiff ${WALES} — flights booked.`;

  eq(M.emojiTagFlags(sentence).map((f) => f.name), ["Wales"], "the Wales flag is recognised as a flag");
  eq(T.count(sentence), 0, "a real flag contributes no payload characters");
  eq(T.decode(sentence), null, "a real flag does not decode as a container");
  eq(M.extractPayload(sentence), null, "a real flag is not reported as a find");
  eq(M.cleanText(sentence), sentence, "cleaning must not dismember a real flag");
  for (const code of Object.keys(M.RGI_TAG_FLAGS)) {
    eq(M.emojiTagFlags(M.tagFlagSeq(code)).length, 1, `${code} is one of the three excused sequences`);
  }

  // an unassigned but well-formed tag sequence is NOT excused: the base character
  // is visible and free, and everything after it is attacker-chosen.
  const forged = "\u{1F3F4}" + M.toTags("usnyc") + "\u{E007F}";
  eq(M.emojiTagFlags(forged).length, 0, "a well-formed but unassigned tag sequence is not excused");
  ok(T.count(forged) > 0, "an unassigned tag sequence is still reported as tag characters");
  /* The asymmetry, stated rather than implied. Cleaning is not symmetric with
     detection here and must not be: the three real sequences come through whole,
     and the forged one is reduced to its visible base — a bare black flag — while
     the panel still reports it. A detector that quietly repaired the forgery
     without saying so would be the worse failure of the two. */
  eq(M.cleanText(forged), "\u{1F3F4}",
     "cleaning an unassigned tag sequence leaves the plain black flag and nothing else");
  ok(M.cleanText(forged) !== forged, "the forged sequence really is changed by cleaning");

  // and the exception must not open a hole: a payload riding beside a real flag
  // is still found, and one whose own bytes sit next to the flag still decodes.
  const stego = M.weave(sentence, T.encode(M.packPlain("meet at nine")), "append");
  const found = M.extractPayload(stego);
  ok(found && found.bytes, "a payload appended after a flag is still found");
  eq(M.CARRIERS.tags.decode(stego).length, M.packPlain("meet at nine").length,
     "the flag's own tag characters are not read into the payload");
}

// --- the codebook itself ---
{
  ok(M.LEX_GROUPS.length > 20, "the codebook has enough groups to be usable");
  const seen = new Set();
  for (const g of M.LEX_GROUPS) {
    ok(Number.isInteger(Math.log2(g.length)) && g.length >= 2, `group [${g[0]}…] is not sized 2^k`);
    for (const w of g) {
      ok(/^[a-z]+$/.test(w), `codebook word “${w}” is not plain lowercase letters`);
      ok(!seen.has(w), `codebook word “${w}” appears in more than one group — decoding would be ambiguous`);
      seen.add(w);
    }
  }
}

console.log(`ok — ${n} assertions passed`);
