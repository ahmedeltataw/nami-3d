import { describe, expect, it } from 'vitest';
import { getBlogPosts, getCompany } from '../../src/content';
import { parsePublicationDate, timelineIndex, timelineMilestones } from '../../src/experience/timemachine/timeline';
import { createTimeMachineSession } from '../../src/experience/timemachine/session';
import { createInteraction } from '../../src/experience/interaction';
import { collectMilestones } from '../../src/experience/timemachine/collectMilestones';

describe('Time Machine', () => {
  it('traces every collected year to its source and keeps locales in parity', async () => {
    const counts: number[] = [];
    for (const locale of ['ar', 'en'] as const) {
      const [milestones, company, posts] = await Promise.all([collectMilestones(locale), getCompany(locale), getBlogPosts(locale)]);
      counts.push(milestones.length);
      expect(new Set(milestones.map(item => `${item.source}:${item.id}`)).size).toBe(milestones.length);
      expect(milestones.map(item => item.year)).toEqual(milestones.map(item => item.year).sort((a, b) => a - b));
      for (const item of milestones) {
        const source = item.source === 'company' ? company : posts.find(post => post.slug === item.id);
        expect(source).toBeDefined();
        expect(JSON.stringify(source)).toContain(String(item.year));
      }
    }
    expect(counts[0]).toBe(counts[1]);
  });
  it('extracts only supported publication dates and preserves their article identity in both locales', async () => {
    for (const locale of ['en', 'ar'] as const) {
      const [company, posts] = await Promise.all([getCompany(locale), getBlogPosts(locale)]);
      const milestones = timelineMilestones(company, posts, locale, 'Founded');
      expect(milestones[0]).toMatchObject({ id: 'founded', date: '2017' });
      expect(milestones).toHaveLength(9);
      expect(milestones.map(item => item.date)).toEqual([...milestones.map(item => item.date)].sort());
      for (const milestone of milestones.slice(1)) {
        const post = posts.find(item => item.slug === milestone.id)!;
        expect(milestone.label).toBe(post.title);
        expect(milestone.href).toBe(`/${locale}/blog/${post.slug}`);
        expect(post.lists.flatMap(list => list.items)).toContain(milestone.dateLabel);
      }
    }
    expect(parsePublicationDate('Vision 2030')).toBeNull();
    expect(parsePublicationDate('February 30, 2026')).toBeNull();
    expect(parsePublicationDate('24 سبتمبر 2026')).toBe('2026-09-24');
  });
  it('supports bounded keyboard navigation in both directions', () => {
    expect(timelineIndex('Home', 3, 9, false)).toBe(0);
    expect(timelineIndex('End', 3, 9, false)).toBe(8);
    expect(timelineIndex('ArrowRight', 2, 9, false)).toBe(3);
    expect(timelineIndex('ArrowRight', 2, 9, true)).toBe(1);
    expect(timelineIndex('ArrowLeft', 0, 9, false)).toBe(0);
  });
  it('preserves the first scene position until close and clears it afterwards', () => {
    const session = createTimeMachineSession();
    const position = { scene: 's06' as const, local: .72, scrollY: 1250, opener: null, playing: true };
    expect(session.open(position)).toBe(true);
    expect(session.open({ ...position, local: .1 })).toBe(false);
    expect(session.close()).toEqual(position);
    expect(session.close()).toBeNull();
  });
  it('holds interaction priority until the modal releases it', () => {
    const interaction = createInteraction();
    const token = interaction.request('modal')!;
    expect(interaction.request('scroll')).toBeNull();
    interaction.narrativeChanged();
    expect(interaction.state.source).toBe('modal');
    interaction.release(token);
    expect(interaction.state.source).toBeNull();
    expect(interaction.request('scroll')).not.toBeNull();
  });
});
