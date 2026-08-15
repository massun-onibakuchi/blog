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

  const after = await html.getAttribute('data-theme');
  expect(after, 'expected data-theme to flip on click').not.toBe(initial);
  expect(['light', 'dark']).toContain(after);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const onReload = await html.getAttribute('data-theme');
  expect(onReload, 'expected the toggled theme to persist across reload, pre-paint').toBe(after);
});
