# Threat model

Ghost Ink is a teaching exhibit. It is not a covert channel, not a messaging
product, and not a security control. This document says precisely what it does
and does not defend, because a page about hidden claims should not make any.

## The two properties, which are not the same

The single most important distinction in this project:

| | What protects it | How strong |
| --- | --- | --- |
| **Confidentiality of the message** | AES-256-GCM with a key derived from your passphrase by PBKDF2-SHA256 | Real. As strong as the passphrase. |
| **Concealment of the message's existence** | Invisible Unicode characters | Not a security property at all. |
| **Concealment, word-choice carrier only** | The codebook, which is published in `app.js` | Not a security property either — and the codebook is not secret. |

Encrypting the payload protects *what it says*. Nothing here protects *that it is
there*. The Inspect panel on this page finds any of the *invisible* text carriers
in a single pass, Microsoft ships a signature for the Tags carrier in Defender for
Office, and VS Code highlights invisible characters by default. Treat the presence
of a payload as public.

**The word-choice carrier is the one deliberate exception, and it is a narrower
one than it first appears.** It defeats representation-layer inspection
completely: every codepoint it emits is ordinary ASCII, so the codepoint X-ray,
the positional whitespace pass and the confusable pass are all structurally blind
to it, and nothing survives-in-transit strips it. What still catches it:

* **Possession of the codebook.** It ships in `app.js`, in the clear, and decoding
  with it is trivial. This is not a key and must never be treated as one — Ghost
  Ink's codebook is public, so anyone can read anything it writes.
* **Distributional or stylometric analysis.** Substituted prose has word
  frequencies its author would not have produced. This page does *not* implement
  such a detector, and says so rather than implying the gap is covered.
* **A careful human reader.** Unlike every other carrier here, this one changes
  the visible text. A reader who knows the author's voice may simply notice.

So the honest framing is not "this one is undetectable" but "this one moves the
detection problem out of the representation layer, where all of this page's
detectors live, and into statistics, where none of them do."

If you need the existence of a message hidden from a capable adversary, this
class of technique is the wrong tool. See `KNOWN-GAPS.md` for what is not.

## What runs where

Everything runs in the browser. There is no backend, no telemetry, no analytics,
and — since the Google Fonts dependency was removed — no third-party network
request of any kind. A passphrase, a secret, or an uploaded image never leaves the
tab. The Content-Security-Policy in the deployed page enforces this rather than
merely promising it: `default-src 'none'`, `connect-src 'self'`, `object-src
'none'`, `form-action 'none'`.

Consequences worth being explicit about:

* Anything you type is in your browser's memory and may reach disk through normal
  browser mechanisms (swap, session restore, crash reports). This page cannot
  prevent that.
* The exhibit is deliberately installable and works offline, which means the code
  is cached locally. Cache identity is content-derived so a stale build cannot be
  served indefinitely.

## Adversaries this project *does* model

**A reader who is shown hostile content.** Every demonstration exists to make one
thing visible to that reader: which layer their inspection covers, and which it
does not. The comparison matrix on the page is the summary.

**A hostile fragment pasted into the scraper panel.** This is the only place the
application knowingly processes attacker-controlled input, and it is treated as
such. Two independent boundaries:

1. **An allowlist, not a blacklist.** The fragment is parsed and *discarded*; a
   new document is built from a fixed set of elements and a fixed set of class
   names. No user-supplied string ever becomes markup, an attribute value, or CSS.
   There is consequently no `url()`, `@import`, `javascript:`, SVG payload or
   event handler to filter, because nothing user-supplied reaches a position
   where those would be interpreted.
2. **A sandboxed iframe** with every permission withheld — no scripts, no
   same-origin, no forms, no popups, no top-level navigation, no plugins —
   inheriting the page CSP, which additionally denies it network reach.

`e2e/security.spec.js` attacks this with twenty hostile fragments and asserts that
none of them executes script, issues an off-site request, navigates the page,
restyles the parent application, or escapes the frame.

**A tampered container.** The v2 format authenticates all of its own metadata as
AES-GCM associated data, and refuses — rather than reinterprets — records with an
unknown version or mode, impossible lengths, trailing bytes, or a key-derivation
iteration count outside a sane band. The specific attack it is designed to stop is
flipping the mode byte so an encrypted record is re-read down the unauthenticated
plaintext path. See `CONTAINER.md`.

## Adversaries this project does *not* model

* **Anyone trying to detect that a payload exists.** Stated above; it is the
  central limitation, not a footnote.
* **Traffic analysis, side channels, or timing.** Out of scope entirely.
* **A malicious host.** If the page itself is served to you modified, nothing
  here helps. Subresource integrity is not used because the app is same-origin
  and static; the deployed artefact is small enough to read.
* **Passphrase strength.** The meter in the UI is an entropy *estimate* for a
  randomly generated string. It is not a judgement about a passphrase you chose,
  and it cannot be.
* **A capable attacker against the plaintext container.** The CRC-32 in mode 0 is
  framing. It rejects noise and flipped-mode records. It is not authentication
  and is never described as such.
* **Detection of lexical substitution.** No distributional or stylometric
  detector is implemented. The word-choice card states what would catch it; the
  page does not pretend to be that thing. `KNOWN-GAPS.md` has the detail.
* **Look-alike characters at standards coverage.** The confusable table is a
  hand-curated working subset inspired by UTS #39, not an implementation of it.
  It is sized to make a demonstration legible, not to detect impostors in the
  wild. `KNOWN-GAPS.md` has the detail.

## What a reader should take away

A detector only sees the layer it was designed to inspect. Every panel on the page
names the class of inspection that would have caught it and the classes that are
structurally blind to it. That is the whole argument, and the reason the exhibit
includes techniques its own detector cannot find.
