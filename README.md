# Ghost Ink

An educational security exhibit about **text that means different things to
different readers** — and about which class of inspection catches each kind of
disagreement, and which is structurally blind to it.

It hides a message in the invisible Unicode **Tags** block (U+E0000–U+E007F),
then detects and strips it — and then does the same for ten other techniques,
seven of which a codepoint scan would never find. Static, offline-capable, no
backend, and **no third-party network request of any kind**.

**[Live demo](https://systemslibrarian.github.io/Ghost-Ink/)**

## The organising idea

Every technique here is filed by **where the two readers disagree**, not by what
the trick is called, because that is what decides which detector could ever have
caught it:

| Layer | The disagreement is in… | Demonstrated by |
| --- | --- | --- |
| **Encoding** | the bytes | Unicode Tags, variation selectors, zero-width, trailing whitespace |
| **Appearance** | the shape | confusables, bidi controls |
| **Rendering** | what gets drawn | text hidden by CSS |
| **Interaction** | the transfer | clipboard substitution |
| **Transformation** | time — check vs. use | normalisation, case folding |
| **Media** | the medium | image LSB |
| **Semantics** | the words themselves | word choice (lexical substitution) |

The page carries one comparison matrix covering all eleven, and every card that
demonstrates a technique states its **detection boundary**: the class of
inspection that catches it, and the classes that cannot. The lesson the exhibit
is built to deliver is a single sentence:

> A detector only sees the layer it was designed to inspect.

That is why the exhibit deliberately includes techniques its own detector misses.
The trailing-whitespace carrier uses no unusual codepoint at all, so the Inspect
panel — built entirely around unusual codepoints — has to find it positionally or
not at all. The CSS panel it cannot find by any means. Neither can it find the
word-choice carrier, which hides bits in *which synonym was used*: every character
it emits is ordinary, so there is not even a candidate to weigh. The codepoint
scan catches four of the eleven techniques here and is blind to seven.

## Documentation

Read these before relying on any claim here:

* **[docs/THREAT-MODEL.md](docs/THREAT-MODEL.md)** — what is and is not defended.
  The central distinction: encryption protects *what a payload says*; nothing here
  protects *that it exists*.
* **[docs/KNOWN-GAPS.md](docs/KNOWN-GAPS.md)** — everything unsupported, in one
  place, including the limits of the confusable table and of the testing.
* **[docs/CONTAINER.md](docs/CONTAINER.md)** — the v2 wire format and every
  condition on which decoding fails closed.
* **[docs/REFERENCES.md](docs/REFERENCES.md)** — primary sources.
* **[SECURITY.md](SECURITY.md)** — what to report, and what is out of scope.
* **[CHANGELOG.md](CHANGELOG.md)** — what changed and why, including corrections
  to earlier claims.

## Honest limitations, up front

* **Hiding content is strong; hiding its existence is not.** AES-256-GCM protects
  the message. The *presence* of a payload is trivially detectable — this page's
  own Inspect panel does it in one pass for every *invisible* carrier, Microsoft
  ships a Defender signature for the Tags carrier, and VS Code highlights invisible
  characters by default. The word-choice carrier is the exception, and it buys that
  by giving up invisibility: it rewrites your cover text rather than hiding beside
  it. What that costs, and what still catches it, is in
  [docs/KNOWN-GAPS.md](docs/KNOWN-GAPS.md).
* **The synonym codebook is a hand-curated working subset**, roughly 70 groups of
  two or four words in one register of business English. It is not a thesaurus and
  encodes no notion of sense or part of speech, so substituted prose reads a little
  unnaturally.
* **The confusable table is a hand-curated working subset inspired by UTS #39, not
  an implementation of it.** Roughly 150 mappings, chosen for legibility. Do not
  use it as a confusable detector.
* **Survivability figures in the matrix are expectations, not measurements.** The
  survivability lab exists so you can measure the paths you care about.
* **No WCAG conformance is claimed.** Accessibility is *checked* — see below —
  not certified, and no manual screen-reader audit has been done.
* **It does not survive everywhere.** Many platforms normalise or strip these
  characters in transit.

## What is in it

**Core** — hide a message in one of five carriers, find one without being told
which carrier was used, and X-ray any text for the whole family of hidden or
deceptive characters.

**Play with it** — Spot the Ghost (a guessing game you cannot win by looking),
the model's-eye view of a prompt injection, a survivability lab you run through
your own apps, a leak tracer, an emoji that carries a whole message, and a
look-alike forge that shows you the Punycode your browser would fall back to.

**The same trick, other disguises** — display order vs. stored order (Trojan
Source), what a scraper reads when text is hidden by CSS, clipboard substitution,
normalisation and case-folding bypass, least-significant-bit stego in an image,
and a message carried entirely by which synonym was chosen.

## How it works

```
secret → UTF-8 → [optional AES-256-GCM] → v2 container → carrier → cover text
```

The container is independent of the carrier: Unicode Tags, variation selectors,
zero-width, trailing whitespace, word choice and image low-bits all move the same
structure.
The **Show your work** button walks the pipeline using the values that produced
whatever is on screen.

### Carriers

| Carrier | Block | Cost per byte | Notes |
| --- | --- | --- | --- |
| **Unicode Tags** | U+E0000–E007F | 1.33 chars | Mirrors ASCII. The ASCII-smuggling carrier. |
| **Variation selectors** | U+FE00–FE0F, U+E0100–E01EF | 1 char | 256 slots exactly, so one selector carries one byte. |
| **Zero-width** | ZWSP / ZWNJ / ZWJ / word joiner | 4 chars | Two bits per character. |
| **Trailing whitespace** | U+0020 / U+0009 | 8 chars | SNOW. No exotic codepoint — which is the point. |
| **Word choice** | no block at all | 0 chars added | Lexical substitution. Cover-bound: capacity is a property of the cover, not the payload, so there is no per-byte figure. |

### Container v2

Full specification and rationale in [docs/CONTAINER.md](docs/CONTAINER.md). The
short version:

* An explicit `GHST` magic, version, mode, KDF identifier, **KDF iteration count**,
  declared salt/nonce/payload lengths, then the payload.
* For encrypted records the **entire header, salt and nonce are passed to AES-GCM
  as associated data**, so none of that metadata can be altered without the tag
  failing.
* Plaintext records are framed with a CRC-32, which is what stops an encrypted
  record being re-read down the unauthenticated plaintext path by flipping the
  mode byte. **The CRC is framing, not authentication**, and is never described
  otherwise.
* Decoding **fails closed** on unknown versions and modes, truncated headers,
  impossible or inconsistent lengths, trailing bytes, ciphertext shorter than the
  GCM tag, an iteration count outside 100,000–2,000,000, a CRC mismatch, and
  authentication failure.
* **v1 is still read** so older material works, is reported as legacy in the UI,
  and is never written.

## Run it

```
npm ci
npm run build     # produces dist/ — the only thing that gets deployed
npm run serve     # http://127.0.0.1:4173
```

`dist/` contains the application and nothing else: no tests, no docs, no tooling.
The build injects two values that must not be maintained by hand — the CSP hash
for the sandbox stylesheet, and the service-worker cache name, derived from a hash
of the asset contents so a content change cannot ship with a stale cache key.

## Security posture of the page itself

* **No third-party network requirement.** Google Fonts was removed in favour of
  system font stacks. `test/build.mjs` asserts that no subresource loads from an
  absolute URL.
* **A restrictive CSP**, generated at build time:
  `default-src 'none'; script-src 'self'; style-src 'self' 'sha256-…'; img-src
  'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none';
  form-action 'none'; frame-ancestors 'none'`. No `unsafe-inline`, no
  `unsafe-eval`. There is no inline script, no inline style block and no style
  attribute anywhere in the page for it to need.
* **The scraper panel accepts hostile markup and does not trust it.** Nothing the
  user writes becomes markup or CSS: the fragment is parsed and discarded, and a
  new document is built from a fixed element allowlist and a fixed set of
  pre-authored class names. It renders inside a sandboxed iframe with every
  permission withheld. `e2e/security.spec.js` attacks it with twenty hostile
  fragments.

## Tests

Everything below is committed and reproducible from a clean clone.

```
npm ci
npm test            # unit + browser
npm run test:unit   # node only, no browsers needed
npm run test:e2e    # Playwright, runs npm run build first
```

**Unit suites** (`npm run test:unit`, plain node, no dependencies):

| Suite | What it covers |
| --- | --- |
| `test/roundtrip.mjs` | A deliberately **independent** re-implementation of the decoder, written from the spec and importing nothing from the app. Checks the invariants and cross-validates v2 against a second implementation. |
| `test/container.mjs` | The v2 format, and above all its refusals: header authentication, the mode-downgrade attack, bounded KDF iterations, truncation, trailing bytes, CRC mismatch, noise rejection, v1 legacy read. |
| `test/carriers.mjs` | All five carriers as shipped — round trips, advertised cost vs. actual output, both weave modes, encrypted payloads, carrier auto-detection, the variation-selector block boundary, and SNOW's blind spot asserted rather than assumed. For the cover-bound word-choice carrier: capacity accounting, fail-closed on insufficient cover, case preservation, that only whole words change, that the codebook is unambiguous, and its blind spot asserted the same way — no unusual codepoint, nothing positional, no look-alike, and auto-detection returning nothing. |
| `test/build.mjs` | That the CSP hash matches the stylesheet it authorises, that the policy is actually restrictive, that no subresource is off-site, that `dist/` contains exactly the application, and that the cache name matches the deployed bytes. |
| `test/consistency.mjs` | Anti-drift. Carrier and panel counts derived from the code rather than typed twice; every taxonomy anchor resolves; every technique is demonstrated by a card and vice versa; every path the README names exists; the corrected telemetry facts cannot regress. |

`test/carriers.mjs`, `test/container.mjs` and `test/consistency.mjs` load the
application's own codec by slicing the pure region out of `app.js`
(`test/lib/slice.mjs`), so they test the shipped file rather than a copy.

**Browser suites** (`npm run test:e2e`, Playwright against `dist/`):

| Suite | What it covers |
| --- | --- |
| `e2e/disguises.spec.js` | The five disguise panels: that both bidi panes hold the identical string, that the stored-order pane is **not itself reordered** by the controls it displays (verified by measuring glyph positions), that hidden text is present in the DOM and occupies no visible area, that copy is replaced with exactly the inert string, that the normalisation examples produce the stated NFKC and case-fold results, that image LSB round-trips, that **no channel moves by more than 1** and alpha is untouched, and that corrupt length headers fail cleanly. |
| `e2e/security.spec.js` | Twenty hostile fragments against the scraper panel — script elements, event handlers, `img onerror`, remote images, SVG script, iframes, `object`/`embed`, `javascript:` URLs, forms, style elements, `url()`, `@import`, meta refresh, `base`, unclosed and case-mixed markup, entity-encoded handlers, `srcdoc` smuggling, remote stylesheets, video posters. Each asserts no execution, **no off-site request**, no navigation, no restyling of the parent, and no escape from the frame. Plus the page-level CSP and a whole-exhibit zero-third-party-request check. |
| `e2e/panels.spec.js` | Clear on every panel that has one, Reset restoring every panel, all four invisible carriers end to end with auto-detection, the word-choice panel round-tripping in the browser while the X-ray reports the result clean, and the encrypted path reporting authentication. |
| `e2e/a11y.spec.js` | axe-core over WCAG 2.0/2.1 A and AA rule tags, failing on serious and critical violations, before and after every panel has produced output — including the word-choice panel, the only carrier whose output is visible prose, whose marks are asserted to be explained by visible text rather than by colour, underline shape or a `title` attribute; full tab-order walk asserting visible focus on every control; keyboard-only operation; invisible characters explained by text not colour; live regions; the chart's text alternative; 200% and 400% zoom without horizontal scroll; a 360px viewport; light and dark contrast; and `prefers-reduced-motion` suppressing all animation. |
| `e2e/pwa.spec.js` | Manifest completeness with every icon fetched, the whole exhibit working with the network cut, a content-derived cache name, and a stale cache generation being evicted rather than stranding the user. |

231 browser tests — 77 per engine across Chromium, Firefox and WebKit, all three
run in CI on every push and pull request. The offline and service-worker tests
skip outside Chromium, and WebKit's keyboard-reachability floor differs because
Safari's Tab default does — both are recorded in
[docs/KNOWN-GAPS.md](docs/KNOWN-GAPS.md) rather than papered over.

## How attackers use this in the wild

The Unicode Tags carrier is a live technique. Microsoft reported hits on its
ASCII-smuggling hunting signature in Defender for Office 365 rising from roughly
21,000 on 8 February 2026 to more than 1.3 million the next day, more than 2.3
million on 11 February, and a peak of **2.37 million on 26 February 2026**, with a
strict weekday cadence and near-zero Sundays, staying elevated for about three
months before dropping sharply after 15 May.

The more useful figure from the same research: **over 99% of those messages were
caught anyway**, by reputation, ML classification, brand-impersonation checks and
authentication — not by noticing the invisible characters. One layer was defeated;
the others held.

Primary source: [Microsoft Security Blog, 3 September 2026](https://www.microsoft.com/en-us/security/blog/2026/09/03/ascii-smuggling-crosses-over-from-ai-prompt-injection-to-phishing-evasion/).
Secondary reporting: [Ars Technica, 4 September 2026](https://arstechnica.com/security/2026/09/once-popular-for-attacking-ai-ascii-smuggling-is-embraced-by-spammers/).
Only the figures Microsoft published are plotted on the page; intermediate
weekdays were not published as daily values and no line is drawn through them.
This project is independent and not affiliated with either.

## Install it as an app

Served over HTTPS, Ghost Ink is an installable PWA: it works offline and gets its
own home-screen icon.

* **Android (Chrome):** the in-page **⬇ Install app** button, or Chrome's
  "Install app" menu item.
* **iPhone / iPad (Safari):** **Share → Add to Home Screen**.

For App Store / Play Store builds the repo is scaffolded for
[Capacitor](https://capacitorjs.com/) — see **[MOBILE.md](MOBILE.md)**. Nothing in
CI builds or tests the native shells.

## Project layout

```
index.html                    markup only — no inline script, style or handlers
app.css                       all styles, including the local font stacks
app.js                        all behaviour, including the synonym codebook and
                              the taxonomy that drives the layer nav, the matrix
                              and the per-card boundaries
sw.js                         service worker; cache name injected by the build
build.mjs                     assembles dist/, computes the CSP hash and cache name
manifest.webmanifest          PWA manifest
icons/                        app icons
docs/                         threat model, container spec, references, known gaps
test/                         node suites + the codec slice helper + a static
                              server + fixtures/ for the independent decoder
e2e/                          Playwright suites
.github/workflows/pages.yml   unit → browser matrix → deploy dist/
.github/dependabot.yml        weekly npm and actions updates
```

## Deploy

Pages deploys `dist/` from `main` after the unit suite and all three browser
projects pass. Pull requests run the same checks without deploying. The deploy job
is the only job granted `pages: write` and `id-token: write`; checkout credentials
are not persisted.

## License

MIT — see [LICENSE](LICENSE).
