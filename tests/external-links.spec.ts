// tests/external-links.spec.ts — end-state §2: every link that leaves the site
// opens in a new tab, and internal navigation never does. Checked on the pages
// that actually carry outbound links: home, both lists, and an article body.

import { test, expect } from '@playwright/test';
import { localEntryLinks } from './support';

const PAGES = ['/', '/publications/', '/posts/', '/open-source/', '/achievements/'];

async function auditLinks(page: import('@playwright/test').Page, path: string) {
  await page.goto(path);
  const links = await page.locator('a[href]').evaluateAll((nodes) =>
    nodes.map((node) => ({
      href: (node as HTMLAnchorElement).href,
      target: node.getAttribute('target'),
      rel: node.getAttribute('rel') ?? '',
    })),
  );
  expect(links.length, `expected links on ${path}`).toBeGreaterThan(0);

  for (const link of links) {
    const external = new URL(link.href).origin !== new URL(page.url()).origin;
    if (external) {
      expect(link.target, `${link.href} on ${path} should open in a new tab`).toBe('_blank');
      expect(link.rel, `${link.href} on ${path} should carry rel=noopener`).toContain('noopener');
    } else {
      expect(link.target, `${link.href} on ${path} should stay in this tab`).toBeNull();
    }
  }
}

for (const path of PAGES) {
  test(`external links on ${path} open in a new tab`, async ({ page }) => {
    await auditLinks(page, path);
  });
}

test('external links inside an article body open in a new tab', async ({ page }) => {
  const entries = await localEntryLinks(page, 'publications');
  test.skip(entries.length === 0, 'no locally hosted publication to inspect');
  await auditLinks(page, entries[0].href);
});
