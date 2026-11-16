import { expect, test } from '@playwright/test';

test.describe('Forms, Contact, and Careers', () => {
  for (const locale of ['ar', 'en'] as const) {
    const isAr = locale === 'ar';
    const expectedDir = isAr ? 'rtl' : 'ltr';

    test(`${locale}/contact: renders page, accessible form, preselects type, validates, shows unavailable with direct contact, zero console errors`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Navigate to contact with query param to test project type preselection
      const res = await page.goto(`/${locale}/contact?type=mobile`);
      expect(res?.status()).toBe(200);

      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', locale);
      await expect(html).toHaveAttribute('dir', expectedDir);

      // Verify page title and header
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();

      // Verify form elements exist with proper accessibility associations
      const form = page.locator('form');
      await expect(form).toBeVisible();

      const nameInput = page.locator('#lead-name');
      const emailInput = page.locator('#lead-email');
      const phoneInput = page.locator('#lead-phone');
      const typeSelect = page.locator('#lead-project-type');
      const messageInput = page.locator('#lead-message');
      const submitBtn = form.locator('button[type="submit"]');

      await expect(nameInput).toBeVisible();
      await expect(emailInput).toBeVisible();
      await expect(phoneInput).toBeVisible();
      await expect(typeSelect).toBeVisible();
      await expect(messageInput).toBeVisible();
      await expect(submitBtn).toBeVisible();

      // Check preselection of projectType from query param
      await expect(typeSelect).toHaveValue('mobile');

      // 1. Validation test: submit empty form
      // Clear any fields if needed and click submit
      await nameInput.fill('');
      await submitBtn.click();

      // Validation errors should appear with aria-describedby and role=alert
      const nameError = page.locator('#lead-name-error');
      await expect(nameError).toBeVisible();
      await expect(nameInput).toHaveAttribute('aria-invalid', 'true');

      // 2. Fill valid form data
      await nameInput.fill('Test User');
      await emailInput.fill('user@example.com');
      await phoneInput.fill('+966500000000');
      await messageInput.fill('I would like to start a new mobile application project.');

      // Error should clear on input
      await expect(nameError).not.toBeVisible();

      // 3. Submit valid form — honest default adapter returns 'unavailable'
      await submitBtn.click();

      // Verify unavailable status banner appears in aria-live region
      const unavailableBanner = page.getByTestId('status-unavailable');
      await expect(unavailableBanner).toBeVisible();

      // Verify direct contact links are rendered in unavailable state
      const directLinks = unavailableBanner.locator('a');
      const linkCount = await directLinks.count();
      expect(linkCount).toBeGreaterThan(0);

      // Verify presence of mailto, tel, or whatsapp link from content
      const hrefs = await directLinks.evaluateAll(els =>
        els.map(el => (el as HTMLAnchorElement).href)
      );
      const hasDirectChannel = hrefs.some(
        h => h.startsWith('mailto:') || h.startsWith('tel:') || h.includes('wa.me') || h.includes('Wa.me')
      );
      expect(hasDirectChannel).toBe(true);

      // Verify retry button is present and clickable
      const retryBtn = unavailableBanner.getByRole('button');
      await expect(retryBtn).toBeVisible();

      // Verify no uncaught console errors
      const criticalErrors = consoleErrors.filter(
        err => !err.includes('favicon') && !err.includes('WebGL')
      );
      expect(criticalErrors).toEqual([]);
    });

    test(`${locale}/careers: renders positions, application form, rejects bad CV file type, shows unavailable with HR contact`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      const res = await page.goto(`/${locale}/careers`);
      expect(res?.status()).toBe(200);

      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', locale);
      await expect(html).toHaveAttribute('dir', expectedDir);

      // Verify careers application form exists
      const form = page.locator('form');
      await expect(form).toBeVisible();

      const nameInput = page.locator('#careers-name');
      const emailInput = page.locator('#careers-email');
      const phoneInput = page.locator('#careers-phone');
      const roleSelect = page.locator('#careers-role');
      const messageInput = page.locator('#careers-message');
      const cvInput = page.locator('#careers-cv');
      const submitBtn = form.locator('button[type="submit"]');

      await expect(nameInput).toBeVisible();
      await expect(emailInput).toBeVisible();
      await expect(phoneInput).toBeVisible();
      await expect(roleSelect).toBeVisible();
      await expect(messageInput).toBeVisible();
      await expect(cvInput).toBeVisible();
      await expect(submitBtn).toBeVisible();

      // 1. Client-side CV validation rejects invalid file extension (.png or .exe)
      await cvInput.setInputFiles({
        name: 'test-malware.png',
        mimeType: 'image/png',
        buffer: Buffer.from('not a document'),
      });

      const cvError = page.locator('#careers-cv-error');
      await expect(cvError).toBeVisible();
      await expect(cvInput).toHaveAttribute('aria-invalid', 'true');

      // 2. Select valid CV document (.pdf)
      await cvInput.setInputFiles({
        name: 'candidate-resume.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test document content'),
      });

      // Error should disappear and selected file badge appears
      await expect(cvError).not.toBeVisible();
      const selectedInfo = page.getByTestId('selected-file-info');
      await expect(selectedInfo).toBeVisible();
      await expect(selectedInfo).toContainText('candidate-resume.pdf');

      // 3. Fill required fields and submit
      await nameInput.fill('Sarah Candidate');
      await emailInput.fill('sarah.candidate@example.com');
      await phoneInput.fill('+966512345678');
      await messageInput.fill('Experienced software engineer interested in joining your team.');

      await submitBtn.click();

      // 4. Verify unavailable status banner appears with direct HR email link
      const unavailableBanner = page.getByTestId('careers-status-unavailable');
      await expect(unavailableBanner).toBeVisible();

      const hrLink = unavailableBanner.locator('a[href^="mailto:"]');
      await expect(hrLink).toBeVisible();
      const hrHref = await hrLink.getAttribute('href');
      expect(hrHref).toContain('mailto:');
      expect(hrHref).toContain('hr@nami-tec.com');

      // 5. Verify no console errors
      const criticalErrors = consoleErrors.filter(
        err => !err.includes('favicon') && !err.includes('WebGL')
      );
      expect(criticalErrors).toEqual([]);
    });

    test(`${locale}/about: renders real company vision, mission, and core values name-only`, async ({
      page,
    }) => {
      const res = await page.goto(`/${locale}/about`);
      expect(res?.status()).toBe(200);

      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();

      // Check values section
      const valueCards = page.locator('main section div div');
      const count = await valueCards.count();
      expect(count).toBeGreaterThanOrEqual(7);
    });
  }
});
