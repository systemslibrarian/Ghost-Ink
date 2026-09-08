# References

Primary sources first. Where a number or a historical claim appears on the page,
it is traceable to something in this list; where no primary source exists, the
page says so rather than borrowing authority from a secondary one.

## Unicode

* **Unicode Standard, Annex #9: Unicode Bidirectional Algorithm** —
  <https://www.unicode.org/reports/tr9/>. The mechanism behind the display-order
  demonstration: RLO/LRO/PDF and the isolate controls.
* **Unicode Technical Standard #39: Unicode Security Mechanisms** —
  <https://www.unicode.org/reports/tr39/>. Defines confusable detection, the
  skeleton transform, and mixed-script restriction levels. **Ghost Ink implements
  a hand-curated subset, not this standard.** See `KNOWN-GAPS.md`.
* **Unicode Technical Report #36: Unicode Security Considerations** —
  <https://www.unicode.org/reports/tr36/>. The broader catalogue, including the
  normalisation and case-folding hazards demonstrated on the page.
* **Unicode Standard Annex #15: Normalization Forms** —
  <https://www.unicode.org/reports/tr15/>. NFKC is what turns `ａｄｍｉｎ` into
  `admin` after a filter has already approved it.
* **Tags block (U+E0000–U+E007F)** — Unicode Standard, and the deprecation
  history in the character database. The block that gives this project its name.

## Trojan Source

* Nicholas Boucher and Ross Anderson, **“Trojan Source: Invisible
  Vulnerabilities”** (University of Cambridge, 2021) —
  <https://trojansource.codes/>. The primary work.
* **CVE-2021-42574** (bidirectional override) and **CVE-2021-42694** (homoglyph
  identifiers) — the assigned identifiers, and the reason the toolchain responses
  below exist.

## Defensive tooling named on the page

* **Microsoft Security Blog, “ASCII smuggling crosses over from AI prompt
  injection to phishing evasion”**, 3 September 2026 —
  <https://www.microsoft.com/en-us/security/blog/2026/09/03/ascii-smuggling-crosses-over-from-ai-prompt-injection-to-phishing-evasion/>.
  **The primary source for every telemetry figure on this page**: ~21,000 hits on
  8 February 2026; more than 1.3 million on 9 February; more than 2.3 million on
  11 February; a peak of 2.37 million on 26 February; near-zero Sundays; elevated
  for roughly three months, dropping sharply after 15 May 2026; and — the figure
  that matters most — over 99% of the messages flagged by other layers anyway.
* **VS Code Unicode highlighting** — the `editor.unicodeHighlight.*` settings
  (`invisibleCharacters`, `ambiguousCharacters`, `nonBasicASCII`). Verify the
  current names against the VS Code settings documentation before relying on
  them; they are quoted from the editor's own settings UI.
* **GitHub bidirectional-text warning** — the banner shown on blobs and diffs
  containing bidi control characters, added in response to Trojan Source.
* **Rust compiler lint** for bidi codepoints in literals, and the equivalent
  responses in other toolchains.

## Linguistic steganography

The sources behind the word-choice carrier. Each was checked against its primary
source before it was listed here.

* Krista Bennett, **“Linguistic Steganography: Survey, Analysis, and Robustness
  Concerns for Hiding Information in Text”**, CERIAS Tech Report 2004-13, Purdue
  University —
  <https://www.cerias.purdue.edu/assets/pdf/bibtex_archive/2004-13.pdf>. The
  survey that frames the field, and the reason the word-choice carrier is filed
  as its own layer here rather than as another encoding trick: it separates
  approaches that *modify* an existing cover from approaches that *generate* one.
* Keith Winstein, **“Lexical Steganography Through Adaptive Modulation of the Word
  Choice Hash”** (1998) — <http://web.mit.edu/keithw/tlex/>. The direct ancestor
  of the carrier implemented here: bits are carried by which member of a set of
  interchangeable words appears. Ghost Ink reimplements the *idea* with a small
  hand-built codebook, not Winstein's hash construction or his thesaurus.
* Mark Chapman and George Davida, **“Hiding the Hidden: A Software System for
  Concealing Ciphertext as Innocuous Text”** (NICETEXT), ICICS 1997, LNCS 1334,
  pp. 335–345 — DOI [10.1007/BFb0028489](https://doi.org/10.1007/BFb0028489). The
  generation-based cousin: rather than substituting words in a cover, it
  *produces* cover text from dictionaries and sentence templates. **Nothing here
  is taken from it**; it is cited to mark the boundary of what this page does not
  do.

**Two fields above are contested in the literature, and are recorded rather than
silently picked.** Winstein's year follows the author's own page; some third-party
indexes date it 1999, and the primary source wins. The Chapman–Davida start page
appears as both 333 and 335 across secondary sources citing the same chapter — the
DOI is authoritative and resolves it for anyone who needs the exact range.

## Secondary reporting

* Dan Goodin, **“Once popular for attacking AI, ASCII smuggling is embraced by
  spammers,”** *Ars Technica*, 4 September 2026 —
  <https://arstechnica.com/security/2026/09/once-popular-for-attacking-ai-ascii-smuggling-is-embraced-by-spammers/>.
  Useful context; not used as a source for any figure.

## Historical and adjacent techniques

* **SNOW** (Matthew Kwan) — whitespace steganography using trailing spaces and
  tabs. The ancestor of the trailing-whitespace carrier here. The original tool
  and its description are the reference; this page reimplements the *idea*, not
  the file format.
* **Smuggling data through variation selectors** — Paul Butler's framing of the
  emoji carrier, which is what the emoji panel demonstrates.
* **Meteor** (Kaptchuk et al.) and arithmetic-coding steganography over language
  models — provably-secure linguistic stego, named on the page as something it
  deliberately does *not* implement. The word-choice carrier that *is* implemented
  is the codebook-driven kind (see **Linguistic steganography** above); it needs no
  model, and it makes none of the security claims that the model-based schemes do.
* **SynthID-Text** (Google DeepMind) and green-list watermarking (Kirchenbauer et
  al.) — watermarking generated text rather than smuggling into it.

## A note on the pull quote

The page contains one blockquote summarising why the same mechanism serves both
prompt injection and filter evasion. **It is not a quotation.** It is the
project's own summary, and it is labelled as such in the markup. An earlier
version of this page presented similar wording as a quotation attributed to
Microsoft via Ars Technica; that attribution could not be verified against either
source and was removed.
