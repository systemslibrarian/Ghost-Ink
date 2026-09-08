/* Independent re-implementation of the Ghost Ink decoder plus a minimal encoder,
 * used to check the invariants. This file deliberately imports NOTHING from the
 * application — it is a second implementation written from docs/CONTAINER.md, not
 * a restatement of app.js. If the two disagree, one of them is wrong, and this
 * file is the one that says so.
 */
import { webcrypto as crypto } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const enc = new TextEncoder(), dec = new TextDecoder();

/* ---- carrier: Unicode Tags (the wire format the exhibit is named for) ---- */
const TAG_BASE = 0xE0000;
const isTag = (cp) => cp >= 0xE0000 && cp <= 0xE007F;
const toTags = (a) => [...a].map((ch) => String.fromCodePoint(TAG_BASE + ch.charCodeAt(0))).join("");
const splitTags = (s) => {
  let visible = "", hidden = "", n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (isTag(cp)) { n++; const b = cp - TAG_BASE; if (b >= 0x20 && b <= 0x7E) hidden += String.fromCharCode(b); }
    else visible += ch;
  }
  return { visible, hidden, tagCount: n };
};
const strip = (s) => [...s].filter((ch) => !isTag(ch.codePointAt(0))).join("");
const bytesToB64 = (b) => Buffer.from(b).toString("base64");
const b64ToBytes = (b) => new Uint8Array(Buffer.from(b, "base64"));

/* ---- container v2, written from the spec ---- */
const MAGIC = [0x47, 0x48, 0x53, 0x54], HDR = 17;
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const rd32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const header = (mode, kdf, iters, saltLen, nonceLen, payLen) =>
  [...MAGIC, 2, mode, kdf, ...be32(iters), saltLen, nonceLen, ...be32(payLen)];

function packPlain(msg) {
  const body = enc.encode(msg);
  return Uint8Array.from([...header(0, 0, 0, 0, 0, body.length + 4), ...be32(crc32(body)), ...body]);
}
const derive = async (pass, salt, iters, use) => {
  const km = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iters, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, [use]);
};
async function packEnc(msg, pass, iters = 210000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const body = enc.encode(msg);
  const aad = Uint8Array.from([...header(1, 1, iters, 16, 12, body.length + 16), ...salt, ...nonce]);
  const key = await derive(pass, salt, iters, "encrypt");
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, key, body));
  return Uint8Array.from([...aad, ...ct]);
}
async function unpack(bytes, pass) {
  if (bytes.length >= HDR && MAGIC.every((m, i) => bytes[i] === m)) {
    assert.equal(bytes[4], 2, "unexpected container version");
    const mode = bytes[5], iters = rd32(bytes, 7), saltLen = bytes[11], nonceLen = bytes[12], payLen = rd32(bytes, 13);
    assert.equal(bytes.length, HDR + saltLen + nonceLen + payLen, "declared length disagrees with the buffer");
    const salt = bytes.slice(HDR, HDR + saltLen);
    const nonce = bytes.slice(HDR + saltLen, HDR + saltLen + nonceLen);
    const payload = bytes.slice(HDR + saltLen + nonceLen);
    if (mode === 0) {
      const body = payload.slice(4);
      assert.equal(rd32(payload, 0), crc32(body), "framing checksum mismatch");
      return dec.decode(body);
    }
    const aad = bytes.slice(0, HDR + saltLen + nonceLen);
    const key = await derive(pass, salt, iters, "decrypt");
    return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, key, payload));
  }
  // v1, decode-only
  assert.equal(bytes[0], 1, "not a Ghost Ink container");
  if (bytes[1] === 0) return dec.decode(bytes.slice(2));
  const key = await derive(pass, bytes.slice(2, 18), 210000, "decrypt");
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(18, 30) }, key, bytes.slice(30)));
}

function weave(cover, tags, mode) {
  if (mode === "append" || cover.length === 0) return cover + tags;
  const cc = [...cover], tc = [...tags];
  if (!tc.length) return cover;
  const per = tc.length / cc.length;
  let out = "", acc = 0, ti = 0;
  for (let i = 0; i < cc.length; i++) {
    out += cc[i]; acc += per;
    while (ti < tc.length && (acc >= 1 || i === cc.length - 1)) { out += tc[ti++]; acc -= 1; }
  }
  while (ti < tc.length) out += tc[ti++];
  return out;
}

let pass = 0;
const secrets = ["meet at the north gate, 9pm", "emoji 🎯 and unicode ✓ ok", "$5M / 60% — a+b", ""];
const cover = "Thanks for the update — talk soon.";

for (const secret of secrets) {
  for (const mode of ["append", "scatter"]) {
    const stego = weave(cover, toTags(bytesToB64(packPlain(secret))), mode);
    // (1) visible text unchanged
    assert.equal(splitTags(stego).visible, cover, `[1] visible!=cover (${mode})`);
    // (2) byte-for-byte round trip
    assert.equal(await unpack(b64ToBytes(splitTags(stego).hidden), null), secret, `[2] roundtrip (${mode})`);
    pass += 2;
  }
}

// (2b) encrypted round trip + (3) authentication failure is caught, never mis-decoded
{
  const stego = weave(cover, toTags(bytesToB64(await packEnc("classified", "correct horse"))), "append");
  const hidden = splitTags(stego).hidden;
  assert.equal(await unpack(b64ToBytes(hidden), "correct horse"), "classified", "[2b] enc roundtrip");
  await assert.rejects(() => unpack(b64ToBytes(hidden), "wrong pass"), "[3] bad pass must throw");
  pass += 2;
}

// (3b) the header is authenticated: an independently-tampered record must not decrypt
{
  const rec = await packEnc("classified", "pw");
  for (const off of [4, 5, 6, 7, 11, 12]) {
    const t = Uint8Array.from(rec); t[off] ^= 1;
    await assert.rejects(() => unpack(t, "pw"), `[3b] tampered header byte ${off} decrypted`);
    pass += 1;
  }
}

// (3c) KDF iterations travel in the record: a non-default count still round-trips
{
  const rec = await packEnc("tuned", "pw", 150000);
  assert.equal(rd32(rec, 7), 150000, "[3c] iteration count written to the header");
  assert.equal(await unpack(rec, "pw"), "tuned", "[3c] non-default iteration count round trips");
  pass += 2;
}

// (4) strip removes exactly the tag chars and nothing else
{
  const stego = weave(cover, toTags(bytesToB64(packPlain("payload"))), "scatter");
  assert.equal(strip(stego), cover, "[4] strip != cover");
  assert.ok([...strip(stego)].every((ch) => !isTag(ch.codePointAt(0))), "[4] tag survived strip");
  pass += 1;
}

// (5) v1 records still decode, so old material keeps working
{
  const v1 = Uint8Array.from([1, 0, ...enc.encode("written before v2")]);
  assert.equal(await unpack(v1, null), "written before v2", "[5] v1 plaintext");
  pass += 1;
}

/* ---- carrier: word choice, decoded independently ----
 *
 * The codebook is *data*, not logic: a second implementation of this carrier
 * still has to agree with the same word groups, exactly as a second
 * implementation of the Tags carrier has to agree on U+E0000. So the groups are
 * read out of app.js as text and the decoder below is written fresh from the
 * rule — rank of the word within its group, most significant bit first, groups
 * sized 2^k — without importing a line of the application.
 */
const lexGroups = (() => {
  const src = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("const LEX_GROUPS = ["), src.indexOf("const LEX_INDEX"));
  return [...block.matchAll(/\[((?:"[a-z]+",?\s*)+)\]/g)]
    .map((m) => m[1].match(/[a-z]+/g));
})();

const lexRank = new Map();
lexGroups.forEach((g) => g.forEach((w, i) => lexRank.set(w, { rank: i, bits: Math.log2(g.length) })));

function lexDecodeIndependently(text) {
  const bits = [];
  for (const w of text.match(/[A-Za-z]+/g) || []) {
    const e = lexRank.get(w.toLowerCase());
    if (!e) continue;
    for (let k = e.bits - 1; k >= 0; k--) bits.push((e.rank >> k) & 1);
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  }
  const all = Uint8Array.from(bytes);
  if (all.length < HDR || !MAGIC.every((m, i) => all[i] === m)) return null;
  // the container declares its own length; everything past it is arbitrary
  const total = HDR + all[11] + all[12] + rd32(all, 13);
  return total <= all.length ? all.slice(0, total) : null;
}

// (6) the word-choice carrier decodes under a second implementation
{
  assert.ok(lexGroups.length > 20, "[6] the codebook parsed out of app.js");
  for (const g of lexGroups) {
    assert.ok(Number.isInteger(Math.log2(g.length)), `[6] group [${g[0]}…] is not sized 2^k`);
  }
  pass += 1;

  /* The application produced these two strings with the shipped encoder; if the
   * two implementations ever disagree about rank order, bit order or where the
   * payload stops, this decode fails. Regenerating them requires the app, which
   * is the point — this file only ever reads. */
  const fixture = readFileSync(new URL("./fixtures/lex.txt", import.meta.url), "utf8");
  const bytes = lexDecodeIndependently(fixture);
  assert.ok(bytes, "[6] the fixture must decode to a container");
  assert.equal(await unpack(bytes, null), "meet at nine", "[6] independent lexical decode");
  pass += 2;

  // and prose that was never substituted must not decode to a container
  assert.equal(lexDecodeIndependently("Thanks for the update, talk soon."), null,
    "[6] unsubstituted text must not yield a container");
  pass += 1;
}

console.log(`ok — ${pass} assertions passed`);
