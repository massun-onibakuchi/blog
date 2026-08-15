// tests/theme.spec.ts — end-state §5: the dark/light toggle flips data-theme
// on <html>, the choice persists across reload, and there is no flash. The
// boot script in BaseLayout.astro sets data-theme synchronously in <head>
// before <body>, so checking the attribute right at domcontentloaded (before
// any deferred work could run) stands in for "no flash on first paint".

import { test, expect } from '@playwright/test';

test('theme toggle flips data-theme, persists across reload, with no flash', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');

  const initial = await html.getAttribute('data-theme');
  expect(['light', 'dark']).toContain(initial);

  const toggle = page.getByRole('button', { name: /toggle dark mode/i });
  await expect(toggle).toBeVisible();
  await toggle.click();

  // The toggle may apply the theme inside a View Transition callback, which
  // runs on the next rendering opportunity rather than synchronously with the
  // click — so poll (toHaveAttribute auto-retries) instead of a single read.
  const expectedAfter = initial === 'dark' ? 'light' : 'dark';
  await expect(html, 'expected data-theme to flip on click').toHaveAttribute(
    'data-theme',
    expectedAfter,
  );
  const after = await html.getAttribute('data-theme');

  await page.reload({ waitUntil: 'domcontentloaded' });
  const onReload = await html.getAttribute('data-theme');
  expect(onReload, 'expected the toggled theme to persist across reload, pre-paint').toBe(after);
});

// Regression: the icon rule lived in a scoped <style>, and Astro scoped the
// `[data-theme]` ancestor too — that attribute is on <html>, which carries no
// scope attribute, so neither icon was ever hidden and sun and moon overlapped.
test('exactly one theme icon is visible, in either theme', async ({ page }) => {
  await page.goto('/');
  const sun = page.locator('[data-theme-icon="light"]');
  const moon = page.locator('[data-theme-icon="dark"]');

  const shown = async () =>
    [await sun.isVisible(), await moon.isVisible()].filter(Boolean).length;

  expect(await shown(), 'expected one icon before toggling, not both or neither').toBe(1);

  const initial = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /toggle dark mode/i }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    initial === 'dark' ? 'light' : 'dark',
  );

  expect(await shown(), 'expected one icon after toggling, not both or neither').toBe(1);
});
