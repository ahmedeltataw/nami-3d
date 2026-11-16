export function referenceToolsEnabled(environment: string | undefined, flag: string | undefined): boolean {
  return environment !== 'production' || flag === '1';
}
