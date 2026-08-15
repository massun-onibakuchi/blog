// tests/article.spec.ts — end-state §4: clicking a list entry lands on the
// article. The article page contains title, date, tags, a JA/EN badge and a
// translation button that opens ChatGPT in a new tab with a prefilled prompt
// containing the article's own URL, targeting the opposite language.

import { test, expect } from '@playwright/test';
import { LANG_TEXT, SECTIONS, localEntryLinks } from './support';

for (const section of SECTIONS) {
  test.describe(`${section} article page`, () => {
    test('a list entry opens an article with title, date, tags, badge and translation link', async ({
      page,
    }) => {
      // Locally hosted entries only: entries with an externalUrl link straight
      // out and have no page here to assert against.
      const entries = await localEntryLinks(page, section);
      test.skip(entries.length === 0, `no locally hosted ${section} entries to open`);

      const { title, href: articlePath } = entries[0];
      await page.goto(articlePath);

      // Title, date.
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(page.locator('article time')).toHaveCount(1);

      // Tags, if any, resolve to /tags/<tag>/.
      const tagLinks = page.locator('article a[href^="/tags/"]');
      const tagCount = await tagLinks.count();
      for (let t = 0; t < tagCount; t++) {
        await expect(tagLinks.nth(t)).toHaveAttribute('href', /^\/tags\/[^/]+\/$/);
      }

      // Language badge: exactly one, and it's en or ja.
      const badge = page.locator('article').getByText(LANG_TEXT, { exact: true });
      await expect(badge, 'expected exactly one JA/EN badge on the article page').toHaveCount(1);
      const lang = ((await badge.textContent()) ?? '').trim().toLowerCase();
      expect(['en', 'ja']).toContain(lang);

      // Translation link: opens chatgpt.com in a new tab, prefilled with a
      // prompt containing this article's own URL, targeting the opposite lang.
      const translate = page.locator('article a[href*="chatgpt.com"]');
      await expect(translate, 'expected exactly one translation link').toHaveCount(1);
      await expect(translate).toHaveAttribute('target', '_blank');

      const href = await translate.getAttribute('href');
      expect(href).toBeTruthy();
      const url = new URL(href!);
      expect(url.hostname).toBe('chatgpt.com');

      const prompt = url.searchParams.get('q') ?? '';
      expect(prompt, 'expected the prefilled prompt to contain the article URL').toContain(
        page.url(),
      );

      const expectedTarget = lang === 'en' ? /japanese|日本語/i : /\benglish\b/i;
      expect(
        prompt,
        `expected the prompt to target the opposite language of "${lang}"`,
      ).toMatch(expectedTarget);
    });
  });
}
