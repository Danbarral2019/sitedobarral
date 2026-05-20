/**
 * Script para enriquecer LegislativeActs existentes com temas e esfera
 *
 * Para cada ato com themes === null:
 * 1. Parseia leiArticles JSON
 * 2. Mapeia artigos → temas usando TEMAS_LICITACOES
 * 3. Fallback: keyword matching na ementa/title
 * 4. Seta esfera = 'federal' (todos os 53 são federais)
 * 5. Seta themes = JSON.stringify([...])
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/enrich-legislative-acts-themes.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/enrich-legislative-acts-themes.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/enrich-legislative-acts-themes.ts --force
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { classifyByHeuristic } from '@/lib/legislative-scrapers/theme-enricher';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  console.log('=== Enriquecimento de Atos Normativos com Temas ===');
  console.log(`Modo: ${dryRun ? 'DRY RUN (sem alterações)' : 'PRODUÇÃO'}`);
  console.log(`Force: ${force ? 'Sim (reprocessar todos)' : 'Não (apenas sem temas)'}`);
  console.log('');

  const whereClause = force ? {} : { themes: null };
  const acts = await prisma.legislativeAct.findMany({
    where: whereClause,
    select: {
      id: true,
      fullNumber: true,
      title: true,
      ementa: true,
      leiArticles: true, leiArticlesArr: true,
      esfera: true,
      themes: true,
    },
  });

  console.log(`Encontrados: ${acts.length} atos para processar`);
  console.log('');

  let updated = 0;
  let skipped = 0;

  for (const act of acts) {
    const allThemes = classifyByHeuristic(act);

    if (allThemes.length === 0) {
      console.log(`  SKIP: ${act.fullNumber} — nenhum tema detectado`);
      skipped++;
      continue;
    }

    console.log(`  ${act.fullNumber}: ${JSON.stringify(allThemes)}`);

    if (!dryRun) {
      await prisma.legislativeAct.update({
        where: { id: act.id },
        data: {
          themes: JSON.stringify(allThemes),
          esfera: act.esfera || 'federal',
        },
      });
    }

    updated++;
  }

  console.log('');
  console.log('=== Resultado ===');
  console.log(`Processados: ${updated}`);
  console.log(`Sem temas detectados: ${skipped}`);
  console.log(`Total: ${acts.length}`);

  if (dryRun) {
    console.log('\n(Nenhuma alteração feita — modo dry-run)');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
