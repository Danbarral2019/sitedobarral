import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { courses } from '@/data/courses';
import { getSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const absoluteUrl = (pathname = '/') => new URL(pathname, siteUrl).toString();

  // Páginas estáticas
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl(),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: absoluteUrl('/sobre'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/cursos'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/blog'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/publicacoes'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/contato'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: absoluteUrl('/lei-14133'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/legislacao'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/glossario'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: absoluteUrl('/base-conhecimento'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: absoluteUrl('/jurisprudencia'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.85,
    },
  ];

  // Páginas de cursos (estáticas)
  const coursesPages: MetadataRoute.Sitemap = courses.map((course) => ({
    url: absoluteUrl(`/cursos/${course.slug}`),
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  // Posts do blog (dinâmicos)
  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const blogPosts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    });

    blogPages = blogPosts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: post.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Erro ao gerar sitemap do blog:', error);
  }

  // Publicações não têm páginas individuais, apenas listagem em /publicacoes
  // A página de listagem já está incluída em staticPages

  // Artigos da Lei 14.133 (dinâmicos)
  let articlePages: MetadataRoute.Sitemap = [];
  try {
    const articles = await prisma.leiArticle.findMany({
      select: { numero: true, updatedAt: true },
    });

    articlePages = articles.map((article) => ({
      url: absoluteUrl(`/artigo/${article.numero}`),
      lastModified: article.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Erro ao gerar sitemap dos artigos:', error);
  }

  // Decisões e súmulas individuais (dinâmicos) — inclui TST, TCE, STJ etc.
  let decisionPages: MetadataRoute.Sitemap = [];
  try {
    const decisions = await prisma.tribunalDecision.findMany({
      where: {
        approvalStatus: { in: ['auto_approved', 'manually_approved'] },
        isRelevant: true,
      },
      select: { id: true, updatedAt: true, decisionType: true },
    });

    decisionPages = decisions.map((d) => ({
      url: absoluteUrl(`/jurisprudencia/${d.id}`),
      lastModified: d.updatedAt,
      // Súmulas são canônicas e raramente mudam — frequência menor
      changeFrequency: d.decisionType === 'sumula' ? 'yearly' : 'monthly',
      priority: 0.6,
    }));
  } catch (error) {
    console.error('Erro ao gerar sitemap das decisões:', error);
  }

  return [...staticPages, ...coursesPages, ...blogPages, ...articlePages, ...decisionPages];
}
