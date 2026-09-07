import { test, expect } from "@playwright/test";

/* Clear and Reset. Every panel added since the exhibit grew past three cards has
 * its own state; a Reset that misses one is the commonest kind of rot here. */

const CLEARS = [
  { name: "hide",        clear: "#hideClear",  inputs: ["#cover", "#secret"],       out: "#hideOut" },
  { name: "find",        clear: "#findClear",  inputs: ["#carrier"],                out: "#findOut" },
  { name: "model view",  clear: "#mevClear",   inputs: ["#mevCover", "#mevInj"],    panes: "#mevPanes" },
  { name: "survival",    clear: "#survClear",  inputs: ["#survBack"],               out: "#survOut" },
  { name: "leak tracer", clear: "#wmClear",    inputs: ["#wmDoc", "#wmLeak"],       out: "#wmOut" },
  { name: "emoji",       clear: "#emClear",    inputs: ["#emSecret"],               out: "#emOut" },
  { name: "forge",       clear: "#hfClear",    inputs: ["#hfIn"],                   out: "#hfOut" },
  { name: "trojan",      clear: "#tsClear",    inputs: ["#tsIn"],                   panes: "#tsPanes" },
  { name: "scraper",     clear: "#scrClear",   inputs: ["#scrIn"],                  panes: "#scrPanes" },
  { name: "normalise",   clear: "#nzClear",    inputs: ["#nzIn"],                   out: "#nzOut" },
];

test.beforeEach(async ({ page }) => { await page.goto("/index.html"); });

for (const c of CLEARS) {
  test(`${c.name}: Clear empties its fields and its output`, async ({ page }) => {
    for (const sel of c.inputs) await page.fill(sel, "something to clear");
    await page.click(c.clear);
    for (const sel of c.inputs) await expect(page.locator(sel)).toHaveValue("");
    if (c.out) await expect(page.locator(c.out)).toHaveClass(/empty/);
    if (c.panes) await expect(page.locator(c.panes)).toBeHidden();
  });
}

test("Reset restores every panel to its authored state", async ({ page }) => {
  const defaults = {};
  for (const sel of ["#cover", "#secret", "#inspectIn", "#mevCover", "#mevInj",
                     "#wmDoc", "#wmNames", "#emSecret", "#hfIn", "#imgSecret"]) {
    defaults[sel] = await page.inputValue(sel);
  }
  // disturb everything
  for (const sel of Object.keys(defaults)) await page.fill(sel, "disturbed");
  await page.fill("#carrier", "disturbed");
  await page.check('input[name=carrier][value="zw"]');
  await page.check('input[name=place][value="scatter"]');
  await page.check("#encChk");
  await page.click("#hideBtn");
  await page.click("#mevBtn");
  await page.click("#wmStamp");
  await page.click("#emBtn");
  await page.click("#hfBtn");

  await page.click("#reset");

  for (const [sel, value] of Object.entries(defaults)) {
    await expect(page.locator(sel), `${sel} restored`).toHaveValue(value);
  }
  await expect(page.locator("#carrier")).toHaveValue("");
  await expect(page.locator('input[name=carrier][value="tags"]')).toBeChecked();
  await expect(page.locator('input[name=place][value="append"]')).toBeChecked();
  await expect(page.locator("#encChk")).not.toBeChecked();
  await expect(page.locator("#encPassWrap")).toBeHidden();
  await expect(page.locator("#hideRevealBtn")).toBeHidden();
  await expect(page.locator("#hideWorkBtn")).toBeHidden();
  await expect(page.locator("#hideOut")).toHaveClass(/empty/);
  await expect(page.locator("#findOut")).toHaveClass(/empty/);
  await expect(page.locator("#mevPanes")).toBeHidden();
  await expect(page.locator("#tsPanes")).toBeHidden();
  await expect(page.locator("#scrPanes")).toBeHidden();
  await expect(page.locator("#wmOut")).toHaveClass(/empty/);
  await expect(page.locator("#emOut")).toHaveClass(/empty/);
  await expect(page.locator("#hfOut")).toHaveClass(/empty/);
  await expect(page.locator("#gameRows .verdict")).toHaveCount(0);
});

test.describe("the carriers still work end to end", () => {
  for (const carrier of ["tags", "vs", "zw", "snow"]) {
    test(`${carrier}: hide then find, with the carrier auto-detected`, async ({ page }) => {
      await page.fill("#secret", `carried by ${carrier}`);
      await page.check(`input[name=carrier][value="${carrier}"]`);
      await page.click("#hideBtn");
      const stego = await page.locator("#hideOut .result-text").textContent();
      await page.fill("#carrier", stego);
      await page.click("#findBtn");
      await expect(page.locator("#findOut .result-text")).toHaveText(`carried by ${carrier}`);
      // the Find panel is not told which carrier was used
      await expect(page.locator("#findOut .stat")).toContainText("container v2");
    });
  }

  test("an encrypted payload reports authentication, not just decryption", async ({ page }) => {
    await page.fill("#secret", "classified");
    await page.check("#encChk");
    await page.fill("#encPass", "correct horse battery");
    await page.click("#hideBtn");
    const stego = await page.locator("#hideOut .result-text").textContent();
    await page.fill("#carrier", stego);
    await page.click("#findBtn");
    await expect(page.locator("#findOut")).toContainText("This message is encrypted");
    await page.fill("#decPass", "wrong");
    await page.click("#findBtn");
    await expect(page.locator("#findOut")).toContainText("Wrong passphrase");
    await page.fill("#decPass", "correct horse battery");
    await page.click("#findBtn");
    await expect(page.locator("#findOut .result-text")).toHaveText("classified");
    await expect(page.locator("#findOut .stat")).toContainText("decrypted and authenticated");
    await expect(page.locator("#findOut .stat")).toContainText("210,000");
  });
});
