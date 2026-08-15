// tests/support.ts — shared discovery helpers for the reading-path suite.
// Why: content (articles, tags) is authored data the tests don't own, so tests
// discover real entries from the rendered site instead of hard-coding slugs.
// That keeps the suite valid as articles are added, removed or reworded.

import type { Page } from '@playwright/test';

export const SECTIONS = ['publications', 'posts'] as const;
export type Section = (typeof SECTIONS)[number];

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Entries whose text is hosted here, i.e. those with a page of their own.
 *  Entries carrying `externalUrl` link straight out and are excluded: they have
 *  no local page, so they are not part of prev/next chains either. */
export async function localEntryLinks(page: Page, section: Section) {
  const entries = await entryLinks(page, section);
  return entries.filter((entry) => entry.href.startsWith(`/${section}/`));
}

/** Title + href of every entry currently listed on a section's list page. */
export async function entryLinks(
  page: Page,
  section: Section,
): Promise<{ title: string; href: string }[]> {
  await page.goto(`/${section}/`);
  const items = page.getByRole('listitem');
  const count = await items.count();
  const out: { title: string; href: string }[] = [];
  for (let i = 0; i < count; i++) {
    const link = items.nth(i).getByRole('link').first();
    const title = (await link.textContent())?.trim() ?? '';
    const href = await link.getAttribute('href');
    if (href) out.push({ title, href });
  }
  return out;
}

/** First published article (either section) whose body renders both a code
 *  block (Expressive Code emits <pre>) and math (KaTeX emits a <math> tag for
 *  accessibility) — the widest/busiest content the site renders. */
export async function findArticleWithCodeAndMath(
  page: Page,
): Promise<{ title: string; href: string } | undefined> {
  for (const section of SECTIONS) {
    // Local entries only: following an externalUrl would leave the site.
    const entries = await localEntryLinks(page, section);
    for (const entry of entries) {
      await page.goto(entry.href);
      const hasCode = (await page.locator('article pre').count()) > 0;
      const hasMath = (await page.locator('article math').count()) > 0;
      if (hasCode && hasMath) return entry;
    }
  }
  return undefined;
}

/** First tag (from either list page) whose display text contains a non-ASCII
 *  character, e.g. Japanese — used to exercise the percent-encoded tag route. */
export async function findNonAsciiTag(
  page: Page,
): Promise<{ text: string; href: string } | undefined> {
  for (const section of SECTIONS) {
    await page.goto(`/${section}/`);
    const tagLinks = page.locator('a[href^="/tags/"]');
    const count = await tagLinks.count();
    for (let i = 0; i < count; i++) {
      const raw = (await tagLinks.nth(i).textContent())?.trim() ?? '';
      const text = raw.replace(/^#/, '');
      if (/[^\x00-\x7F]/.test(text)) {
        const href = await tagLinks.nth(i).getAttribute('href');
        if (href) return { text, href };
      }
    }
  }
  return undefined;
}
