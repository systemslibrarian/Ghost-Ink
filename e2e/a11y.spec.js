import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/* Automated accessibility checks plus the manual behaviours automation cannot
 * see. These are *checks*, not a conformance claim — see docs/KNOWN-GAPS.md for
 * what has and has not been evaluated. */

const SECTIONS = ["#play", "#disguises", "#wild", "#inspect-panel"];

test("no axe violations at the serious or critical level", async ({ page }) => {
  await page.goto("/index.html");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const bad = results.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  expect(bad.map((v) => `${v.id} (${v.nodes.length}) — ${v.help}`)).toEqual([]);
});

test("no axe violations after every panel has produced output", async ({ page }) => {
  // Every panel populated means a much larger tree for axe to walk.
  test.setTimeout(120_000);
  await page.goto("/index.html");
  for (const id of ["#revealBtn", "#hideBtn", "#hideRevealBtn", "#hideWorkBtn", "#inspectBtn",
                    "#gameCheck", "#mevBtn", "#survCheck", "#wmStamp", "#emBtn", "#hfBtn",
                    "#tsEx1", "#scrEx1", "#pjReveal", "#nzEx1", "#imgHide",
                    // the word-choice panel is the one carrier whose output is
                    // visible prose, and it must be in the tree axe walks
                    "#lexHide", "#lexMark", "#lexFind"]) {
    await page.click(id).catch(() => {});
  }
  // The scraper panel's sandbox has no script capability by design, so axe cannot
  // inject into it and would wait forever. Its contents are also deliberately
  // hidden-from-rendering sample text — the subject of the demonstration, not part
  // of the application's own interface.
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("#scrRendered")
    .analyze();
  const bad = results.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  expect(bad.map((v) => `${v.id} (${v.nodes.length}) — ${v.help}`)).toEqual([]);
});

test("every interactive control is reachable by keyboard and shows focus", async ({ browserName, page }) => {
  await page.goto("/index.html");
  const controls = await page.locator("button:visible, a[href]:visible, input:visible, textarea:visible, select:visible").count();
  expect(controls).toBeGreaterThan(40);
  // WebKit's default is Safari's: Tab moves between form fields only, unless the
  // user turns on "Press Tab to highlight each item". That is a platform setting,
  // not something the page controls, so the reachability floor differs. What must
  // hold everywhere is that nothing which *does* take focus takes it invisibly.
  const floor = browserName === "webkit" ? 15 : 30;

  // Walk the whole tab order and confirm nothing is a keyboard trap and that the
  // focused element is always visibly distinguishable.
  const seen = new Set();
  let invisibleFocus = [];
  for (let i = 0; i < controls + 10; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const id = el.id || el.tagName + ":" + (el.textContent || "").slice(0, 20);
      // a visible focus ring is either an outline or a box-shadow
      const ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
      return { id, ring, tag: el.tagName };
    });
    if (!info) continue;
    seen.add(info.id);
    if (!info.ring) invisibleFocus.push(info.id);
  }
  expect(seen.size, `tabbing reached ${seen.size} controls in ${browserName}`).toBeGreaterThan(floor);
  expect(invisibleFocus, "these controls take focus without showing it").toEqual([]);
});

test("the primary flow is operable with the keyboard alone", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator("#secret").focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("typed with no mouse");
  await page.locator("#hideBtn").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#hideOut .result-text")).toBeVisible();
});

test("invisible characters are explained by text, not by colour alone", async ({ page }) => {
  await page.goto("/index.html");
  await page.click("#inspectBtn");
  await page.fill("#inspectIn", "plain​text‮!");
  await page.waitForTimeout(250);
  // every chip names the character; colour is redundant, not load-bearing
  const chips = await page.locator("#inspectRender .chip").allTextContents();
  expect(chips.length).toBeGreaterThan(0);
  for (const c of chips) expect(c.trim().length, "chip carries a text label").toBeGreaterThan(2);
  for (const c of chips) expect(c).toMatch(/U\+[0-9A-F]{4}/);
  // and the legend spells out the category names
  await expect(page.locator("#inspectLegend")).toContainText("Zero-width");
  await expect(page.locator("#inspectStat")).not.toHaveText("");
});

/* The test above covers the *invisible* carriers, whose output is chips in the
 * Inspect panel. Word choice is the exhibit's only carrier whose output is
 * ordinary readable prose, so the thing being marked is a real word rather than
 * an absent character — a different a11y problem, and one the Inspect-panel
 * assertions never touch. */
test("substituted words are explained by text, not by colour or a tooltip", async ({ page }) => {
  await page.goto("/index.html");
  await page.fill("#lexSecret", "meet at nine");
  await page.click("#lexHide");
  await page.click("#lexMark");

  const chips = page.locator("#lexOut .chip.lex");
  expect(await chips.count(), "the marked view produced marks").toBeGreaterThan(0);

  // the mark must not eat the word: a substituted word still reads as that word
  for (const text of (await chips.allTextContents()).slice(0, 10)) {
    expect(text.trim(), "a marked chip still carries its word").toMatch(/^[A-Za-z]+$/);
  }
  // and no chip may hide its meaning behind an aria-label that replaces the word
  const labelled = await page.locator("#lexOut .chip.lex[aria-label]").count();
  expect(labelled, "a chip must not substitute a description for the word").toBe(0);

  /* The load-bearing part: what a mark MEANS is stated in visible text, not left
     to the colour, the underline shape, or the title attribute — none of which a
     screen-reader or keyboard user receives. */
  const note = page.locator("#lexOut .lex-legend");
  await expect(note).toBeVisible();
  await expect(note).toContainText("substituted");
  expect((await note.textContent()).trim().length).toBeGreaterThan(40);

  // the chip is distinguished by more than hue: a border and a doubled underline
  const style = await chips.first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { bw: s.borderBottomWidth, bs: s.borderBottomStyle, w: s.borderTopWidth };
  });
  expect(style.bs, "the mark carries a non-colour cue").toBe("double");
  expect(parseFloat(style.bw)).toBeGreaterThan(1);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .include("#lex-card")
    .analyze();
  const bad = results.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  expect(bad.map((v) => `${v.id} (${v.nodes.length}) — ${v.help}`)).toEqual([]);
});

test("live regions announce the panels that update in place", async ({ page }) => {
  await page.goto("/index.html");
  for (const sel of ["#heroDecoded", "#inspectRender"]) {
    expect(await page.getAttribute(sel, "aria-live"), `${sel} announces changes`).toBeTruthy();
  }
  expect(await page.getAttribute("#wildChart", "role")).toBe("img");
  const alt = await page.getAttribute("#wildChart", "aria-label");
  expect(alt.length, "the chart has a real text alternative").toBeGreaterThan(200);
  expect(alt).toContain("2.37 million");
  expect(alt).toContain("26 February");
});

test("readable at 200% and 400% zoom without horizontal scrolling", async ({ page }) => {
  for (const [w, h, label] of [[640, 512, "200%"], [320, 256, "400%"]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/index.html");
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${label}: page scrolls horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
  }
});

test("usable on a narrow phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/index.html");
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  // cards stack rather than squeeze
  const widths = await page.locator(".card").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  for (const w of widths) expect(w).toBeLessThanOrEqual(360);
  await page.fill("#secret", "mobile");
  await page.click("#hideBtn");
  await expect(page.locator("#hideOut .result-text")).toBeVisible();
});

test("light and dark both render with real contrast", async ({ page }) => {
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/index.html");
    const { bg, fg } = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { bg: s.backgroundColor, fg: s.color };
    });
    expect(bg, `${scheme}: body must paint its own background`).not.toBe("rgba(0, 0, 0, 0)");
    expect(fg).not.toBe(bg);
    const results = await new AxeBuilder({ page }).withTags(["wcag2aa"]).include("body").analyze();
    const contrast = results.violations.filter((v) => v.id === "color-contrast");
    expect(contrast.map((v) => v.nodes.length), `${scheme}: contrast violations`).toEqual([]);
  }
});

test("prefers-reduced-motion suppresses the page's animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/index.html");
  const moving = await page.evaluate(() =>
    [...document.querySelectorAll("*")].filter((el) => {
      const s = getComputedStyle(el);
      const dur = parseFloat(s.animationDuration) || 0;
      const trans = parseFloat(s.transitionDuration) || 0;
      return (dur > 0.05 && s.animationName !== "none") || trans > 0.05;
    }).length);
  expect(moving, "elements still animate under prefers-reduced-motion").toBe(0);
});

test("each section is a landmark with a heading", async ({ page }) => {
  await page.goto("/index.html");
  for (const sel of SECTIONS) {
    const el = page.locator(sel);
    await expect(el).toBeVisible();
  }
  const h2s = await page.locator("h2").allTextContents();
  expect(h2s.length).toBeGreaterThan(4);
  expect(await page.locator("h1").count()).toBe(1);
});
