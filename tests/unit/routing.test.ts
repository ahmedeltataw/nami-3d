import { describe, expect, it } from 'vitest';
import { routing } from '../../src/i18n/routing';

describe('locale routing', () => {
  it('supports Arabic and English with Arabic as the default', () => {
    expect(routing.locales).toEqual(['ar', 'en']);
    expect(routing.defaultLocale).toBe('ar');
  });
});
