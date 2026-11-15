import { expect, test } from '@playwright/test';

for (const locale of ['ar', 'en']) {
  test(`styleguide screenshot ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/styleguide`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `tests/e2e/__screens__/styleguide-${locale}.png`, fullPage: true });
  });
}
