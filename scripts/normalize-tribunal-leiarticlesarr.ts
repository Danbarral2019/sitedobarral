/**
 * Saneia `TribunalDecision.leiArticlesArr` para o formato canônico do índice
 * `data/lei-14133-artigos.ts` (número puro, ex: "75", "166-A").
 *
 * Bug: `lib/tribunal-scrapers/classifier.ts` gravava "Art. 75" (prefixado),
 * quebrando o cruzamento decisão↔artigo (`unified-query.ts`, `semantic-adapter.ts`,
 * `admin/tribunal-decisions/route.ts` filtram por número puro). O classifier já
 * foi corrigido; este script sane­ia os dados existentes. Os scripts anteriores
 * (`normalize-tribunal-lei-articles.ts`, `fix-tribunal-decision-leiarticles.ts`)
 * operavam no campo JSON `leiArticles`, dropado na Onda 4.5.6 — não servem mais.
 *
 * Estratégia: para cada valor, extrai o primeiro número (com sufixo -A opcional),
 * remove zeros à esquerda, e mantém APENAS os que existem em LEI_14133_ARTIGOS.
 * Valores que não casam são descartados (refs inválidas) e reportados.
 *
 * Backup do estado anterior em docs/audits/tribunal-leiarticlesarr-backup-<data>.json.
 * Dry-run por padrão; --apply grava.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/normalize-tribunal-leiarticlesarr.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/normalize-tribunal-leiarticlesarr.ts --apply
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { writeFileSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { LEI_14133_ARTIGOS } from '../data/lei-14133-artigos';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const APPLY = process.argv.includes('--apply');
const VALID = new Set(Object.keys(LEI_14133_ARTIGOS));

/** "Art. 75" | "art.30" | "166-A" → "75" | "30" | "166-A" (ou null se inválido) */
export function canonArticle(raw: string): string | null {
  const m = raw.match(/(\d{1,3})(-[A-Za-z])?/);
  if (!m) return null;
  const num = m[1].replace(/^0+(?=\d)/, '') + (m[2] ? m[2].toUpperCase() : '');
  return VALID.has(num) ? num : null;
}

async function main() {
  console.log(`\n=== Saneamento TribunalDecision.leiArticlesArr ${APPLY ? '[APPLY]' : '[DRY-RUN]'} ===\n`);
  const decisions = await prisma.tribunalDecision.findMany({
    where: { leiArticlesArr: { isEmpty: false } },
    select: { id: true, tribunalCode: true, decisionNumber: true, leiArticlesArr: true },
  });

  const backup: Record<string, string[]> = {};
  const diffs: { id: string; label: string; before: string[]; after: string[]; dropped: string[] }[] = [];
  const droppedGlobal = new Map<string, number>();

  for (const d of decisions) {
    backup[d.id] = d.leiArticlesArr;
    const seen = new Set<string>();
    const dropped: string[] = [];
    for (const raw of d.leiArticlesArr) {
      const c = canonArticle(raw);
      if (c) seen.add(c);
      else { dropped.push(raw); droppedGlobal.set(raw, (droppedGlobal.get(raw) ?? 0) + 1); }
    }
    const after = [...seen].sort((a, b) => parseInt(a) - parseInt(b));
    const changed = after.length !== d.leiArticlesArr.length || after.some((v, i) => v !== d.leiArticlesArr[i]);
    if (changed) diffs.push({ id: d.id, label: `${d.tribunalCode} ${d.decisionNumber}`, before: d.leiArticlesArr, after, dropped });
  }

  console.log(`Decisões com leiArticlesArr: ${decisions.length}`);
  console.log(`Precisam saneamento: ${diffs.length}`);
  console.log(`Valores descartados (não casam com a Lei 14.133 após limpeza): ${[...droppedGlobal.values()].reduce((a, b) => a + b, 0)} (${droppedGlobal.size} distintos)`);
  if (droppedGlobal.size) {
    console.log('  Top descartados:');
    [...droppedGlobal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([v, n]) => console.log(`    "${v}" ×${n}`));
  }
  console.log('\n  Amostra de mudanças (5):');
  diffs.slice(0, 5).forEach((d) => console.log(`    ${d.label}: [${d.before.join(', ')}] → [${d.after.join(', ')}]`));

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Rode com --apply para gravar ${diffs.length} mudanças (backup será criado antes).`);
    await prisma.$disconnect();
    return;
  }

  mkdirSync('docs/audits', { recursive: true });
  const backupPath = `docs/audits/tribunal-leiarticlesarr-backup-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\n🔒 Backup: ${backupPath}`);

  let n = 0;
  for (const d of diffs) {
    await prisma.tribunalDecision.update({ where: { id: d.id }, data: { leiArticlesArr: d.after } });
    if (++n % 100 === 0) console.log(`  ${n}/${diffs.length}...`);
  }
  console.log(`\n✅ ${n} decisões saneadas.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
