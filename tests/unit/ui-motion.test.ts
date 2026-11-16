import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initRevealObserver,
  splitWords,
} from '../../src/ui-motion';

class MockElement {
  attributes: Record<string, string> = {};
  children: MockElement[] = [];

  setAttribute(name: string, val: string) {
    this.attributes[name] = val;
  }
  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }
  appendChild(child: MockElement) {
    this.children.push(child);
    return child;
  }
  querySelectorAll(sel: string): MockElement[] {
    const res: MockElement[] = [];
    const check = (node: MockElement) => {
      if (sel === '[data-reveal]' && 'data-reveal' in node.attributes) {
        res.push(node);
      }
      for (const c of node.children) check(c);
    };
    check(this);
    return res;
  }
}

describe('UI Motion', () => {
  describe('word splitter keeps Arabic words intact', () => {
    it('splits Arabic sentences into intact words without breaking characters', () => {
      const arabicSentence = 'مرحبا بك في نامي للحلول البرمجية المتكاملة';
      const words = splitWords(arabicSentence);

      expect(words).toEqual([
        'مرحبا',
        'بك',
        'في',
        'نامي',
        'للحلول',
        'البرمجية',
        'المتكاملة',
      ]);

      for (const word of words) {
        expect(word.trim().length).toBeGreaterThan(0);
        expect(word).not.toMatch(/\s/);
      }
    });

    it('splits English sentences correctly by words', () => {
      const englishSentence = 'Welcome to Nami Technology and 3D experience';
      const words = splitWords(englishSentence);

      expect(words).toEqual([
        'Welcome',
        'to',
        'Nami',
        'Technology',
        'and',
        '3D',
        'experience',
      ]);
    });

    it('handles mixed punctuation, multiple spaces, and empty input', () => {
      expect(splitWords('')).toEqual([]);
      expect(splitWords('   ')).toEqual([]);
      expect(splitWords('  كلمة   أخرى!  ')).toEqual(['كلمة', 'أخرى!']);
    });
  });

  describe('reveal helper reduced-motion branch', () => {
    let container: MockElement;

    beforeEach(() => {
      container = new MockElement();
    });

    it('immediately reveals elements when reduced motion is preferred', () => {
      const el1 = new MockElement();
      el1.setAttribute('data-reveal', '');
      const el2 = new MockElement();
      el2.setAttribute('data-reveal', '');
      container.appendChild(el1);
      container.appendChild(el2);

      const cleanup = initRevealObserver(container as unknown as Element, {
        reducedMotion: true,
      });

      expect(el1.getAttribute('data-revealed')).toBe('true');
      expect(el2.getAttribute('data-revealed')).toBe('true');

      cleanup();
    });

    it('immediately reveals elements when direct motion mode is selected', () => {
      const el = new MockElement();
      el.setAttribute('data-reveal', '');
      container.appendChild(el);

      const cleanup = initRevealObserver(container as unknown as Element, {
        reducedMotion: false,
        motionChoice: 'direct',
      });

      expect(el.getAttribute('data-revealed')).toBe('true');

      cleanup();
    });

    it('uses IntersectionObserver when motion is full', () => {
      let observerCallback: (
        entries: Array<{ target: MockElement; isIntersecting: boolean }>,
        obs: { unobserve: (el: MockElement) => void }
      ) => void = () => {};
      const observeMock = vi.fn();
      const unobserveMock = vi.fn();
      const disconnectMock = vi.fn();

      const MockIntersectionObserver = vi.fn().mockImplementation(function (cb) {
        observerCallback = cb;
        return {
          observe: observeMock,
          unobserve: unobserveMock,
          disconnect: disconnectMock,
        };
      });

      vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
      vi.stubGlobal('window', {
        IntersectionObserver: MockIntersectionObserver,
      });

      const el = new MockElement();
      el.setAttribute('data-reveal', '');
      container.appendChild(el);

      const cleanup = initRevealObserver(container as unknown as Element, {
        reducedMotion: false,
        motionChoice: 'cinematic',
      });

      expect(observeMock).toHaveBeenCalledWith(el);
      expect(el.getAttribute('data-revealed')).toBeNull();

      // Simulate intersection
      observerCallback([{ target: el, isIntersecting: true }], { unobserve: unobserveMock });
      expect(el.getAttribute('data-revealed')).toBe('true');
      expect(unobserveMock).toHaveBeenCalledWith(el);

      cleanup();
      expect(disconnectMock).toHaveBeenCalled();
    });
  });
});
