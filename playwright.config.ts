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
    command: 'pnpm build && pnpm preview',
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
      name: 'mobile-chromium',
      use: { ...devices['iPhone 14'] },
    },
  ],
});
