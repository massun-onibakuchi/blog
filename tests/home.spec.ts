// tests/home.spec.ts — end-state §2 (site structure): "/" carries a short bio
// and links out to every section. Runs on both projects in playwright.config.ts
// (desktop 1280x800 and mobile iPhone 14).

import { test, expect } from '@playwright/test';

test.describe('home page', () => {
  test('renders bio text and links out to each section', async ({ page }) => {
    await page.goto('/');

    // Bio: end-state §2 says it lives on "/" and stays 3-5 lines. We don't pin
    // the exact copy (that's content, not contract) — just that a substantial
    // paragraph of prose is present in the main content area.
    const bio = page.locator('main p').first();
    await expect(bio).toBeVisible();
    const bioText = (await bio.textContent())?.trim() ?? '';
    expect(bioText.length, 'expected a bio paragraph with real content').toBeGreaterThan(30);

    // Links out to each section (either from the "latest excerpts" per §2, or
    // the header nav present on every page — either satisfies "linking out").
    for (const path of ['/publications', '/posts', '/open-source']) {
      const link = page.locator(`a[href^="${path}"]`).first();
      await expect(link, `expected a link to ${path} on the home page`).toBeVisible();
    }
  });
});
