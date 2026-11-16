import { test, expect } from '@playwright/test';

test('navigation, director and factory release their overlays', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/ar');
  await page.getByRole('button', { name: 'افتح مصنع نامي' }).click();
  const saved = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'مصنع نامي' })).toHaveCount(0);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - saved)).toBeLessThanOrEqual(2);
  await page.getByRole('button', { name: 'عرّفني على نامي' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-director]')).toHaveAttribute('data-director', 'idle');
  await page.getByRole('button', { name: /القائمة/ }).first().click();
  await page.locator('a[href="/ar/about"]').first().click();
  await expect(page).toHaveURL(/\/ar\/about$/);
  await page.goBack();
  await expect(page.locator('[data-route-transition]')).toHaveAttribute('data-route-transition', 'idle');
  expect(errors).toEqual([]);
});
