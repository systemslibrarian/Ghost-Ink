import { test, expect } from "@playwright/test";

/* The scraper panel accepts hostile markup on purpose. These tests are the
 * reason that is defensible: they attack it, and assert nothing gets out. */

const HOSTILE = [
  { name: "script element", html: `<p>hi</p><script>window.__pwned = "script"<\/script>` },
  { name: "event handler", html: `<p onmouseover="window.__pwned='onmouseover'" onclick="window.__pwned='onclick'">hover me</p>` },
  { name: "img onerror", html: `<img src="x" onerror="window.__pwned='onerror'">` },
  { name: "remote image", html: `<img src="https://example.invalid/tracker.png">` },
  { name: "svg with script", html: `<svg><script>window.__pwned='svg'<\/script><use href="https://example.invalid/x#y"/></svg>` },
  { name: "iframe", html: `<iframe src="https://example.invalid/"></iframe>` },
  { name: "object and embed", html: `<object data="https://example.invalid/x"></object><embed src="https://example.invalid/y">` },
  { name: "javascript: link", html: `<a href="javascript:window.__pwned='href'">click</a>` },
  { name: "form action", html: `<form action="https://example.invalid/collect"><input name="a"><button>go</button></form>` },
  { name: "style element", html: `<style>body{background:url("https://example.invalid/x")}</style><p>hi</p>` },
  { name: "css url()", html: `<p style="background:url('https://example.invalid/x')">hi</p>` },
  { name: "css @import", html: `<p style="@import url('https://example.invalid/x')">hi</p>` },
  { name: "meta refresh", html: `<meta http-equiv="refresh" content="0;url=https://example.invalid/">` },
  { name: "base tag", html: `<base href="https://example.invalid/">` },
  { name: "malformed unclosed script", html: `<p>a</p><script>window.__pwned='unclosed'` },
  { name: "nested and case-mixed", html: `<DiV><ScRiPt>window.__pwned='case'<\/ScRiPt><P OnClIcK="window.__pwned='case2'">x</P></DiV>` },
  { name: "entity-encoded handler", html: `<p onclick="&#119;indow.__pwned='entity'">x</p>` },
  { name: "srcdoc smuggling", html: `<iframe srcdoc="<script>parent.__pwned='srcdoc'<\/script>"></iframe>` },
  { name: "link stylesheet", html: `<link rel="stylesheet" href="https://example.invalid/x.css"><p>hi</p>` },
  { name: "video with poster", html: `<video poster="https://example.invalid/p.jpg" src="https://example.invalid/v.mp4"></video>` },
];

test.describe("hostile scraper input", () => {
  for (const c of HOSTILE) {
    test(`${c.name} is neutralised`, async ({ page }) => {
      const offsite = [];
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (!url.startsWith("http://127.0.0.1:4173")) { offsite.push(url); return route.abort(); }
        return route.continue();
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));

      await page.goto("/index.html");
      const titleBefore = await page.title();
      const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

      await page.fill("#scrIn", c.html);
      await page.click("#scrBtn");
      await page.waitForTimeout(250);
      // give any injected handler a chance to fire
      await page.locator("#scrRendered").hover().catch(() => {});
      await page.waitForTimeout(150);

      expect(await page.evaluate(() => window.__pwned), `${c.name} executed`).toBeUndefined();
      expect(await page.evaluate(() => document.body.dataset.pwned)).toBeUndefined();
      expect(offsite, `${c.name} initiated an off-site request`).toEqual([]);
      expect(page.url(), `${c.name} navigated the page`).toContain("/index.html");
      expect(await page.title(), `${c.name} changed the document`).toBe(titleBefore);
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
        `${c.name} restyled the parent application`).toBe(bgBefore);
      // nothing escaped into the parent's live DOM
      expect(await page.evaluate(() =>
        document.querySelectorAll("#scrRendered script, #scrRendered form, #scrRendered object, #scrRendered embed").length)).toBe(0);
      expect(await page.evaluate(() => document.querySelectorAll("#scrRendered iframe").length),
        "exactly one frame, the sandbox").toBe(1);
      expect(errors.filter((e) => !/ResizeObserver/.test(e))).toEqual([]);
    });
  }

  test("the allowlist reports what it refused", async ({ page }) => {
    await page.goto("/index.html");
    await page.fill("#scrIn", `<p onclick="x()">kept</p><script>1<\/script><img src=x>`);
    await page.click("#scrBtn");
    const stat = await page.locator("#scrStat").textContent();
    expect(stat).toContain("refused by the allowlist");
    expect(stat).toContain("<script>");
    expect(stat).toContain("<img>");
    expect(stat).toContain("@onclick");
  });

  test("no user-supplied string reaches the sandbox as markup or CSS", async ({ page }) => {
    await page.goto("/index.html");
    await page.fill("#scrIn", `<p style="color:#fff;background:url(https://example.invalid/x);--evil:1">hidden</p>`);
    await page.click("#scrBtn");
    const srcdoc = await page.locator("#scrRendered iframe").getAttribute("srcdoc");
    expect(srcdoc).not.toContain("example.invalid");
    expect(srcdoc).not.toContain("url(");
    expect(srcdoc).not.toContain("--evil");
    expect(srcdoc).not.toContain("style=");
    // the declaration selected a pre-authored class instead
    expect(srcdoc).toContain('class="c-white"');
  });
});

test.describe("page-level policy", () => {
  test("a restrictive CSP is served and nothing inline exists to need loosening", async ({ page }) => {
    await page.goto("/index.html");
    const csp = await page.evaluate(() =>
      document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || "");
    for (const d of ["default-src 'none'", "object-src 'none'", "base-uri 'none'",
                     "form-action 'none'", "frame-ancestors 'none'", "script-src 'self'"]) {
      expect(csp).toContain(d);
    }
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(await page.evaluate(() => document.querySelectorAll("script:not([src])").length)).toBe(0);
    expect(await page.evaluate(() => document.querySelectorAll("style").length)).toBe(0);
    // What CSP governs is the *served* document: inline style attributes are parsed
    // from markup. Styles the app later sets through CSSOM are not policy-relevant,
    // so assert against the response body rather than the live DOM.
    const served = await (await page.request.get("/index.html")).text();
    expect(served.match(/\sstyle="/g), "no style attribute in the served markup").toBeNull();
    expect(served.match(/\son[a-z]+="/g), "no inline handler in the served markup").toBeNull();
  });

  test("the whole exhibit loads without a single third-party request", async ({ page }) => {
    const offsite = [];
    page.on("request", (r) => { if (!r.url().startsWith("http://127.0.0.1:4173")) offsite.push(r.url()); });
    await page.goto("/index.html");
    // touch every panel that could conceivably fetch something
    for (const id of ["#revealBtn", "#hideBtn", "#inspectBtn", "#gameCheck", "#mevBtn",
                      "#survCheck", "#wmStamp", "#emBtn", "#hfBtn", "#tsEx1", "#scrEx1",
                      "#pjReveal", "#nzEx1", "#imgHide", "#imgFind"]) {
      await page.click(id).catch(() => {});
    }
    await page.waitForTimeout(400);
    expect(offsite).toEqual([]);
  });
});
