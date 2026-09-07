/* Loads the *shipped* pure codec section out of app.js and evaluates it.
 *
 * The region between `const TAG_BASE` and the HERO banner is deliberately free
 * of DOM access, so it can be exercised in node exactly as it is served. This is
 * how the container and carrier suites test the real file rather than a copy.
 */
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";

const EXPORTS = [
  "CARRIERS", "extractPayload", "packPlain", "packEnc", "unpack", "peek", "weave",
  "toTags", "tagsToAscii", "bytesToB64", "b64ToBytes", "classify", "isTag",
  "skeleton", "CONFUSABLE", "SCRIPT_OF", "crc32", "parseV2", "buildHeader",
  "HDR", "MAGIC", "V2", "MODE_PLAIN", "MODE_GCM", "KDF_NONE", "KDF_PBKDF2_SHA256",
  "KDF_ITERS", "KDF_MIN", "KDF_MAX", "SALT_LEN", "NONCE_LEN", "GCM_TAG", "INV",
];

export function loadCodec() {
  const src = readFileSync(new URL("../../app.js", import.meta.url), "utf8");
  const start = src.indexOf("const TAG_BASE");
  const end = src.indexOf("/* =========================================================\n     HERO");
  if (start < 0 || end < start) throw new Error("slice: could not locate the pure codec region in app.js");
  const body = src.slice(start, end);
  if (/\bdocument\.(getElementById|querySelector)\s*\(/.test(body.replace(/const \$ = id => document\.getElementById\(id\);/, ""))) {
    throw new Error("slice: the codec region touched the DOM — it is no longer pure");
  }
  const fn = new Function("crypto", "document", `${body}\n return {${EXPORTS.join(", ")}};`);
  return fn(webcrypto, { getElementById: () => null });
}

export const appSource = () => readFileSync(new URL("../../app.js", import.meta.url), "utf8");
export const htmlSource = () => readFileSync(new URL("../../index.html", import.meta.url), "utf8");
export const cssSource = () => readFileSync(new URL("../../app.css", import.meta.url), "utf8");
export const readmeSource = () => readFileSync(new URL("../../README.md", import.meta.url), "utf8");
