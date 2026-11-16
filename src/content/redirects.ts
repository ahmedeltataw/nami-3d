import routes from '../../content-inventory/routes.json';

// Fragments are not sent in HTTP requests; unchanged routes need no redirect.
export const routeMappings = routes.map(route => {
  const url = new URL(route.oldUrl);
  const source = `${url.pathname}${url.hash}`;
  let destination = source;
  if (route.kind === 'service') destination = `/${route.locale}/services/${route.newSlug}`;
  else if (route.kind === 'project') destination = `/${route.locale}/projects/${route.newSlug}`;
  else if (route.kind === 'blog') destination = `/${route.locale}/blog/${route.newSlug}`;
  else if (url.pathname === `/${route.locale}/blogs`) destination = `/${route.locale}/blog`;
  else if (url.pathname === `/${route.locale}/portfolio`) destination = `/${route.locale}/projects`;
  else if (url.pathname === `/${route.locale}/terms-conditions`) destination = `/${route.locale}/${route.newSlug}`;
  else if (route.kind === 'page' && route.oldId) destination = `/${route.locale}/${url.pathname.split('/')[2]}/${route.newSlug}`;
  return { source, destination, kind: url.hash ? 'fragment' as const : source === destination ? 'identity' as const : 'redirect' as const };
});
export const redirects = routeMappings.filter(route => route.kind === 'redirect').map(({ source, destination }) => ({ source, destination, permanent: true as const }));
