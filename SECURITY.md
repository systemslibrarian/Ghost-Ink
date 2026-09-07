# Security policy

## What this project is

Ghost Ink is an educational exhibit that demonstrates text-concealment and
text-deception techniques, and the defensive boundaries that do and do not catch
them. It is not a security product and should not be used as one. Read
`docs/THREAT-MODEL.md` before drawing conclusions about what it protects, and
`docs/KNOWN-GAPS.md` for what it does not.

## Reporting a vulnerability

Open an issue at <https://github.com/systemslibrarian/Ghost-Ink/issues>, or use
GitHub's private vulnerability reporting on the repository if the issue is
sensitive.

Because the application is static, client-side and has no backend, the realistic
vulnerability classes are narrow, and reports in these areas are especially
welcome:

* **An escape from the scraper panel's rendering boundary.** That panel accepts
  hostile markup by design. If you can make it execute script, issue any network
  request, navigate the page, restyle the parent application, or read anything
  from the parent, that is a real finding. `e2e/security.spec.js` documents the
  twenty cases already covered.
* **A container record that is decoded when it should be refused**, or that is
  reinterpreted rather than rejected — particularly any way to have an encrypted
  record read down the plaintext path. See `docs/CONTAINER.md`.
* **Any CSP bypass**, or any third-party network request from the deployed page.
  The page is intended to make no off-site request whatsoever.
* **A cryptographic error** in the v2 container, its use of AES-GCM, or its
  associated-data construction.

## Out of scope

* That a payload's *existence* is detectable. This is the project's central,
  documented limitation, not a bug.
* The strength of a passphrase a user chooses, and the entropy estimate shown for
  generated ones.
* Techniques demonstrated on the page working as intended.
* The legacy v1 container being weaker than v2. It is decode-only, is labelled as
  legacy in the UI, and is never written.

## Supported versions

The deployed `main` branch is the only supported version.
