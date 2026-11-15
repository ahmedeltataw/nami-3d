import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast, parseColors, TEXT_PAIRS, type Theme } from '../../src/lib/contrast';

const css = readFileSync('src/styles/tokens.css', 'utf8');

describe.each(['light', 'dark'] as Theme[])('token contrast (%s)', (theme) => {
  const colors = parseColors(css, theme);
  it.each(TEXT_PAIRS)('$fg on $bg >= $min', ({ fg, bg, min }) => {
    expect(colors[fg], fg).toBeDefined();
    expect(colors[bg], bg).toBeDefined();
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(min);
  });
});
