/**
 * Estrutura oficial da Lei 14.133/2021 — TÍTULOS → CAPÍTULOS → ARTIGOS
 *
 * Mapeamento manual feito a partir do texto oficial da Lei. Os campos
 * `titulo` e `capituloCompleto` em `data/lei-14133-artigos.ts` só estão
 * preenchidos para os primeiros 22 artigos; o resto (171 artigos) usa
 * apenas o campo `capitulo` resumido (formato "TÍTULO X - CAPÍTULO Y").
 *
 * Este arquivo é o source-of-truth para a hierarquia oficial — usado
 * pela Direção C "Edição Comentada" da página /lei-14133.
 */

import { LEI_14133_ARTIGOS } from './lei-14133-artigos';

export interface LeiChapter {
  /** Slug curto pra URL (`#cap-i-do-ambito-de-aplicacao`) */
  id: string;
  /** Numeral romano (`I`, `II`, `III`...) */
  number: string;
  /** Título do capítulo, sem o prefixo "CAPÍTULO X - " */
  title: string;
  /** Seção dentro do capítulo (quando o DB modela seções como capítulos separados) */
  section?: string;
  /** ID do título superior */
  titleId: string;
  /** Lista ordenada de números de artigo deste capítulo */
  articles: string[];
}

export interface LeiTitle {
  id: string;
  number: string;
  name: string;
  full: string;
  chapters: LeiChapter[];
}

/* ------------------------------------------------------------------
   Mapping manual oficial — Lei 14.133/2021
   Cada chave aqui corresponde ao campo `capitulo` resumido de cada artigo
   ------------------------------------------------------------------ */

interface ChapterDef {
  titleId: string;
  titleNumber: string;
  titleName: string;
  chapterNumber: string;
  chapterTitle: string;
  section?: string;
}

const CHAPTER_MAPPING: Record<string, ChapterDef> = {
  // TÍTULO I — DAS DISPOSIÇÕES PRELIMINARES
  'TÍTULO I - CAPÍTULO I': {
    titleId: 't1-disposicoes-preliminares',
    titleNumber: 'I',
    titleName: 'Das Disposições Preliminares',
    chapterNumber: 'I',
    chapterTitle: 'Do Âmbito de Aplicação desta Lei',
  },
  'TÍTULO I - CAPÍTULO II': {
    titleId: 't1-disposicoes-preliminares',
    titleNumber: 'I',
    titleName: 'Das Disposições Preliminares',
    chapterNumber: 'II',
    chapterTitle: 'Dos Princípios',
  },
  'TÍTULO I - CAPÍTULO III': {
    titleId: 't1-disposicoes-preliminares',
    titleNumber: 'I',
    titleName: 'Das Disposições Preliminares',
    chapterNumber: 'III',
    chapterTitle: 'Das Definições',
  },
  'TÍTULO I - CAPÍTULO IV': {
    titleId: 't1-disposicoes-preliminares',
    titleNumber: 'I',
    titleName: 'Das Disposições Preliminares',
    chapterNumber: 'IV',
    chapterTitle: 'Dos Agentes Públicos',
  },
  'TÍTULO I - CAPÍTULO V': {
    titleId: 't1-disposicoes-preliminares',
    titleNumber: 'I',
    titleName: 'Das Disposições Preliminares',
    chapterNumber: 'V',
    chapterTitle: 'Dos Órgãos de Assessoramento Jurídico e de Controle Interno',
  },

  // TÍTULO II — DAS LICITAÇÕES
  'TÍTULO II - CAPÍTULO I - SEÇÃO I': {
    titleId: 't2-licitacoes',
    titleNumber: 'II',
    titleName: 'Das Licitações',
    chapterNumber: 'I',
    chapterTitle: 'Das Regras Gerais das Licitações',
    section: 'Das Regras Aplicáveis às Licitações',
  },
  'TÍTULO II - CAPÍTULO I - SEÇÃO II': {
    titleId: 't2-licitacoes',
    titleNumber: 'II',
    titleName: 'Das Licitações',
    chapterNumber: 'I',
    chapterTitle: 'Das Regras Gerais das Licitações',
    section: 'Do Planejamento da Contratação',
  },
  'TÍTULO II - CAPÍTULO I - SEÇÃO III': {
    titleId: 't2-licitacoes',
    titleNumber: 'II',
    titleName: 'Das Licitações',
    chapterNumber: 'I',
    chapterTitle: 'Das Regras Gerais das Licitações',
    section: 'Da Instrução do Processo Licitatório',
  },
  'TÍTULO II - CAPÍTULO II': {
    titleId: 't2-licitacoes',
    titleNumber: 'II',
    titleName: 'Das Licitações',
    chapterNumber: 'II',
    chapterTitle: 'Da Divulgação no Portal Nacional de Contratações Públicas',
  },
  'TÍTULO II - CAPÍTULO III': {
    titleId: 't2-licitacoes',
    titleNumber: 'II',
    titleName: 'Das Licitações',
    chapterNumber: 'III',
    chapterTitle: 'Da Divulgação do Edital de Licitação',
  },
  'TÍTULO II - CAPÍTULO IV': {
    titleId: 't2-licitacoes',
    titleNumber: 'II',
    titleName: 'Das Licitações',
    chapterNumber: 'IV',
    chapterTitle: 'Da Apresentação de Propostas e Lances e do Julgamento',
  },
  'TÍTULO II - CAPÍTULO V': {
    titleId: 't2-licitacoes',
    titleNumber: 'II',
    titleName: 'Das Licitações',
    chapterNumber: 'V',
    chapterTitle: 'Da Habilitação',
  },
  'TÍTULO II - CAPÍTULO VI': {
    titleId: 't2-licitacoes',
    titleNumber: 'II',
    titleName: 'Das Licitações',
    chapterNumber: 'VI',
    chapterTitle: 'Do Encerramento da Licitação',
  },
  'TÍTULO II - CAPÍTULO VII': {
    titleId: 't2-licitacoes',
    titleNumber: 'II',
    titleName: 'Das Licitações',
    chapterNumber: 'VII',
    chapterTitle: 'Da Contratação Direta',
  },

  // TÍTULO III — DOS CONTRATOS ADMINISTRATIVOS
  'TÍTULO III - CAPÍTULO I': {
    titleId: 't3-contratos',
    titleNumber: 'III',
    titleName: 'Dos Contratos Administrativos',
    chapterNumber: 'I',
    chapterTitle: 'Da Formalização dos Contratos',
  },
  'TÍTULO III - CAPÍTULO II': {
    titleId: 't3-contratos',
    titleNumber: 'III',
    titleName: 'Dos Contratos Administrativos',
    chapterNumber: 'II',
    chapterTitle: 'Das Garantias',
  },
  'TÍTULO III - CAPÍTULO III': {
    titleId: 't3-contratos',
    titleNumber: 'III',
    titleName: 'Dos Contratos Administrativos',
    chapterNumber: 'III',
    chapterTitle: 'Das Prerrogativas da Administração e da Alocação de Riscos',
  },
  'TÍTULO III - CAPÍTULO IV': {
    titleId: 't3-contratos',
    titleNumber: 'III',
    titleName: 'Dos Contratos Administrativos',
    chapterNumber: 'IV',
    chapterTitle: 'Da Duração dos Contratos',
  },
  'TÍTULO III - CAPÍTULO V': {
    titleId: 't3-contratos',
    titleNumber: 'III',
    titleName: 'Dos Contratos Administrativos',
    chapterNumber: 'V',
    chapterTitle: 'Da Execução dos Contratos',
  },
  'TÍTULO III - CAPÍTULO VI': {
    titleId: 't3-contratos',
    titleNumber: 'III',
    titleName: 'Dos Contratos Administrativos',
    chapterNumber: 'VI',
    chapterTitle: 'Da Alteração dos Contratos e dos Preços',
  },
  'TÍTULO III - CAPÍTULO VII': {
    titleId: 't3-contratos',
    titleNumber: 'III',
    titleName: 'Dos Contratos Administrativos',
    chapterNumber: 'VII',
    chapterTitle: 'Das Hipóteses de Extinção dos Contratos',
  },

  // TÍTULO IV — DAS IRREGULARIDADES
  'TÍTULO IV - CAPÍTULO I': {
    titleId: 't4-irregularidades',
    titleNumber: 'IV',
    titleName: 'Das Irregularidades',
    chapterNumber: 'I',
    chapterTitle: 'Das Infrações e Sanções Administrativas',
  },
  'TÍTULO IV - CAPÍTULO II': {
    titleId: 't4-irregularidades',
    titleNumber: 'IV',
    titleName: 'Das Irregularidades',
    chapterNumber: 'II',
    chapterTitle: 'Das Impugnações, dos Pedidos de Esclarecimento e dos Recursos',
  },
  'TÍTULO IV - CAPÍTULO III': {
    titleId: 't4-irregularidades',
    titleNumber: 'IV',
    titleName: 'Das Irregularidades',
    chapterNumber: 'III',
    chapterTitle: 'Do Controle das Contratações',
  },

  // TÍTULOS V, VI, VII — DISPOSIÇÕES FINAIS
  'TÍTULO V': {
    titleId: 't5-meios-alternativos',
    titleNumber: 'V',
    titleName: 'Dos Meios Alternativos de Resolução de Controvérsias',
    chapterNumber: '—',
    chapterTitle: 'Disposições Gerais',
  },
  'TÍTULO VI': {
    titleId: 't6-bens-imoveis',
    titleNumber: 'VI',
    titleName: 'Das Alienações',
    chapterNumber: '—',
    chapterTitle: 'Disposições Gerais',
  },
  'TÍTULO VII': {
    titleId: 't7-disposicoes-finais',
    titleNumber: 'VII',
    titleName: 'Das Disposições Finais e Transitórias',
    chapterNumber: '—',
    chapterTitle: 'Disposições Finais e Transitórias',
  },
};

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */

function compareArticleNumbers(a: string, b: string): number {
  const parse = (s: string): [number, string] => {
    const m = s.match(/^(\d+)(?:-([A-Z]))?$/);
    if (!m) return [Number.MAX_SAFE_INTEGER, s];
    return [parseInt(m[1], 10), m[2] || ''];
  };
  const [na, sa] = parse(a);
  const [nb, sb] = parse(b);
  if (na !== nb) return na - nb;
  return sa.localeCompare(sb);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ------------------------------------------------------------------
   Build estrutura
   ------------------------------------------------------------------ */

function buildStructure(): LeiTitle[] {
  // chapterKey -> { def, articles[] }
  const chapterArticles = new Map<string, string[]>();

  for (const numero of Object.keys(LEI_14133_ARTIGOS).sort(compareArticleNumbers)) {
    const cap = LEI_14133_ARTIGOS[numero].capitulo;
    if (!cap) continue;
    if (!chapterArticles.has(cap)) chapterArticles.set(cap, []);
    chapterArticles.get(cap)!.push(numero);
  }

  // Group by titleId
  const titleMap = new Map<string, { def: ChapterDef; chapters: LeiChapter[]; firstSeen: number }>();
  let firstSeen = 0;

  for (const [capKey, articles] of chapterArticles) {
    const def = CHAPTER_MAPPING[capKey];
    if (!def) {
      // Capítulo não mapeado — gera entry genérico pra não perder
      const fallbackDef: ChapterDef = {
        titleId: 'sem-titulo',
        titleNumber: '?',
        titleName: 'Outros',
        chapterNumber: '?',
        chapterTitle: capKey,
      };
      const chapter: LeiChapter = {
        id: slugify(capKey),
        number: '?',
        title: capKey,
        titleId: 'sem-titulo',
        articles: articles.sort(compareArticleNumbers),
      };
      if (!titleMap.has('sem-titulo')) {
        titleMap.set('sem-titulo', { def: fallbackDef, chapters: [], firstSeen: firstSeen++ });
      }
      titleMap.get('sem-titulo')!.chapters.push(chapter);
      continue;
    }

    const chapter: LeiChapter = {
      id: `${def.titleId}-cap-${slugify(def.chapterNumber)}${def.section ? '-' + slugify(def.section) : ''}`,
      number: def.chapterNumber,
      title: def.chapterTitle,
      section: def.section,
      titleId: def.titleId,
      articles: articles.sort(compareArticleNumbers),
    };

    if (!titleMap.has(def.titleId)) {
      titleMap.set(def.titleId, { def, chapters: [], firstSeen: firstSeen++ });
    }
    titleMap.get(def.titleId)!.chapters.push(chapter);
  }

  return Array.from(titleMap.entries())
    .sort((a, b) => a[1].firstSeen - b[1].firstSeen)
    .map(([id, entry]) => ({
      id,
      number: entry.def.titleNumber,
      name: entry.def.titleName,
      full: `Título ${entry.def.titleNumber} — ${entry.def.titleName}`,
      chapters: entry.chapters,
    }));
}

/* ------------------------------------------------------------------
   Exports
   ------------------------------------------------------------------ */

/** Estrutura completa: TÍTULOS → CAPÍTULOS → ARTIGOS */
export const LEI_14133_TITULOS: readonly LeiTitle[] = buildStructure();

/** Lista flat de capítulos (sem agrupamento por título) */
export const LEI_14133_CAPITULOS: readonly LeiChapter[] = LEI_14133_TITULOS.flatMap((t) => t.chapters);

/** Mapa de número de artigo → capítulo correspondente */
export const ARTICLE_TO_CHAPTER: ReadonlyMap<string, LeiChapter> = (() => {
  const map = new Map<string, LeiChapter>();
  for (const cap of LEI_14133_CAPITULOS) {
    for (const art of cap.articles) {
      map.set(art, cap);
    }
  }
  return map;
})();

/** Helper: encontra o capítulo de um artigo */
export function getChapterForArticle(articleNumber: string): LeiChapter | undefined {
  return ARTICLE_TO_CHAPTER.get(articleNumber);
}

/** Helper: encontra o título de um capítulo */
export function getTitleForChapter(chapter: LeiChapter): LeiTitle | undefined {
  return LEI_14133_TITULOS.find((t) => t.id === chapter.titleId);
}

/** Stats globais */
export const LEI_14133_STRUCTURE_STATS = {
  totalTitulos: LEI_14133_TITULOS.length,
  totalCapitulos: LEI_14133_CAPITULOS.length,
  totalArtigos: Object.keys(LEI_14133_ARTIGOS).length,
};
