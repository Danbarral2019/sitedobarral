import { MetadataRoute } from 'next';
import { PrismaClient } from '@prisma/client';
import { courses } from '@/data/courses';

const prisma = new PrismaClient();
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://profdanielbarral.com';

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
    console.error('Erro ao gerar sitemap do blog:', error);
  }

  // Publicações (dinâmicas)
  let publicationPages: MetadataRoute.Sitemap = [];
  try {
    const publications = await prisma.publication.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    });

    publicationPages = publications.map((pub) => ({
      url: `${BASE_URL}/publicacoes/${pub.slug}`,
      lastModified: pub.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.6,
    }));
  } catch (error) {
    console.error('Erro ao gerar sitemap de publicações:', error);
  }

  return [...staticPages, ...coursesPages, ...blogPages, ...publicationPages];
}
