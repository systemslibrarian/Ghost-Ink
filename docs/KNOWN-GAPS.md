# Known gaps

Deliberately a top-level document rather than a footnote. If you are evaluating
this project, read this before the README's claims.

## The central one

**Ghost Ink hides content well and hides the existence of content not at all.**
Encryption protects what a payload says. Nothing here protects the fact that a
payload is present — the page's own Inspect panel finds every *invisible* text
carrier in one pass. This is stated in the UI, in the README and in
`THREAT-MODEL.md`, and it is not a limitation that can be engineered away within
this class of technique.

The one carrier that escapes that pass is **word choice**, and it does so by
giving up invisibility rather than by beating the detector: it rewrites the cover
text instead of hiding beside it, so there is nothing unusual left to find. What
it costs to do that, and what still catches it, is set out under **The word-choice
carrier specifically** below.

## Standards coverage

* **The confusable table is a hand-curated subset, not UTS #39.** It contains
  roughly 150 mappings chosen to make the demonstration legible: common Cyrillic
  and Greek look-alikes, Armenian and Cherokee samples, the fullwidth Latin block,
  and a few letterlike forms. The real standard has thousands of entries, defines
  a skeleton algorithm this page approximates rather than implements, and adds
  mixed-script restriction levels that are not implemented at all. The UI and the
  README label it as a working subset. **Do not use it as a confusable detector.**
  Vendoring `confusables.txt` and recording the Unicode version is the correct
  fix, and has not been done.
* **Mixed-script detection is reported, not enforced.** The panel names the
  scripts it found; it does not implement UTS #39 restriction levels.
* **The synonym codebook is a hand-curated working subset too**, and for the same
  reason: legibility over coverage. Roughly seventy groups of two or four
  interchangeable words, hand-picked for one register of business English. It is
  not a thesaurus, it is not derived from one, and it encodes no notion of sense,
  part of speech or collocation — so a substitution that is wrong for the
  sentence is possible and the prose reads a little unnaturally. Groups are sized
  2^k purely so the arithmetic is a rank rather than a range coder.
* **The bidi demonstration is illustrative, not a compiler test.** It shows that
  drawn order and stored order disagree, which is verified in the browser by
  measuring glyph positions. It does not compile anything, and the source-comment
  example is written to be legible rather than to be a working exploit against a
  specific language.

## The word-choice carrier specifically

It is the only carrier here that behaves unlike the other four, and each
difference is a limitation worth stating separately.

* **It changes the visible text.** Every other carrier on this page is
  *invisible*: the cover is untouched and the payload rides alongside it. This one
  rewrites the cover. It is semantically innocent, not visually absent. A reader
  who knows the author's voice may notice, and that is not a detector this page
  can measure.
* **Capacity is cover-dependent, and terrible.** There is no cost-per-byte figure
  because there cannot be one: capacity is a property of how many codebook words
  the cover already contains. A group of four carries two bits, a pair carries
  one. The container is 21 bytes before the message even starts, so a
  two-character secret needs 184 bits — and the demonstration cover of roughly
  seven hundred words carries only a little over three hundred. This is the
  honest headline cost of linguistic steganography, and the panel states it in
  bits rather than hiding it.
* **It fails closed on insufficient cover, which is the common case.** Picking it
  in the main Hide panel against the default cover text will refuse, by design.
* **The codebook is public and is not a key.** It ships in `app.js`. Anyone can
  decode anything it writes. Confidentiality still comes only from the AES-GCM
  path, exactly as with every other carrier.
* **Auto-detection cannot find it, deliberately.** `extractPayload` skips
  cover-bound carriers rather than guessing, because "was this the author's word
  or the codebook's?" has no answer from the text alone. `test/carriers.mjs`
  asserts the blind spot rather than assuming it, the same way SNOW's is asserted.
* **No stylometric detector is implemented.** Distributional analysis of word
  choice is the thing that would actually catch this, and it is named on the card
  and in `THREAT-MODEL.md` as the detector this page does not have.
* **Only the plaintext path has a panel.** The carrier itself round-trips
  AES-GCM payloads and `test/carriers.mjs` proves it, but the encrypted container
  is 61 bytes before the message starts, which needs a cover far longer than a
  card can reasonably show. The dedicated panel reads plaintext only and says so.

## Open defects

* **`snow.count()` reports a single trailing space as a payload signal.** It
  returns the length of any trailing whitespace run, so *any* text ending in one
  ordinary space makes `extractPayload` report "invisible characters present, but
  they aren't a Ghost Ink payload" instead of nothing at all. The Inspect panel is
  unaffected — its positional pass requires a run of four — so this shows up only
  in the Find panel's wording on text that happens to end in a space.
  The word-choice tests work around it by trimming their generated covers, and
  the comment there points here. **The whitespace carrier is deliberately
  unchanged**: fixing `count()` touches the carrier that four other suites assert
  against, and that is its own change with its own risk, not a rider on this one.

## Data and claims

* **Only the telemetry figures Microsoft published are plotted.** Weekdays between
  the published dates ran between roughly 1 million and the 2.37 million peak but
  were not published as daily values, so no line is drawn through them. An earlier
  version of this page invented a plausible daily series and annotated the peak on
  the wrong date.
* **Survivability in the comparison matrix is a general expectation, not a
  measurement.** The survivability lab exists so you can measure the paths you
  care about; nothing on the page is derived from a systematic survey.
* **No WCAG conformance is claimed.** See below.

## Testing

* **Accessibility is checked, not certified.** `e2e/a11y.spec.js` runs axe-core
  against the WCAG 2.0/2.1 A and AA rule tags and fails on serious and critical
  violations, and separately checks keyboard reachability, visible focus, 200% and
  400% zoom, a narrow viewport, both colour schemes, reduced motion, and that
  invisible characters are explained by text rather than colour alone. Automated
  rules cover a minority of the success criteria. **No manual screen-reader audit
  has been performed**, and no conformance level is claimed.
* **Offline and service-worker behaviour is only asserted in Chromium.** Firefox
  and WebKit run every other browser suite; the offline emulation used for the PWA
  tests is not reliable across all three here, so those tests skip elsewhere.
* **The keyboard-reachability floor is lower in WebKit.** Safari's default is that
  Tab moves between form fields only, unless the user enables "Press Tab to
  highlight each item". That is a platform setting rather than something the page
  controls, so the test asserts a lower reachability floor there. The assertion
  that nothing takes focus *invisibly* is enforced identically in all three
  engines.
* **No visual regression testing.** Layout is checked for overflow and stacking,
  not for appearance.
* **Installability is checked, not exercised.** `e2e/pwa.spec.js` validates the
  manifest and fetches every icon it declares, and proves the app works with the
  network cut. The browser's actual install prompt cannot be driven from an
  automated test, so no test asserts that a real installation succeeds.
* **The image LSB panel is not tested against re-encoding.** It is asserted to
  round-trip and to move no channel by more than 1; the claim that a lossy
  re-encode destroys the payload is stated in the matrix and not exercised.

## Architecture

* **The CSP relies on a hash of a constant stylesheet.** The sandbox iframe
  inherits the page policy, so its stylesheet is authorised by hash, computed at
  build time and asserted in `test/build.mjs`. If that stylesheet is edited
  without rebuilding, the sandbox renders unstyled — the demonstration degrades,
  it does not become unsafe.
* **No Subresource Integrity.** Everything is same-origin and there are no
  third-party resources, so SRI would add nothing; a malicious host is out of
  scope in the threat model.
* **The native (Capacitor) shells are unverified.** `MOBILE.md` describes the
  route to App Store and Play Store builds. Nothing in CI builds or tests them.

## Layers not represented

The taxonomy organises demonstrations by where two readers disagree: encoding,
appearance, rendering, interaction, transformation, media, semantics. Layers that exist and
are *not* demonstrated here, listed so their absence is visible:

* **Model-based linguistic** — hiding bits in a *language model's* token choices
  (Meteor, arithmetic coding). Requires a model; cannot be done honestly in a
  static page. Note that an earlier version of this document ruled out the
  linguistic layer as a whole on this ground, which was too broad: the
  codebook-driven kind needs no model, and is now implemented as the word-choice
  carrier under the **Semantics** layer. Only the model-based kind is absent.
* **Protocol and transport** — header and metadata channels, timing channels.
* **Filesystem and archive** — alternate data streams, zip comment fields,
  polyglot files.
* **Audio and video** — the same LSB idea in other media.

These are named in `REFERENCES.md`. Adding a card for any of them would be adding
a trick, not closing a conceptual gap in what the page teaches.
