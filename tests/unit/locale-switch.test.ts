import { describe, expect, it } from 'vitest';
import { switchLocalePath } from '../../src/lib/locale-path';

describe('switchLocalePath', () => {
  it('switches root locale preserving target locale', () => {
    expect(switchLocalePath('/ar', 'ar', 'en')).toBe('/en');
    expect(switchLocalePath('/en', 'en', 'ar')).toBe('/ar');
  });

  it('switches deep page path', () => {
    expect(switchLocalePath('/ar/services/mobile-application-development', 'ar', 'en')).toBe('/en/services/mobile-application-development');
    expect(switchLocalePath('/en/projects/al-nahdi-family-office', 'en', 'ar')).toBe('/ar/projects/al-nahdi-family-office');
    expect(switchLocalePath('/ar/about', 'ar', 'en')).toBe('/en/about');
    expect(switchLocalePath('/en/contact', 'en', 'ar')).toBe('/ar/contact');
  });

  it('preserves hash across locale switch', () => {
    expect(switchLocalePath('/ar', 'ar', 'en', '#s05')).toBe('/en#s05');
    expect(switchLocalePath('/en', 'en', 'ar', '#s02')).toBe('/ar#s02');
    expect(switchLocalePath('/ar/services/website-development', 'ar', 'en', '#details')).toBe('/en/services/website-development#details');
    // hash without leading '#' should also normalize
    expect(switchLocalePath('/ar', 'ar', 'en', 's03')).toBe('/en#s03');
  });

  it('handles empty hash cleanly', () => {
    expect(switchLocalePath('/ar', 'ar', 'en', '')).toBe('/en');
    expect(switchLocalePath('/en/blog', 'en', 'ar', '')).toBe('/ar/blog');
  });

  it('handles root path or un-prefixed paths', () => {
    expect(switchLocalePath('/', 'ar', 'en')).toBe('/en');
    expect(switchLocalePath('', 'ar', 'en')).toBe('/en');
    expect(switchLocalePath('/services', 'ar', 'en')).toBe('/en/services');
  });
});
