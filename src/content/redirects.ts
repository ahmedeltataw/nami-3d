import routes from '../../content-inventory/routes.json' with { type: 'json' };

// Fragments are not sent in HTTP requests; unchanged routes need no redirect.
export const routeMappings = routes.map(route => {
  const url = new URL(route.oldUrl);
  const source = `${url.pathname}${url.hash}`;
  let destination = source;
  if (route.kind === 'service') destination = `/${route.locale}/services/${route.newSlug}`;
  else if (route.kind === 'project') destination = `/${route.locale}/projects/${route.newSlug}`;
  else if (route.kind === 'blog') destination = `/${route.locale}/blog/${route.newSlug}`;
  else if (url.pathname === `/${route.locale}/blogs`) destination = `/${route.locale}/blog`;
  else if (url.pathname === `/${route.locale}/portfolio` || url.pathname === `/${route.locale}/products`) destination = `/${route.locale}/projects`;
  else if (url.pathname === `/${route.locale}/terms-conditions` || url.pathname === `/${route.locale}/terms-and-conditions`) destination = `/${route.locale}/terms`;
  else if (url.pathname === `/${route.locale}/privacy-policy`) destination = `/${route.locale}/privacy`;
  else if (route.kind === 'page' && route.oldId) {
    if (url.pathname.startsWith(`/${route.locale}/marketing/`)) {
      destination = `/${route.locale}/marketing`;
    } else if (url.pathname.startsWith(`/${route.locale}/products/`)) {
      if (route.newSlug === 'mishwar') destination = `/${route.locale}/projects/meshwar`;
      else destination = `/${route.locale}/projects`;
    } else {
      destination = `/${route.locale}/${url.pathname.split('/')[2]}/${route.newSlug}`;
    }
  }
  return { source, destination, kind: url.hash ? 'fragment' as const : source === destination ? 'identity' as const : 'redirect' as const };
});
export const redirects = routeMappings.filter(route => route.kind === 'redirect').map(({ source, destination }) => ({ source, destination, permanent: true as const }));

