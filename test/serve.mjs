/* Minimal static server over dist/, so the browser suites exercise the artefact
 * that is actually deployed — CSP header included — rather than the sources. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const ROOT = new URL("../dist/", import.meta.url).pathname;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json",
};

export function serve(port = 0) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end("no"); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        "content-type": TYPES[extname(file)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(body);
    } catch { res.writeHead(404).end("not found"); }
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}

if (process.argv[1] && process.argv[1].endsWith("serve.mjs")) {
  const port = Number(process.env.PORT || 4173);
  await serve(port);
  console.log(`serving dist/ on http://127.0.0.1:${port}`);
}
