// tests/open-source.spec.ts — end-state §2/§6: /open-source/ is a flat list of
// data-only entries (title, description, external link, year) with no detail
// pages, so every entry link must point at an external GitHub URL.

import { test, expect } from '@playwright/test';

test('/open-source/ lists entries linking to external GitHub URLs', async ({ page }) => {
  await page.goto('/open-source/');

  const githubLinks = page.locator('main a[href^="https://github.com/"]');
  const count = await githubLinks.count();
  expect(count, 'expected at least one open-source entry linking to GitHub').toBeGreaterThan(0);

  // No per-project detail pages (end-state §2/§8).
  const internalDetailLinks = page.locator('main a[href^="/open-source/"]');
  await expect(internalDetailLinks).toHaveCount(0);
});
