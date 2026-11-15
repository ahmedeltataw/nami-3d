export type Theme = 'light' | 'dark';
export type Pair = { fg: string; bg: string; min: number };

export const TEXT_PAIRS: Pair[] = [
  { fg: 'ink', bg: 'surface', min: 4.5 },
  { fg: 'ink', bg: 'surface-alt', min: 4.5 },
  { fg: 'muted', bg: 'surface', min: 4.5 },
  { fg: 'muted', bg: 'surface-alt', min: 4.5 },
  { fg: 'accent-strong', bg: 'surface', min: 4.5 },
  { fg: 'accent-strong', bg: 'surface-alt', min: 4.5 },
  { fg: 'on-accent', bg: 'accent-strong', min: 4.5 },
  { fg: 'danger', bg: 'surface', min: 4.5 },
  { fg: 'on-danger', bg: 'danger', min: 4.5 },
  { fg: 'focus', bg: 'surface', min: 3 },
  { fg: 'focus', bg: 'surface-alt', min: 3 },
];

function block(css: string, selector: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(new RegExp(selector.source + String.raw`\s*\{([^}]*)\}`, 'g'))) {
    for (const d of m[1].matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[d[1]] = d[2];
  }
  return out;
}

export function parseColors(css: string, theme: Theme): Record<string, string> {
  const light = block(css, /:root,\s*\[data-theme='light'\]/);
  return theme === 'light' ? light : { ...light, ...block(css, /\[data-theme='dark'\]/) };
}

function channel(v: number) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
