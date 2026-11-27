import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. They run against a deployed site, not a mocked one:
 *
 *   E2E_BASE_URL  the web app   (default http://localhost:3000)
 *   E2E_API_URL   the API       (default http://localhost:5000)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
