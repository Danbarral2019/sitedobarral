/**
 * Refresh dos excerpts obsoletos das `LegislativeActRelation`.
 *
 * Problema: 112 de 177 relações (63%) têm `excerpt` que não casa mais com o
 * texto atual do source (ementa + content). O cron semanal re-scrapeia o ato e
 * o trecho salvo vira texto fantasma — ruim pra UI ("este ato altera X porque
 * diz '...trecho que não existe mais...'").
 *
 * Estratégia: pra cada relação stale, rodar `detectAmendments` no texto atual
 * do source e procurar a detecção que casa pelo mesmo `(relationType, target)`.
 * Se achar, atualiza o excerpt. Se não achar, marca metadata via campo
 * `excerpt` prefixado com `[ORPHAN]` (cron não conseguiu re-detectar — pode
 * ser que o ato foi reescrito e a menção sumiu, ou que a detecção original
 * já era frágil).
 *
 * IMPORTANTE: não cria nem deleta relações. Só atualiza `excerpt`. Em caso de
 * ORPHAN, não rejeita a relação — deixa a critério do admin via fila.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/refresh-relation-excerpts.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/refresh-relation-excerpts.ts --apply
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { detectAmendments } from '../lib/legislative-acts/amendment-detector';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Parseia um fullNumber em chave (type|number|year) ignorando issuer.
 * Detector produz "IN 190/2024" mas DB tem "IN SEGES/MGI 190/2024" — ambos
 * devem casar como mesmo target.
 *
 * Retorna null se não conseguir parsear.
 */
function parseKey(fullNumber: string): string | null {
  // "Lei 14.133/2021" | "Decreto 7.892/2013" | "IN SEGES/MGI 81/2024" | "Portaria SGD/MGI nº 750/2023"
  const m = fullNumber.match(/^(Lei|Decreto|MP|IN|Portaria)\s+(?:[A-Za-zÀ-ÿ./\-]+\s+)?(?:n[ºo°.]?\s*)?([\d.]+)\/(\d{2,4})$/);
  if (!m) return null;
  const [, prefix, num, year] = m;
  return `${prefix}|${num.replace(/\.$/, '')}|${year}`;
}

async function main() {
  console.log(`\n=== Refresh de excerpts ${APPLY ? '[APPLY]' : '[DRY-RUN]'} ===\n`);

  const relations = await prisma.legislativeActRelation.findMany({
    where: { reviewStatus: { in: ['pending', 'confirmed'] } },
    include: {
      sourceAct: { select: { id: true, fullNumber: true, ementa: true, content: true } },
      targetAct: { select: { fullNumber: true } },
    },
  });

  console.log(`Relações a verificar (pending+confirmed): ${relations.length}\n`);

  let staleCount = 0;
  let refreshed = 0;
  let orphan = 0;
  let updates: Array<{ id: string; label: string; old: string; next: string }> = [];

  for (const r of relations) {
    if (!r.excerpt || r.excerpt.length < 20) continue;

    const haystack = norm((r.sourceAct.ementa || '') + '\n' + (r.sourceAct.content || ''));
    if (haystack.includes(norm(r.excerpt))) continue; // excerpt OK
    staleCount++;

    // Re-detecta no texto atual
    const detected = detectAmendments(r.sourceAct.ementa || '', r.sourceAct.content || '');
    const targetKey = parseKey(r.targetAct.fullNumber);

    // Procura match por (relationType, target-parsed-key). Match flexível: ignora issuer.
    const match = detected.find((d) => {
      if (d.relationType !== r.relationType) return false;
      const dKey = parseKey(d.targetFullNumber);
      return dKey !== null && dKey === targetKey;
    });

    const label = `${r.sourceAct.fullNumber} → ${r.relationType} → ${r.targetAct.fullNumber}`;

    if (match) {
      refreshed++;
      const next = match.excerpt;
      if (next !== r.excerpt) {
        updates.push({ id: r.id, label, old: r.excerpt.slice(0, 80), next: next.slice(0, 80) });
      }
    } else {
      orphan++;
      // NÃO atualiza excerpt — preserva o original. Reporta pra revisão admin.
    }
  }

  console.log(`Stale (excerpt não casa): ${staleCount}`);
  console.log(`Refreshed (re-detectado): ${refreshed}`);
  console.log(`Orphan (não re-detectado): ${orphan}\n`);

  if (updates.length === 0) {
    console.log('✅ Nada a atualizar.');
    await prisma.$disconnect();
    return;
  }

  console.log('Amostra (até 10):');
  for (const u of updates.slice(0, 10)) {
    console.log(`  ${u.label}`);
    console.log(`    old:  "${u.old}${u.old.length >= 80 ? '...' : ''}"`);
    console.log(`    new:  "${u.next}${u.next.length >= 80 ? '...' : ''}"`);
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Rode com --apply para atualizar ${updates.length} relações.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\nAplicando ${updates.length} updates...`);
  let ok = 0;
  for (const u of updates) {
    const r = await prisma.legislativeActRelation.findUnique({
      where: { id: u.id },
      include: {
        sourceAct: { select: { ementa: true, content: true } },
        targetAct: { select: { fullNumber: true } },
      },
    });
    if (!r) continue;

    const detected = detectAmendments(r.sourceAct.ementa || '', r.sourceAct.content || '');
    const targetKey = parseKey(r.targetAct.fullNumber);
    const match = detected.find((d) => {
      if (d.relationType !== r.relationType) return false;
      const dKey = parseKey(d.targetFullNumber);
      return dKey !== null && dKey === targetKey;
    });
    if (!match) continue; // edge case

    await prisma.legislativeActRelation.update({
      where: { id: u.id },
      data: { excerpt: match.excerpt },
    });
    ok++;
    if (ok % 30 === 0) console.log(`  ${ok}/${updates.length}...`);
  }
  console.log(`\n✅ ${ok} relação(ões) com excerpt atualizado.`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
