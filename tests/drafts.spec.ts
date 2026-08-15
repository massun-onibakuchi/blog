// tests/drafts.spec.ts — end-state §6: `isPublished: false` must vanish from
// the build entirely: 404 on its own URL, absent from lists, absent from its
// tag page, absent from the sitemap if one exists.
//
// Fixture note: no isPublished: false entry existed anywhere in src/content at
// the time this suite was written (src/content did not exist yet — pages were
// still being built). Per the task's one exception to "don't touch src/", this
// suite creates its own draft fixture at
// src/content/posts/draft-test-fixture.md so this path has something to check.
// If a real draft fixture is later added to the content set, this file can be
// deleted and DRAFT_TITLE/DRAFT_URL/DRAFT_TAG below repointed at it.

import { test, expect } from '@playwright/test';

const DRAFT_TITLE = 'Draft Fixture (isPublished false, test-only)';
const DRAFT_URL = '/posts/draft-test-fixture/';
const DRAFT_TAG_URL = '/tags/draft-fixture-tag/';

test('a draft 404s on its own URL', async ({ page }) => {
  const response = await page.goto(DRAFT_URL);
  expect(response?.status()).toBe(404);
});

test('a draft is absent from its section list and the home page', async ({ page }) => {
  await page.goto('/posts/');
  await expect(page.getByRole('link', { name: DRAFT_TITLE })).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByText(DRAFT_TITLE)).toHaveCount(0);
});

test("a draft's tag does not produce a listing", async ({ page }) => {
  // The fixture's tag is unique to it, so if drafts are correctly excluded
  // from getTags()/getAllArticles(), this route was never generated at all.
  const response = await page.goto(DRAFT_TAG_URL);
  expect(response?.status()).toBe(404);
});

test('a draft is absent from the sitemap, if one exists', async ({ request }) => {
  for (const path of ['/sitemap-index.xml', '/sitemap.xml']) {
    const res = await request.get(path);
    if (res.ok()) {
      const body = await res.text();
      expect(body).not.toContain('draft-test-fixture');
    }
  }
});
