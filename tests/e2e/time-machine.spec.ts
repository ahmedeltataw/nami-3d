import { expect, test } from '@playwright/test';

for (const locale of ['ar', 'en']) {
  test(`${locale} time machine supports keyboard navigation and restores focus`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

    await page.goto(`/${locale}#s06`);
    await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
    const trigger = page.locator('[data-time-machine-open]');
    await trigger.focus();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('nami:time-machine')));

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const slider = dialog.getByRole('slider');
    await slider.focus();
    await page.keyboard.press('Home');
    const initial = await slider.getAttribute('aria-valuenow');
    await page.keyboard.press('ArrowUp');
    await expect(slider).not.toHaveAttribute('aria-valuenow', initial!);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(Math.abs(await page.evaluate(() => window.scrollY) - scrollBefore)).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });
}
