// playwright.config.ts — e2e entry point (`pnpm test`).
// Why build+preview instead of `astro dev`: the reading paths, isPublished
// filtering, OG generation and the sitemap (if any) all depend on the static
// build output, not the dev server's on-demand rendering.
// Projects: desktop Chromium at the spec's 1280x800, and iPhone 14 for mobile
// (used for the no-horizontal-overflow gate and to double most reading paths).

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
  },
  webServer: {
    // ASTRO_PREVIEW_BACKGROUND=1 forces `astro preview` to run in the
    // foreground: Astro 7 auto-detects agent/CI-like shells (no TTY) and
    // daemonizes `preview` by default, which makes Playwright's webServer
    // process appear to "exit early" even though the server is actually up.
    command: 'pnpm build && ASTRO_PREVIEW_BACKGROUND=1 pnpm preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      // devices['iPhone 14'] defaults to WebKit; only Chromium is installed
      // (pnpm test:install), so pin the engine and keep the device's viewport/
      // UA/touch emulation.
      name: 'mobile-chromium',
      use: { ...devices['iPhone 14'], browserName: 'chromium' },
    },
  ],
});
