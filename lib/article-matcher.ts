/**
 * Identificação de artigos da Lei 14.133/2021 citados em documentos
 */

export interface ArticleMatch {
  articleNumber: string;
  occurrences: number;
  contexts: string[]; // Trechos onde o artigo foi citado
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Padrões regex para identificar citações de artigos
 */
const ARTICLE_PATTERNS = [
  // "art. 5º", "Art. 72", "art 30"
  /\bart(?:igo)?\.?\s*(\d{1,3})[ºº°]?/gi,

  // "artigo 5", "Artigo 72"
  /\bartigo\s+(\d{1,3})/gi,

  // "Art 5º", "art 72º"
  /\bart\.?\s+(\d{1,3})[ºº°]/gi,

  // "arts. 5º e 6º", "arts 30 a 34"
  /\barts?\.?\s*(\d{1,3})\s*(?:e|a|ao|até)\s*(\d{1,3})/gi,
];

/**
 * Extrai números de artigos citados do texto
 */
export function extractArticleNumbers(text: string): string[] {
  const articleNumbers = new Set<string>();

  for (const pattern of ARTICLE_PATTERNS) {
    const matches = text.matchAll(pattern);

    for (const match of matches) {
      // Captura o número do artigo (primeiro grupo)
      if (match[1]) {
        const num = parseInt(match[1], 10);
        // Valida se está no range 1-193 (artigos da Lei 14.133)
        if (num >= 1 && num <= 193) {
          articleNumbers.add(num.toString());
        }
      }

      // Se houver um segundo número (ex: "arts. 5 e 6", "arts 30 a 34")
      if (match[2]) {
        const num = parseInt(match[2], 10);
        if (num >= 1 && num <= 193) {
          articleNumbers.add(num.toString());
        }
      }
    }
  }

  return Array.from(articleNumbers).sort((a, b) => parseInt(a) - parseInt(b));
}

/**
 * Extrai contexto ao redor de uma citação de artigo
 */
function extractContext(text: string, articleNumber: string, contextSize = 100): string[] {
  const contexts: string[] = [];
  const patterns = [
    new RegExp(`art(?:igo)?\.?\\s*${articleNumber}[ºº°]?`, 'gi'),
    new RegExp(`artigo\\s+${articleNumber}`, 'gi'),
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);

    for (const match of matches) {
      if (match.index !== undefined) {
        const start = Math.max(0, match.index - contextSize);
        const end = Math.min(text.length, match.index + match[0].length + contextSize);
        const context = text.substring(start, end).trim();

        if (context && !contexts.includes(context)) {
          contexts.push(context);
        }
      }
    }
  }

  return contexts;
}

/**
 * Determina o nível de confiança da identificação
 */
function calculateConfidence(occurrences: number, hasExplicitCitation: boolean): ArticleMatch['confidence'] {
  if (hasExplicitCitation && occurrences >= 3) return 'high';
  if (hasExplicitCitation && occurrences >= 1) return 'medium';
  return 'low';
}

/**
 * Analisa texto e retorna artigos citados com contextos
 */
export function findArticleMatches(text: string): ArticleMatch[] {
  const articleNumbers = extractArticleNumbers(text);
  const matches: ArticleMatch[] = [];

  for (const articleNumber of articleNumbers) {
    const contexts = extractContext(text, articleNumber);
    const occurrences = contexts.length;

    if (occurrences > 0) {
      matches.push({
        articleNumber,
        occurrences,
        contexts: contexts.slice(0, 3), // Limita a 3 contextos
        confidence: calculateConfidence(occurrences, true)
      });
    }
  }

  return matches.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Detecta se o documento trata de um range de artigos
 * Ex: "Análise dos artigos 72 a 80" → retorna [72, 73, 74, ..., 80]
 */
export function detectArticleRanges(text: string): string[] {
  const rangePattern = /art(?:igo)?s?\.?\s*(\d{1,3})\s*(?:a|ao|até)\s*(\d{1,3})/gi;
  const articles = new Set<string>();

  const matches = text.matchAll(rangePattern);

  for (const match of matches) {
    if (match[1] && match[2]) {
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);

      // Valida range
      if (start >= 1 && end <= 193 && start <= end) {
        // Adiciona todos os artigos do range
        for (let i = start; i <= end; i++) {
          articles.add(i.toString());
        }
      }
    }
  }

  return Array.from(articles).sort((a, b) => parseInt(a) - parseInt(b));
}
