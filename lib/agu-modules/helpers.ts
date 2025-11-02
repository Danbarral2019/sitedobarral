/**
 * AGU Scraper v4 - Funções Auxiliares Compartilhadas
 */

import {
  KEYWORDS_RELEVANCIA,
  TEMAS_MAP,
  CURSOS_KEYWORDS,
} from '../agu-types';

/**
 * Analisa a relevância de um documento para licitações/contratos
 */
export function analyzeRelevancia(
  titulo: string,
  descricao: string
): {
  isRelevante: boolean;
  score: number;
  temas: string[];
} {
  const text = `${titulo} ${descricao}`.toLowerCase();
  let score = 0;
  const temasEncontrados = new Set<string>();

  // Keywords de alta relevância (peso 10)
  for (const keyword of KEYWORDS_RELEVANCIA.high) {
    if (text.includes(keyword)) {
      score += 10;

      // Identifica tema
      if (keyword.includes('licitaç') || keyword.includes('licitac')) {
        temasEncontrados.add('licitacao');
      }
      if (keyword.includes('pregão') || keyword.includes('pregao')) {
        temasEncontrados.add('pregao');
      }
      if (keyword.includes('dispensa') || keyword.includes('inexigibilidade')) {
        temasEncontrados.add('dispensa');
      }
      if (keyword.includes('contrato') || keyword.includes('contrataç')) {
        temasEncontrados.add('contrato');
      }
      if (keyword.includes('14.133') || keyword.includes('14133')) {
        temasEncontrados.add('lei-14133');
      }
      if (keyword.includes('8.666') || keyword.includes('8666')) {
        temasEncontrados.add('lei-8666');
      }
      if (keyword.includes('registro de preços') || keyword.includes('registro de precos')) {
        temasEncontrados.add('registro-precos');
      }
    }
  }

  // Keywords de média relevância (peso 5)
  for (const keyword of KEYWORDS_RELEVANCIA.medium) {
    if (text.includes(keyword)) {
      score += 5;

      // Identifica tema
      if (keyword.includes('fiscal')) {
        temasEncontrados.add('fiscalizacao');
      }
      if (keyword.includes('terceir')) {
        temasEncontrados.add('terceirizacao');
      }
      if (keyword.includes('reajuste') || keyword.includes('repactuaç')) {
        temasEncontrados.add('reajuste');
      }
      if (keyword.includes('planejamento')) {
        temasEncontrados.add('planejamento');
      }
      if (keyword.includes('sanç') || keyword.includes('penalidade')) {
        temasEncontrados.add('sancao');
      }
    }
  }

  // Keywords de baixa relevância (peso 2)
  for (const keyword of KEYWORDS_RELEVANCIA.low) {
    if (text.includes(keyword)) {
      score += 2;

      if (keyword.includes('convênio') || keyword.includes('convenio')) {
        temasEncontrados.add('convenio');
      }
    }
  }

  // Keywords de exclusão (peso -15)
  for (const keyword of KEYWORDS_RELEVANCIA.exclude) {
    if (text.includes(keyword)) {
      score -= 15;
    }
  }

  // Normaliza score para 0-100
  score = Math.max(0, Math.min(100, score));

  // Considera relevante se score >= 10
  const isRelevante = score >= 10;

  // Converte temas para labels
  const temas = Array.from(temasEncontrados).map(key => TEMAS_MAP[key as keyof typeof TEMAS_MAP] || key);

  return { isRelevante, score, temas };
}

/**
 * Sugere cursos baseado no conteúdo do documento
 */
export function suggestCursos(titulo: string, descricao: string): string[] {
  const text = `${titulo} ${descricao}`.toLowerCase();
  const cursos = new Set<string>();

  // Para cada curso, verifica se alguma keyword está presente
  for (const [cursoId, keywords] of Object.entries(CURSOS_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        cursos.add(cursoId);
        break; // Já encontrou match, próximo curso
      }
    }
  }

  // Se não encontrou nenhum curso específico mas é relevante, adiciona curso 1
  if (cursos.size === 0) {
    cursos.add('1'); // Nova Lei de Licitações como padrão
  }

  return Array.from(cursos);
}

/**
 * Normaliza URLs (adiciona protocolo e domínio se necessário)
 */
export function normalizeUrl(url: string): string {
  url = url.trim();

  // Se já é uma URL completa, retorna
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Se começa com //, adiciona https:
  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  // Se é um path relativo do gov.br, adiciona o domínio
  if (url.startsWith('/')) {
    return `https://www.gov.br${url}`;
  }

  // Se é um domínio sem protocolo
  if (url.includes('gov.br') || url.includes('in.gov.br')) {
    return `https://${url}`;
  }

  return url;
}

/**
 * Valida se uma URL é válida e acessível
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Aceita apenas URLs http/https
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Verifica se uma URL é problemática (Sapiens restrito ou DOU quebrado)
 */
export function isProblematicUrl(url: string): boolean {
  const problematicPatterns = [
    'sapiens.agu.gov.br',      // Sistema restrito a membros da AGU
    'in.gov.br',                // Diário Oficial (links quebrados)
    'imprensa.nacional',        // Diário Oficial (links quebrados)
  ];

  return problematicPatterns.some(pattern => url.includes(pattern));
}

/**
 * Extrai número e ano de string (ex: "ON 5/2024" → {numero: 5, ano: 2024})
 */
export function extractNumeroAno(text: string): { numero?: number; ano?: number } {
  const match = text.match(/(\d+)\/(\d{4})/);

  if (!match) {
    return {};
  }

  return {
    numero: parseInt(match[1]),
    ano: parseInt(match[2]),
  };
}

/**
 * Formata data brasileira para ISO (DD/MM/YYYY → YYYY-MM-DD)
 */
export function formatDateBR(dataBR: string): string | undefined {
  const match = dataBR.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (!match) {
    return undefined;
  }

  const [, dia, mes, ano] = match;
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

/**
 * Remove HTML tags e normaliza espaços
 */
export function cleanHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trunca texto para evitar problemas no banco
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Extrai tags de um texto baseado em keywords
 */
export function extractTags(content: string, base: string[] = []): string[] {
  const tags = new Set<string>(base);
  const cleanContent = content.toLowerCase();

  const temaKeywords = [
    { keyword: 'licitação|licitacao', tag: 'Licitação' },
    { keyword: 'contrato', tag: 'Contratos' },
    { keyword: 'dispensa|inexigibilidade', tag: 'Contratação Direta' },
    { keyword: 'pregão|pregao', tag: 'Pregão' },
    { keyword: 'registro de preços', tag: 'Registro de Preços' },
    { keyword: 'lei 14.133|lei 14133', tag: 'Lei 14.133/2021' },
    { keyword: 'lei 8.666|lei 8666', tag: 'Lei 8.666/93' },
    { keyword: 'convênio|convenio', tag: 'Convênios' },
    { keyword: 'parceria', tag: 'Parcerias' },
    { keyword: 'fiscal', tag: 'Fiscalização' },
    { keyword: 'gestão|gestao', tag: 'Gestão' },
    { keyword: 'terceirização|terceirizacao', tag: 'Terceirização' },
    { keyword: 'sustentável|sustentavel', tag: 'Sustentabilidade' },
  ];

  for (const { keyword, tag } of temaKeywords) {
    if (new RegExp(keyword, 'i').test(cleanContent)) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
}

/**
 * Aguarda um tempo (para rate limiting)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gera nome de arquivo para screenshot
 */
export function generateScreenshotPath(tipo: string): string {
  const timestamp = Date.now();
  const date = new Date().toISOString().split('T')[0];
  return `public/debug/agu-${tipo}-${date}-${timestamp}.png`;
}
