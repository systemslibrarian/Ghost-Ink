# Ghost Ink on mobile

Ghost Ink is a single static page, and there are two ways to put it on a phone.
Start with the PWA — it needs no accounts, no build tools, and no fees.

---

## 1. Install it as an app (PWA) — works today

Once the site is served over HTTPS (GitHub Pages does this), it's installable on
both platforms straight from the browser. Nothing to build.

**iPhone / iPad (Safari)**
1. Open the site in Safari.
2. Tap **Share** → **Add to Home Screen**.
3. It launches full-screen with its own icon. (There's an in-app **⬇ Install app**
   button that shows these steps.)

**Android (Chrome)**
1. Open the site in Chrome.
2. Tap the **⬇ Install app** button (or Chrome's "Install app" menu item).
3. Confirm the native install prompt.

The PWA works offline after first load (service worker), uses the generated app
icons, and respects light/dark. This is the recommended path for a for-fun demo.

---

## 2. Native App Store / Play Store apps (Capacitor)

Only needed if you want listings in the actual stores. This wraps the same page
in a native shell. It requires developer accounts and platform tooling **on your
own machine** — I scaffolded the config, but these steps run on your Mac.

### What you'll need
- **Node** (already used by the project).
- **iOS:** a Mac with **Xcode**, and an **Apple Developer** account (**$99/yr**)
  to ship to the App Store. CocoaPods (`sudo gem install cocoapods`).
- **Android:** **Android Studio**, and a **Google Play Developer** account
  (**one-time $25**) to ship to Play.

### One-time setup
```bash
npm install                 # pulls in @capacitor/core, cli, ios, android
npm run build               # assembles dist/ from index.html, app.css, app.js, manifest, sw.js, icons
npx cap add ios             # creates the native ios/ project (Mac only)
npx cap add android         # creates the native android/ project
```

### Each time you change the web app
```bash
npm run cap:ios       # build + sync + open Xcode
npm run cap:android   # build + sync + open Android Studio
```
Then Run/Archive from Xcode (iOS) or Build → Generate Signed Bundle (Android),
and submit through App Store Connect / Play Console.

### App identity (already set in `capacitor.config.json`)
- appId: `io.github.systemslibrarian.ghostink`  — change to a domain you control
  before submitting.
- appName: `Ghost Ink`
- webDir: `dist`

The `ios/` and `android/` folders are git-ignored while this is a scaffold; commit
them once you commit to maintaining native builds (they hold signing and native
config you'll want under version control).

---

## Honest note for a "messaging" use

Ghost Ink is a teaching toy, not a secure messenger. Its hidden layer (invisible
Unicode Tags) is **trivially detectable** and is **silently stripped by many
mobile keyboards and messaging apps** — so a hidden message may simply not
survive being sent from a phone. If you actually need private messaging, use an
end-to-end encrypted app like Signal. Keep Ghost Ink for what it's great at:
showing people how this trick works, and how to catch it.
