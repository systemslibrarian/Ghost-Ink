# Changelog

All notable changes to Ghost Ink. Dates are the date of the change, not of a
release; this is an exhibit rather than a versioned library.

## 2026-09-07

### Added

* **A fifth carrier: word choice (lexical substitution)**, and a seventh taxonomy
  layer, **Semantics**, to file it under. Bits ride in *which synonym was used*
  rather than in any character, so the output contains no unusual codepoint at
  all. A hand-curated codebook of ~70 groups, each canonically ordered and sized
  2^k, carries one or two bits per coding point. The v2 container is unchanged and
  carrier-independent as before.
* **A dedicated panel** (`#lex-card`) with a cover long enough to demonstrate the
  carrier, a live capacity readout in bits, a swap marker, a decoder, and a
  one-click hand-off to the X-ray so the blind spot can be seen rather than
  described.
* **Two detector classes** in the taxonomy — *possession of the codebook* and
  *distributional or stylometric analysis of word choice* — because the existing
  eight could not honestly describe what catches this.
* Primary sources for the new carrier in `docs/REFERENCES.md`: Bennett's 2004
  CERIAS survey, Winstein 1998 (the direct ancestor), and Chapman & Davida's
  NICETEXT as the generation-based cousin that is deliberately *not* implemented.
  Each was checked against its primary source before being listed.

### Changed

* **`docs/KNOWN-GAPS.md` no longer rules out the linguistic layer as a whole.**
  It excluded it on the grounds that it "requires a language model", which is true
  of Meteor and arithmetic coding but not of the codebook-driven kind. Only the
  model-based variant is now listed as absent, and the correction is recorded in
  place rather than quietly edited out.
* The carrier interface gained `coverBound`, `capacity(cover)` and
  `encodeInto(bytes, cover)`. A cover-bound carrier rewrites the cover instead of
  producing a payload for `weave()`, and advertises no cost per byte, because its
  capacity is a property of the cover rather than of the payload.
* Claims that "the Inspect panel finds every text carrier in one pass" are now
  scoped to the *invisible* carriers, in the README, `THREAT-MODEL.md` and
  `KNOWN-GAPS.md`.

### Fixed

* **The comparison-matrix commentary was inverted.** The page claimed a codepoint
  scan "catches six of the ten techniques here and is structurally blind to the
  other four", while the table it describes rendered four caught and six missed.
  It now reads four of eleven and seven blind, and `test/consistency.mjs` derives
  all three numbers from the taxonomy so the sentence cannot drift again.
* Spot the Ghost drew from every registered carrier, which would have thrown once
  a carrier without `encode()` existed. It now draws from the invisible carriers
  only — the game's premise is that inspection is the way to win, which the
  cover-bound carrier defeats.

### Pre-commit audit

* **Carrier-registry iteration is now structurally guarded.** Every
  `Object.keys(CARRIERS)` site in `app.js` must have a `coverBound` guard within
  reach, and a cover-bound carrier must *not* expose `encode()`/`cost()` — so a
  generic caller throws loudly instead of misbehaving quietly. Both assertions are
  in `test/consistency.mjs` and both were mutation-tested against a deliberately
  broken tree.
* **Fail-closed proven on the cover-bound decode path.** The lexical decoder
  truncates using the container's *declared* lengths, which the other carriers
  never had to do. `test/carriers.mjs` now corrupts the declared payload length,
  the salt length and the nonce length in a lex record and asserts every case
  fails closed — plaintext via the CRC framing check, encrypted via GCM
  authentication.
* **Accessibility of the first visible carrier.** The word-choice panel is now in
  the axe walk, and its swap marks are asserted to be explained by visible text —
  not by colour, not by the doubled underline alone, and not by a `title`
  attribute that keyboard and screen-reader users never receive.

### Deliberate blind spots

* `extractPayload` skips cover-bound carriers rather than guessing, so the "find
  one without being told which carrier was used" path cannot find this one. This
  is asserted in `test/carriers.mjs` and guarded in `test/consistency.mjs`, the
  same way SNOW's positional blind spot is asserted rather than assumed.
* No distributional or stylometric detector is implemented. It is named on the
  card and in `THREAT-MODEL.md` as the thing that would catch this, and the page
  does not pretend to be it.
