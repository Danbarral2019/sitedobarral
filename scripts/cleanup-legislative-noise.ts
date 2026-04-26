/**
 * Limpeza one-shot dos atos legislativos no DB.
 *
 * 1. Zera `annexesJson` em TODOS os atos. O campo era populado por um script
 *    deprecado (`scrape-legislative-acts-content.ts`) que extraía a sidebar de
 *    "Conteúdos relacionados" do gov.br/compras como anexos — todos os atos
 *    ficavam com o mesmo conjunto de "anexos" (Guia do Fornecedor, Plano
 *    Diretor de Logística, etc.) que NÃO são anexos do ato. Pipeline atual
 *    não popula esse campo. Limpar é seguro.
 *
 * 2. Aplica `stripGovbrUiNoise` no `content` existente dos atos vindos de
 *    gov.br (corta "Info" do topo e "Compartilhe: ..." do final). Evita ter
 *    que re-scrape tudo só pra limpar lixo de UI já presente.
 *
 * 3. Aplica normalização de pontilhados (`\.{6,}` → `[...]`) em atos do
 *    Planalto que já estão no DB.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/cleanup-legislative-noise.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/cleanup-legislative-noise.ts
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { stripGovbrUiNoise } from '../lib/legislative-scrapers/normalize';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');

function normalizePontilhados(s: string): string {
  return s.replace(/(?:\s*\.\s*){6,}/g, ' [...] ');
}

function isGovbrUrl(url: string | null): boolean {
  if (!url) return false;
  return /(?:gov\.br\/(?:compras|gestao|mgi|seges|governodigital))/i.test(url);
}

function isPlanaltoUrl(url: string | null): boolean {
  if (!url) return false;
  return /planalto\.gov\.br/i.test(url);
}

async function main() {
  console.log(`\n=== Cleanup de ruído ${DRY_RUN ? '[DRY-RUN]' : '[EXEC]'} ===\n`);

  // Stage 1: zerar annexesJson
  const withAnnex = await prisma.legislativeAct.count({ where: { annexesJson: { not: null } } });
  console.log(`[Stage 1] Atos com annexesJson populado (lixo): ${withAnnex}`);
  if (!DRY_RUN && withAnnex > 0) {
    const r = await prisma.legislativeAct.updateMany({
      where: { annexesJson: { not: null } },
      data: { annexesJson: null },
    });
    console.log(`[Stage 1] Zerado em ${r.count} atos`);
  }

  // Stage 2 + 3: limpar content
  const acts = await prisma.legislativeAct.findMany({
    where: { content: { not: null } },
    select: { id: true, fullNumber: true, officialUrl: true, content: true },
  });
  console.log(`\n[Stage 2+3] Atos com content (candidatos a cleanup): ${acts.length}`);

  let stage2Changed = 0;
  let stage3Changed = 0;

  for (const act of acts) {
    let newContent = act.content!;
    let changed = false;
    let stage2 = false;
    let stage3 = false;

    // Stage 2: gov.br/compras → strip UI noise
    if (isGovbrUrl(act.officialUrl)) {
      const after = stripGovbrUiNoise(newContent);
      if (after !== newContent) {
        newContent = after;
        changed = true;
        stage2 = true;
      }
    }

    // Stage 3: planalto → normalizar pontilhados
    if (isPlanaltoUrl(act.officialUrl)) {
      const after = normalizePontilhados(newContent);
      if (after !== newContent) {
        newContent = after;
        changed = true;
        stage3 = true;
      }
    }

    if (!changed) continue;
    if (stage2) stage2Changed++;
    if (stage3) stage3Changed++;

    const tag = stage2 && stage3 ? '[both]' : stage2 ? '[gov.br]' : '[planalto]';
    const delta = newContent.length - act.content!.length;
    const sign = delta < 0 ? '-' : '+';
    console.log(`  ${tag.padEnd(11)} ${act.fullNumber.padEnd(38)} ${sign}${Math.abs(delta)} chars`);

    if (!DRY_RUN) {
      await prisma.legislativeAct.update({
        where: { id: act.id },
        data: { content: newContent },
      });
    }
  }

  console.log(`\n=== Sumário ===`);
  console.log(`  annexesJson zerados:                  ${DRY_RUN ? '(simulado) ' : ''}${withAnnex}`);
  console.log(`  Stage 2 (gov.br UI noise removido):   ${stage2Changed}`);
  console.log(`  Stage 3 (planalto pontilhados):       ${stage3Changed}`);

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
