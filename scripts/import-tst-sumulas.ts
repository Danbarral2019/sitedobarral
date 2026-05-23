/**
 * Importação das Súmulas do TST a partir do PDF oficial.
 *
 * Lê o PDF, parseia as 463 súmulas com fidelidade textual e grava em
 * `TribunalDecision` com `tribunalCode='TST'` e `decisionType='sumula'`.
 * O JSON estruturado (situação, itens romanos, IRRs, resoluções, refs) fica
 * em `sourceRawData` para reconstrução perfeita no front-end.
 *
 * Não dispara reindexação de embeddings — deixa `embeddingStatus='pending'`
 * para o cron `process-index-jobs` processar nas próximas execuções.
 *
 * Uso:
 *   npx tsx scripts/import-tst-sumulas.ts
 *   npx tsx scripts/import-tst-sumulas.ts --dry-run
 *   npx tsx scripts/import-tst-sumulas.ts --limit 10
 *   npx tsx scripts/import-tst-sumulas.ts --force
 *   TST_SUMULAS_PDF=/caminho/custom.pdf npx tsx scripts/import-tst-sumulas.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { extractTstPdf, parseTstSumulas } from '../lib/tst';
import type { TstSumulaParsed } from '../lib/tst/types';

const DEFAULT_PDF_PATH =
  '/Users/danba/Library/CloudStorage/OneDrive-AGU/Súmulas TST.pdf';
const SOURCE_API = 'tst-pdf-2026-05';

interface Options {
  dryRun: boolean;
  force: boolean;
  limit: number | null;
  pdfPath: string;
}

function parseArgs(argv: string[]): Options {
  const out: Options = {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    limit: null,
    pdfPath: process.env.TST_SUMULAS_PDF || DEFAULT_PDF_PATH,
  };
  const limitIdx = argv.indexOf('--limit');
  if (limitIdx >= 0 && argv[limitIdx + 1]) {
    const n = Number(argv[limitIdx + 1]);
    if (!Number.isNaN(n) && n > 0) out.limit = n;
  }
  return out;
}

function buildFullIdentifier(numero: number): string {
  return `TST Súmula ${numero}`;
}

function deriveDataPublicacao(p: TstSumulaParsed): Date | null {
  // Procura a resolução mais recente — esta é a data efetiva da redação atual.
  if (p.resolucoes.length === 0) return null;
  const sorted = [...p.resolucoes].sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0));
  const ano = sorted[0].ano;
  if (!ano) return null;
  // Sem dia/mês exatos disponíveis no texto canônico — usa 1º de janeiro do
  // ano. Front-end exibe só o ano em badges. Data exata exigiria parser de DJ/DEJT.
  return new Date(Date.UTC(ano, 0, 1));
}

function deriveRelator(p: TstSumulaParsed): string | null {
  // Quando há IRR, o relator é nominal (Min. X). Senão null.
  return p.irrs[0]?.relator ?? null;
}

function deriveOrgaoJulgador(p: TstSumulaParsed): string | null {
  return p.irrs.length > 0 ? 'Tribunal Pleno' : null;
}

function buildSourceRawData(p: TstSumulaParsed): string {
  // JSON estruturado preservado para o front-end reconstruir badges, itens,
  // timeline, etc. Não inclui rawBlock para evitar duplicação massiva.
  const payload = {
    situacao: p.situacao,
    situacaoMotivo: p.situacaoMotivo,
    observacao: p.observacao,
    tese: p.tese,
    itens: p.itens,
    irrs: p.irrs,
    resolucoes: p.resolucoes,
    leiArticles: p.leiArticles,
    cltArticles: p.cltArticles,
  };
  return JSON.stringify(payload);
}

interface UpsertStats {
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  withoutUrl: number;
}

async function upsertSumula(
  prisma: PrismaClient,
  p: TstSumulaParsed,
  options: { dryRun: boolean; force: boolean },
  stats: UpsertStats,
): Promise<void> {
  const fullIdentifier = buildFullIdentifier(p.numero);
  if (!p.url) stats.withoutUrl++;

  const dataPub = deriveDataPublicacao(p);
  const data = {
    tribunalCode: 'TST' as const,
    tribunalName: 'Tribunal Superior do Trabalho',
    decisionType: 'sumula' as const,
    decisionNumber: String(p.numero),
    processNumber: null,
    year: p.ano ?? new Date().getUTCFullYear(),
    fullIdentifier,
    title: p.titulo,
    ementa: p.tese,
    fullText: p.fullTextMarkdown,
    summary: null,
    relator: deriveRelator(p),
    orgaoJulgador: deriveOrgaoJulgador(p),
    dataJulgamento: dataPub,
    dataPublicacao: dataPub,
    url: p.url,
    pdfUrl: null,
    isRelevant: true,
    relevanceScore: 100,
    themes: JSON.stringify(p.themes),
    leiArticlesArr: p.leiArticles,
    suggestedCourses: null,
    sourceApi: SOURCE_API,
    sourceId: String(p.numero),
    sourceRawData: buildSourceRawData(p),
    approvalStatus: 'manually_approved' as const,
    confidence: 100,
    classificationReasoning: null,
    reviewedBy: 'import-tst-sumulas',
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
      select: { id: true, ementa: true, fullText: true, themes: true, url: true },
    });

    if (!existing) {
      await prisma.tribunalDecision.create({ data });
      stats.created++;
      return;
    }

    if (
      !options.force &&
      existing.ementa === data.ementa &&
      existing.fullText === data.fullText &&
      existing.themes === data.themes &&
      existing.url === data.url
    ) {
      stats.unchanged++;
      return;
    }

    await prisma.tribunalDecision.update({
      where: { id: existing.id },
      data: {
        ...data,
        // Preserva sequência de embedding existente se nada relevante mudou.
        embeddingStatus: 'pending',
        chunkCount: 0,
        embeddedAt: null,
      },
    });
    stats.updated++;
  } catch (err) {
    stats.failed++;
    console.error(`  ✗ S${p.numero} falhou:`, err instanceof Error ? err.message : err);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log('🏛️  Importação Súmulas TST');
  console.log('Opções:', options);

  if (!existsSync(options.pdfPath)) {
    console.error(`✗ PDF não encontrado: ${options.pdfPath}`);
    console.error(
      'Defina TST_SUMULAS_PDF=/caminho/arquivo.pdf ou use o default OneDrive.',
    );
    process.exit(1);
  }
  console.log(`📄 PDF: ${path.basename(options.pdfPath)}`);

  console.log('Extraindo texto e hyperlinks...');
  const { rawText, urls } = await extractTstPdf(options.pdfPath);
  console.log(`  rawText: ${rawText.length} chars`);
  console.log(`  URLs hyperlinks: ${urls.size}`);

  console.log('Parseando súmulas...');
  let sumulas = parseTstSumulas(rawText, urls);
  console.log(`  Parseadas: ${sumulas.length}`);

  if (sumulas.length !== 463) {
    console.warn(`⚠ Atenção: esperado 463 súmulas, obtido ${sumulas.length}`);
  }

  if (options.limit !== null) {
    sumulas = sumulas.slice(0, options.limit);
    console.log(`  Aplicando --limit ${options.limit}: processando ${sumulas.length}`);
  }

  // Stats pré-import
  const semUrl = sumulas.filter((s) => !s.url).length;
  if (semUrl > 0) {
    console.warn(`⚠ ${semUrl} súmulas sem URL extraída do PDF`);
  }
  const bySit = new Map<string, number>();
  for (const s of sumulas) bySit.set(s.situacao, (bySit.get(s.situacao) ?? 0) + 1);
  console.log('  Situações:', Object.fromEntries(bySit));

  // Conexão DB
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

  for (let i = 0; i < sumulas.length; i++) {
    const s = sumulas[i];
    await upsertSumula(prisma, s, options, stats);
    if ((i + 1) % 50 === 0) {
      console.log(`  ... ${i + 1}/${sumulas.length} processadas`);
    }
  }

  await prisma.$disconnect();

  console.log('\n=== Resumo ===');
  console.log(`  Criadas:    ${stats.created}`);
  console.log(`  Atualizadas:${stats.updated}`);
  console.log(`  Inalteradas:${stats.unchanged}`);
  console.log(`  Falhas:     ${stats.failed}`);
  console.log(`  Sem URL:    ${stats.withoutUrl}`);
  console.log('');
  if (stats.failed > 0) {
    console.error(`✗ ${stats.failed} súmulas falharam — investigar logs acima`);
    process.exit(2);
  }
  if (options.dryRun) {
    console.log('✓ DRY RUN concluído. Reexecute sem --dry-run para gravar.');
  } else {
    console.log('✓ Importação concluída.');
    console.log(
      '  Próximo passo: aguardar cron `process-index-jobs` (ou disparar manualmente) para gerar embeddings.',
    );
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
