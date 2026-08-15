// tests/neighbours.spec.ts — end-state §4: previous/next links move between
// articles within the same section, and never cross into the other section
// (src/lib/articles.ts `neighbours` only looks within one section's list).

import { test, expect } from '@playwright/test';
import { SECTIONS, localEntryLinks, escapeRegExp } from './support';

for (const section of SECTIONS) {
  test(`${section}: prev/next stay within the section`, async ({ page }) => {
    const entries = await localEntryLinks(page, section);
    test.skip(entries.length < 2, `need at least 2 locally hosted ${section} entries`);

    // Newest entry: expect an "older" link toward entries[1], staying in-section.
    await page.goto(entries[0].href);
    const olderLink = page.getByRole('link', { name: new RegExp(escapeRegExp(entries[1].title)) });
    await expect(olderLink).toBeVisible();
    await expect(olderLink).toHaveAttribute('href', new RegExp(`^/${section}/`));
    await olderLink.click();
    await expect(page).toHaveURL(new RegExp(`/${section}/`));

    if (entries.length >= 3) {
      // Now on entries[1] (middle): both a newer link back to entries[0] and
      // an older link forward to entries[2] should exist, both in-section.
      const newerLink = page.getByRole('link', {
        name: new RegExp(escapeRegExp(entries[0].title)),
      });
      await expect(newerLink).toHaveAttribute('href', new RegExp(`^/${section}/`));

      const olderLink2 = page.getByRole('link', {
        name: new RegExp(escapeRegExp(entries[2].title)),
      });
      await expect(olderLink2).toHaveAttribute('href', new RegExp(`^/${section}/`));
    }
  });
}
