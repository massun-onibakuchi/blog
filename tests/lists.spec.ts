// tests/lists.spec.ts — end-state §2/§3: /publications/ and /posts/ list
// entries with title, date and tags — and, critically, NO language badge. The
// badge belongs on the article page only (§3: "Lists mix languages ... with no
// language marking. The badge appears on the article page itself.").

import { test, expect } from '@playwright/test';
import { LANG_TEXT, SECTIONS } from './support';

for (const section of SECTIONS) {
  test.describe(`/${section}/ list`, () => {
    test('entries show title and date, and never a language badge', async ({ page }) => {
      await page.goto(`/${section}/`);

      const items = page.getByRole('listitem');
      const count = await items.count();
      expect(count, `expected at least one published ${section} entry`).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const item = items.nth(i);

        // Title (a link) and a machine-readable date.
        await expect(item.getByRole('link').first()).toBeVisible();
        await expect(item.locator('time')).toHaveCount(1);

        // No standalone "en"/"ja" badge text anywhere in this entry.
        await expect(item.getByText(LANG_TEXT, { exact: true })).toHaveCount(0);

        // Any tag links present must resolve to the /tags/<tag>/ route shape.
        const tagLinks = item.locator('a[href^="/tags/"]');
        const tagCount = await tagLinks.count();
        for (let t = 0; t < tagCount; t++) {
          await expect(tagLinks.nth(t)).toHaveAttribute('href', /^\/tags\/[^/]+\/$/);
        }
      }
    });
  });
}
