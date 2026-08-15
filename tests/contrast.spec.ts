// tests/contrast.spec.ts — end-state §7.1 quality gate: WCAG 2 AA
// color-contrast for body text, code, and links, in both themes, on the home
// page, a list page, and an article with code and math. Theme is
// attribute-driven ([data-theme] on <html>, set from localStorage by the boot
// script in BaseLayout.astro), so we force it two ways before each navigation:
// localStorage `theme` (what the boot script reads) and emulateMedia
// colorScheme (in case anything also relies on prefers-color-scheme).

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { findArticleWithCodeAndMath } from './support';

const THEMES = ['light', 'dark'] as const;

async function assertNoContrastViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).include('body').withRules(['color-contrast']).analyze();

  if (results.violations.length > 0) {
    const offenders = results.violations
      .flatMap((violation) =>
        violation.nodes.map((node) => `  - ${node.target.join(' ')}: ${node.failureSummary}`),
      )
      .join('\n');
    expect(
      results.violations.length,
      `color-contrast violations on ${label}:\n${offenders}`,
    ).toBe(0);
  }
}

for (const theme of THEMES) {
  test.describe(`color-contrast (WCAG 2 AA), ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
      await page.emulateMedia({ colorScheme: theme });
    });

    test('home', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await assertNoContrastViolations(page, `home (${theme})`);
    });

    test('a list page', async ({ page }) => {
      await page.goto('/publications/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await assertNoContrastViolations(page, `/publications/ (${theme})`);
    });

    test('an article with code and math', async ({ page }) => {
      const entry = await findArticleWithCodeAndMath(page);
      test.skip(!entry, 'no published article with both a code block and a math block found');
      await page.goto(entry!.href);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await assertNoContrastViolations(page, `${entry!.href} (${theme})`);
    });
  });
}
