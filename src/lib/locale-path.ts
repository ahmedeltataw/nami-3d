/**
 * Pure helper for switching locale while preserving current path and hash.
 */
export function switchLocalePath(currentPath: string, currentLocale: string, targetLocale: string, hash = ''): string {
  const cleanPath = currentPath ? (currentPath.startsWith('/') ? currentPath : `/${currentPath}`) : '/';
  const prefixRegex = new RegExp(`^/${currentLocale}(?=/|$)`);
  let newPath: string;
  if (prefixRegex.test(cleanPath)) {
    newPath = cleanPath.replace(prefixRegex, `/${targetLocale}`);
  } else {
    newPath = `/${targetLocale}${cleanPath === '/' ? '' : cleanPath}`;
  }
  if (!newPath || newPath === '') newPath = `/${targetLocale}`;
  const cleanHash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';
  return `${newPath}${cleanHash}`;
}
