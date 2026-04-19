/**
 * Normaliza o valor 'tic' para 'tecnologia-informacao' no campo themes
 * de LegislativeAct. Valor canônico da taxonomia é 'tecnologia-informacao'
 * (ver scripts/enrich-legislative-acts-themes.ts TEMAS_LICITACOES).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/normalize-theme-tic.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/normalize-theme-tic.ts --dry-run
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Substitui 'tic' por 'tecnologia-informacao' preservando ordem, deduplicando.
 * Pura, exportada para testes.
 */
export function normalizeThemeTic(themes: string[]): string[] {
  const out: string[] = [];
  for (const t of themes) {
    const normalized = t === 'tic' ? 'tecnologia-informacao' : t;
    if (!out.includes(normalized)) out.push(normalized);
  }
  return out;
}

async function main() {
  const acts = await prisma.legislativeAct.findMany({
    where: { themes: { not: null } },
    select: { id: true, fullNumber: true, themes: true },
  });

  let changedCount = 0;
  for (const act of acts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(act.themes!);
    } catch {
      console.log(`  ⚠ ${act.fullNumber}: themes não é JSON válido: ${act.themes}`);
      continue;
    }
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
      console.log(`  ⚠ ${act.fullNumber}: themes não é array de strings: ${act.themes}`);
      continue;
    }
    const themes = parsed as string[];
    if (!themes.includes('tic')) continue;

    const normalized = normalizeThemeTic(themes);
    const newJson = JSON.stringify(normalized);
    console.log(`  ${DRY_RUN ? '[dry-run]' : '✓'} ${act.fullNumber}:`);
    console.log(`      ${act.themes}`);
    console.log(`      → ${newJson}`);

    if (!DRY_RUN) {
      await prisma.legislativeAct.update({
        where: { id: act.id },
        data: { themes: newJson },
      });
    }
    changedCount++;
  }

  console.log(`\nResumo: ${changedCount} atos ${DRY_RUN ? 'seriam' : 'foram'} normalizados.`);
}

main()
  .catch((err) => {
    console.error('ERRO:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
