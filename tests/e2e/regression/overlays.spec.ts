import { expect, test } from '@playwright/test';
import { SCENE_IDS } from '../../../src/experience/scroll-map';
import { scrollBody, seekJump } from '../motion-helpers';
import { boundaryBeats, JUMPS, openCapturePage } from './harness';

const MID_JUMP_SAMPLES = [0.12, 0.30, 0.55, 0.85] as const;

test('DOM overlays are inert and non-focusable/non-clickable mid-jump, and focus lands on destination headings after nav jumps', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await openCapturePage(page, { locale: 'en', ambient: 6, intro: 8, hash: 's01', viewport: { width: 1280, height: 800 } });

  const host = page.locator('[data-experience]');

  // 1. Mid-jump overlay checks across every jump boundary
  for (const jump of JUMPS) {
    const { swap } = boundaryBeats(jump.boundary);
    // Warm destination poster/scene assets across the boundary before sampling t = 0.55
    await seekJump(page, jump.boundary, 0.85);
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().loading), { timeout: 45_000 }).toBe(false);
    await expect(host, `${jump.id} warm host data-scene`).toHaveAttribute('data-scene', jump.to);
    for (const t of MID_JUMP_SAMPLES) {
      const expectedOwner = t < swap ? jump.from : jump.to;
      await seekJump(page, jump.boundary, t);
      await expect.poll(() => page.evaluate(() => window.__namiDebug?.().loading), { timeout: 45_000 }).toBe(false);
      await expect(host, `${jump.id} t=${t} host data-scene`).toHaveAttribute('data-scene', expectedOwner);

      // Assert React-committed [data-scene-panel] active and inert attributes via auto-retrying locators + expect.poll
      for (const panelScene of ['s06', 's07'] as const) {
        const panel = page.locator(`[data-scene-panel="${panelScene}"]`);
        await expect(panel, `${jump.id} t=${t} panel ${panelScene} data-active`).toHaveAttribute(
          'data-active',
          String(panelScene === expectedOwner),
        );
        if (panelScene === expectedOwner) {
          await expect(panel, `${jump.id} t=${t} owner panel ${panelScene} not inert`).not.toHaveAttribute('inert');
        } else {
          await expect(panel, `${jump.id} t=${t} inactive panel ${panelScene} inert`).toHaveAttribute('inert', '');
        }
      }

      await expect
        .poll(
          () =>
            page.evaluate(owner => {
              return Array.from(document.querySelectorAll<HTMLElement>('[data-scene-panel]'))
                .filter(panel => panel.dataset.scenePanel !== owner)
                .every(panel => panel.inert);
            }, expectedOwner),
          { message: `${jump.id} t=${t} inactive scene panels must be inert` },
        )
        .toBe(true);

      const overlayCheck = await page.evaluate(({ from, to, t }) => {
        const debug = window.__namiDebug?.();
        const owner = debug?.owner;
        const overlayRoot = document.querySelector<HTMLElement>('[data-narrative-overlays]');
        if (!overlayRoot) throw new Error('Missing [data-narrative-overlays] root');

        const wrappers = Array.from(overlayRoot.querySelectorAll<HTMLElement>('[data-overlay-scene]'));
        const sceneResults = wrappers.map(wrapper => {
          const id = wrapper.dataset.overlayScene!;
          const timeline = wrapper.querySelector<HTMLElement>('[data-scene-timeline]')!;
          const jumpNode = wrapper.querySelector<HTMLElement>('[data-jump-opacity]')!;
          const active = id === from || id === to;
          const interactive = Array.from(wrapper.querySelectorAll<HTMLElement>('a, button, input, select, textarea, [tabindex]'));

          let focusEscaped = false;
          let hitInsideOverlay = false;
          for (const el of interactive) {
            el.focus();
            if (overlayRoot.contains(document.activeElement)) {
              focusEscaped = true;
            }
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              const cx = Math.min(window.innerWidth - 1, Math.max(1, rect.left + rect.width / 2));
              const cy = Math.min(window.innerHeight - 1, Math.max(1, rect.top + rect.height / 2));
              const hit = document.elementFromPoint(cx, cy);
              if (hit && overlayRoot.contains(hit)) {
                hitInsideOverlay = true;
              }
            }
          }

          return {
            id,
            active,
            hidden: wrapper.hidden,
            inert: timeline.inert,
            visibility: wrapper.style.visibility,
            jumpOpacity: Number(getComputedStyle(jumpNode).opacity),
            focusEscaped,
            hitInsideOverlay,
          };
        });

        return { owner, t, sceneResults };
      }, { from: jump.from, to: jump.to, t });

      for (const res of overlayCheck.sceneResults) {
        expect(res.inert, `${jump.id} t=${t} overlay ${res.id} must be inert mid-jump`).toBe(true);
        expect(res.focusEscaped, `${jump.id} t=${t} overlay ${res.id} must not allow focus mid-jump`).toBe(false);
        expect(res.hitInsideOverlay, `${jump.id} t=${t} overlay ${res.id} must not be clickable mid-jump`).toBe(false);
        expect(res.hidden, `${jump.id} t=${t} overlay ${res.id} hidden state`).toBe(!res.active);

        if (res.active) {
          expect(res.visibility, `${jump.id} t=${t} overlay ${res.id} visibility`).toBe(res.id === overlayCheck.owner ? 'visible' : 'hidden');
          if (t >= 0.25 && t <= 0.75) {
            expect(res.jumpOpacity, `${jump.id} t=${t} overlay ${res.id} opacity between .25 and .75`).toBe(0);
          } else {
            expect(res.jumpOpacity, `${jump.id} t=${t} overlay ${res.id} partial fade opacity`).toBeGreaterThan(0);
            expect(res.jumpOpacity, `${jump.id} t=${t} overlay ${res.id} partial fade opacity`).toBeLessThan(1);
          }
        }
      }
    }
  }

  // 2. Ordinary scroll never moves focus to a heading
  await scrollBody(page, 's05', 0);
  const skipLink = page.locator('a.skip-link');
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await scrollBody(page, 's02', 0.4);
  await seekJump(page, 1, 0.5);
  await expect(skipLink).toBeFocused();

  // 3. Header nav jumps land on every scene hero (b = 0, transition = null) and focus the destination heading
  for (const scene of SCENE_IDS) {
    await page.getByRole('link', { name: scene, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${scene}$`));
    await expect(host).toHaveAttribute('data-scene', scene);

    const overlayTimeline = page.locator(`[data-overlay-scene="${scene}"] [data-scene-timeline]`);
    if ((await overlayTimeline.count()) > 0) {
      await expect(overlayTimeline).not.toHaveAttribute('inert');
    }
    const scenePanel = page.locator(`[data-scene-panel="${scene}"]`);
    if ((await scenePanel.count()) > 0) {
      await expect(scenePanel).toHaveAttribute('data-active', 'true');
      await expect(scenePanel).not.toHaveAttribute('inert');
    }

    await expect
      .poll(() =>
        page.evaluate(targetScene => {
          const debug = window.__namiDebug?.();
          const active = document.activeElement as HTMLElement | null;
          const overlayHeading = document.querySelector<HTMLElement>(
            `[data-overlay-scene="${targetScene}"] h1, [data-overlay-scene="${targetScene}"] h2`,
          );
          const sectionHeading = document.getElementById(targetScene)?.querySelector<HTMLElement>('h1, h2, [role=heading]');
          const expectedHeading = overlayHeading ?? sectionHeading;
          const timelineEl = document.querySelector<HTMLElement>(`[data-overlay-scene="${targetScene}"] [data-scene-timeline]`);
          const panelEl = expectedHeading?.closest<HTMLElement>('[data-scene-panel]');
          return {
            b: debug?.b,
            transition: debug?.transition,
            owner: debug?.owner,
            hasHeading: targetScene === 's04' ? true : !!expectedHeading,
            headingFocused: expectedHeading ? active === expectedHeading : true,
            overlayInert: timelineEl ? timelineEl.inert : false,
            panelInert: panelEl ? panelEl.inert : false,
          };
        }, scene),
      )
      .toEqual({
        b: 0,
        transition: null,
        owner: scene,
        hasHeading: true,
        headingFocused: true,
        overlayInert: false,
        panelInert: false,
      });
  }

  // 4. Skip link, S01 CTA links, keyboard PageDown/PageUp/Home/End, and history back/forward focus destination headings
  await skipLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-s01-headline]')).toBeFocused();

  await page.locator('[data-overlay-scene="s01"] a[href="#s05"]').click();
  await expect(page.locator('#s05 h2').first()).toBeFocused();

  await page.keyboard.press('PageDown');
  await expect(page.locator('#s06 h2').first()).toBeFocused();

  await page.keyboard.press('End');
  await expect(page.locator('#s07 h2').first()).toBeFocused();

  await page.keyboard.press('PageUp');
  await expect(page.locator('#s06 h2').first()).toBeFocused();

  await page.keyboard.press('Home');
  await expect(page.locator('[data-s01-headline]')).toBeFocused();

  await page.locator('[data-overlay-scene="s01"] a[href="#s07"]').click();
  await expect(page.locator('#s07 h2').first()).toBeFocused();

  await page.goBack();
  await expect(page.locator('[data-s01-headline]')).toBeFocused();

  await page.goForward();
  await expect(page.locator('#s07 h2').first()).toBeFocused();

  expect(errors).toEqual([]);
});
