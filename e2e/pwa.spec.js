import { test, expect } from "@playwright/test";

/* Installability and offline. The service worker is the one part of the exhibit
 * that can strand a user on a stale build, so the cache identity is checked too. */

test("the manifest is complete enough to install", async ({ page, request }) => {
  await page.goto("/index.html");
  const href = await page.getAttribute('link[rel="manifest"]', "href");
  const manifest = await (await request.get(`/${href}`)).json();
  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.display).toMatch(/standalone|fullscreen|minimal-ui/);
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  expect(manifest.icons.some((i) => i.sizes?.includes("512"))).toBe(true);
  expect(manifest.icons.some((i) => i.purpose?.includes("maskable"))).toBe(true);
  for (const icon of manifest.icons) {
    expect((await request.get(`/${icon.src}`)).status(), `${icon.src} exists`).toBe(200);
  }
});

test.describe("offline", () => {
  test.skip(({ browserName }) => browserName !== "chromium",
    "service-worker + offline emulation is only reliable in Chromium here");

  test("the whole exhibit works with the network cut", async ({ page, context }) => {
    await page.goto("/index.html");
    await page.evaluate(() => navigator.serviceWorker.ready);
    // let the precache settle
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      if (!keys.length) return false;
      const c = await caches.open(keys[0]);
      return (await c.keys()).length >= 8;
    }, null, { timeout: 15000 });

    const cacheName = await page.evaluate(async () => (await caches.keys())[0]);
    expect(cacheName, "cache name is content-derived").toMatch(/^ghost-ink-[0-9a-f]{12}$/);

    await context.setOffline(true);
    await page.reload();
    // the application is fully functional with no network at all
    await expect(page.locator("h1")).toBeVisible();
    await page.fill("#secret", "works offline");
    await page.click("#hideBtn");
    const stego = await page.locator("#hideOut .result-text").textContent();
    await page.fill("#carrier", stego);
    await page.click("#findBtn");
    await expect(page.locator("#findOut .result-text")).toHaveText("works offline");
    await page.click("#imgHide");
    await expect(page.locator("#imgOut")).toContainText("bytes written into");
    await context.setOffline(false);
  });

  test("a new build replaces the old cache rather than stranding the user", async ({ page }) => {
    await page.goto("/index.html");
    await page.evaluate(() => navigator.serviceWorker.ready);
    const before = await page.evaluate(async () => await caches.keys());
    expect(before.length, "exactly one cache generation is kept").toBe(1);

    // Leave behind a stale generation, as an earlier deploy would, then force a
    // fresh install+activate. Pruning happens in activate, which a plain reload
    // does not re-fire, so the worker is unregistered first.
    await page.evaluate(async () => {
      await caches.open("ghost-ink-deadbeef0000");
      const reg = await navigator.serviceWorker.getRegistration();
      await reg.unregister();
    });
    expect(await page.evaluate(async () => await caches.keys())).toContain("ghost-ink-deadbeef0000");

    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      return keys.length === 1 && !keys.includes("ghost-ink-deadbeef0000");
    }, null, { timeout: 15000 });
    const after = await page.evaluate(async () => await caches.keys());
    expect(after, "the stale generation is evicted, not accumulated").toEqual(before);
  });
});
