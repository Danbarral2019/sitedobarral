import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

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
          '/login',
          '/registro',
          '/validar-acesso',
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
          '/login',
          '/registro',
          '/validar-acesso',
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
          '/login',
          '/registro',
          '/validar-acesso',
          '/preview',
        ],
        crawlDelay: 0,
      },
    ],
    sitemap: new URL('/sitemap.xml', getSiteUrl()).toString(),
  };
}
