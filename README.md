# Ghost Ink

Hide a message in the invisible Unicode **Tags** block (U+E0000–U+E007F), then
detect and strip it. The core is one self-contained HTML page — no build step,
no backend — and it installs as an app (PWA) on desktop, Android, and iPhone.

**[Live demo](https://systemslibrarian.github.io/ghost-ink/)**

## What it is

Almost the entire Tags block mirrors plain ASCII: `U+E0041` stands in for `A`,
`U+E0061` for `a`, `U+E0020` for a space. The characters exist in the text and
travel with it, but fonts render them to nothing — a machine reads them, a person
doesn't. Ghost Ink hides a message in that layer, optionally encrypts it, and
(in the same page) exposes and removes it.

Same idea as whitespace steganography (SNOW), with the Tags block as the carrier
instead of trailing spaces.

## Why this is worth understanding

This isn't just a curiosity — the exact carrier the demo uses is a live technique
called **ASCII smuggling**, and it has had two lives:

- **Against AI.** Invisible instructions are woven into content an LLM will read,
  so the model obeys a command the human reviewer never sees — a stealthy form of
  prompt injection. This is where the technique first drew attention.
- **Against filters.** Spammers slip invisible tags *inside* trigger words so a
  detector no longer recognizes them, while the recipient reads the word normally.

Microsoft reported the second use spiking in early 2026: daily hits on its
ASCII-smuggling signature in Defender for Office jumped from a ~21,000/day
baseline to more than 1.3 million in a day, peaking near **2.37 million/day on
Feb 11, 2026** before tapering off in May. The demo's *How attackers use this in
the wild* section walks through the data, the tokenizer-splitting trick
(`funding` → `fun` + `ding`), and links the source reporting:
Dan Goodin, ["Once popular for attacking AI, ASCII smuggling is embraced by
spammers,"](https://arstechnica.com/security/2026/09/once-popular-for-attacking-ai-ascii-smuggling-is-embraced-by-spammers/)
*Ars Technica*, Sept. 4, 2026 (based on Microsoft research). This project is an
independent educational demo and is not affiliated with either.

## How it works

```
secret → UTF-8 bytes → [optional AES-256-GCM] → Base64
       → map each char c to U+(0xE0000 + codepoint(c))
       → weave into cover text (append or scatter)
```

- **Encryption** (optional): AES-256-GCM, key from your passphrase via
  PBKDF2-SHA256 (210,000 iterations). Runs in the browser with WebCrypto —
  no bytes leave the page.
- **Container** (before Base64): byte 0 version, byte 1 flags (plaintext or
  GCM), then either the UTF-8 message or `salt(16) · iv(12) · ciphertext`.
- **Placement doesn't matter**: a reader collects the tag characters in order
  and shifts them back down, so appended and scattered payloads decode the same.

## The detector catches more than its own trick

The **Inspect & clean** panel isn't limited to Ghost Ink's Tags-block carrier.
It X-rays text for the whole family of hidden or deceptive characters a defender
has to watch, colour-coded by category, and strips them on request:

- **Tags block** (U+E0000–U+E007F) — the ASCII-smuggling carrier, decoded as a
  possible Ghost Ink payload.
- **Variation selectors** (U+FE00–FE0F, U+E0100–E01EF) — the "emoji smuggling" carrier.
- **Zero-width & format** characters (ZWSP, ZWNJ, ZWJ, word joiner, BOM, soft hyphen…).
- **Bidirectional controls** (RLO/LRO/…) — the Trojan Source display-reordering trick.
- **Unusual spaces** (NBSP and friends) that stand in for ordinary spaces.

Built-in examples load a Tags spam lure, a zero-width payload, and a bidi
(Trojan Source) case so you can see each light up.

## Honest limitations

- **Hiding the content is strong; hiding its existence is not.** The AES-GCM
  layer protects what the message says. The *presence* of a payload is trivial
  to detect — the Inspect panel does it in one pass, and published filter
  signatures already flag this carrier.
- **It doesn't survive everywhere.** Many platforms and editors normalize or
  strip tag characters on paste or send, so the hidden layer can silently vanish
  in transit.
- **Not a covert channel.** This is a teaching model of a known technique, not a
  way to move messages past a real adversary.

## Run it

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server
```

Deployed to GitHub Pages from `main` via the included workflow.

## Install it as an app

Served over HTTPS (as on GitHub Pages), Ghost Ink is an installable **PWA** — it
works offline and gets its own home-screen icon. No accounts, no fees.

- **Android (Chrome):** tap the in-page **⬇ Install app** button, or Chrome's
  "Install app" menu item.
- **iPhone / iPad (Safari):** **Share → Add to Home Screen** (the in-page button
  shows these steps).

For actual **App Store / Play Store** listings, the repo is scaffolded for
[Capacitor](https://capacitorjs.com/) — see **[MOBILE.md](MOBILE.md)** for the
full build-and-submit walkthrough (this needs Xcode / Android Studio and the
respective developer accounts).

## Project layout

```
index.html                    the entire web app (markup, styles, logic — no build step)
manifest.webmanifest          PWA manifest (name, icons, standalone display)
sw.js                         service worker — offline support for the installed app
icons/                        generated app icons (PNG + SVG, incl. maskable + apple-touch)
build.mjs                     assembles dist/ for native shells (not needed for the web app)
capacitor.config.json         native app identity for Capacitor (iOS/Android)
package.json                  test + build + Capacitor scripts
MOBILE.md                     install-as-PWA and native App Store / Play Store guide
test/roundtrip.mjs            independent decoder that checks the four invariants
.github/workflows/pages.yml   run the test, then deploy to GitHub Pages on push to main
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow runs `node test/roundtrip.mjs`, and only deploys if
   the test passes.

## Test

Invariants are checked by an independent decoder (it does not import the page's
own encoder):

```
node test/roundtrip.mjs
```

## License

MIT — see [LICENSE](LICENSE).
