// tests/tags.spec.ts — end-state §2: a tag link goes to /tags/<tag>/ and that
// page lists the originating article. Also exercises a Japanese (non-ASCII)
// tag when the content has one, since percent-encoded routes must resolve
// (src/lib/articles.ts tagKey + `encodeURIComponent`).

import { test, expect } from '@playwright/test';
import { escapeRegExp, findNonAsciiTag } from './support';

test('a tag link leads to /tags/<tag>/, which lists the article', async ({ page }) => {
  await page.goto('/publications/');
  const tagLinks = page.locator('a[href^="/tags/"]');
  const count = await tagLinks.count();
  test.skip(count === 0, 'no tagged content to exercise');

  const tagLink = tagLinks.first();
  const href = await tagLink.getAttribute('href');
  const item = tagLink.locator('xpath=ancestor::li[1]');
  const itemTitle = (await item.getByRole('link').first().textContent())?.trim() ?? '';

  const response = await Promise.all([page.waitForNavigation(), tagLink.click()]).then(
    ([nav]) => nav,
  );
  expect(response?.status()).toBe(200);
  expect(page.url()).toContain(href);
  await expect(
    page.getByRole('link', { name: new RegExp(escapeRegExp(itemTitle)) }),
  ).toBeVisible();
});

test('a Japanese tag route resolves and lists the article', async ({ page }) => {
  const jaTag = await findNonAsciiTag(page);
  test.skip(!jaTag, 'no Japanese-tagged content found in publications/posts');

  const response = await page.goto(jaTag!.href);
  expect(response?.status(), `expected ${jaTag!.href} to resolve (percent-encoded route)`).toBe(
    200,
  );
  await expect(page.locator('main')).toContainText(jaTag!.text);
  await expect(page.getByRole('listitem').first()).toBeVisible();
});
