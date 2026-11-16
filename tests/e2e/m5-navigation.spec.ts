import { expect, test } from '@playwright/test';

for (const locale of ['ar', 'en']) {
  test(`${locale}: overlay keyboard navigation and motion preference`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`/${locale}`);
    const toggle = page.locator('button[aria-controls="mobile-nav-panel"]');
    const panel = page.locator('#mobile-nav-panel');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(panel).toBeHidden();
    await toggle.click();
    await panel.locator('button').last().click();
    await expect(panel.locator('button').last()).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await toggle.click();
    await expect(panel.locator('button').last()).toHaveAttribute('aria-pressed', 'true');
    await panel.locator(`a[href="/${locale}/services"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/services$`));
    expect(errors).toEqual([]);
  });
}

test('coarse mobile pointer has no custom cursor', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('/en');
  await expect(page.locator('[data-living-cursor]')).toHaveCount(0);
  await context.close();
});
