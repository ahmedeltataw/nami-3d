import type { BlogPost, Company, Locale } from '../../content/schema';

export type Milestone = { id: string; year: number; label: string; source: 'company' | 'blog'; date: string; dateLabel: string; href?: string };
const months: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'أغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
};
export function parsePublicationDate(value: string): string | null {
  const en = /^(\w+) (\d{1,2}), (\d{4})$/.exec(value);
  const ar = /^(\d{1,2}) ([\u0600-\u06ff]+) (\d{4})$/.exec(value);
  const month = months[en?.[1] ?? ar?.[2] ?? ''];
  const day = Number(en?.[2] ?? ar?.[1]);
  const year = Number(en?.[3] ?? ar?.[3]);
  if (!month || !day || !year) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}
export function timelineMilestones(company: Company, posts: BlogPost[], locale: Locale, founded: string): Milestone[] {
  const result: Milestone[] = [{ id: 'founded', year: company.foundedYear, date: String(company.foundedYear), dateLabel: String(company.foundedYear), label: founded, source: 'company' }];
  for (const post of posts) {
    if (typeof post.title !== 'string') continue;
    const dates = post.lists.flatMap(list => list.items).filter((item): item is string => typeof item === 'string').map(label => ({ label, date: parsePublicationDate(label) })).filter((item): item is {label: string; date: string} => item.date !== null);
    if (dates.length !== 1) continue;
    if (result.some(item => item.source === 'blog' && item.id === post.slug)) continue;
    result.push({ id: post.slug, year: Number(dates[0].date.slice(0, 4)), date: dates[0].date, dateLabel: dates[0].label, label: post.title, source: 'blog', href: `/${locale}/blog/${post.slug}` });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export function timelineIndex(key: string, current: number, count: number, rtl: boolean): number {
  if (key === 'Home') return 0;
  if (key === 'End') return Math.max(0, count - 1);
  const direction = key === 'ArrowRight' ? (rtl ? -1 : 1) : key === 'ArrowLeft' ? (rtl ? 1 : -1) : key === 'ArrowUp' ? 1 : key === 'ArrowDown' ? -1 : 0;
  return Math.max(0, Math.min(count - 1, current + direction));
}
