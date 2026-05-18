import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { courses } from '@/data/courses';
import { apiLogger } from "@/lib/logger";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://profdanielbarral.com';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Páginas estáticas
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/sobre`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/cursos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/publicacoes`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/contato`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/lei-14133`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/legislacao`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/glossario`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  // Páginas de cursos (estáticas)
  const coursesPages: MetadataRoute.Sitemap = courses.map((course) => ({
    url: `${BASE_URL}/cursos/${course.slug}`,
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
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    }));
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao gerar sitemap do blog:');
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
      url: `${BASE_URL}/artigo/${article.numero}`,
      lastModified: article.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    }));
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao gerar sitemap dos artigos:');
  }

  return [...staticPages, ...coursesPages, ...blogPages, ...articlePages];
}
