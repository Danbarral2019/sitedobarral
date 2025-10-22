// Cached database queries para otimização de performance
// Usa React cache() para deduplic queries dentro do mesmo request

import { cache } from 'react';
import { prisma } from '@/lib/prisma';

/**
 * Busca todos os posts do blog publicados (cached)
 * Evita queries duplicadas na mesma requisição
 */
export const getCachedPublishedBlogPosts = cache(async () => {
  return await prisma.blogPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      author: true,
      publishedAt: true,
      tags: true,
    },
  });
});

/**
 * Busca um post do blog por slug (cached)
 */
export const getCachedBlogPostBySlug = cache(async (slug: string) => {
  return await prisma.blogPost.findUnique({
    where: { slug },
  });
});

/**
 * Busca todas as publicações (cached)
 */
export const getCachedPublications = cache(async () => {
  return await prisma.publication.findMany({
    orderBy: { createdAt: 'desc' },
  });
});

/**
 * Busca publicações por tipo (cached)
 */
export const getCachedPublicationsByType = cache(async (type: 'livro' | 'artigo' | 'noticia') => {
  return await prisma.publication.findMany({
    where: { type },
    orderBy: { createdAt: 'desc' },
  });
});

/**
 * Busca documentos públicos (cached)
 */
export const getCachedPublicDocuments = cache(async () => {
  return await prisma.document.findMany({
    where: { isPublic: true },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      category: true,
      courseId: true,
      uploadedAt: true,
    },
  });
});

/**
 * Busca documentos por curso (cached)
 */
export const getCachedDocumentsByCourse = cache(async (courseId: string) => {
  return await prisma.document.findMany({
    where: { courseId },
    orderBy: { uploadedAt: 'desc' },
  });
});

/**
 * Busca usuário por email (cached)
 */
export const getCachedUserByEmail = cache(async (email: string) => {
  return await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      enrollments: true,
    },
  });
});

/**
 * Conta total de documentos (cached)
 */
export const getCachedDocumentCount = cache(async () => {
  return await prisma.document.count();
});

/**
 * Conta total de posts publicados (cached)
 */
export const getCachedPublishedPostCount = cache(async () => {
  return await prisma.blogPost.count({
    where: { isPublished: true },
  });
});
