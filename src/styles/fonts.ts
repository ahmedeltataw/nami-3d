import localFont from 'next/font/local';

export const plexArabic = localFont({
  src: [
    { path: '../../public/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-plex-arabic',
  display: 'swap',
});

export const inter = localFont({
  src: '../../public/fonts/inter-latin-wght.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
});
