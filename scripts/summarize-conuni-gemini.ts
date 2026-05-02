/**
 * CLI wrapper do summarize CONUNI. Lógica em lib/conuni-summary.ts.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/summarize-conuni-gemini.ts --apply              # full run
 *   npx dotenv -e .env.local -- npx tsx scripts/summarize-conuni-gemini.ts --apply --limit=20
 */

import { prisma } from '../lib/prisma';
import { PRIMARY_GEMINI_MODEL } from '../lib/gemini/config';
import { summarizeRelevantPareceres } from '../lib/conuni-summary';

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : APPLY ? Infinity : 5;

async function main() {
  console.log(`[${APPLY ? 'APPLY' : 'DRY-RUN'}] Resumindo pareceres via Gemini (${PRIMARY_GEMINI_MODEL})\n`);

  if (!APPLY) {
    const c = await prisma.document.count({
      where: {
        category: { in: ['parecer', 'parecer-vinculante', 'nota-tecnica', 'despacho', 'decor'] },
        isPublic: true,
        AND: [
          { aiClassification: { contains: '"licitacoesContratos":true' } },
          { NOT: { aiClassification: { contains: '"summary"' } } },
        ],
      },
    });
    console.log(`Pareceres relevantes sem summary: ${c}`);
    console.log(`Use --apply pra gerar resumos.`);
    await prisma.$disconnect();
    return;
  }

  const result = await summarizeRelevantPareceres(prisma, {
    limit: isFinite(LIMIT) ? LIMIT : undefined,
    delayMs: 200,
    logger: (msg) => console.log(msg),
  });
  console.log('\n=== Resultado ===');
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
