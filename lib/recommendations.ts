/**
 * Sistema de Recomendações
 *
 * Gera recomendações de conteúdo relacionado baseado em:
 * - Artigos da Lei 14.133/2021 em comum
 * - Categorias similares
 * - Tags compartilhadas
 * - Mesmo curso
 */

import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

export interface RecommendationItem {
  id: string;
  type: 'document' | 'blog-post' | 'article';
  title: string;
  score: number;
  reason: string[];
}

export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  courseId?: string;
  tags?: string;
  leiArticles?: string;
}

/**
 * Calcula score de similaridade entre dois itens de conteúdo
 */
export function calculateSimilarityScore(
  item1: ContentItem,
  item2: ContentItem
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Artigos da Lei em comum (peso maior)
  if (item1.leiArticles && item2.leiArticles) {
    try {
      const articles1: string[] = JSON.parse(item1.leiArticles);
      const articles2: string[] = JSON.parse(item2.leiArticles);
      const commonArticles = articles1.filter(a => articles2.includes(a));

      if (commonArticles.length > 0) {
        // Cada artigo em comum vale 20 pontos
        score += commonArticles.length * 20;

        if (commonArticles.length === 1) {
          reasons.push(`Trata do mesmo artigo (Art. ${commonArticles[0]})`);
        } else if (commonArticles.length <= 3) {
          reasons.push(`Aborda ${commonArticles.length} artigos em comum (${commonArticles.join(', ')})`);
        } else {
          reasons.push(`Compartilha ${commonArticles.length} artigos da Lei`);
        }
      }
    } catch {
      // Ignora erros de parse
    }
  }

  // 2. Mesmo curso (peso médio)
  if (item1.courseId && item2.courseId && item1.courseId === item2.courseId) {
    score += 15;
    reasons.push('Mesmo curso');
  }

  // 3. Mesma categoria (peso médio)
  if (item1.category && item2.category && item1.category === item2.category) {
    score += 10;
    reasons.push(`Mesma categoria (${item1.category})`);
  }

  // 4. Tags em comum (peso menor)
  if (item1.tags && item2.tags) {
    try {
      const tags1: string[] = JSON.parse(item1.tags);
      const tags2: string[] = JSON.parse(item2.tags);
      const commonTags = tags1.filter(t => tags2.includes(t));

      if (commonTags.length > 0) {
        score += commonTags.length * 5;

        if (commonTags.length === 1) {
          reasons.push(`Tag em comum: "${commonTags[0]}"`);
        } else if (commonTags.length <= 3) {
          reasons.push(`Tags: ${commonTags.join(', ')}`);
        } else {
          reasons.push(`${commonTags.length} tags em comum`);
        }
      }
    } catch {
      // Ignora erros de parse
    }
  }

  // 5. Similaridade no título/descrição (peso baixo)
  if (item1.title && item2.title) {
    const words1 = item1.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const words2 = item2.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const commonWords = words1.filter(w => words2.includes(w));

    if (commonWords.length > 0) {
      score += commonWords.length * 2;
      // Não adiciona razão explícita para evitar poluição
    }
  }

  return { score, reasons };
}

/**
 * Gera recomendações de documentos baseado em um item de conteúdo
 */
export function generateRecommendations(
  sourceItem: ContentItem,
  candidateItems: ContentItem[],
  maxRecommendations: number = 5
): RecommendationItem[] {
  const recommendations: Array<{
    item: ContentItem;
    score: number;
    reasons: string[];
  }> = [];

  // Calcula score para cada candidato
  for (const candidate of candidateItems) {
    // Não recomendar o próprio item
    if (candidate.id === sourceItem.id) continue;

    const { score, reasons } = calculateSimilarityScore(sourceItem, candidate);

    // Só adiciona se tiver score mínimo
    if (score >= 10) {
      recommendations.push({
        item: candidate,
        score,
        reasons,
      });
    }
  }

  // Ordena por score decrescente
  recommendations.sort((a, b) => b.score - a.score);

  // Retorna top N recomendações
  return recommendations
    .slice(0, maxRecommendations)
    .map(rec => ({
      id: rec.item.id,
      type: 'document' as const, // Será definido pelo chamador
      title: rec.item.title,
      score: rec.score,
      reason: rec.reasons,
    }));
}

/**
 * Gera recomendações de artigos baseado em artigos já visualizados
 */
export function recommendArticles(
  viewedArticles: string[],
  maxRecommendations: number = 5
): string[] {
  const recommendations = new Map<string, number>();

  for (const articleNum of viewedArticles) {
    const article = LEI_14133_ARTIGOS[articleNum];
    if (!article) continue;

    // Recomenda artigos do mesmo capítulo
    Object.values(LEI_14133_ARTIGOS).forEach(otherArticle => {
      // Não recomendar artigos já visualizados
      if (viewedArticles.includes(otherArticle.numero)) return;

      let score = 0;

      // Mesmo capítulo
      if (otherArticle.capitulo === article.capitulo) {
        score += 10;
      }

      // Mesma seção
      if (article.secao && otherArticle.secao === article.secao) {
        score += 15;
      }

      // Artigos próximos numericamente (dentro de 5 artigos)
      const distance = Math.abs(parseInt(otherArticle.numero) - parseInt(articleNum));
      if (distance <= 5 && distance > 0) {
        score += (6 - distance) * 5; // Quanto mais próximo, maior o score
      }

      // Adiciona ou incrementa score
      const current = recommendations.get(otherArticle.numero) || 0;
      recommendations.set(otherArticle.numero, current + score);
    });
  }

  // Ordena por score e retorna os melhores
  return Array.from(recommendations.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxRecommendations)
    .map(([numero]) => numero);
}

/**
 * Formata razões de recomendação para exibição
 */
export function formatRecommendationReason(reasons: string[]): string {
  if (reasons.length === 0) return 'Conteúdo relacionado';
  if (reasons.length === 1) return reasons[0];
  if (reasons.length === 2) return reasons.join(' e ');

  const last = reasons[reasons.length - 1];
  const others = reasons.slice(0, -1);
  return `${others.join(', ')} e ${last}`;
}

/**
 * Gera recomendações de artigos baseado em um único artigo
 */
export function getRelatedArticles(
  articleNumber: string,
  maxRecommendations: number = 6
): string[] {
  const article = LEI_14133_ARTIGOS[articleNumber];
  if (!article) return [];

  const recommendations = new Map<string, number>();

  Object.values(LEI_14133_ARTIGOS).forEach(otherArticle => {
    // Não recomendar o próprio artigo
    if (otherArticle.numero === articleNumber) return;

    let score = 0;

    // Artigos próximos numericamente (prioridade alta)
    const distance = Math.abs(parseInt(otherArticle.numero) - parseInt(articleNumber));
    if (distance === 1) {
      score += 100; // Artigos adjacentes têm prioridade máxima
    } else if (distance <= 3) {
      score += 50 - (distance * 10);
    } else if (distance <= 5) {
      score += 20;
    }

    // Mesma seção (prioridade alta)
    if (article.secao && otherArticle.secao === article.secao) {
      score += 80;
    }

    // Mesmo capítulo (prioridade média)
    if (otherArticle.capitulo === article.capitulo) {
      score += 40;
    }

    // Termos importantes em comum na ementa
    const keywords = ['licitação', 'contrato', 'dispensa', 'inexigibilidade', 'pregão', 'registro de preços'];
    const ementa1 = article.ementa.toLowerCase();
    const ementa2 = otherArticle.ementa.toLowerCase();

    keywords.forEach(keyword => {
      if (ementa1.includes(keyword) && ementa2.includes(keyword)) {
        score += 10;
      }
    });

    if (score > 0) {
      recommendations.set(otherArticle.numero, score);
    }
  });

  // Ordena por score e retorna os melhores
  return Array.from(recommendations.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxRecommendations)
    .map(([numero]) => numero);
}
