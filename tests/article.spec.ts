// tests/article.spec.ts — end-state §4: clicking a list entry lands on the
// article. The article page contains title, date, tags and a language helper
// that opens ChatGPT in a new tab with the article URL already in a summary
// prompt targeting the opposite language.

import { test, expect } from '@playwright/test';
import { SECTIONS, localEntryLinks } from './support';

for (const section of SECTIONS) {
  test.describe(`${section} article page`, () => {
    test('a list entry opens an article with title, date, tags and summary link', async ({
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

      // Language helper: opens chatgpt.com in a new tab with the article URL and
      // a summary instruction targeting the opposite language.
      const summary = page.locator('article a[href*="chatgpt.com"]');
      await expect(summary, 'expected exactly one ChatGPT summary link').toHaveCount(1);
      await expect(summary).toHaveAttribute('target', '_blank');

      const targetLang = await summary.getAttribute('hreflang');
      expect(['en', 'ja']).toContain(targetLang);

      await expect(summary).toHaveText(
        targetLang === 'ja'
          ? 'ChatGPTで日本語の要約を読む'
          : 'Summarize in English with ChatGPT',
      );

      const href = await summary.getAttribute('href');
      expect(href).not.toBeNull();
      const url = new URL(href!);
      expect(url.hostname).toBe('chatgpt.com');

      const prompt = url.searchParams.get('prompt') ?? '';
      const expectedTarget = targetLang === 'ja' ? /japanese|日本語/i : /\benglish\b/i;
      expect(prompt, `expected the prompt to target ${targetLang}`).toMatch(expectedTarget);
      expect(prompt).toMatch(/^Summarize the article at https?:\/\//);
      expect(prompt).toContain(articlePath);
      expect(prompt).toContain('key technical details');
    });
  });
}
