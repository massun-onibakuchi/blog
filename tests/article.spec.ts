// tests/article.spec.ts — end-state §4: clicking a list entry lands on the
// article. The article page contains title, date, tags and a translation
// button that copies the article body and opens ChatGPT in a new tab with a
// prefilled prompt targeting the opposite language.

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
      // the opposite language and copies the rendered article body first.
      const translate = page.locator('article a[href*="chatgpt.com"]');
      await expect(translate, 'expected exactly one translation link').toHaveCount(1);
      await expect(translate).toHaveAttribute('target', '_blank');

      const targetLang = await translate.getAttribute('hreflang');
      expect(['en', 'ja']).toContain(targetLang);

      const href = await translate.getAttribute('href');
      expect(href).not.toBeNull();
      const url = new URL(href!);
      expect(url.hostname).toBe('chatgpt.com');

      const prompt = url.searchParams.get('prompt') ?? '';
      const expectedTarget = targetLang === 'ja' ? /japanese|日本語/i : /\benglish\b/i;
      expect(prompt, `expected the prompt to target ${targetLang}`).toMatch(expectedTarget);
      expect(prompt).toContain('Paste the article text from your clipboard and send it.');

      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (text: string) => {
              (window as typeof window & { __copiedArticle?: string }).__copiedArticle = text;
            },
          },
        });
      });

      const copied = await translate.evaluate(async (element) => {
        const link = element as HTMLAnchorElement;
        link.addEventListener('click', (event) => event.preventDefault(), { once: true });
        link.click();
        await Promise.resolve();
        return (window as typeof window & { __copiedArticle?: string }).__copiedArticle ?? '';
      });

      expect(copied.length, 'expected article body to be copied').toBeGreaterThan(0);
      expect(copied).not.toContain(title);
    });
  });
}
