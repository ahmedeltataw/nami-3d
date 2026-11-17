import { describe, expect, it } from 'vitest';
import { groupFrames, parseFrameName, sheetFrames, sheetSections } from '../../scripts/contact-sheet.mjs';

const jumpId = `S01${String.fromCharCode(8594)}S02`;

describe('contact sheet input', () => {
  it('parses jump and scene capture names', () => {
    expect(parseFrameName('S01-S02_fwd_t0.53.png')).toMatchObject({ card: 'S01-S02', kind: 'jump', id: jumpId, t: .53, direction: 'fwd' });
    expect(parseFrameName('S03_seek_b0.25.png')).toMatchObject({ card: 'S03', kind: 'scene', id: 'S03', b: .25, direction: 'seek' });
  });

  it('orders frames by progress within their sheet group', () => {
    const groups = groupFrames([
      { file: 'later.png', card: 'S01-S02', kind: 'jump', id: jumpId, t: .53, direction: 'fwd' },
      { file: 'early.png', card: 'S01-S02', kind: 'jump', id: jumpId, t: .15, direction: 'fwd' },
    ]);
    expect(groups[0].frames.map(frame => frame.file)).toEqual(['early.png', 'later.png']);
  });

  it('keeps the full default time set as labelled cells for each direction', () => {
    const frames = sheetFrames({ kind: 'jump', card: 'S01-S02', id: jumpId, frames: [
      { file: 'reverse.png', card: 'S01-S02', kind: 'jump', id: jumpId, t: .53, direction: 'rev' },
      { file: 'forward.png', card: 'S01-S02', kind: 'jump', id: jumpId, t: .15, direction: 'fwd' },
    ] });
    expect(frames).toHaveLength(27);
    expect(frames.slice(0, 9).map(frame => frame.t)).toEqual([0, .15, .3, .5, .53, .59, .6, .78, 1]);
    expect(frames[0]).toMatchObject({ direction: 'fwd', missing: true, label: 't .00' });
    expect(frames[1]).toMatchObject({ direction: 'fwd', file: 'forward.png' });
    expect(frames[9]).toMatchObject({ direction: 'rev', t: 0, missing: true });
    expect(frames[13]).toMatchObject({ direction: 'rev', t: .53, file: 'reverse.png' });
  });

  it('renders direction sections separately in forward, reverse, seek order', () => {
    const frames = ['seek', 'rev', 'fwd'].map((direction, index) => ({
      file: `${direction}.png`, card: 'S01-S02', kind: 'jump' as const, id: jumpId, t: [.5, .3, .15][index], direction: direction as 'fwd' | 'rev' | 'seek',
    }));
    const sections = sheetSections({ kind: 'jump', card: 'S01-S02', id: jumpId, frames });
    expect(sections.map(section => section.label)).toEqual(['forward', 'reverse', 'seek']);
    expect(sections.map(section => section.frames.filter(frame => !frame.missing).map(frame => frame.file))).toEqual([['fwd.png'], ['rev.png'], ['seek.png']]);
    expect(sections.every(section => section.frames.length === 9)).toBe(true);
  });
});
