import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/site-url';
import { artigosIndexaveis, urlDoArtigo } from '@/lib/lei-14133/metadados-artigo';

/**
 * GET /sitemap-artigos.xml
 * Gera sitemap XML para todas as páginas de artigos da Lei 14.133/2021
 */
export async function GET() {
  const baseUrl = getSiteUrl();

  // Gera URLs para todos os artigos
  // /artigo/N redireciona; o sitemap aponta direto para a URL canônica do artigo.
  const articleUrls = artigosIndexaveis().map((numero) => {
    return `  <url>
    <loc>${new URL(urlDoArtigo(numero), baseUrl).toString()}</loc>
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
