// Independent re-implementation of the Ghost Ink decoder + a minimal encoder,
// used only to check the four invariants. This file deliberately does NOT import
// anything from index.html — it is a second implementation, not a restatement.
import { webcrypto as crypto } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const TAG_BASE = 0xE0000;
const enc = new TextEncoder(), dec = new TextDecoder();
const isTag = cp => cp >= 0xE0000 && cp <= 0xE007F;

const toTags = a => [...a].map(ch => String.fromCodePoint(TAG_BASE + ch.charCodeAt(0))).join("");
const splitTags = s => {
  let visible = "", hidden = "", n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (isTag(cp)) { n++; const b = cp - TAG_BASE; if (b >= 0x20 && b <= 0x7E) hidden += String.fromCharCode(b); }
    else visible += ch;
  }
  return { visible, hidden, tagCount: n };
};
const strip = s => [...s].filter(ch => !isTag(ch.codePointAt(0))).join("");
const bytesToB64 = b => Buffer.from(b).toString("base64");
const b64ToBytes = b => new Uint8Array(Buffer.from(b, "base64"));

const VER = 1, F_PLAIN = 0, F_ENC = 1;
function packPlain(m){ const body = enc.encode(m); const o = new Uint8Array(2+body.length); o[0]=VER;o[1]=F_PLAIN;o.set(body,2); return o; }
async function packEnc(m, pass){
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const km = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:210000,hash:"SHA-256"}, km, {name:"AES-GCM",length:256}, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, enc.encode(m)));
  const o = new Uint8Array(2+16+12+ct.length); o[0]=VER;o[1]=F_ENC;o.set(salt,2);o.set(iv,18);o.set(ct,30); return o;
}
async function unpack(bytes, pass){
  if (bytes[0] !== VER) throw new Error("format");
  if (bytes[1] === F_PLAIN) return dec.decode(bytes.slice(2));
  const salt=bytes.slice(2,18), iv=bytes.slice(18,30), ct=bytes.slice(30);
  const km = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:210000,hash:"SHA-256"}, km, {name:"AES-GCM",length:256}, false, ["decrypt"]);
  return dec.decode(await crypto.subtle.decrypt({name:"AES-GCM",iv}, key, ct));
}
function weave(cover, tags, mode){
  if (mode === "append" || cover.length === 0) return cover + tags;
  const cc=[...cover], tc=[...tags]; if(!tc.length) return cover;
  const per = tc.length/cc.length; let out="",acc=0,ti=0;
  for (let i=0;i<cc.length;i++){ out+=cc[i]; acc+=per; while(ti<tc.length&&(acc>=1||i===cc.length-1)){out+=tc[ti++];acc-=1;} }
  while(ti<tc.length) out+=tc[ti++]; return out;
}

let pass = 0;
const secrets = ["meet at the north gate, 9pm","emoji 🎯 and unicode ✓ ok","$5M / 60% — a+b",""];
const cover = "Thanks for the update — talk soon.";

for (const secret of secrets) {
  for (const mode of ["append","scatter"]) {
    const stego = weave(cover, toTags(bytesToB64(packPlain(secret))), mode);
    // (1) visible text unchanged
    assert.equal(splitTags(stego).visible, cover, `[1] visible!=cover (${mode})`);
    // (2) byte-for-byte round trip
    const rec = await unpack(b64ToBytes(splitTags(stego).hidden), null);
    assert.equal(rec, secret, `[2] roundtrip (${mode})`);
    pass += 2;
  }
}

// (2b) encrypted round trip + (3) auth failure is caught, never mis-decoded
{
  const stego = weave(cover, toTags(bytesToB64(await packEnc("classified", "correct horse"))), "append");
  const hidden = splitTags(stego).hidden;
  assert.equal(await unpack(b64ToBytes(hidden), "correct horse"), "classified", "[2b] enc roundtrip");
  await assert.rejects(() => unpack(b64ToBytes(hidden), "wrong pass"), "[3] bad pass must throw");
  pass += 2;
}

// (4) strip removes exactly the tag chars and nothing else
{
  const stego = weave(cover, toTags(bytesToB64(packPlain("payload"))), "scatter");
  assert.equal(strip(stego), cover, "[4] strip != cover");
  assert.ok([...strip(stego)].every(ch => !isTag(ch.codePointAt(0))), "[4] tag survived strip");
  pass += 1;
}

console.log(`ok — ${pass} assertions passed`);
