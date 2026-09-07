# Ghost Ink container format

The container is what the carriers move. It is independent of *how* the bytes
travel — Unicode Tags, variation selectors, zero-width, trailing whitespace or
the low bits of an image all carry the same structure.

## v2 (current, written by default)

All multi-byte integers are big-endian.

```
off  size  field
  0     4  magic            "GHST" (0x47 0x48 0x53 0x54)
  4     1  version          2
  5     1  mode             0 = plaintext framed, 1 = AES-256-GCM
  6     1  kdf              0 = none, 1 = PBKDF2-SHA256
  7     4  kdfIterations    uint32, 0 when kdf = 0
 11     1  saltLen          0 when kdf = 0, else 16
 12     1  nonceLen         0 when mode = 0, else 12
 13     4  payloadLen       uint32, exact length of the payload that follows
------------------------------- header is 17 bytes -------------------------------
 17  saltLen   salt
      nonceLen nonce
      payloadLen payload
```

`payload` is:

* **mode 0** — `crc32(utf8)` as 4 bytes, followed by the UTF-8 message.
* **mode 1** — AES-256-GCM ciphertext with its 16-byte tag appended.

### What is authenticated

For mode 1 the **entire 17-byte header, plus the salt, plus the nonce** is passed
to AES-GCM as additional authenticated data. Version, mode, KDF identifier, KDF
iteration count and all declared lengths are therefore covered by the tag: none
of them can be altered without decryption failing.

That alone does not stop an attacker flipping `mode` from 1 to 0 to have a record
re-read down the unauthenticated plaintext path, because the plaintext path never
checks a tag. The framing is what closes that: a mode-0 payload must begin with a
CRC-32 of its own contents, which ciphertext passes with probability about 2^-32,
and must then decode as valid UTF-8. A flipped record is rejected rather than
reinterpreted.

### The CRC-32 is not authentication

It is a framing and accidental-corruption check, and it is the reason random
invisible characters are not accepted as a payload merely because their first
bytes resemble a header. It provides no protection against a deliberate attacker,
who can trivially recompute it. Only mode 1 provides integrity, and only for the
message and the header.

### Fail-closed conditions

Decoding rejects, rather than guessing, on all of:

* buffer shorter than the 17-byte header;
* wrong magic;
* unknown version;
* unknown mode;
* unknown KDF identifier, or a KDF that does not match the mode;
* `kdfIterations` outside the accepted range (100,000 – 2,000,000) — an unbounded
  value read from untrusted input is a denial-of-service vector, not a parameter;
* `saltLen` / `nonceLen` that do not match the mode;
* declared `payloadLen` that does not exactly equal the remaining bytes — both
  truncation and trailing bytes are errors;
* mode 1 ciphertext shorter than the 16-byte GCM tag;
* mode 0 payload shorter than its 4-byte CRC;
* CRC mismatch;
* GCM authentication failure.

### KDF parameters travel with the record

`kdfIterations` is written into the header rather than assumed. A record made
today still decodes if the page's default changes later.

## v1 (legacy, decode-only)

```
off  size  field
  0     1  version = 1
  1     1  flags   0 = plaintext, 1 = AES-256-GCM
  2     …  plaintext: UTF-8 message
           encrypted: salt(16) · iv(12) · ciphertext+tag
```

v1 had no magic, no declared lengths, no framing on the plaintext path, no
authentication of its own metadata, and an implied 210,000 PBKDF2 iterations. It
is still read so that material produced before the change keeps working; it is
never written. `peek()` reports `legacy: true` for these records, and the Find
panel says so.

The two versions are unambiguous on the wire: v1 begins with `0x01`, v2 with `G`.
