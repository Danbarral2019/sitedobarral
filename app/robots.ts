import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

/**
 * Login, registro e demais páginas de conta não entram no `disallow`: ficam
 * fora do índice pelo `noindex` (`NOINDEX` em `lib/site-metadata.ts`), que o
 * buscador só lê se puder rastrear a página.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/*',
          '/area-restrita',
          '/area-restrita/*',
          '/api',
          '/api/*',
          '/preview',
          '/_next/static/*',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/*',
          '/area-restrita',
          '/area-restrita/*',
          '/api',
          '/api/*',
          '/preview',
        ],
        crawlDelay: 0,
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/*',
          '/area-restrita',
          '/area-restrita/*',
          '/api',
          '/api/*',
          '/preview',
        ],
        crawlDelay: 0,
      },
    ],
    sitemap: new URL('/sitemap.xml', getSiteUrl()).toString(),
  };
}
