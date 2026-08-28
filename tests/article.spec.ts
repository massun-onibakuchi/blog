// tests/article.spec.ts — end-state §4: clicking a list entry lands on the
// article. The article page contains title, date, tags and a translation
// button that opens ChatGPT in a new tab with the full article body already in
// the prefilled prompt, targeting the opposite language.

import { test, expect } from '@playwright/test';
import { SECTIONS, localEntryLinks } from './support';

for (const section of SECTIONS) {
  test.describe(`${section} article page`, () => {
    test('a list entry opens an article with title, date, tags and translation link', async ({
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

      // Translation link: opens chatgpt.com in a new tab with a prompt targeting
      // the opposite language and containing the article text itself.
      const translate = page.locator('article a[href*="chatgpt.com"]');
      await expect(translate, 'expected exactly one translation link').toHaveCount(1);
      await expect(translate).toHaveAttribute('target', '_blank');

      const targetLang = await translate.getAttribute('hreflang');
      expect(['en', 'ja']).toContain(targetLang);

      await expect(translate).toHaveText(
        targetLang === 'ja' ? 'ChatGPTで日本語に翻訳' : 'Translate to English with ChatGPT',
      );

      const href = await translate.getAttribute('href');
      expect(href).not.toBeNull();
      const url = new URL(href!);
      expect(url.hostname).toBe('chatgpt.com');

      const prompt = url.searchParams.get('prompt') ?? '';
      const expectedTarget = targetLang === 'ja' ? /japanese|日本語/i : /\benglish\b/i;
      expect(prompt, `expected the prompt to target ${targetLang}`).toMatch(expectedTarget);
      expect(prompt).toContain('Translate the following article text into');
      expect(prompt).not.toMatch(/clipboard|paste the article|copy the article/i);

      const [instruction, ...articleParts] = prompt.split('\n\n');
      expect(instruction.length).toBeGreaterThan(0);
      expect(articleParts.join('\n\n').trim().length, 'expected article text in prompt').toBeGreaterThan(
        100,
      );
    });
  });
}
