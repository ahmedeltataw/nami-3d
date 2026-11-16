import { getBlogPosts, getCompany, type Locale } from '../../content';
import { timelineMilestones } from './timeline';

export async function collectMilestones(locale: Locale) {
  const [company, posts] = await Promise.all([getCompany(locale), getBlogPosts(locale)]);
  return timelineMilestones(company, posts, locale, locale === 'ar' ? 'تأسيس نامي' : 'Nami founded');
}
