import { describe, expect, it } from 'vitest';
import { SCROLL_MAP, TOTAL_BUDGET } from '../../src/experience/scroll-map';
import {
  CAPTURE_DIRECTIONS,
  captureFrameFileName,
  contactFrameRelativePath,
  DEFAULT_JUMP_T,
  formatJumpT,
  JUMP_IDS,
  JUMP_SLUGS,
  JUMPS,
  parseTValues,
  progressForJump,
  resolveJumpTargets,
  SCROLL_BUDGETS,
} from '../../scripts/capture-jumps.mjs';

describe('capture-jumps script helpers', () => {
  it('matches the runtime scroll map budgets and boundary geometry', () => {
    expect(SCROLL_BUDGETS).toEqual(SCROLL_MAP.map(row => row.budget));
    expect(JUMPS).toHaveLength(6);
    expect(JUMP_IDS).toEqual(['s01->s02', 's02->s03', 's03->s04', 's04->s05', 's05->s06', 's06->s07']);
    expect(JUMP_SLUGS).toEqual(['s01-s02', 's02-s03', 's03-s04', 's04-s05', 's05-s06', 's06-s07']);
    expect(DEFAULT_JUMP_T).toEqual([0, 0.15, 0.30, 0.50, 0.53, 0.59, 0.60, 0.78, 1.0]);
    expect(CAPTURE_DIRECTIONS).toEqual(['forward', 'reverse', 'direct-seek']);

    for (const [index, jump] of JUMPS.entries()) {
      const row = SCROLL_MAP[index];
      const next = SCROLL_MAP[index + 1];
      expect(jump.departure).toBe(row.departure);
      expect(jump.length).toBe(row.head + next.tail);
      expect(progressForJump(index, 0)).toBeCloseTo(row.departure / TOTAL_BUDGET, 10);
      expect(progressForJump(jump.id, 1)).toBeCloseTo(next.hero / TOTAL_BUDGET, 10);
      expect(progressForJump(jump.slug, 0.5)).toBeCloseTo((row.departure + 0.5 * jump.length) / TOTAL_BUDGET, 10);
    }
  });

  it('resolves jump targets by id, slug, index, comma list, or all', () => {
    expect(resolveJumpTargets('all')).toHaveLength(6);
    expect(resolveJumpTargets()).toHaveLength(6);
    expect(resolveJumpTargets('s01->s02').map(j => j.slug)).toEqual(['s01-s02']);
    expect(resolveJumpTargets('s02-s03,s05->s06,0').map(j => j.id)).toEqual(['s02->s03', 's05->s06', 's01->s02']);
    expect(() => resolveJumpTargets('s07->s08')).toThrow(/Unknown jump/);
  });

  it('formats filenames and validates custom t lists', () => {
    expect(formatJumpT(0)).toBe('0.00');
    expect(formatJumpT(0.3)).toBe('0.30');
    expect(formatJumpT(0.53)).toBe('0.53');
    expect(formatJumpT(1)).toBe('1.00');
    expect(captureFrameFileName('forward', 0.3)).toBe('forward-t0.30.png');
    expect(captureFrameFileName('reverse', 0.59)).toBe('reverse-t0.59.png');
    expect(captureFrameFileName('direct-seek', 1)).toBe('direct-seek-t1.00.png');
    expect(contactFrameRelativePath('s01-s02', 'forward-t0.00.png')).toBe('s01-s02/forward-t0.00.png');
    expect(contactFrameRelativePath('s06-s07', 'direct-seek-t1.00.png')).not.toContain('\\');
    expect(parseTValues('0,0.5,1')).toEqual([0, 0.5, 1]);
    expect(() => parseTValues('0,1.2')).toThrow(/Invalid --t/);
  });
});
