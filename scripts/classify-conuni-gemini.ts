/**
 * CLI wrapper do classify CONUNI. Lógica vive em lib/conuni-classify.ts
 * (compartilhada com o cron Vercel /api/cron/classify-conuni).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/classify-conuni-gemini.ts                       # dry-run, primeiros 5
 *   npx dotenv -e .env.local -- npx tsx scripts/classify-conuni-gemini.ts --apply --limit=50    # batch piloto
 *   npx dotenv -e .env.local -- npx tsx scripts/classify-conuni-gemini.ts --apply               # full run
 */

import { GoogleGenAI } from '@google/genai';
import { prisma } from '../lib/prisma';
import { PRIMARY_GEMINI_MODEL } from '../lib/gemini/config';
import { classifyOne, classifyPendingPareceres } from '../lib/conuni-classify';

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : APPLY ? Infinity : 5;

async function main() {
  const tag = APPLY ? '[APPLY]' : '[DRY-RUN]';
  console.log(`${tag} Classificando pareceres via Gemini (modelo: ${PRIMARY_GEMINI_MODEL})\n`);

  if (APPLY) {
    const result = await classifyPendingPareceres(prisma, {
      limit: isFinite(LIMIT) ? LIMIT : undefined,
      delayMs: 200,
      logger: (msg) => console.log(msg),
    });
    console.log('\n=== Resultado ===');
    console.log(JSON.stringify(result, null, 2));
    await prisma.$disconnect();
    return;
  }

  // Dry-run: classify sem persistir, só pra calibrar prompt
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado');
  const genAI = new GoogleGenAI({ apiKey });

  const candidates = await prisma.document.findMany({
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'nota-tecnica', 'despacho', 'decor'] },
      isPublic: true,
      AND: [
        { NOT: { aiClassification: { contains: 'licitacoesContratos' } } },
        { NOT: { aiClassification: { contains: 'licitacoesContratosManualBy' } } },
      ],
    },
    select: { id: true, title: true, description: true, content: true, category: true },
    orderBy: { uploadedAt: 'desc' },
    take: isFinite(LIMIT) ? LIMIT : 5,
  });

  console.log(`Documentos a classificar (dry-run): ${candidates.length}\n`);

  for (let i = 0; i < candidates.length; i++) {
    const doc = candidates[i];
    process.stdout.write(`[${i + 1}/${candidates.length}] [${doc.category}] ${doc.title.slice(0, 70)}... `);
    try {
      const cls = await classifyOne(genAI, doc);
      const flag = cls.licitacoesContratos ? '✓' : '✗';
      const cursos = cls.cursosRelevantes.length > 0 ? ` cursos=[${cls.cursosRelevantes.join(',')}]` : '';
      const arts = cls.leiArticles.length > 0 ? ` arts=[${cls.leiArticles.slice(0, 3).join(',')}]` : '';
      console.log(`${flag} (${cls.confidence})${cursos}${arts}`);
      console.log(`     subtemas: [${cls.subtemas.join(', ')}]`);
      console.log(`     reasoning: ${cls.reasoning}`);
    } catch (e) {
      console.log(`✗ ERRO: ${(e as Error).message}`);
    }
    if (i < candidates.length - 1) await new Promise((r) => setTimeout(r, 200));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
