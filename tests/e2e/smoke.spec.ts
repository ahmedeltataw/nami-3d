import { expect, test } from '@playwright/test';

const ar = 'نامى للحلول البرمجية';

test('root redirects to Arabic', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/ar$/);
});

for (const [locale, dir, heading] of [['ar', 'rtl', ar], ['en', 'ltr', 'Nami Software Solutions']]) {
  test(`${locale} renders`, async ({ page }) => {
    const response = await page.goto(`/${locale}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', dir);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  });
}
