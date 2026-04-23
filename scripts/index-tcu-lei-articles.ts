/**
 * Script para indexar acórdãos do TCU com artigos da Lei 14.133/2021 via Gemini AI.
 *
 * Analisa a descrição/enunciado de cada acórdão e identifica artigos relevantes
 * automaticamente usando o LeiIndexer + Gemini.
 *
 * Uso:
 *   npx tsx scripts/index-tcu-lei-articles.ts                     # Executa indexação
 *   npx tsx scripts/index-tcu-lei-articles.ts --dry-run            # Simula sem alterar
 *   npx tsx scripts/index-tcu-lei-articles.ts --limit 10           # Limita a 10 docs
 *   npx tsx scripts/index-tcu-lei-articles.ts --concurrency 5      # 5 chamadas paralelas
 *   npx tsx scripts/index-tcu-lei-articles.ts --min-confidence 50  # Confiança mínima 50
 *   npx tsx scripts/index-tcu-lei-articles.ts --force              # Reprocessa todos (inclusive já indexados)
 *   npx tsx scripts/index-tcu-lei-articles.ts --all                # Inclui TODOS (sem filtro por área)
 *
 * Por padrão, filtra apenas acórdãos de licitações/contratos (exclui Pessoal, RH, etc.)
 * Use --all para processar todos os acórdãos.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { LeiIndexer, type ArticleAnalysisResult } from '../lib/lei-indexer';

const prisma = new PrismaClient();

// --- Parse CLI args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const ALL = args.includes('--all');

function getArgValue(flag: string, defaultValue: number): number {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    const val = parseInt(args[idx + 1], 10);
    return isNaN(val) ? defaultValue : val;
  }
  return defaultValue;
}

const LIMIT = getArgValue('--limit', 0); // 0 = sem limite
const CONCURRENCY = getArgValue('--concurrency', 3);
const MIN_CONFIDENCE = getArgValue('--min-confidence', 40);
const DELAY_MS = 1000; // Delay entre chamadas (ms)

// --- Tags de licitações/contratos (relevantes para Lei 14.133) ---
const TAGS_LICITACOES = new Set([
  'Licitação',
  'Contrato Administrativo',
  'Contrato administrativo',
  'Edital de licitação',
  'Habilitação de licitante',
  'Qualificação técnica',
  'Obras e serviços de engenharia',
  'Pregão',
  'Dispensa de licitação',
  'Inexigibilidade',
  'Atestado de capacidade técnica',
  'Fiscalização',
  'Superfaturamento',
  'Declaração de inidoneidade',
  'Convênio',
  'Sobrepreço',
  'Proposta',
  'Contratação direta',
  'Registro de preços',
  'Concorrência',
  'Tomada de preços',
  'Terceirização',
  'Gestão contratual',
  'Termo de referência',
  'Estudo técnico preliminar',
  'Planilha de custos',
  'Aditivo contratual',
  'Garantia contratual',
  'Sanção administrativa',
  'Empresa estatal',
  'Finanças Públicas',
  'Prestação de contas',
  'Execução financeira',
  'Orçamento',
  'Obra pública',
  'Serviço de engenharia',
  'Projeto básico',
  'Projeto executivo',
  'Equilíbrio econômico-financeiro',
  'Reajuste',
  'Repactuação',
  'Subcontratação',
  'Consórcio',
]);

/** Verifica se um acórdão é relevante para licitações/contratos */
function isLicitacaoRelated(doc: { tags: string | null; courseId: string | null }): boolean {
  // Docs já mapeados a um curso são de licitações
  if (doc.courseId) return true;

  // Verificar se tem alguma tag relevante
  if (doc.tags) {
    try {
      const tags: string[] = JSON.parse(doc.tags);
      return tags.some(tag => TAGS_LICITACOES.has(tag));
    } catch {
      return false;
    }
  }

  return false;
}

// --- Helpers ---

/** Testa conexão com Gemini API */
async function testGeminiConnection(): Promise<boolean> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[ERRO] GEMINI_API_KEY não configurada em .env.local');
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
    console.error('[ERRO] Teste de conexão falhou:', error);
    return false;
  }
}

/** Delay helper */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Main ---

async function main() {
  console.log(`\n=== Indexação TCU → Lei 14.133 via Gemini ${DRY_RUN ? '(DRY RUN)' : ''} ===`);
  console.log(`Configuração: concurrency=${CONCURRENCY}, minConfidence=${MIN_CONFIDENCE}, delay=${DELAY_MS}ms`);
  if (LIMIT > 0) console.log(`Limite: ${LIMIT} documentos`);
  if (FORCE) console.log(`Modo FORCE: reprocessando todos os acórdãos`);
  if (ALL) console.log(`Modo ALL: processando TODOS os acórdãos (sem filtro por área)`);
  console.log('');

  // 1. Testar conexão Gemini
  console.log('[1/3] Testando conexão com Gemini...');
  const connected = await testGeminiConnection();
  if (!connected) {
    console.error('Falha na conexão com Gemini. Abortando.');
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log('  ✓ Gemini conectado\n');

  // 2. Buscar acórdãos
  console.log('[2/3] Buscando acórdãos TCU...');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { category: 'acordao' };

  if (!FORCE) {
    // Buscar apenas os que não têm leiArticles preenchido
    where.OR = [
      { leiArticles: null },
      { leiArticles: '' },
      { leiArticles: '[]' },
    ];
  }

  const allDocs = await prisma.document.findMany({
    where,
    select: {
      id: true,
      title: true,
      category: true,
      tags: true,
      content: true,
      description: true,
      leiArticles: true,
      courseId: true,
    },
    orderBy: { uploadedAt: 'asc' },
  });

  console.log(`  Total no banco: ${allDocs.length}`);

  // Filtrar por área (licitações/contratos) a menos que --all
  let docs = allDocs;
  if (!ALL) {
    docs = allDocs.filter(isLicitacaoRelated);
    const excluded = allDocs.length - docs.length;
    console.log(`  Filtrados (licitações/contratos): ${docs.length}`);
    console.log(`  Excluídos (Pessoal, RH, outros): ${excluded}`);
  }

  // Aplicar limit
  if (LIMIT > 0) {
    docs = docs.slice(0, LIMIT);
    console.log(`  Limitado a: ${docs.length}`);
  }

  if (docs.length === 0) {
    console.log('  Nenhum acórdão para processar. Concluído.');
    await prisma.$disconnect();
    return;
  }
  console.log('');

  // 3. Processar em batches com concurrency
  console.log(`[3/3] Processando ${docs.length} acórdãos (concurrency=${CONCURRENCY})...\n`);

  const allResults: ArticleAnalysisResult[] = [];
  let processed = 0;
  let updated = 0;
  let errors = 0;
  let skipped = 0;
  const startTime = Date.now();

  // Processar em grupos de CONCURRENCY
  for (let i = 0; i < docs.length; i += CONCURRENCY) {
    const batch = docs.slice(i, i + CONCURRENCY);

    const promises = batch.map(async (doc) => {
      try {
        const result = await LeiIndexer.analyzeDocument(doc, {
          minConfidence: MIN_CONFIDENCE,
          maxArticles: 10,
        });

        allResults.push(result);

        // Filtrar artigos com confiança mínima
        const articles = LeiIndexer.resultToLeiArticles(result);

        if (articles.length === 0) {
          skipped++;
          return;
        }

        const leiArticlesJson = JSON.stringify(articles);

        if (DRY_RUN) {
          console.log(`  [DRY] ${doc.title.substring(0, 80)}`);
          console.log(`         → Artigos: ${articles.join(', ')} (confiança: ${result.confidence}%)`);
        } else {
          await prisma.document.update({
            where: { id: doc.id },
            data: { leiArticles: leiArticlesJson },
          });
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

    // Progresso a cada 50 docs
    if (processed % 50 === 0 || processed === docs.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = (processed / ((Date.now() - startTime) / 1000)).toFixed(1);
      console.log(`  Progresso: ${processed}/${docs.length} (${elapsed}s, ${rate} docs/s)`);
    }

    // Delay entre batches para respeitar rate limits
    if (i + CONCURRENCY < docs.length) {
      await sleep(DELAY_MS);
    }
  }

  // 4. Estatísticas finais
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const stats = LeiIndexer.getBatchStats(allResults);

  console.log(`\n=== Resultado ${DRY_RUN ? '(DRY RUN - nada foi alterado)' : ''} ===`);
  console.log(`Tempo total: ${totalTime}s`);
  console.log(`Processados: ${processed}`);
  if (!DRY_RUN) console.log(`Atualizados: ${updated}`);
  console.log(`Sem artigos encontrados: ${skipped}`);
  console.log(`Erros: ${errors}`);
  console.log('');
  console.log(`--- Estatísticas de Indexação ---`);
  console.log(`Taxa de sucesso: ${stats.successRate}`);
  console.log(`Total de artigos encontrados: ${stats.totalArticlesFound}`);
  console.log(`Média de artigos/doc: ${stats.avgArticlesPerDoc}`);
  console.log(`Confiança média: ${stats.avgConfidence}`);

  if (stats.topArticles.length > 0) {
    console.log(`\nTop 10 artigos mais frequentes:`);
    stats.topArticles.forEach(({ article, count }) => {
      console.log(`  Art. ${article}: ${count} docs`);
    });
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
