import { describe, expect, it } from 'vitest';
import { cursorEnabled, magneticOffset } from '../../src/experience/cursor';
import { effectiveMotion, readMotionChoice, saveMotionChoice } from '../../src/experience/profile';

describe('cursor and motion preferences', () => {
  it('enables the cursor only for fine pointers without reduced motion', () => {
    expect(cursorEnabled(true, false)).toBe(true);
    expect(cursorEnabled(false, false)).toBe(false);
    expect(cursorEnabled(true, true)).toBe(false);
  });
  it('clamps magnetic pull in either direction', () => {
    expect(magneticOffset(1000)).toBe(8);
    expect(magneticOffset(-1000)).toBe(-8);
    expect(magneticOffset(20)).toBe(3);
  });
  it('persists the choice and respects system reduced motion', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    saveMotionChoice(storage, 'direct');
    expect(readMotionChoice(storage)).toBe('direct');
    expect(effectiveMotion(false, readMotionChoice(storage))).toBe('reduced');
    saveMotionChoice(storage, 'cinematic');
    expect(effectiveMotion(true, readMotionChoice(storage))).toBe('reduced');
    expect(effectiveMotion(false, readMotionChoice(storage))).toBe('full');
  });
});

