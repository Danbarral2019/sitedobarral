/**
 * Lista os atos referenciados que ainda NÃO existem no DB.
 *
 * Roda detectAmendments em (ementa + content) de todos os LegislativeAct
 * existentes e, para cada targetFullNumber detectado, verifica se o ato-alvo
 * existe. Os que NÃO existem são "órfãos de relação" — referências sem destino.
 *
 * Imprime ranking dos órfãos mais citados e salva um JSON detalhado em
 * docs/audits/orphan-relations-{AAAA-MM-DD}.json para inspeção manual.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/list-orphan-relations.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/list-orphan-relations.ts --top 20
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { detectAmendments } from '../lib/legislative-acts/amendment-detector';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const topArgIdx = args.indexOf('--top');
const TOP = topArgIdx >= 0 ? parseInt(args[topArgIdx + 1] ?? '20', 10) : 20;

interface OrphanReference {
  count: number;
  citedBy: string[]; // fullNumber dos atos que citam
  relationTypes: string[]; // tipos de relação detectados
}

async function resolveTargetActId(
  fullNumber: string,
): Promise<string | null> {
  // Mesma lógica de lib/legislative-acts/relations.ts:resolveTargetActId
  const exact = await prisma.legislativeAct.findUnique({
    where: { fullNumber },
    select: { id: true },
  });
  if (exact) return exact.id;

  const candidates = await prisma.legislativeAct.findMany({
    where: { fullNumber: { contains: fullNumber.split(' ').pop() ?? fullNumber } },
    select: { id: true, fullNumber: true },
    take: 5,
  });
  // Match flexível: número e ano coincidem
  const numYearMatch = fullNumber.match(/(\d+)\/(\d{4})$/);
  if (numYearMatch) {
    const [, num, year] = numYearMatch;
    const found = candidates.find((c) =>
      c.fullNumber.includes(num) && c.fullNumber.includes(year),
    );
    return found?.id ?? null;
  }
  return null;
}

async function main() {
  console.log('\n=== Listando órfãos de relação ===\n');

  const acts = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, ementa: true, content: true },
  });
  console.log(`Atos a analisar: ${acts.length}`);

  const orphans = new Map<string, OrphanReference>();
  let totalDetected = 0;
  let totalResolved = 0;

  for (const act of acts) {
    const detected = detectAmendments(act.ementa, act.content || '');
    if (detected.length === 0) continue;
    totalDetected += detected.length;

    for (const rel of detected) {
      const targetId = await resolveTargetActId(rel.targetFullNumber);
      if (targetId) {
        totalResolved++;
        continue;
      }
      const existing = orphans.get(rel.targetFullNumber);
      if (existing) {
        existing.count++;
        if (!existing.citedBy.includes(act.fullNumber)) {
          existing.citedBy.push(act.fullNumber);
        }
        if (!existing.relationTypes.includes(rel.relationType)) {
          existing.relationTypes.push(rel.relationType);
        }
      } else {
        orphans.set(rel.targetFullNumber, {
          count: 1,
          citedBy: [act.fullNumber],
          relationTypes: [rel.relationType],
        });
      }
    }
  }

  console.log(`\nTotal candidatos detectados: ${totalDetected}`);
  console.log(`Targets resolvidos:          ${totalResolved}`);
  console.log(`Targets órfãos (distintos):  ${orphans.size}`);

  const ranked = Array.from(orphans.entries())
    .map(([target, ref]) => ({ target, ...ref }))
    .sort((a, b) => b.count - a.count);

  console.log(`\n--- Top ${Math.min(TOP, ranked.length)} órfãos mais citados ---`);
  for (const r of ranked.slice(0, TOP)) {
    console.log(
      `${String(r.count).padStart(3)}× ${r.target}  (tipos: ${r.relationTypes.join(',')})`,
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const outDir = resolve('docs/audits');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `orphan-relations-${today}.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalActs: acts.length,
        totalDetected,
        totalResolved,
        totalOrphanTargets: orphans.size,
        orphans: ranked,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\nJSON detalhado salvo em: ${outPath}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
