import { expect, test } from '@playwright/test';

for (const locale of ['ar', 'en'] as const) {
  test(`${locale}: sound toggle button state and persistence after reload`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('THREE.WebGLRenderer') && !text.includes('SwiftShader')) {
          errors.push(text);
        }
      }
    });

    await page.goto(`/${locale}`);

    // Find sound toggle button in footer or nav
    const soundToggle = page.locator('footer button[data-sound="click"], header button[data-sound="click"]').first();
    await expect(soundToggle).toBeVisible();

    // OFF by default
    await expect(soundToggle).toHaveAttribute('aria-pressed', 'false');

    // Toggle ON (explicit user consent)
    await soundToggle.click();
    await expect(soundToggle).toHaveAttribute('aria-pressed', 'true');

    // Persistence after reload
    await page.reload();
    const soundToggleAfterReload = page.locator('footer button[data-sound="click"], header button[data-sound="click"]').first();
    await expect(soundToggleAfterReload).toBeVisible();
    await expect(soundToggleAfterReload).toHaveAttribute('aria-pressed', 'true');

    // Toggle OFF (mute)
    await soundToggleAfterReload.click();
    await expect(soundToggleAfterReload).toHaveAttribute('aria-pressed', 'false');

    // Persistence after second reload
    await page.reload();
    const soundToggleMuted = page.locator('footer button[data-sound="click"], header button[data-sound="click"]').first();
    await expect(soundToggleMuted).toHaveAttribute('aria-pressed', 'false');

    expect(errors, `No console errors on ${locale}`).toEqual([]);
  });

  test(`${locale}: reduced-motion context renders all content visible and keeps sound off by default`, async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
    });
    // Content visibility and sound state do not depend on the production image CDN.
    await context.route('https://backend.nami-tec.com/storage/images/project/**', route => route.fulfill({
      path: 'public/posters/s05.svg', contentType: 'image/svg+xml',
    }));
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('THREE.WebGLRenderer') && !text.includes('SwiftShader')) {
          errors.push(text);
        }
      }
    });

    // Content pages to test
    const contentPages = [
      `/${locale}/about`,
      `/${locale}/services`,
      `/${locale}/projects`,
      `/${locale}/contact`,
      `/${locale}/blog`,
      `/${locale}/faqs`,
    ];

    for (const route of contentPages) {
      await page.goto(route);

      // Verify sound toggle is still off by default under reduced motion
      const soundToggle = page.locator('footer button[data-sound="click"], header button[data-sound="click"]').first();
      await expect(soundToggle).toHaveAttribute('aria-pressed', 'false');

      // Headings and cards with data-reveal must be visible
      const revealElements = page.locator('[data-reveal]');
      const count = await revealElements.count();
      expect(count, `Found data-reveal elements on ${route}`).toBeGreaterThan(0);

      // Verify headings and cards are visible and not hidden by transform/opacity
      const h1 = page.locator('h1[data-reveal]').first();
      await expect(h1).toBeVisible();

      // Check all reveal elements
      for (let i = 0; i < Math.min(count, 5); i++) {
        await expect(revealElements.nth(i)).toBeVisible();
      }
    }

    expect(errors, `No console errors in reduced-motion on ${locale}`).toEqual([]);
    await context.close();
  });

  test(`${locale}: direct motion mode renders content visible and reveals immediately`, async ({ page }) => {
    // Set direct motion mode in localStorage
    await page.addInitScript(() => {
      try {
        localStorage.setItem('nami-motion', 'direct');
      } catch {
        /* ignore */
      }
    });

    await page.goto(`/${locale}/about`);

    // Verify h1 and cards are visible
    const h1 = page.locator('h1[data-reveal]').first();
    await expect(h1).toBeVisible();

    const cards = page.locator('[data-reveal]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(cards.nth(i)).toBeVisible();
    }
  });
}
