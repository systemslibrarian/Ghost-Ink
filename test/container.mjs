/* Container v2 — behaviour and, more importantly, refusals.
 *
 * Every case below is a way a malformed or hostile record could be mistaken for
 * a good one. The format is specified in docs/CONTAINER.md; this file is the
 * executable half of that document.
 */
import assert from "node:assert/strict";
import { loadCodec } from "./lib/slice.mjs";

const M = loadCodec();
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
async function rejects(fn, why, m) {
  try { await fn(); assert.fail("expected rejection: " + m); }
  catch (e) {
    assert.ok(e && e.code, `${m}: threw without a code (${e})`);
    if (why) assert.equal(e.code, why, `${m}: wrong code (${e.code}${e.why ? " / " + e.why : ""})`);
    n++;
  }
}
const bytes = (b) => Uint8Array.from(b);

// ---------- shape ----------
{
  const p = M.packPlain("hello");
  eq([...p.slice(0, 4)], M.MAGIC, "plaintext record starts with the GHST magic");
  eq(p[4], M.V2, "version byte is 2");
  eq(p[5], M.MODE_PLAIN, "mode byte is plaintext");
  eq(p[6], M.KDF_NONE, "no KDF on a plaintext record");
  eq(p.length, M.HDR + 4 + 5, "header + crc + utf-8 length");

  const e = await M.packEnc("hello", "pw");
  eq(e[5], M.MODE_GCM, "mode byte is GCM");
  eq(e[6], M.KDF_PBKDF2_SHA256, "KDF id is PBKDF2-SHA256");
  const iters = (e[7] << 24 | e[8] << 16 | e[9] << 8 | e[10]) >>> 0;
  eq(iters, M.KDF_ITERS, "iteration count travels in the header, not as an assumption");
  eq(e.length, M.HDR + M.SALT_LEN + M.NONCE_LEN + 5 + M.GCM_TAG, "encrypted record length");
}

// ---------- round trips ----------
for (const text of ["meet at the north gate, 9pm", "emoji 🎯 ✓", "$5M / 60% — a+b", "x", ""]) {
  eq((await M.unpack(M.packPlain(text), null)).text, text, `plaintext round trip: ${JSON.stringify(text)}`);
  const e = await M.packEnc(text, "correct horse");
  eq((await M.unpack(e, "correct horse")).text, text, `encrypted round trip: ${JSON.stringify(text)}`);
  ok((await M.unpack(e, "correct horse")).encrypted, "encrypted flag reported");
}
{
  const rec = await M.packEnc("x", "right");
  await rejects(() => M.unpack(rec, "wrong"), "badpass", "wrong passphrase");
  await rejects(() => M.unpack(rec, null), "needpass", "encrypted record with no passphrase");
}

// ---------- the metadata is authenticated ----------
{
  const base = await M.packEnc("classified", "pw");
  // Every header byte is inside the AAD, so flipping any of them must fail the tag
  // rather than change how the record is interpreted.
  for (const [off, label] of [[4, "version"], [6, "kdf id"], [7, "iteration count (high byte)"],
                              [10, "iteration count (low byte)"], [11, "salt length"], [12, "nonce length"]]) {
    const tampered = Uint8Array.from(base);
    tampered[off] ^= 0x01;
    await rejects(() => M.unpack(tampered, "pw"), null, `flipped ${label} must not decrypt`);
  }
  // Flipping the salt or the nonce likewise.
  const saltFlip = Uint8Array.from(base); saltFlip[M.HDR] ^= 0xFF;
  await rejects(() => M.unpack(saltFlip, "pw"), "badpass", "flipped salt");
  const nonceFlip = Uint8Array.from(base); nonceFlip[M.HDR + M.SALT_LEN] ^= 0xFF;
  await rejects(() => M.unpack(nonceFlip, "pw"), "badpass", "flipped nonce");
  const ctFlip = Uint8Array.from(base); ctFlip[ctFlip.length - 1] ^= 0x01;
  await rejects(() => M.unpack(ctFlip, "pw"), "badpass", "flipped ciphertext");
}

// ---------- an encrypted record cannot be downgraded to plaintext ----------
{
  // The attack the format exists to stop: flip mode 1 -> 0 so the reader takes
  // the path that never checks a tag. The plaintext framing must refuse it.
  const e = await M.packEnc("classified", "pw");
  const downgraded = Uint8Array.from(e);
  downgraded[5] = M.MODE_PLAIN;
  await rejects(() => M.unpack(downgraded, null), "format", "mode downgrade must be refused");

  // …including when the attacker also fixes up the KDF metadata to look consistent.
  const tidy = Uint8Array.from(e);
  tidy[5] = M.MODE_PLAIN; tidy[6] = M.KDF_NONE;
  tidy[7] = tidy[8] = tidy[9] = tidy[10] = 0; tidy[11] = 0; tidy[12] = 0;
  await rejects(() => M.unpack(tidy, null), "format", "tidied-up downgrade must still be refused");
}

// ---------- fail-closed on malformed records ----------
{
  const good = M.packPlain("payload");
  const enc = await M.packEnc("payload", "pw");

  await rejects(() => M.unpack(bytes([]), null), "format", "empty buffer");
  await rejects(() => M.unpack(bytes([0x47, 0x48]), null), "format", "two bytes");
  await rejects(() => M.unpack(good.slice(0, M.HDR - 1), null), "format", "truncated header");
  await rejects(() => M.unpack(good.slice(0, good.length - 1), null), "format", "truncated payload");

  const badMagic = Uint8Array.from(good); badMagic[0] = 0x48;
  await rejects(() => M.unpack(badMagic, null), "format", "bad magic");

  const badVer = Uint8Array.from(good); badVer[4] = 9;
  await rejects(() => M.unpack(badVer, null), "format", "unknown version");

  const badMode = Uint8Array.from(good); badMode[5] = 7;
  await rejects(() => M.unpack(badMode, null), "format", "unknown mode");

  const badKdf = Uint8Array.from(enc); badKdf[6] = 3;
  await rejects(() => M.unpack(badKdf, "pw"), "format", "unknown kdf id");

  const trailing = new Uint8Array(good.length + 1);
  trailing.set(good); trailing[good.length] = 0x41;
  await rejects(() => M.unpack(trailing, null), "format", "trailing bytes after the declared payload");

  const lied = Uint8Array.from(good);
  lied[16] = 0xFF;                                  // payloadLen low byte -> absurd
  await rejects(() => M.unpack(lied, null), "format", "declared length longer than the data");

  const crcBreak = Uint8Array.from(good);
  crcBreak[M.HDR + 4] ^= 0x01;                      // corrupt the framed body
  await rejects(() => M.unpack(crcBreak, null), "format", "framing checksum mismatch");

  // Plaintext records must not carry key-derivation metadata.
  const smuggledKdf = Uint8Array.from(good); smuggledKdf[6] = M.KDF_PBKDF2_SHA256;
  await rejects(() => M.unpack(smuggledKdf, null), "format", "plaintext record carrying a KDF id");
}

// ---------- KDF iterations are bounded, because they come from untrusted input ----------
{
  const e = await M.packEnc("x", "pw");
  const put = (b, n) => { b[7]=(n>>>24)&255; b[8]=(n>>>16)&255; b[9]=(n>>>8)&255; b[10]=n&255; };
  for (const [value, label] of [[0, "zero"], [1, "one"], [M.KDF_MIN - 1, "just under the floor"],
                                [M.KDF_MAX + 1, "just over the ceiling"], [0xFFFFFFFF, "four billion"]]) {
    const b = Uint8Array.from(e); put(b, value);
    await rejects(() => M.unpack(b, "pw"), "format", `iteration count ${label} must be refused, not attempted`);
  }
  // peek() must refuse them too, or the UI would offer a passphrase box for a record it can never read
  const huge = Uint8Array.from(e); put(huge, 0xFFFFFFFF);
  eq(M.peek(huge), null, "peek refuses an out-of-range iteration count");
}

// ---------- ciphertext shorter than the tag ----------
{
  const e = await M.packEnc("", "pw");
  const short = e.slice(0, M.HDR + M.SALT_LEN + M.NONCE_LEN + M.GCM_TAG - 1);
  short[16] = M.GCM_TAG - 1;                        // declare the short length honestly
  await rejects(() => M.unpack(short, null), "format", "ciphertext shorter than the GCM tag");
}

// ---------- random noise is not a container ----------
{
  let accepted = 0;
  for (let i = 0; i < 400; i++) {
    const junk = new Uint8Array(24);
    for (let j = 0; j < junk.length; j++) junk[j] = (i * 31 + j * 7 + (i >> 3)) & 0xFF;
    if (M.peek(junk)) accepted++;
  }
  eq(accepted, 0, "no deterministic-noise buffer was accepted as a container");

  // The specific v1 weakness this replaces: two leading bytes that merely look right.
  eq(M.peek(bytes([2, 0, 65, 66, 67])), null, "a v2-looking pair of bytes without the magic is refused");
}

// ---------- v1 is still readable, and is labelled as legacy ----------
{
  const v1plain = bytes([1, 0, ...new TextEncoder().encode("legacy message")]);
  const r = await M.unpack(v1plain, null);
  eq(r.text, "legacy message", "v1 plaintext still decodes");
  eq(r.version, 1, "v1 reports version 1");
  ok(r.legacy, "v1 is flagged as legacy");
  ok(M.peek(v1plain).legacy, "peek flags v1 as legacy");
  eq(M.peek(bytes([1, 5, 65])), null, "an unknown v1 flag is refused");
  await rejects(() => M.unpack(bytes([1, 1, 1, 2, 3]), "pw"), "format", "truncated v1 encrypted record");
  // v1 is never produced
  ok(M.packPlain("x")[0] !== 1, "the writer never emits v1");
}

// ---------- crc32 is the standard one ----------
{
  eq(M.crc32(new TextEncoder().encode("123456789")), 0xCBF43926, "crc32 check value matches the standard vector");
}

console.log(`ok — ${n} assertions passed`);
