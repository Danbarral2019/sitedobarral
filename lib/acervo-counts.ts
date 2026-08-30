/**
 * Fonte única das contagens do acervo exibidas ao público.
 *
 * Existe porque o mesmo número aparecia calculado de três jeitos diferentes:
 * somado na home, escrito à mão na /busca ("mais de 800") e com fallback
 * desatualizado no código (53 atos normativos, quando o banco tem 266).
 *
 * Três decisões de contagem, todas deliberadas:
 *
 * 1. `acordao-grafo` fica de fora. São ~13 mil acórdãos do TCU ingeridos para
 *    alimentar o grafo de citações; não têm página pública e ninguém consegue
 *    abri-los. Contá-los como "documentos" infla o acervo em mais de 13 mil.
 *
 * 2. Súmulas do TST ficam de fora. São ~1.300 registros de matéria trabalhista
 *    (periculosidade, férias proporcionais, estabilidade sindical) num acervo
 *    de licitações e contratos. Poluem a contagem e o resultado de busca.
 *
 * 3. Acórdãos do TCU são contados UMA vez. Eles existem em duas tabelas ao
 *    mesmo tempo, como Document (categoria `acordao`) e como TribunalDecision
 *    (tribunalCode TCU). A sobreposição foi conferida número a número e é
 *    integral: 676 de 676. A fonte canônica aqui é Document, e TribunalDecision
 *    entra apenas com os demais tribunais.
 */

import { cache } from 'react';
import { prisma } from '@/lib/prisma';

/** Categorias de Document que compõem o acervo consultivo da AGU. */
const AGU_CATEGORIES = ['parecer', 'parecer-vinculante', 'nota-tecnica', 'despacho', 'decor'];

/** Tribunais cujas decisões não entram na contagem pública. Ver notas 2 e 3. */
const TRIBUNAIS_EXCLUIDOS = ['TST', 'TCU'];

export interface AcervoRow {
  key: string;
  count: number;
  label: string;
  description: string;
  href: string;
}

async function countDocs(where: Parameters<typeof prisma.document.count>[0]) {
  return prisma.document.count(where);
}

/**
 * As linhas do índice do acervo, na ordem em que a home as apresenta.
 * Falha suave: se o banco não responder (build de CI, por exemplo), devolve
 * as linhas com contagem zero e a home omite os números em vez de quebrar.
 */
export const getAcervoIndex = cache(async (): Promise<AcervoRow[]> => {
  try {
    const [artigos, acordaosTcu, agu, tribunais, atos, informativos, enunciados, ons, glossario] =
      await Promise.all([
        prisma.leiArticle.count(),
        countDocs({ where: { category: 'acordao' } }),
        countDocs({ where: { category: { in: AGU_CATEGORIES } } }),
        prisma.tribunalDecision.count({ where: { tribunalCode: { notIn: TRIBUNAIS_EXCLUIDOS } } }),
        prisma.legislativeAct.count(),
        countDocs({ where: { category: 'informativo' } }),
        countDocs({ where: { category: 'enunciados' } }),
        countDocs({ where: { category: 'orientacao-normativa' } }),
        prisma.glossaryTerm.count(),
      ]);

    return [
      {
        key: 'lei',
        count: artigos,
        label: 'Artigos da Lei 14.133',
        description: 'Texto integral, com a jurisprudência ligada a cada dispositivo.',
        href: '/lei-14133',
      },
      {
        key: 'acordaos',
        count: acordaosTcu,
        label: 'Acórdãos do TCU',
        description: 'Ementa, relator, colegiado e link para a publicação oficial.',
        href: '/jurisprudencia',
      },
      {
        key: 'agu',
        count: agu,
        label: 'Pareceres, notas e despachos da AGU',
        description: 'Inclui os pareceres vinculantes e o acervo do DECOR.',
        href: '/base-conhecimento/pareceres',
      },
      {
        key: 'tribunais',
        count: tribunais,
        label: 'Decisões de STF, STJ e Tribunais de Contas',
        description: 'Seleção por tema de licitações e contratos administrativos.',
        href: '/jurisprudencia',
      },
      {
        key: 'atos',
        count: atos,
        label: 'Atos normativos',
        description: 'Decretos, instruções normativas e portarias, com a redação vigente.',
        href: '/legislacao',
      },
      {
        key: 'informativos',
        count: informativos,
        label: 'Informativos do TCU',
        description: 'Série histórica, com o enunciado e o acórdão de origem.',
        href: '/base-conhecimento',
      },
      {
        key: 'enunciados',
        count: enunciados + ons,
        label: 'Enunciados e orientações normativas',
        description: 'Simpósios do CJF, IBDA e INCP, e as ONs da AGU.',
        href: '/base-conhecimento/enunciados',
      },
      {
        key: 'glossario',
        count: glossario,
        label: 'Termos no glossário',
        description: 'Definições curtas com o dispositivo legal de referência.',
        href: '/glossario',
      },
    ];
  } catch {
    // Banco indisponível: devolve a estrutura sem números. A home checa
    // `count > 0` antes de exibir, então nada quebra e nada mente.
    return [];
  }
});

export interface AcervoLatestItem {
  id: string;
  label: string;
  title: string;
  date: Date;
  href: string;
}

/**
 * As entradas mais recentes do acervo, para o painel "Últimas entradas".
 * Deliberadamente não promete janela de tempo: o rótulo na home diz
 * "últimas entradas", não "esta semana", porque a cadência de cada fonte
 * varia e um item de dois meses atrás sob "esta semana" seria falso.
 */
export const getAcervoLatest = cache(async (limit = 4): Promise<AcervoLatestItem[]> => {
  try {
    const [docs, decisoes] = await Promise.all([
      prisma.document.findMany({
        where: { isPublic: true, reviewed: true, NOT: { category: 'acordao-grafo' } },
        select: { id: true, title: true, category: true, uploadedAt: true },
        orderBy: { uploadedAt: 'desc' },
        take: limit * 2,
      }),
      prisma.tribunalDecision.findMany({
        where: { tribunalCode: { notIn: TRIBUNAIS_EXCLUIDOS } },
        select: { id: true, title: true, tribunalCode: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
      }),
    ]);

    const LABELS: Record<string, string> = {
      acordao: 'Acórdão TCU',
      'nota-tecnica': 'Nota AGU',
      parecer: 'Parecer AGU',
      'parecer-vinculante': 'Parecer vinculante',
      despacho: 'Despacho AGU',
      decor: 'DECOR',
      'orientacao-normativa': 'ON AGU',
      enunciados: 'Enunciado',
      informativo: 'Informativo TCU',
      'ato-normativo': 'Ato normativo',
      sumula: 'Súmula TCU',
      'manual-tcu': 'Manual TCU',
    };

    const items: AcervoLatestItem[] = [
      ...docs.map((d) => ({
        id: d.id,
        label: LABELS[d.category] ?? 'Documento',
        title: d.title,
        date: d.uploadedAt ?? new Date(),
        href: `/documento/${d.id}`,
      })),
      ...decisoes.map((t) => ({
        id: t.id,
        label: t.tribunalCode,
        title: t.title,
        date: t.createdAt,
        href: `/jurisprudencia/${t.id}`,
      })),
    ];

    // Dedup por título normalizado, defesa contra o mesmo conteúdo aparecendo
    // em Document e TribunalDecision (caso conhecido dos acórdãos do TCU).
    const seen = new Set<string>();
    const ordenados = items
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .filter((item) => {
        const key = item.title.trim().toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    // Diversifica a origem: uma entrada por fonte antes de repetir qualquer
    // uma. A ingestão é em lote, então sem isto o painel mostra quatro
    // acórdãos do TCU seguidos e passa a impressão de acervo de fonte única.
    const usados = new Set<string>();
    const primeiraRodada = ordenados.filter((item) => {
      if (usados.has(item.label)) return false;
      usados.add(item.label);
      return true;
    });
    const resto = ordenados.filter((item) => !primeiraRodada.includes(item));
    return [...primeiraRodada, ...resto].slice(0, limit);
  } catch {
    return [];
  }
});
