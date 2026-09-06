// Assemble the static web app into dist/ — used by Capacitor for native shells
// (and usable by any static host). The site also deploys straight from the repo
// root to GitHub Pages, so this is only needed for the native builds.
import { cpSync, rmSync, mkdirSync } from "node:fs";

const OUT = "dist";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const f of ["index.html", "manifest.webmanifest", "sw.js"]) cpSync(f, `${OUT}/${f}`);
cpSync("icons", `${OUT}/icons`, { recursive: true });

console.log("built dist/ (index.html, manifest.webmanifest, sw.js, icons/)");
