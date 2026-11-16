import { notFound } from 'next/navigation';
import { getProject, LocaleSchema } from '@/content';
import styles from './project.module.css';

export default async function ProjectPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const parsed = LocaleSchema.safeParse(locale);
  if (!parsed.success) notFound();
  const project = await getProject(slug, parsed.data);
  if (!project) notFound();
  return <main id="main" className={styles.project}>
    <a href={`/${locale}#s05`}>{locale === 'ar' ? 'العودة إلى المشاريع' : 'Back to projects'}</a>
    <h1>{typeof project.title === 'string' ? project.title.split('|')[0].trim() : project.slug}</h1>
    {typeof project.category === 'string' && <p>{project.category}</p>}
    {typeof project.overview === 'string' && <p>{project.overview}</p>}
    {project.screens.map(screen => <figure key={screen.url}>
      {/* Content screenshots retain their original source and alternative text. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={screen.url} alt={typeof screen.alt === 'string' ? screen.alt : ''} />
    </figure>)}
    {project.paragraphs.filter(text => typeof text === 'string' && text !== project.overview).map((text, i) => <p key={i}>{text as string}</p>)}
  </main>;
}
