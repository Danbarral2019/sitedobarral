/**
 * Importação do "Livro de Súmulas, OJs e PNs do TST" (Res. 225/2025).
 *
 * Lê o RTF oficial em `livrointernet-12.rtf`, parseia as 6 séries
 * (Súmulas + OJ TP/OE + OJ SBDI-I + OJ SBDI-I Transitória + OJ SBDI-II +
 * OJ SDC + PN) e grava em `TribunalDecision` com `tribunalCode='TST'` e
 * `decisionType` apropriado (`sumula` / `orientacao_jurisprudencial` /
 * `precedente_normativo`).
 *
 * Idempotente via upsert por `fullIdentifier`. Re-importar Súmulas já no
 * banco é seguro: preserva URLs existentes (que o RTF não tem) e só atualiza
 * conteúdo se houver mudança.
 *
 * Uso:
 *   npx tsx scripts/import-tst-livro.ts
 *   npx tsx scripts/import-tst-livro.ts --dry-run
 *   npx tsx scripts/import-tst-livro.ts --serie sumula
 *   npx tsx scripts/import-tst-livro.ts --serie oj-sdi1 --limit 10
 *   npx tsx scripts/import-tst-livro.ts --force
 *   TST_LIVRO_RTF=/caminho/custom.rtf npx tsx scripts/import-tst-livro.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { extractTstLivroRtf } from '../lib/tst/extract-rtf';
import { parseLivroText } from '../lib/tst/parser-livro';
import type { TstLivroBlock, TstLivroSerie } from '../lib/tst/types-livro';

const DEFAULT_RTF_PATH =
  '/Users/danba/Library/CloudStorage/OneDrive-AGU/livrointernet-12.rtf';
const SOURCE_API = 'tst-livro-res-225-2025';

interface Options {
  dryRun: boolean;
  force: boolean;
  limit: number | null;
  rtfPath: string;
  serieFilter: TstLivroSerie | 'all';
}

const SERIE_FLAG_MAP: Record<string, TstLivroSerie | 'all'> = {
  all: 'all',
  sumula: 'sumula',
  'tp-oe': 'oj-tp-oe',
  'tpoe': 'oj-tp-oe',
  sbdi1: 'oj-sdi1',
  'sdi1': 'oj-sdi1',
  sbdi1t: 'oj-sdi1t',
  'sdi1t': 'oj-sdi1t',
  sbdi2: 'oj-sdi2',
  'sdi2': 'oj-sdi2',
  sdc: 'oj-sdc',
  pn: 'pn',
};

function parseArgs(argv: string[]): Options {
  const out: Options = {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    limit: null,
    rtfPath: process.env.TST_LIVRO_RTF || DEFAULT_RTF_PATH,
    serieFilter: 'all',
  };
  const limitIdx = argv.indexOf('--limit');
  if (limitIdx >= 0 && argv[limitIdx + 1]) {
    const n = Number(argv[limitIdx + 1]);
    if (!Number.isNaN(n) && n > 0) out.limit = n;
  }
  const serieIdx = argv.indexOf('--serie');
  if (serieIdx >= 0 && argv[serieIdx + 1]) {
    const v = argv[serieIdx + 1].toLowerCase();
    const mapped = SERIE_FLAG_MAP[v];
    if (mapped) out.serieFilter = mapped;
    else {
      console.warn(`⚠ --serie "${v}" desconhecida; aceitando "all". Opções: ${Object.keys(SERIE_FLAG_MAP).join(', ')}`);
    }
  }
  return out;
}

const SERIE_TO_DECISION_TYPE: Record<TstLivroSerie, string> = {
  sumula: 'sumula',
  'oj-tp-oe': 'orientacao_jurisprudencial',
  'oj-sdi1': 'orientacao_jurisprudencial',
  'oj-sdi1t': 'orientacao_jurisprudencial',
  'oj-sdi2': 'orientacao_jurisprudencial',
  'oj-sdc': 'orientacao_jurisprudencial',
  pn: 'precedente_normativo',
};

const SERIE_TO_FULL_ID_PREFIX: Record<TstLivroSerie, string> = {
  sumula: 'TST Súmula',
  'oj-tp-oe': 'TST OJ-TP/OE',
  'oj-sdi1': 'TST OJ-SBDI-I',
  'oj-sdi1t': 'TST OJ-SBDI-I Transitória',
  'oj-sdi2': 'TST OJ-SBDI-II',
  'oj-sdc': 'TST OJ-SDC',
  pn: 'TST Precedente Normativo',
};

function buildFullIdentifier(p: TstLivroBlock): string {
  return `${SERIE_TO_FULL_ID_PREFIX[p.serie]} ${p.numero}`;
}

function deriveYear(p: TstLivroBlock): number | null {
  if (p.resolucoes.length === 0) return null;
  const anos = p.resolucoes.map((r) => r.ano).filter((y): y is number => typeof y === 'number');
  return anos.length > 0 ? Math.min(...anos) : null;
}

function deriveDataPublicacao(p: TstLivroBlock): Date | null {
  const ano = deriveYear(p);
  if (!ano) return null;
  return new Date(Date.UTC(ano, 0, 1));
}

function deriveThemes(p: TstLivroBlock): string[] {
  const themes: string[] = [`situacao:${p.situacao}`, 'tst'];
  themes.push(p.serie); // ex.: oj-sbdi-1, pn, sumula
  // Marca CLT quando há refs CLT
  if (p.cltArticles.length > 0) themes.push('clt');
  for (const art of p.cltArticles) themes.push(`clt-art-${art}`);
  // Marca trabalho (tag genérica útil pro RAG)
  themes.push('trabalho');
  return themes;
}

function buildSourceRawData(p: TstLivroBlock): string {
  const payload = {
    serie: p.serie,
    rotulo: p.rotulo,
    cabecalho: p.cabecalhoCompleto,
    situacao: p.situacao,
    situacaoMotivo: p.situacaoMotivo,
    tese: p.tese,
    itens: p.itens,
    resolucoes: p.resolucoes,
    historico: p.historico,
    leiArticles: p.leiArticles,
    cltArticles: p.cltArticles,
  };
  return JSON.stringify(payload);
}

function buildFullTextMarkdown(p: TstLivroBlock): string {
  const lines: string[] = [];
  const prefix = SERIE_TO_FULL_ID_PREFIX[p.serie];
  lines.push(`# ${prefix} ${p.numero} — ${p.titulo}`);
  lines.push('');
  lines.push(`**Situação:** ${p.situacao}`);
  if (p.situacaoMotivo) lines.push(`> ${p.situacaoMotivo}`);
  if (p.resolucoes.length > 0) {
    lines.push('');
    lines.push('## Resoluções');
    for (const r of p.resolucoes) {
      const div = r.divulgadoEm ? ` — ${r.tipo ?? ''} ${r.divulgadoEm}`.trim() : '';
      lines.push(`- Res. ${r.numero}${div}`);
    }
  }
  lines.push('');
  lines.push('## Tese');
  if (p.itens.length > 0) {
    for (const it of p.itens) {
      const prefix2 = it.cancelled ? `~~${it.ordem} -` : `${it.ordem} -`;
      const suffix = it.cancelled ? '~~' : '';
      lines.push(`- ${prefix2} ${it.texto}${suffix}`);
      if (it.cancelled && it.cancelMotivo) lines.push(`  - _${it.cancelMotivo}_`);
    }
  } else {
    lines.push(p.tese);
  }
  if (p.historico.length > 0) {
    lines.push('');
    lines.push('## Histórico');
    for (const h of p.historico) {
      lines.push(`- ${h.texto}`);
    }
  }
  return lines.join('\n');
}

interface UpsertStats {
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  withoutUrl: number;
}

async function upsertBlock(
  prisma: PrismaClient,
  p: TstLivroBlock,
  options: { dryRun: boolean; force: boolean },
  stats: UpsertStats,
): Promise<void> {
  const fullIdentifier = buildFullIdentifier(p);
  if (!p.url) stats.withoutUrl++;

  const dataPub = deriveDataPublicacao(p);
  const ano = deriveYear(p);
  const data = {
    tribunalCode: 'TST' as const,
    tribunalName: 'Tribunal Superior do Trabalho',
    decisionType: SERIE_TO_DECISION_TYPE[p.serie],
    decisionNumber: String(p.numero),
    processNumber: null,
    year: ano ?? new Date().getUTCFullYear(),
    fullIdentifier,
    title: p.titulo,
    ementa: p.tese,
    fullText: buildFullTextMarkdown(p),
    summary: null,
    relator: null,
    orgaoJulgador: p.serie === 'pn' ? 'Tribunal Pleno' : null,
    dataJulgamento: dataPub,
    dataPublicacao: dataPub,
    url: p.url, // RTF do TST não tem hyperlinks; será null. Preservamos URL existente no upsert.
    pdfUrl: null,
    isRelevant: true,
    relevanceScore: 100,
    themes: JSON.stringify(deriveThemes(p)),
    leiArticlesArr: p.leiArticles,
    suggestedCourses: null,
    sourceApi: SOURCE_API,
    sourceId: p.rotulo,
    sourceRawData: buildSourceRawData(p),
    approvalStatus: 'manually_approved' as const,
    confidence: 100,
    classificationReasoning: null,
    reviewedBy: 'import-tst-livro',
    reviewedAt: new Date(),
    adminNotes: null,
    embeddingStatus: 'pending' as const,
    chunkCount: 0,
    embeddedAt: null,
    notifiedAt: null,
    scrapedAt: new Date(),
    scrapeError: null,
  };

  if (options.dryRun) {
    stats.created++;
    return;
  }

  try {
    const existing = await prisma.tribunalDecision.findUnique({
      where: { fullIdentifier },
      select: {
        id: true,
        ementa: true,
        fullText: true,
        themes: true,
        url: true,
      },
    });

    if (!existing) {
      await prisma.tribunalDecision.create({ data });
      stats.created++;
      return;
    }

    // Preserva URL existente quando o novo `data.url` for null (caso comum,
    // já que o RTF não tem hyperlinks; mantém URLs que vieram do PDF anterior).
    const urlToSave = data.url ?? existing.url;
    const dataWithUrl = { ...data, url: urlToSave };

    if (
      !options.force &&
      existing.ementa === dataWithUrl.ementa &&
      existing.fullText === dataWithUrl.fullText &&
      existing.themes === dataWithUrl.themes &&
      existing.url === dataWithUrl.url
    ) {
      stats.unchanged++;
      return;
    }

    await prisma.tribunalDecision.update({
      where: { id: existing.id },
      data: {
        ...dataWithUrl,
        // Re-trigger reindexação só se conteúdo textual mudou
        embeddingStatus:
          existing.ementa !== dataWithUrl.ementa ||
          existing.fullText !== dataWithUrl.fullText
            ? 'pending'
            : (await prisma.tribunalDecision.findUnique({
                where: { id: existing.id },
                select: { embeddingStatus: true },
              }))?.embeddingStatus ?? 'pending',
      },
    });
    stats.updated++;
  } catch (err) {
    stats.failed++;
    console.error(`  ✗ ${p.rotulo} falhou:`, err instanceof Error ? err.message : err);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log('🏛️  Importação do Livro TST (Res. 225/2025)');
  console.log('Opções:', options);

  if (!existsSync(options.rtfPath)) {
    console.error(`✗ RTF não encontrado: ${options.rtfPath}`);
    console.error('Defina TST_LIVRO_RTF=/caminho/arquivo.rtf ou baixe de:');
    console.error('  https://www.tst.jus.br/documents/d/guest/livrointernet-12-rtf');
    process.exit(1);
  }
  console.log(`📄 RTF: ${path.basename(options.rtfPath)}`);

  console.log('Extraindo texto via textutil...');
  const { rawText } = await extractTstLivroRtf(options.rtfPath);
  console.log(`  rawText: ${rawText.length} chars`);

  console.log('Parseando documentos...');
  let blocks = parseLivroText(rawText);
  console.log(`  Parseados: ${blocks.length}`);

  // Filtro por série
  if (options.serieFilter !== 'all') {
    blocks = blocks.filter((b) => b.serie === options.serieFilter);
    console.log(`  Filtrando série=${options.serieFilter}: ${blocks.length}`);
  }
  if (options.limit !== null) {
    blocks = blocks.slice(0, options.limit);
    console.log(`  --limit ${options.limit}: processando ${blocks.length}`);
  }

  // Estatísticas por série
  const bySerie = new Map<string, number>();
  const bySit = new Map<string, number>();
  for (const b of blocks) {
    bySerie.set(b.serie, (bySerie.get(b.serie) ?? 0) + 1);
    bySit.set(b.situacao, (bySit.get(b.situacao) ?? 0) + 1);
  }
  console.log('  Por série:', Object.fromEntries(bySerie));
  console.log('  Por situação:', Object.fromEntries(bySit));

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });
  if (options.dryRun) {
    console.log('\n🔍 DRY RUN — nenhuma escrita no banco.\n');
  } else {
    console.log('\n💾 Gravando no banco...\n');
  }

  const stats: UpsertStats = {
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    withoutUrl: 0,
  };
  for (let i = 0; i < blocks.length; i++) {
    await upsertBlock(prisma, blocks[i], options, stats);
    if ((i + 1) % 100 === 0) {
      console.log(`  ... ${i + 1}/${blocks.length}`);
    }
  }
  await prisma.$disconnect();

  console.log('\n=== Resumo ===');
  console.log(`  Criadas:    ${stats.created}`);
  console.log(`  Atualizadas:${stats.updated}`);
  console.log(`  Inalteradas:${stats.unchanged}`);
  console.log(`  Falhas:     ${stats.failed}`);
  console.log(`  Sem URL:    ${stats.withoutUrl}`);
  if (stats.failed > 0) {
    process.exit(2);
  }
  if (options.dryRun) {
    console.log('\n✓ DRY RUN concluído. Reexecute sem --dry-run para gravar.');
  } else {
    console.log('\n✓ Importação concluída.');
    console.log('  Próximo passo: aguardar cron `process-index-jobs` ou disparar reindexação manual.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
