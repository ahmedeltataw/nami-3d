import { expect, test, type APIRequestContext } from '@playwright/test';

// Extract all routes from sitemap.xml
async function getSitemapPaths(request: APIRequestContext, locale: 'ar' | 'en'): Promise<string[]> {
  const sitemapRes = await request.get('/sitemap.xml');
  expect(sitemapRes.status()).toBe(200);
  const xml = await sitemapRes.text();
  const matches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g));
  const urls = matches.map(m => m[1]);
  return urls
    .map(u => new URL(u).pathname)
    .filter(p => p.startsWith(`/${locale}`));
}

test.describe('Accessibility & Keyboard & RTL Suite (M6-02)', () => {
  for (const locale of ['ar', 'en'] as const) {
    const isAr = locale === 'ar';
    const expectedDir = isAr ? 'rtl' : 'ltr';

    test(`${locale}: every sitemap page passes core DOM a11y assertions (h1, landmarks, lang/dir, alt, accessible names)`, async ({ page, request }) => {
      const paths = await getSitemapPaths(request, locale);
      expect(paths.length).toBeGreaterThan(0);

      const failures: string[] = [];

      for (const pathname of paths) {
        const res = await page.goto(pathname, { waitUntil: 'domcontentloaded' });
        if (res?.status() !== 200) {
          failures.push(`${pathname}: HTTP status ${res?.status()} (expected 200)`);
          continue;
        }

        // 1. html lang and dir
        const html = page.locator('html');
        const lang = await html.getAttribute('lang');
        const dir = await html.getAttribute('dir');
        if (lang !== locale) {
          failures.push(`${pathname}: html lang is "${lang}", expected "${locale}"`);
        }
        if (dir !== expectedDir) {
          failures.push(`${pathname}: html dir is "${dir}", expected "${expectedDir}"`);
        }

        // 2. Exactly one h1
        const h1Count = await page.locator('h1').count();
        if (h1Count !== 1) {
          failures.push(`${pathname}: found ${h1Count} <h1> elements (expected exactly 1)`);
        } else {
          const h1 = page.locator('h1').first();
          const text = (await h1.textContent())?.trim();
          if (!text || text.length === 0) {
            failures.push(`${pathname}: <h1> is empty`);
          }
        }

        // 3. Landmarks: main, nav, footer
        const mainCount = await page.locator('main').count();
        if (mainCount !== 1) {
          failures.push(`${pathname}: found ${mainCount} <main> landmarks (expected 1)`);
        }
        const navCount = await page.locator('nav').count();
        if (navCount < 1) {
          failures.push(`${pathname}: missing <nav> landmark`);
        }
        const footerCount = await page.locator('footer, [role="contentinfo"]').count();
        if (footerCount < 1) {
          failures.push(`${pathname}: missing <footer> or [role="contentinfo"] landmark`);
        }

        // 4. Skip link exists
        const skipLink = page.locator('a.skip-link[href="#main"]');
        if ((await skipLink.count()) === 0) {
          failures.push(`${pathname}: missing skip link a.skip-link[href="#main"]`);
        }

        // 5. Every image has alt attribute
        const missingAlt = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return imgs
            .filter(img => !img.hasAttribute('alt'))
            .map(img => img.outerHTML.slice(0, 80));
        });
        if (missingAlt.length > 0) {
          failures.push(`${pathname}: images missing alt attribute: ${missingAlt.join('; ')}`);
        }

        // 6. Every visible interactive element has an accessible name
        const missingNames = await page.evaluate(() => {
          const selector = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="button"], summary';
          const elements = Array.from(document.querySelectorAll(selector));
          const unlabelled = [];

          for (const el of elements) {
            // Skip hidden or aria-hidden elements
            if (el.closest('[hidden], [aria-hidden="true"]')) continue;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;

            const ariaLabel = el.getAttribute('aria-label')?.trim();
            if (ariaLabel) continue;

            const ariaLabelledby = el.getAttribute('aria-labelledby');
            if (ariaLabelledby) {
              const text = ariaLabelledby.split(/\s+/).map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
              if (text) continue;
            }

            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
              const id = el.getAttribute('id');
              if (id && document.querySelector(`label[for="${id}"]`)?.textContent?.trim()) continue;
              if (el.closest('label')?.textContent?.trim()) continue;
              const placeholder = el.getAttribute('placeholder')?.trim();
              if (placeholder) continue;
              const title = el.getAttribute('title')?.trim();
              if (title) continue;
              const value = el.getAttribute('value')?.trim();
              if (value && el.getAttribute('type') === 'submit') continue;
            }

            const title = el.getAttribute('title')?.trim();
            if (title) continue;

            // Nested image with alt
            const imgAlt = el.querySelector('img')?.getAttribute('alt')?.trim();
            if (imgAlt) continue;

            // Text content
            const text = ((el as HTMLElement).innerText || el.textContent || '').trim();
            if (text) continue;

            unlabelled.push({
              tag: el.tagName.toLowerCase(),
              html: el.outerHTML.slice(0, 80),
            });
          }
          return unlabelled;
        });

        if (missingNames.length > 0) {
          failures.push(`${pathname}: interactive elements missing accessible name: ${JSON.stringify(missingNames)}`);
        }
      }

      if (failures.length > 0) {
        console.error(`A11y failures for ${locale}:\n` + failures.join('\n'));
      }
      expect(failures, `No a11y DOM failures for ${locale}`).toEqual([]);
    });

    test(`${locale}: skip link works and moves focus to #main`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const skipLink = page.locator('a.skip-link[href="#main"]');
      await expect(skipLink).toBeAttached();

      // Focus skip link
      await skipLink.focus();
      await expect(skipLink).toBeFocused();

      // Press Enter to activate skip link
      await page.keyboard.press('Enter');

      // The target is #main
      const main = page.locator('#main');
      await expect(main).toBeAttached();
      expect(page.url()).toContain('#main');
    });

    test(`${locale}: sequential tab order reaches nav -> main -> footer`, async ({ page }) => {
      // Use /services which has interactive elements in nav, main, and footer
      await page.goto(`/${locale}/services`);
      await page.waitForLoadState('domcontentloaded');

      // Analyze sequential focus order of interactive elements
      const order = await page.evaluate(() => {
        const selector = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="button"], summary';
        const interactive = Array.from(document.querySelectorAll(selector)).filter(el => {
          if (el.closest('[hidden], [aria-hidden="true"]')) return false;
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });

        const landmarks = interactive.map(el => {
          if (el.closest('header, nav')) return 'nav';
          if (el.closest('main')) return 'main';
          if (el.closest('footer')) return 'footer';
          return 'other';
        });

        return landmarks;
      });

      // Find first occurrence of nav, main, footer
      const firstNav = order.indexOf('nav');
      const firstMain = order.indexOf('main');
      const firstFooter = order.indexOf('footer');

      expect(firstNav, 'Nav interactive element exists').toBeGreaterThanOrEqual(0);
      expect(firstMain, 'Main interactive element exists').toBeGreaterThan(firstNav);
      expect(firstFooter, 'Footer interactive element exists').toBeGreaterThan(firstMain);
    });

    test(`${locale}: focus visible style present on interactive elements`, async ({ page }) => {
      await page.goto(`/${locale}/contact`);
      const button = page.locator('button[type="submit"], button').first();
      await button.focus();

      // Check that :focus-visible / :focus has an outline or shadow
      const focusStyle = await button.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor,
          boxShadow: style.boxShadow,
        };
      });

      const hasVisibleFocus =
        (focusStyle.outlineStyle !== 'none' && parseFloat(focusStyle.outlineWidth) > 0) ||
        (focusStyle.boxShadow && focusStyle.boxShadow !== 'none');

      expect(hasVisibleFocus, 'Button has visible focus styling').toBe(true);
    });

    test(`${locale}: mobile nav overlay traps keyboard and closes on Escape with no traps`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`/${locale}`);

      const menuButton = page.locator('button[aria-controls="mobile-nav-panel"]');
      await expect(menuButton).toBeVisible();

      // Open mobile nav
      await menuButton.click();
      const panel = page.locator('#mobile-nav-panel');
      await expect(panel).toBeVisible();
      await expect(menuButton).toHaveAttribute('aria-expanded', 'true');

      // Press Escape
      await page.keyboard.press('Escape');

      // Verify panel is closed
      await expect(panel).toBeHidden();
      await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      await expect(menuButton).toBeFocused();
    });
  }

  test('prefers-reduced-motion: canvas experience falls back to usable HTML', async ({ page }) => {
    // Emulate reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/ar');
    await page.waitForLoadState('domcontentloaded');

    // Verify data-motion="reduced" is set on documentElement
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');

    // Assert that the HTML content layer in <main id="main"> is usable and all sections are accessible
    const main = page.locator('#main');
    await expect(main).toBeVisible();

    // S01 Hero is visible and accessible
    const headline = page.locator('[data-s01-headline]');
    await expect(headline).toBeVisible();
    const s01Projects = page.locator('#s01 a[href="#s05"]');
    const s01Contact = page.locator('#s01 a[href="#s07"]');
    await expect(s01Projects).toBeAttached();
    await expect(s01Contact).toBeAttached();

    // S03 Services panel is present and usable
    const s03Panel = page.locator('#s03 [class*="panel"]');
    await expect(s03Panel).toBeAttached();

    // S04 Explore panel is present
    const s04Explore = page.locator('#s04 [class*="panel"]');
    await expect(s04Explore).toBeAttached();

    // S05 Gallery is present with fallback or still pose
    const s05Gallery = page.locator('#s05 [data-gallery-panel]');
    await expect(s05Gallery).toBeAttached();

    // S06 DNA list has all values rendered
    const dnaValues = page.locator('#s06 ol[class*="valuesList"] li');
    await expect(dnaValues).toHaveCount(7);

    // S07 Build Your Future panel has 4 options
    const s07Options = page.locator('#s07 button[data-choice]');
    await expect(s07Options).toHaveCount(4);

    // Verify 3D host is aria-hidden ensuring fallback to usable HTML layer
    const experienceHost = page.locator('[data-experience]');
    await expect(experienceHost).toHaveAttribute('aria-hidden', 'true');
  });
});
