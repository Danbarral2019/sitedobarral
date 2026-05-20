/**
 * Script de Re-análise de Artigos da Lei 14.133
 *
 * Re-processa TODOS os documentos e atos legislativos que já possuem leiArticles,
 * usando o LeiIndexer atualizado (com regra do Art. 6 residual).
 *
 * Uso:
 *   npx tsx scripts/reanalyze-lei-articles.ts                     # Dry-run (compara antes/depois)
 *   npx tsx scripts/reanalyze-lei-articles.ts --execute           # Execução real (atualiza banco)
 *   npx tsx scripts/reanalyze-lei-articles.ts --limit 10          # Limita a 10 docs
 *   npx tsx scripts/reanalyze-lei-articles.ts --concurrency 3     # 3 chamadas paralelas
 *   npx tsx scripts/reanalyze-lei-articles.ts --only-documents    # Apenas Documents
 *   npx tsx scripts/reanalyze-lei-articles.ts --only-legislative  # Apenas LegislativeActs
 *
 * O script compara indexação anterior vs nova e reporta:
 * - Documentos com Art. 6 removido
 * - Artigos adicionados/removidos
 * - Estatísticas gerais
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { LeiIndexer } from '../lib/lei-indexer';
import { safeParseArray } from '../lib/utils';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

// --- Parse CLI args ---
const args = process.argv.slice(2);
const EXECUTE_MODE = args.includes('--execute');
const ONLY_DOCUMENTS = args.includes('--only-documents');
const ONLY_LEGISLATIVE = args.includes('--only-legislative');

function getArgValue(flag: string, defaultValue: number): number {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    const val = parseInt(args[idx + 1], 10);
    return isNaN(val) ? defaultValue : val;
  }
  return defaultValue;
}

const LIMIT = getArgValue('--limit', 0);
const CONCURRENCY = getArgValue('--concurrency', 3);
const DELAY_MS = 1500; // Delay entre batches (ms)

interface DocumentToReanalyze {
  id: string;
  title: string;
  category: string | null;
  tags: string | null;
  content: string | null;
  description: string | null;
  leiArticles: string | null;
  source: 'Document' | 'LegislativeAct';
}

interface ReanalysisResult {
  id: string;
  title: string;
  source: string;
  oldArticles: string[];
  newArticles: string[];
  added: string[];
  removed: string[];
  art6Removed: boolean;
  confidence: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Testa conexao Gemini */
async function testGeminiConnection(): Promise<boolean> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[ERRO] GEMINI_API_KEY nao configurada em .env.local');
    return false;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Responda apenas com: OK' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 10 },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[ERRO] Gemini API (${response.status}): ${err}`);
      return false;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.toUpperCase().includes('OK');
  } catch (error) {
    console.error('[ERRO] Teste de conexao falhou:', error);
    return false;
  }
}

async function main() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  console.log(`\n=== Re-analise de Artigos Lei 14.133 ${EXECUTE_MODE ? '(EXECUCAO REAL)' : '(DRY RUN)'} ===`);
  console.log(`Configuracao: concurrency=${CONCURRENCY}, delay=${DELAY_MS}ms`);
  if (LIMIT > 0) console.log(`Limite: ${LIMIT} documentos`);
  if (ONLY_DOCUMENTS) console.log(`Filtro: apenas Documents`);
  if (ONLY_LEGISLATIVE) console.log(`Filtro: apenas LegislativeActs`);
  console.log('');

  // 1. Testar conexao Gemini
  console.log('[1/4] Testando conexao com Gemini...');
  const connected = await testGeminiConnection();
  if (!connected) {
    console.error('Falha na conexao com Gemini. Abortando.');
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log('  OK Gemini conectado\n');

  // 2. Buscar documentos ja indexados
  console.log('[2/4] Buscando documentos com leiArticles existente...');

  const allDocs: DocumentToReanalyze[] = [];

  if (!ONLY_LEGISLATIVE) {
    const documents = await prisma.document.findMany({
      where: {
        leiArticles: { not: null },
        NOT: [
          { leiArticles: '' },
          { leiArticles: '[]' },
        ],
      },
      select: {
        id: true,
        title: true,
        category: true,
        tags: true,
        content: true,
        description: true,
        leiArticlesArr: true,
      },
      orderBy: { uploadedAt: 'asc' },
    });

    for (const doc of documents) {
      allDocs.push({ ...doc, source: 'Document' });
    }
    console.log(`  Documents: ${documents.length}`);
  }

  if (!ONLY_DOCUMENTS) {
    const legislativeActs = await prisma.legislativeAct.findMany({
      where: {
        leiArticles: { not: null },
        NOT: [
          { leiArticles: '' },
          { leiArticles: '[]' },
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        ementa: true,
        summary: true,
        leiArticlesArr: true,
        content: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const la of legislativeActs) {
      allDocs.push({
        id: la.id,
        title: la.title,
        category: la.type,
        tags: null,
        content: la.content,
        description: la.ementa || la.summary || null,
        leiArticles: la.leiArticles,
        source: 'LegislativeAct',
      });
    }
    console.log(`  LegislativeActs: ${legislativeActs.length}`);
  }

  console.log(`  Total para re-analise: ${allDocs.length}`);

  // Aplicar limite
  let docs = allDocs;
  if (LIMIT > 0) {
    docs = docs.slice(0, LIMIT);
    console.log(`  Limitado a: ${docs.length}`);
  }

  if (docs.length === 0) {
    console.log('  Nenhum documento para re-analisar. Concluido.');
    await prisma.$disconnect();
    return;
  }
  console.log('');

  // 3. Processar em batches
  console.log(`[3/4] Re-analisando ${docs.length} documentos (concurrency=${CONCURRENCY})...\n`);

  const results: ReanalysisResult[] = [];
  let processed = 0;
  let updated = 0;
  let errors = 0;
  let art6RemovedCount = 0;

  for (let i = 0; i < docs.length; i += CONCURRENCY) {
    const batch = docs.slice(i, i + CONCURRENCY);

    const promises = batch.map(async (doc) => {
      try {
        const oldArticles = safeParseArray(doc.leiArticles);

        // Re-analisar com LeiIndexer atualizado (inclui regra Art. 6)
        const result = await LeiIndexer.analyzeDocument(
          {
            id: doc.id,
            title: doc.title,
            category: doc.category ?? '',
            tags: doc.tags ?? null,
            content: doc.content ?? '',
            description: doc.description ?? '',
          },
          {
            minConfidence: 30,
            maxArticles: 10,
          }
        );

        const newArticles = LeiIndexer.resultToLeiArticles(result);

        // Calcular diferencas
        const oldSet = new Set(oldArticles);
        const newSet = new Set(newArticles);
        const added = newArticles.filter(a => !oldSet.has(a));
        const removed = oldArticles.filter(a => !newSet.has(a));
        const art6Removed = oldSet.has('6') && !newSet.has('6');

        if (art6Removed) art6RemovedCount++;

        const reanalysisResult: ReanalysisResult = {
          id: doc.id,
          title: doc.title,
          source: doc.source,
          oldArticles,
          newArticles,
          added,
          removed,
          art6Removed,
          confidence: result.confidence,
        };

        results.push(reanalysisResult);

        // Log mudancas significativas
        if (added.length > 0 || removed.length > 0) {
          const changes: string[] = [];
          if (removed.length > 0) changes.push(`-[${removed.join(',')}]`);
          if (added.length > 0) changes.push(`+[${added.join(',')}]`);
          console.log(`  ${art6Removed ? '[ART6]' : '[DIFF]'} ${doc.title.substring(0, 70)} ${changes.join(' ')}`);
        }

        // Salvar se em modo execute e houve mudanca
        if (EXECUTE_MODE && (added.length > 0 || removed.length > 0)) {
          const leiArticlesJson = JSON.stringify(newArticles);

          if (doc.source === 'Document') {
            await prisma.document.update({
              where: { id: doc.id },
              data: { leiArticles: leiArticlesJson },
            });
          } else {
            await prisma.legislativeAct.update({
              where: { id: doc.id },
              data: { leiArticles: leiArticlesJson },
            });
          }
          updated++;
        }
      } catch (error) {
        errors++;
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  [ERRO] ${doc.title.substring(0, 60)}: ${msg}`);
      }
    });

    await Promise.all(promises);
    processed += batch.length;

    // Progresso
    if (processed % 20 === 0 || processed === docs.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = processed > 0 ? (processed / ((Date.now() - startTime) / 1000)).toFixed(1) : '0';
      const eta = processed > 0
        ? (((docs.length - processed) / (processed / ((Date.now() - startTime) / 1000))) / 60).toFixed(1)
        : '?';
      console.log(`  Progresso: ${processed}/${docs.length} (${elapsed}s, ${rate} docs/s, ETA: ${eta}min)`);
    }

    // Delay entre batches
    if (i + CONCURRENCY < docs.length) {
      await sleep(DELAY_MS);
    }
  }

  // 4. Estatisticas e relatorio
  console.log(`\n[4/4] Estatisticas finais\n`);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const docsWithChanges = results.filter(r => r.added.length > 0 || r.removed.length > 0);
  const docsUnchanged = results.filter(r => r.added.length === 0 && r.removed.length === 0);

  // Contagem de artigos removidos/adicionados
  const removedArticleCounts = new Map<string, number>();
  const addedArticleCounts = new Map<string, number>();
  for (const r of results) {
    for (const art of r.removed) {
      removedArticleCounts.set(art, (removedArticleCounts.get(art) || 0) + 1);
    }
    for (const art of r.added) {
      addedArticleCounts.set(art, (addedArticleCounts.get(art) || 0) + 1);
    }
  }

  console.log(`=== Resultado ${EXECUTE_MODE ? '' : '(DRY RUN - nada foi alterado)'} ===`);
  console.log(`Tempo total: ${totalTime}s`);
  console.log(`Processados: ${processed}`);
  console.log(`Com mudancas: ${docsWithChanges.length}`);
  console.log(`Sem mudancas: ${docsUnchanged.length}`);
  if (EXECUTE_MODE) console.log(`Atualizados no banco: ${updated}`);
  console.log(`Erros: ${errors}`);
  console.log(`Art. 6 removido: ${art6RemovedCount} documentos`);
  console.log('');

  if (removedArticleCounts.size > 0) {
    console.log('--- Artigos mais REMOVIDOS ---');
    const topRemoved = Array.from(removedArticleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    for (const [art, count] of topRemoved) {
      console.log(`  Art. ${art}: removido de ${count} docs`);
    }
    console.log('');
  }

  if (addedArticleCounts.size > 0) {
    console.log('--- Artigos mais ADICIONADOS ---');
    const topAdded = Array.from(addedArticleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    for (const [art, count] of topAdded) {
      console.log(`  Art. ${art}: adicionado a ${count} docs`);
    }
    console.log('');
  }

  // Documentos onde Art. 6 foi removido
  if (art6RemovedCount > 0) {
    console.log(`--- Documentos com Art. 6 removido (${art6RemovedCount}) ---`);
    const art6Docs = results.filter(r => r.art6Removed);
    for (const r of art6Docs) {
      console.log(`  [${r.source}] ${r.title.substring(0, 80)}`);
    }
    console.log('');
  }

  // Salvar relatorio JSON
  const reportDir = path.join(__dirname, '..', 'data', 'backups');
  await fs.mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `reanalysis-report-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    executeMode: EXECUTE_MODE,
    config: { concurrency: CONCURRENCY, delayMs: DELAY_MS, limit: LIMIT },
    summary: {
      totalProcessed: processed,
      withChanges: docsWithChanges.length,
      unchanged: docsUnchanged.length,
      updated,
      errors,
      art6Removed: art6RemovedCount,
      timeSeconds: parseFloat(totalTime),
    },
    removedArticles: Object.fromEntries(removedArticleCounts),
    addedArticles: Object.fromEntries(addedArticleCounts),
    details: results.map(r => ({
      id: r.id,
      title: r.title,
      source: r.source,
      oldArticles: r.oldArticles,
      newArticles: r.newArticles,
      added: r.added,
      removed: r.removed,
      art6Removed: r.art6Removed,
      confidence: r.confidence,
    })),
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`Relatorio salvo em: ${reportPath}`);

  if (!EXECUTE_MODE) {
    console.log('\nPara executar a re-analise real, rode:');
    console.log('  npx tsx scripts/reanalyze-lei-articles.ts --execute\n');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
