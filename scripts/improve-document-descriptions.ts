/**
 * Melhoria em lote de Document.summary para qualquer categoria que não seja 'acordao'.
 *
 * Para 'acordao' (TCU), usar `scripts/improve-tcu-descriptions.ts`, que tem
 * prompt especializado em dados de `metaTcu` (ementa completa, área, tema,
 * subtema, colegiado).
 *
 * Uso:
 *   npx tsx scripts/improve-document-descriptions.ts --category orientacao-normativa --dry-run
 *   npx tsx scripts/improve-document-descriptions.ts --category informativo --limit 5 --force
 *   npx tsx scripts/improve-document-descriptions.ts --category decor                  # todos
 *   npx tsx scripts/improve-document-descriptions.ts --all                             # todas as categorias (exceto acordao)
 *
 * Flags:
 *   --category <slug>      Filtra por Document.category. Obrigatório se não usar --all.
 *   --all                  Processa todas as categorias exceto 'acordao' e 'bibliografia'.
 *   --limit <N>            Processa no máximo N documentos (útil em smoke test).
 *   --force                Reprocessa mesmo quem já tem summary (overwrite).
 *   --concurrency <N>      Requests Gemini paralelos (default 3).
 *   --dry-run              Gera resumos mas não escreve no banco.
 */

import { prisma } from '../lib/prisma';
import { buildGenericSummaryPrompt, callGemini } from '../lib/document-enrichment';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const ALL = args.includes('--all');

function getArgValue(flag: string, defaultValue: number): number {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10);
    return isNaN(n) ? defaultValue : n;
  }
  return defaultValue;
}

function getArgString(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

const LIMIT = getArgValue('--limit', 0);
const CONCURRENCY = getArgValue('--concurrency', 3);
const CHUNK_DELAY_MS = 200;
const CATEGORY = getArgString('--category');

// Categorias cobertas pelo script TCU-específico — ignorar aqui.
const SKIP_CATEGORIES = new Set(['acordao']);

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║    IMPROVE DOCUMENT DESCRIPTIONS — gemini-2.5-flash         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY não configurada. Defina em .env.local');
    process.exit(1);
  }

  if (!CATEGORY && !ALL) {
    console.error('❌ Passe --category <slug> ou --all');
    console.error('   Categorias conhecidas (ver inventory-documents-by-category.ts):');
    console.error('   informativo, lei-artigo, decor, manual-tcu, orientacao-normativa,');
    console.error('   consulta_tcu, enunciados, orientacao_procedimento, ato-normativo,');
    console.error('   sumula, parecer-vinculante, parecer, boa_pratica, outro');
    process.exit(1);
  }

  if (DRY_RUN) console.log('🔍 MODO DRY-RUN: nenhuma alteração será feita\n');

  const baseWhere = CATEGORY
    ? { category: CATEGORY }
    : { category: { notIn: [...SKIP_CATEGORIES] } };

  const whereCondition = FORCE
    ? baseWhere
    : { ...baseWhere, summary: null };

  let docs = await prisma.document.findMany({
    where: whereCondition,
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      category: true,
      tags: true,
      leiArticles: true, leiArticlesArr: true,
      issuerOrg: true,
      themes: true,
      entityType: true,
      enunciadoNumber: true,
      onNumber: true,
      onYear: true,
    },
    orderBy: { uploadedAt: 'desc' },
  });

  if (LIMIT > 0) docs = docs.slice(0, LIMIT);

  console.log(`📊 Documentos a processar: ${docs.length}${FORCE ? ' (--force: reprocessando todos)' : ''}`);
  if (LIMIT > 0) console.log(`   (limitado a ${LIMIT})`);
  console.log(`   Categoria: ${CATEGORY ?? 'todas (exceto acordao)'}`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log('');

  if (docs.length === 0) {
    console.log('✅ Nada a fazer — nenhum documento se enquadra no filtro.');
    return;
  }

  const chunks: (typeof docs)[] = [];
  for (let i = 0; i < docs.length; i += CONCURRENCY) {
    chunks.push(docs.slice(i, i + CONCURRENCY));
  }

  let processed = 0;
  let success = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (doc, idx) => {
        if (idx > 0) {
          await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS * idx));
        }
        const prompt = buildGenericSummaryPrompt(doc);
        const summary = await callGemini(prompt);
        return { doc, summary };
      })
    );

    for (const result of results) {
      processed++;
      const progress = `[${processed}/${docs.length}]`;

      if (result.status === 'fulfilled') {
        const { doc, summary } = result.value;
        if (DRY_RUN) {
          success++;
          if (success <= 5 || success % 50 === 0) {
            console.log(`${progress} 📝 ${doc.title.slice(0, 70)}`);
            console.log(`         → ${summary.slice(0, 180)}${summary.length > 180 ? '…' : ''}`);
            console.log('');
          }
        } else {
          try {
            await prisma.document.update({
              where: { id: doc.id },
              data: {
                summary,
                description: summary,
                summaryGeneratedAt: new Date(),
                embeddingStatus: 'pending',
              },
            });
            success++;
            if (success <= 10 || success % 50 === 0) {
              console.log(`${progress} ✓ ${doc.title.slice(0, 70)}`);
            }
          } catch (err) {
            errors++;
            console.error(`${progress} ✗ Erro ao salvar ${doc.title.slice(0, 70)}:`, err instanceof Error ? err.message : err);
          }
        }
      } else {
        errors++;
        const reason = (result.reason instanceof Error ? result.reason.message : String(result.reason)).slice(0, 200);
        console.error(`${progress} ✗ Erro Gemini:`, reason);
      }
    }

    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      RESULTADO                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`   Total processados: ${processed}`);
  console.log(`   Resumos gerados: ${success}`);
  console.log(`   Erros: ${errors}`);
  console.log(`   Tempo: ${elapsed}s`);
  console.log('');

  if (DRY_RUN) {
    console.log('💡 Execute sem --dry-run para aplicar as mudanças.');
  } else if (success > 0) {
    console.log(`💡 ${success} documentos atualizados (embeddingStatus=pending).`);
    console.log('   Execute "npx tsx scripts/migrate-to-embeddings.ts" para re-indexar.');
  }
}

main()
  .catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
