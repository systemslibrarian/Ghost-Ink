# Ghost Ink

Hide a message in the invisible Unicode **Tags** block (U+E0000–U+E007F), then
detect and strip it. The core is one self-contained HTML page — no build step,
no backend — and it installs as an app (PWA) on desktop, Android, and iPhone.

**[Live demo](https://systemslibrarian.github.io/Ghost-Ink/)**

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

## Play with it

Four panels turn the technique into something you do rather than read about:

- **Spot the Ghost** — five ordinary-looking messages, some carrying a payload.
  Mark your guesses and check. You cannot win by looking harder, which is the point.
- **What the model reads** — the prompt-injection case, shown from both sides: the
  string the human reviews next to the same string as a language model receives it,
  with the smuggled instruction lit up. (This panel maps the instruction *straight*
  into the Tags block — no container, no Base64 — because that is what a real
  injection does: it wants the model to read the text, not to decode it.)
- **Does it survive the trip?** — the "it doesn't survive everywhere" limitation,
  made measurable. The page emits a probe carrying a known count of every category;
  you route it through Slack, Gmail, Notes, your CMS, whatever, paste it back, and
  get a per-category survival report.
- **Leak tracer** — one document, several recipients, a different invisible
  watermark scattered through each copy. Paste a leaked copy back and it names the
  recipient. A real deployed use of the technique, not a hypothetical.
- **Hide it behind one emoji** — Paul Butler's framing of the variation-selector
  trick. Selectors bind to the character in front of them, so a whole message can
  ride on a single glyph. (The hosts on offer are all single codepoints on purpose:
  an emoji like ❤️ already ends in U+FE0F, which would corrupt the payload.)
- **Look-alike forge** — the homoglyph family, which is the opposite of everything
  else here: nothing is hidden, the characters are visible impostors. Type a domain
  and it swaps in Cyrillic or Greek lookalikes, then shows the `xn--` Punycode form
  your browser would fall back to.

## The same trick, other disguises

Five more panels, none of which hide anything *in* a character. They are here
because the failure they share is the one that matters: two readers of a single
artefact disagree, and only one of those readers is you.

- **Display order vs. stored order** — Trojan Source (Boucher & Anderson, 2021;
  CVE-2021-42574). Bidi controls change the order text is *drawn* without touching
  the order it is *stored*. The right-hand pane puts every character in its own
  isolated inline-block, which defeats bidi reordering, so what you read there is
  genuinely the storage order a compiler or filesystem sees.
- **What a scraper reads** — no unusual codepoint at all. The text is ordinary;
  the *renderer* is told not to draw it, via `color:#fff`, `display:none`, or
  off-screen positioning. `textContent` returns every word. This is how prompt
  injection actually arrives on the open web, and it is exactly the case the
  Inspect panel cannot catch — the concealment is in the CSS, not the encoding.
- **What actually reaches your clipboard** — pastejacking. The block shows one
  command and copying it yields another. The substitute is inert and announces
  itself; the mechanism is the lesson, and a demo that handed you a working
  command would be the thing it warns about.
- **Clean before, dirty after** — a blocklist that checks a string *before* the
  system normalises it is checking something that will not exist by the time it
  matters. `ａｄｍｉｎ` passes and NFKC turns it into `admin`; `api_toKen` (with a
  Kelvin sign) survives NFKC and dies only to case folding, which is the sharper
  lesson: normalising is not enough unless you apply *every* transform the system
  will apply.
- **The low bit of a picture** — LSB stego on a canvas. Bit 0 of every red, green
  and blue byte carries one bit of payload, a change of at most 1/255 per channel;
  the difference view amplifies 64× before anything is visible. Same container
  format as every text carrier here, different medium underneath. Your own image
  can be loaded and never leaves the browser.

## How it works

```
secret → UTF-8 bytes → [optional AES-256-GCM] → Base64
       → map each char c to U+(0xE0000 + codepoint(c))
       → weave into cover text (append or scatter)
```

The **Show your work** button in the Hide panel walks that pipeline step by step
using the actual values that produced the result on screen.

- **Encryption** (optional): AES-256-GCM, key from your passphrase via
  PBKDF2-SHA256 (210,000 iterations). Runs in the browser with WebCrypto —
  no bytes leave the page.
- **Container** (before Base64): byte 0 version, byte 1 flags (plaintext or
  GCM), then either the UTF-8 message or `salt(16) · iv(12) · ciphertext`.
- **Placement doesn't matter**: a reader collects the tag characters in order
  and shifts them back down, so appended and scattered payloads decode the same.

### Three carriers, one container

The container format and the crypto are carrier-independent — only the last mile
changes, and the Hide panel lets you pick it. The Find panel is not told which was
used: it tries each and accepts the first that yields a valid container.

| Carrier | Block | Cost per byte | Notes |
| --- | --- | --- | --- |
| **Unicode Tags** | U+E0000–E007F | 1.33 chars | Mirrors ASCII. The ASCII-smuggling carrier. |
| **Variation selectors** | U+FE00–FE0F, U+E0100–E01EF | 1 char | Exactly 256 slots, so one selector carries one whole byte. The "emoji smuggling" carrier. |
| **Zero-width** | ZWSP / ZWNJ / ZWJ / word joiner | 4 chars | Two bits per character. Bulky, but the most widely supported. |
| **Trailing whitespace** | U+0020 / U+0009 | 8 chars | SNOW, the 1990s ancestor. Space is 0, tab is 1. Always appended — scattering it through a sentence would be plainly visible. |

The whitespace carrier is in there for a reason beyond nostalgia: it uses no
exotic codepoint at all, so a detector built purely around unusual characters —
like the one on this page — **cannot see it by lookup**. The Inspect panel has to
find it positionally instead, as a run of trailing whitespace. It is the clearest
demonstration on the page that a detector is only as good as the assumption it
was built on.

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
- **Trailing whitespace runs** — the SNOW carrier, caught by position rather than
  by codepoint.
- **Look-alikes** (UTS #39 confusables) — Cyrillic `а`, Greek `ο`, fullwidth `ａ`
  and friends imitating ASCII. These are *visible* impostors, so deleting them is
  the wrong repair: the panel recovers the ASCII skeleton (`раypal.com` is
  pretending to be `paypal.com`) and offers **Copy ASCII-folded text** alongside
  **Copy cleaned text**.

Built-in examples load a Tags spam lure, a zero-width payload, a bidi
(Trojan Source) case, a look-alike domain, and a SNOW payload so you can see each
light up, and the panel X-rays as you type rather than waiting for a button press.

The page also names the tools that already do this in production — VS Code's
`editor.unicodeHighlight.*`, GitHub's bidi banner, the Rust compiler's lint,
browser Punycode display rules, Defender for Office — and is explicit about the
neighbouring fields it *cannot* honestly demonstrate in one HTML file: Meteor-style
stego in a model's token choices, SynthID/green-list watermarking, and LSB stego
in other media.

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
test/carriers.mjs             exercises the page's own three carriers as shipped
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
npm test
```

Two suites:

- `test/roundtrip.mjs` — a deliberately independent re-implementation of the
  decoder, checking the four invariants against the Tags wire format.
- `test/carriers.mjs` — slices the page's *own* pure codec section out of
  `index.html` and exercises all three carriers as shipped: byte round trips,
  advertised cost vs. actual output, survival through both weave modes, encrypted
  payloads, carrier auto-detection, the variation-selector block boundary, SNOW's
  blind spot (asserted, not assumed: a codepoint-only detector sees nothing there),
  and confusable folding.

The five disguise panels are covered by the jsdom pass rather than the unit
suites — including that the scraper panel's sanitiser strips `<script>` elements
and event-handler attributes before rendering a fragment, and that LSB hiding
moves no channel by more than 1.

## License

MIT — see [LICENSE](LICENSE).
