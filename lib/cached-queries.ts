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

/**
 * Conta documentos agrupados por categoria (cached).
 *
 * Para categorias do CONUNI (parecer/parecer-vinculante/decor/nota-tecnica/
 * despacho), exclui docs marcados como `licitacoesContratos:false` pelo
 * classificador Gemini (irrelevantes pra licitações). Docs ainda não
 * classificados continuam contando — filtragem é gradual.
 */
export const getCachedDocumentCountByCategory = cache(async () => {
  const CONUNI_CATEGORIES = ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'];
  const [conuniCounts, otherCounts] = await Promise.all([
    prisma.document.groupBy({
      by: ['category'],
      where: {
        category: { in: CONUNI_CATEGORIES },
        NOT: { aiClassification: { contains: '"licitacoesContratos":false' } },
      },
      _count: { id: true },
    }),
    prisma.document.groupBy({
      by: ['category'],
      where: { category: { notIn: CONUNI_CATEGORIES } },
      _count: { id: true },
    }),
  ]);
  return Object.fromEntries(
    [...conuniCounts, ...otherCounts].map(c => [c.category, c._count.id]),
  );
});

/**
 * Conta total de artigos da Lei 14.133 (cached)
 */
export const getCachedLeiArticleCount = cache(async () => {
  return await prisma.leiArticle.count();
});

/**
 * Conta total de termos no glossario (cached)
 */
export const getCachedGlossaryTermCount = cache(async () => {
  return await prisma.glossaryTerm.count();
});

/**
 * Conta total de atos normativos (cached)
 */
export const getCachedLegislativeActCount = cache(async () => {
  return await prisma.legislativeAct.count();
});

/**
 * Conta total de decisões de tribunais aprovadas (cached)
 */
export const getCachedTribunalDecisionCount = cache(async () => {
  return await prisma.tribunalDecision.count({
    where: { approvalStatus: { in: ['auto_approved', 'manually_approved'] } },
  });
});

/**
 * Conta súmulas do TST aprovadas (cached). Usada pelo card "Súmulas do TST"
 * no hub /base-conhecimento.
 */
export const getCachedTstSumulaCount = cache(async () => {
  return await prisma.tribunalDecision.count({
    where: {
      tribunalCode: 'TST',
      decisionType: 'sumula',
      approvalStatus: { in: ['auto_approved', 'manually_approved'] },
    },
  });
});
