import { expect, test } from '@playwright/test';

test.describe('Navigation and Accessibility', () => {
  for (const locale of ['ar', 'en'] as const) {
    const isAr = locale === 'ar';
    const expectedDir = isAr ? 'rtl' : 'ltr';

    test(`${locale}: html lang and dir are correct`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', locale);
      await expect(html).toHaveAttribute('dir', expectedDir);
    });

    test(`${locale}: every nav page link returns 200 (crawl links)`, async ({ page, request }) => {
      await page.goto(`/${locale}`);
      // Find all link hrefs in header/nav
      const hrefs = await page.locator('header nav a, #mobile-nav-panel a').evaluateAll(elements =>
        elements.map(el => (el as HTMLAnchorElement).getAttribute('href')).filter((h): h is string => Boolean(h))
      );

      // Distinct paths without hash
      const uniquePageHrefs = Array.from(new Set(
        hrefs
          .map(h => h.split('#')[0])
          .filter(h => h.startsWith(`/${locale}`))
      ));

      expect(uniquePageHrefs.length).toBeGreaterThan(0);

      for (const href of uniquePageHrefs) {
        const res = await request.get(href);
        expect(res.status(), `Status 200 for ${href}`).toBe(200);
      }
    });

    test(`${locale}: hero h1 and CTA visible without JavaScript`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(`/${locale}`);

      const heroH1 = page.locator('#s01 h1');
      await expect(heroH1).toBeVisible();
      expect((await heroH1.textContent())?.trim().length).toBeGreaterThan(0);

      const heroCta = page.locator('#s01 a[href*="/contact"]');
      await expect(heroCta).toBeVisible();

      await context.close();
    });

    test(`${locale}: skip link works and points to #main`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const skipLink = page.locator('a.skip-link');
      await expect(skipLink).toHaveAttribute('href', '#main');

      // Focus skip link via keyboard Tab
      await page.keyboard.press('Tab');
      await expect(skipLink).toBeFocused();

      // Press Enter or click to navigate to #main
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`/${locale}#main$`));
      await expect(page.locator('#main')).toBeInViewport();
    });

    test(`${locale}: tab order is sane and accessible`, async ({ page }) => {
      await page.goto(`/${locale}`);

      // First tab focuses skip link
      await page.keyboard.press('Tab');
      await expect(page.locator('a.skip-link')).toBeFocused();

      // Next tab moves to brand logo
      await page.keyboard.press('Tab');
      const focusedHref = await page.evaluate(() => (document.activeElement as HTMLAnchorElement)?.getAttribute('href'));
      expect(focusedHref).toContain(`/${locale}`);
    });
  }
});
