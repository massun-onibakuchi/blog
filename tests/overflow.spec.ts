// tests/overflow.spec.ts — end-state §5 (responsive): no horizontal overflow
// on mobile, checked on home, a list page, and an article page that contains
// both a code block and a math block (the widest content the site renders).
// Mobile-only: skips itself on the desktop project.

import { test, expect, type Page } from '@playwright/test';
import { findArticleWithCodeAndMath } from './support';

async function expectNoHorizontalOverflow(page: Page) {
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fits, 'document.documentElement.scrollWidth exceeds window.innerWidth').toBe(true);
}

test('home has no horizontal overflow on mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile viewport only');
  await page.goto('/');
  await expectNoHorizontalOverflow(page);
});

test('a list page has no horizontal overflow on mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile viewport only');
  await page.goto('/publications/');
  await expectNoHorizontalOverflow(page);
});

test('an article with code and math has no horizontal overflow on mobile', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile viewport only');
  const entry = await findArticleWithCodeAndMath(page);
  test.skip(!entry, 'no published article with both a code block and a math block found');
  await page.goto(entry!.href);
  await expectNoHorizontalOverflow(page);
});
