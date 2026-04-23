/**
 * Melhoria em lote de LegislativeAct.summary via Gemini.
 *
 * Esta tabela é separada de Document (ver prisma/schema.prisma) e concentra
 * os atos normativos federais de hierarquia formal (leis, decretos, INs,
 * portarias, ordens de serviço) ligados à Lei 14.133/2021.
 *
 * Uso:
 *   npx tsx scripts/improve-legislative-acts.ts --dry-run
 *   npx tsx scripts/improve-legislative-acts.ts --limit 5 --force
 *   npx tsx scripts/improve-legislative-acts.ts --force              # reprocessa todos (~108)
 */

import { prisma } from '../lib/prisma';
import { buildLegislativeActPrompt, callGemini } from '../lib/document-enrichment';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

function getArgValue(flag: string, defaultValue: number): number {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10);
    return isNaN(n) ? defaultValue : n;
  }
  return defaultValue;
}

const LIMIT = getArgValue('--limit', 0);
const CONCURRENCY = getArgValue('--concurrency', 3);
const CHUNK_DELAY_MS = 200;

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  IMPROVE LEGISLATIVE ACTS — gemini-2.5-flash                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY não configurada.');
    process.exit(1);
  }

  if (DRY_RUN) console.log('🔍 MODO DRY-RUN: nenhuma alteração será feita\n');

  const where = FORCE ? {} : { summary: null };

  let acts = await prisma.legislativeAct.findMany({
    where,
    select: {
      id: true,
      type: true,
      number: true,
      year: true,
      title: true,
      ementa: true,
      content: true,
      issuer: true,
      leiArticles: true,
      themes: true,
    },
    orderBy: { publishDate: 'desc' },
  });

  if (LIMIT > 0) acts = acts.slice(0, LIMIT);

  console.log(`📊 Atos legislativos a processar: ${acts.length}${FORCE ? ' (--force)' : ' (sem summary)'}`);
  if (LIMIT > 0) console.log(`   (limitado a ${LIMIT})`);
  console.log(`   Concurrency: ${CONCURRENCY}\n`);

  if (acts.length === 0) {
    console.log('✅ Nada a fazer.');
    return;
  }

  const chunks: (typeof acts)[] = [];
  for (let i = 0; i < acts.length; i += CONCURRENCY) {
    chunks.push(acts.slice(i, i + CONCURRENCY));
  }

  let processed = 0;
  let success = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (act, idx) => {
        if (idx > 0) await new Promise(r => setTimeout(r, CHUNK_DELAY_MS * idx));
        const prompt = buildLegislativeActPrompt(act);
        const summary = await callGemini(prompt);
        return { act, summary };
      })
    );

    for (const result of results) {
      processed++;
      const progress = `[${processed}/${acts.length}]`;

      if (result.status === 'fulfilled') {
        const { act, summary } = result.value;
        const label = `${act.type} ${act.number}/${act.year}`;
        if (DRY_RUN) {
          success++;
          if (success <= 5) {
            console.log(`${progress} 📝 ${label} — ${act.title.slice(0, 60)}`);
            console.log(`         → ${summary.slice(0, 200)}${summary.length > 200 ? '…' : ''}\n`);
          }
        } else {
          try {
            await prisma.legislativeAct.update({
              where: { id: act.id },
              data: { summary },
            });
            success++;
            if (success <= 10 || success % 25 === 0) {
              console.log(`${progress} ✓ ${label}`);
            }
          } catch (err) {
            errors++;
            console.error(`${progress} ✗ Erro ao salvar ${label}:`, err instanceof Error ? err.message : err);
          }
        }
      } else {
        errors++;
        const reason = (result.reason instanceof Error ? result.reason.message : String(result.reason)).slice(0, 200);
        console.error(`${progress} ✗ Erro Gemini:`, reason);
      }
    }

    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
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
}

main()
  .catch(err => { console.error('❌ Erro fatal:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
