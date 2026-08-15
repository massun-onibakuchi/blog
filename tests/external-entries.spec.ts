// tests/external-entries.spec.ts — writing published elsewhere (Qiita, Medium)
// appears in the Publications list by title and date, but links straight out and
// builds no page here. This guards the `externalUrl` branch of the content model.

import { test, expect } from '@playwright/test';
import { entryLinks, localEntryLinks } from './support';

test('external publications link out and have no page on this site', async ({ page }) => {
  const all = await entryLinks(page, 'publications');
  const local = await localEntryLinks(page, 'publications');
  const external = all.filter((entry) => !local.some((l) => l.href === entry.href));
  test.skip(external.length === 0, 'no externally hosted publications listed');

  for (const entry of external) {
    expect(entry.href).toMatch(/^https?:\/\//);
    // The slug-shaped local route for the same entry must not exist.
    const localPath = `/publications/${entry.href.split('/').pop()}/`;
    const response = await page.request.get(localPath);
    expect(response.status()).toBe(404);
  }
});

test('the hackathons list links out to each submission', async ({ page }) => {
  await page.goto('/hackathons/');
  const links = page.getByRole('listitem').getByRole('link');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(links.nth(i)).toHaveAttribute('href', /^https?:\/\//);
  }
});
