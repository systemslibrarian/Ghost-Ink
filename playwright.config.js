import { defineConfig, devices } from "@playwright/test";

/* The browser suites run against dist/, not the sources, because the security
 * boundary being tested (CSP, the sandboxed iframe, the service worker) only
 * exists in the built artefact. `npm run build` runs first via webServer. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && node test/serve.mjs",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
