import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://profbarral.com.br';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/area-restrita/',
          '/api/',
          '/validar-acesso/',
          '/_next/',
          '/node_modules/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
