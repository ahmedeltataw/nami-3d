export function assertUniqueSlug(seen, route, locale) {
  const key = `${route.kind}:${route.newSlug}`;
  if (seen.has(key)) throw new Error(`Duplicate ${route.kind} slug "${route.newSlug}" in ${locale}: ${seen.get(key)} and ${route.oldUrl}`);
  seen.set(key, route.oldUrl);
}
