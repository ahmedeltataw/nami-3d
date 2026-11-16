import { expect, test } from '@playwright/test';

test.describe('Content Pages Suite', () => {
  for (const locale of ['ar', 'en'] as const) {
    test(`${locale}: every route in sitemap returns 200`, async ({ request }) => {
      const sitemapRes = await request.get('/sitemap.xml');
      expect(sitemapRes.status()).toBe(200);
      const xml = await sitemapRes.text();

      // Extract all URLs from sitemap
      const matches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g));
      const urls = matches.map(m => m[1]);
      expect(urls.length).toBeGreaterThan(0);

      // Filter URLs for this locale
      const localeUrls = urls.filter(u => {
        try {
          const pathname = new URL(u).pathname;
          return pathname.startsWith(`/${locale}`);
        } catch {
          return u.includes(`/${locale}`);
        }
      });

      expect(localeUrls.length).toBeGreaterThan(0);

      for (const fullUrl of localeUrls) {
        const path = new URL(fullUrl).pathname;
        const res = await request.get(path);
        expect(res.status(), `Status 200 for ${path}`).toBe(200);
      }
    });

    test(`${locale}: content routes have visible h1 and no console errors`, async ({ page }) => {
      const sampleRoutes = [
        `/${locale}/services`,
        `/${locale}/services/website-development`,
        `/${locale}/projects`,
        `/${locale}/projects/al-nahdi-family-office`,
        `/${locale}/blog`,
        `/${locale}/blog/web-development-companies-comprehensive-guide-to-costs-standards`,
        `/${locale}/faqs`,
        `/${locale}/marketing`,
        `/${locale}/privacy`,
        `/${locale}/terms`,
      ];

      for (const route of sampleRoutes) {
        const consoleErrors: string[] = [];
        page.on('console', msg => {
          if (msg.type() === 'error') {
            // Filter out benign SwiftShader/WebGL canvas warnings in headless environment
            const text = msg.text();
            if (!text.includes('THREE.WebGLRenderer') && !text.includes('SwiftShader')) {
              consoleErrors.push(`${route}: ${text}`);
            }
          }
        });

        const res = await page.goto(route);
        expect(res?.status()).toBe(200);

        const h1 = page.locator('h1').first();
        await expect(h1).toBeVisible();
        const h1Text = (await h1.textContent())?.trim();
        expect(h1Text && h1Text.length > 0).toBe(true);

        expect(consoleErrors, `No console errors on ${route}`).toEqual([]);
      }
    });

    test(`${locale}: FAQ details toggle by keyboard`, async ({ page }) => {
      await page.goto(`/${locale}/faqs`);

      const firstDetails = page.locator('details').first();
      const firstSummary = firstDetails.locator('summary');

      await expect(firstDetails).not.toHaveAttribute('open');

      // Focus and press Enter
      await firstSummary.focus();
      await page.keyboard.press('Enter');
      await expect(firstDetails).toHaveAttribute('open', '');

      // Press Enter again to close
      await page.keyboard.press('Enter');
      await expect(firstDetails).not.toHaveAttribute('open');

      // Press Space to open
      await page.keyboard.press('Space');
      await expect(firstDetails).toHaveAttribute('open', '');

      // Press Space to close
      await page.keyboard.press('Space');
      await expect(firstDetails).not.toHaveAttribute('open');
    });

    test(`${locale}: no horizontal overflow at 375px on sample pages`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const samplePages = [
        `/${locale}/services/website-development`,
        `/${locale}/projects/al-nahdi-family-office`,
        `/${locale}/blog/web-development-companies-comprehensive-guide-to-costs-standards`,
        `/${locale}/faqs`,
        `/${locale}/privacy`,
      ];

      for (const url of samplePages) {
        await page.goto(url);
        await page.waitForLoadState('domcontentloaded');

        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });

        expect(overflow, `No horizontal overflow at 375px on ${url}`).toBe(false);
      }
    });
  }
});
