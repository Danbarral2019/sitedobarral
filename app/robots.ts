import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://profdanielbarral.com';

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
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
