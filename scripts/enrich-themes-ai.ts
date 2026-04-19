/**
 * Classificador de temas via LLM para atos normativos que não foram cobertos
 * pela heurística (scripts/enrich-legislative-acts-themes.ts).
 *
 * Delega para lib/legislative-scrapers/theme-enricher#classifyByAi (também
 * usado pelo cron /api/cron/enrich-themes).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/enrich-themes-ai.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/enrich-themes-ai.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/enrich-themes-ai.ts --limit=3
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { classifyByAi } from '@/lib/legislative-scrapers/theme-enricher';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Number.POSITIVE_INFINITY;

const DELAY_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const targets = await prisma.legislativeAct.findMany({
    where: { themes: null },
    select: { id: true, fullNumber: true, title: true, ementa: true, leiArticles: true, content: true },
  });
  const toProcess = targets.slice(0, LIMIT);
  console.log(`Encontrados ${targets.length} atos sem themes.`);
  console.log(`Processando ${toProcess.length} (limit=${LIMIT}, dry-run=${DRY_RUN})\n`);

  let ok = 0;
  let invalid = 0;
  let empty = 0;
  let error = 0;
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const act = toProcess[i];
    console.log(`[${i + 1}/${toProcess.length}] ${act.fullNumber}`);

    const result = await classifyByAi(act);
    totalInput += result.tokens?.input ?? 0;
    totalOutput += result.tokens?.output ?? 0;

    if (!result.ok) {
      const isApiError = result.reason && /\d{3}|rate|quota|credit|api/i.test(result.reason);
      if (isApiError) {
        error++;
        console.log(`  ✗ erro API: ${result.reason}`);
      } else {
        invalid++;
        console.log(`  ✗ resposta inválida: ${result.reason}`);
      }
    } else if (result.themes.length === 0) {
      empty++;
      console.log(`  = themes vazio (AI decidiu que nenhum tema canônico serve)`);
    } else {
      console.log(`  ✓ themes: ${JSON.stringify(result.themes)}`);
      if (!DRY_RUN) {
        await prisma.legislativeAct.update({
          where: { id: act.id },
          data: { themes: JSON.stringify(result.themes) },
        });
      }
      ok++;
    }

    if (i < toProcess.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n=== Resumo ===`);
  console.log(`Sucesso (themes gravados): ${ok}`);
  console.log(`Pulados por resposta inválida: ${invalid}`);
  console.log(`Pulados por themes vazio: ${empty}`);
  console.log(`Pulados por erro de API: ${error}`);
  console.log(`Tokens: input=${totalInput}, output=${totalOutput}`);
  if (DRY_RUN) console.log(`\n(dry-run — nada gravado no banco)`);
}

main()
  .catch((err) => {
    console.error('ERRO:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
