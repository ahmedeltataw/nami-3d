import { describe, expect, it } from 'vitest';
import { referenceToolsEnabled } from '../../src/experience/debug/gate';
import { referenceOverlay } from '../../src/experience/debug/reference';

describe('reference tools gate', () => {
  it('rejects production query-only access', () => {
    expect(referenceToolsEnabled('production', undefined)).toBe(false);
    expect(referenceToolsEnabled('production', '0')).toBe(false);
    expect(referenceToolsEnabled('production', 'true')).toBe(false);
  });
  it('allows development and explicitly enabled preview builds', () => {
    expect(referenceToolsEnabled('development', undefined)).toBe(true);
    expect(referenceToolsEnabled('test', undefined)).toBe(true);
    expect(referenceToolsEnabled('production', '1')).toBe(true);
  });
});

describe('referenceOverlay lifecycle and gate', () => {
  it('returns no-op function when window is undefined', () => {
    const dispose = referenceOverlay();
    expect(typeof dispose).toBe('function');
    dispose();
  });

  it('mounts and cleans up overlay image in enabled browser context', () => {
    type MockElement = {
      src?: string;
      alt?: string;
      style: Record<string, string>;
      dataset: Record<string, string>;
      setAttribute: (k: string, v: string) => void;
      remove: () => void;
    };
    const listeners: Record<string, ((e: Event) => void)[]> = {};
    const appended: MockElement[] = [];
    const mockWindow = {
      location: { search: '?debug=reference&scene=S01&opacity=0.4' },
      addEventListener: (type: string, cb: (e: Event) => void) => {
        (listeners[type] ||= []).push(cb);
      },
      removeEventListener: (type: string, cb: (e: Event) => void) => {
        listeners[type] = (listeners[type] || []).filter(l => l !== cb);
      },
    };
    const mockDocument = {
      createElement: (): MockElement => {
        const el: MockElement = {
          style: {},
          dataset: {},
          setAttribute: (k: string, v: string) => { (el as Record<string, unknown>)[k] = v; },
          remove: () => {
            const idx = appended.indexOf(el);
            if (idx >= 0) appended.splice(idx, 1);
          },
        };
        return el;
      },
      body: {
        append: (el: MockElement) => { appended.push(el); },
      },
    };

    const globalObj = globalThis as unknown as { window?: unknown; document?: unknown };
    globalObj.window = mockWindow;
    globalObj.document = mockDocument;

    try {
      const dispose = referenceOverlay();
      expect(appended.length).toBe(1);
      const img = appended[0];
      expect(img.src).toContain('S01.png');
      expect(img.style.opacity).toBe('0.4');
      expect(img.style.pointerEvents).toBe('none');

      // Test keydown '[' decreases opacity by 0.05
      const keydown = listeners['keydown']?.[0];
      expect(keydown).toBeDefined();
      keydown?.({ key: '[', target: {} } as unknown as KeyboardEvent);
      expect(img.style.opacity).toBe('0.35');

      // Test keydown ']' increases opacity by 0.05
      keydown?.({ key: ']', target: {} } as unknown as KeyboardEvent);
      expect(img.style.opacity).toBe('0.4');

      // Test cleanup
      dispose();
      expect(appended.length).toBe(0);
      expect(listeners['keydown'].length).toBe(0);
    } finally {
      delete globalObj.window;
      delete globalObj.document;
    }
  });
});
