import { describe, expect, it } from 'vitest';
import arMessages from '../../src/messages/ar.json';
import enMessages from '../../src/messages/en.json';

function getLeafKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...getLeafKeyPaths(value as Record<string, unknown>, fullPath));
    } else {
      paths.push(fullPath);
    }
  }
  return paths.sort();
}

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

describe('messages parity', () => {
  const arPaths = getLeafKeyPaths(arMessages);
  const enPaths = getLeafKeyPaths(enMessages);

  it('has identical set of keys between ar.json and en.json', () => {
    const missingInEn = arPaths.filter(p => !enPaths.includes(p));
    const missingInAr = enPaths.filter(p => !arPaths.includes(p));

    expect(missingInEn, 'Keys missing in en.json').toEqual([]);
    expect(missingInAr, 'Keys missing in ar.json').toEqual([]);
    expect(arPaths).toEqual(enPaths);
  });

  it('has non-empty string values for all keys', () => {
    for (const keyPath of arPaths) {
      const arVal = getValueByPath(arMessages, keyPath);
      const enVal = getValueByPath(enMessages, keyPath);

      expect(typeof arVal, `ar: ${keyPath} is string`).toBe('string');
      expect(typeof enVal, `en: ${keyPath} is string`).toBe('string');
      expect((arVal as string).trim().length, `ar: ${keyPath} is non-empty`).toBeGreaterThan(0);
      expect((enVal as string).trim().length, `en: ${keyPath} is non-empty`).toBeGreaterThan(0);
    }
  });
});
