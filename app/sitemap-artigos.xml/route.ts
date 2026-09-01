import { NextResponse } from 'next/server';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';
import { getSiteUrl } from '@/lib/site-url';

/**
 * GET /sitemap-artigos.xml
 * Gera sitemap XML para todas as páginas de artigos da Lei 14.133/2021
 */
export async function GET() {
  const baseUrl = getSiteUrl();

  // Gera URLs para todos os artigos
  const articleUrls = Object.keys(LEI_14133_ARTIGOS).map((numero) => {
    return `  <url>
    <loc>${new URL(`/artigo/${numero}`, baseUrl).toString()}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }).join('\n');

  // Adiciona URL da página índice de artigos
  const indexUrl = `  <url>
    <loc>${new URL('/artigos', baseUrl).toString()}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexUrl}
${articleUrls}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400', // Cache por 24 horas
    },
  });
}
