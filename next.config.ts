import createNextIntlPlugin from 'next-intl/plugin';
import { redirects } from './src/content/redirects';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
export default withNextIntl({ async redirects() { return redirects; } });
