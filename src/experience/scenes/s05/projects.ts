import type { Project } from '../../../content/schema';

export const worlds = [
  { slug: 'rif-aljouf', oldId: '170' }, { slug: 'loryfy', oldId: '169' },
  { slug: 'tasami', oldId: '168' }, { slug: 'benaat', oldId: '167' },
  { slug: 'alhumairi-hajj', oldId: '166' }, { slug: 'shahntak', oldId: '165' },
] as const;
export type WorldSlug = typeof worlds[number]['slug'];
export type GalleryProject = { world: WorldSlug; slug: string; name: string; category: string | null; screens: string[] };
export function galleryProjects(projects: Project[]): GalleryProject[] {
  return worlds.map(world => {
    const matches = projects.filter(project => project.oldId === world.oldId);
    if (matches.length !== 1) throw new Error(`Missing or ambiguous gallery project ${world.oldId}`);
    const project = matches[0];
    return { world: world.slug, slug: project.slug,
      name: typeof project.title === 'string' ? project.title.split('|')[0].trim() : project.slug,
      category: typeof project.category === 'string' ? project.category : null,
      screens: project.screens.slice(0, 3).map(screen => `/models/gallery/screens/${new URL(screen.url).pathname.split('/').pop()}`),
    };
  });
}
