/**
 * Lei 14.133/2021 - Helpers para acesso aos artigos
 *
 * Com a migração para banco de dados, este arquivo fornece helpers
 * para buscar artigos mantendo compatibilidade com o código existente.
 */

import { prisma } from './prisma';
import { LeiArticle as LeiArticleInterface } from '@/data/lei-14133-artigos';

/**
 * Busca todos os artigos do banco de dados
 * Retorna no formato compatível com LEI_14133_ARTIGOS
 */
export async function getAllLeiArticles(): Promise<Record<string, LeiArticleInterface>> {
  const artigos = await prisma.leiArticle.findMany({
    orderBy: {
      numero: 'asc',
    },
  });

  const artigosMap: Record<string, LeiArticleInterface> = {};

  for (const artigo of artigos) {
    artigosMap[artigo.numero] = {
      numero: artigo.numero,
      titulo: artigo.titulo || undefined,
      capituloCompleto: artigo.capituloCompleto || undefined,
      ementa: artigo.ementa,
      capitulo: artigo.capitulo,
      secao: artigo.secao || undefined,
    };
  }

  return artigosMap;
}

/**
 * Busca um artigo específico do banco
 */
export async function getLeiArticle(numero: string): Promise<LeiArticleInterface | null> {
  const artigo = await prisma.leiArticle.findUnique({
    where: { numero },
  });

  if (!artigo) return null;

  return {
    numero: artigo.numero,
    titulo: artigo.titulo || undefined,
    capituloCompleto: artigo.capituloCompleto || undefined,
    ementa: artigo.ementa,
    capitulo: artigo.capitulo,
    secao: artigo.secao || undefined,
  };
}

/**
 * Busca artigos por capítulo
 */
export async function getLeiArticlesByCapitulo(capitulo: string): Promise<LeiArticleInterface[]> {
  const artigos = await prisma.leiArticle.findMany({
    where: {
      capitulo: {
        contains: capitulo,
      },
    },
    orderBy: {
      numero: 'asc',
    },
  });

  return artigos.map((artigo) => ({
    numero: artigo.numero,
    titulo: artigo.titulo || undefined,
    capituloCompleto: artigo.capituloCompleto || undefined,
    ementa: artigo.ementa,
    capitulo: artigo.capitulo,
    secao: artigo.secao || undefined,
  }));
}
