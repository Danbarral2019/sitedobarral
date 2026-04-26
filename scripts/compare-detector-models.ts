/**
 * Comparativo Heurística vs IA Flash vs IA Pro pro detector de relações.
 *
 * Pra cada ato amostrado, roda os 3 detectores em paralelo, mostra:
 *   - Quantidade de relações que cada um achou
 *   - Quais relações Flash achou que heurística perdeu (true gain)
 *   - Quais relações Pro achou que Flash perdeu (justifica 6× custo?)
 *   - Quais relações Pro perdeu que Flash achou (regressão?)
 *   - Cobertura agregada
 *   - Latência por modelo
 *
 * Não persiste nada — só relata. Custo estimado em 10 atos:
 *   ~R$ 0,08 Flash + ~R$ 2,00 Pro = ~R$ 2,08
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/compare-detector-models.ts --limit 10
 *   npx dotenv -e .env.local -- npx tsx scripts/compare-detector-models.ts --acts 'IN SEGES 460/2025,Decreto 11.345/2023'
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { detectAmendments } from '../lib/legislative-acts/amendment-detector';
import { detectAmendmentsAI } from '../lib/legislative-acts/amendment-detector-ai';
import type { DetectedRelation } from '../lib/legislative-acts/amendment-detector';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? '10', 10) : 10;
const actsIdx = args.indexOf('--acts');
const ACT_FILTER = actsIdx >= 0 ? args[actsIdx + 1].split(',').map((s) => s.trim()) : null;

const FLASH = 'gemini-3-flash-preview';
const PRO = 'gemini-3.1-pro-preview';

function relKey(r: DetectedRelation): string {
  return `${r.relationType}|${r.targetFullNumber.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

interface ActResult {
  fullNumber: string;
  heuristic: DetectedRelation[];
  flash: DetectedRelation[];
  pro: DetectedRelation[];
  flashLatencyMs: number;
  proLatencyMs: number;
}

async function compareOne(act: { id: string; fullNumber: string; ementa: string; content: string | null }): Promise<ActResult> {
  const heuristic = detectAmendments(act.ementa, act.content || '');

  const flashStart = Date.now();
  const flash = await detectAmendmentsAI(act.ementa, act.content || '', { model: FLASH });
  const flashLatencyMs = Date.now() - flashStart;

  const proStart = Date.now();
  const pro = await detectAmendmentsAI(act.ementa, act.content || '', { model: PRO });
  const proLatencyMs = Date.now() - proStart;

  return { fullNumber: act.fullNumber, heuristic, flash, pro, flashLatencyMs, proLatencyMs };
}

function diffSets<T>(left: T[], right: T[], keyOf: (x: T) => string): { onlyLeft: T[]; onlyRight: T[]; both: T[] } {
  const leftMap = new Map(left.map((x) => [keyOf(x), x] as const));
  const rightMap = new Map(right.map((x) => [keyOf(x), x] as const));
  const onlyLeft: T[] = [];
  const onlyRight: T[] = [];
  const both: T[] = [];
  for (const [k, v] of leftMap) {
    if (rightMap.has(k)) both.push(v);
    else onlyLeft.push(v);
  }
  for (const [k, v] of rightMap) {
    if (!leftMap.has(k)) onlyRight.push(v);
  }
  return { onlyLeft, onlyRight, both };
}

async function main() {
  console.log('\n=== Comparativo Heurística vs Flash vs Pro ===\n');

  const where = ACT_FILTER ? { fullNumber: { in: ACT_FILTER } } : {};
  const acts = await prisma.legislativeAct.findMany({
    where,
    select: { id: true, fullNumber: true, ementa: true, content: true },
    // Ordena pelos atos com content mais rico (mais material pro detector trabalhar)
    orderBy: { content: { sort: 'desc', nulls: 'last' } },
    take: LIMIT,
  });
  console.log(`Atos amostrados: ${acts.length}\n`);

  const results: ActResult[] = [];
  for (let i = 0; i < acts.length; i++) {
    const act = acts[i];
    process.stdout.write(`[${i + 1}/${acts.length}] ${act.fullNumber} ... `);
    try {
      const r = await compareOne(act);
      results.push(r);
      console.log(`heur=${r.heuristic.length} flash=${r.flash.length} (${r.flashLatencyMs}ms) pro=${r.pro.length} (${r.proLatencyMs}ms)`);
    } catch (err) {
      console.log(`✗ erro: ${err instanceof Error ? err.message : err}`);
    }
    // Rate limit: pequena pausa entre atos
    await new Promise((r) => setTimeout(r, 500));
  }

  // Agregados
  const totalHeur = results.reduce((a, b) => a + b.heuristic.length, 0);
  const totalFlash = results.reduce((a, b) => a + b.flash.length, 0);
  const totalPro = results.reduce((a, b) => a + b.pro.length, 0);

  // Per-act dedup-aware sums (qualquer relação detectada por algum método)
  let unionFlashHeur = 0;
  let unionProHeur = 0;
  let proOnlyVsFlash = 0;
  let flashOnlyVsPro = 0;
  let agreedFlashPro = 0;

  // Coleta exemplos qualitativos
  const exFlashGain: { act: string; rel: DetectedRelation }[] = [];
  const exProGain: { act: string; rel: DetectedRelation }[] = [];
  const exProMissed: { act: string; rel: DetectedRelation }[] = [];

  for (const r of results) {
    const flashVsHeur = diffSets(r.heuristic, r.flash, relKey);
    const proVsHeur = diffSets(r.heuristic, r.pro, relKey);
    const proVsFlash = diffSets(r.flash, r.pro, relKey);
    unionFlashHeur += flashVsHeur.both.length + flashVsHeur.onlyLeft.length + flashVsHeur.onlyRight.length;
    unionProHeur += proVsHeur.both.length + proVsHeur.onlyLeft.length + proVsHeur.onlyRight.length;
    proOnlyVsFlash += proVsFlash.onlyRight.length;
    flashOnlyVsPro += proVsFlash.onlyLeft.length;
    agreedFlashPro += proVsFlash.both.length;

    for (const rel of flashVsHeur.onlyRight.slice(0, 2)) exFlashGain.push({ act: r.fullNumber, rel });
    for (const rel of proVsFlash.onlyRight.slice(0, 2)) exProGain.push({ act: r.fullNumber, rel });
    for (const rel of proVsFlash.onlyLeft.slice(0, 2)) exProMissed.push({ act: r.fullNumber, rel });
  }

  const avgFlashLatency = results.length
    ? Math.round(results.reduce((a, b) => a + b.flashLatencyMs, 0) / results.length)
    : 0;
  const avgProLatency = results.length
    ? Math.round(results.reduce((a, b) => a + b.proLatencyMs, 0) / results.length)
    : 0;

  console.log(`\n=== Totais (${results.length} atos) ===`);
  console.log(`Relações detectadas:`);
  console.log(`  Heurística:                 ${totalHeur}`);
  console.log(`  Flash (puro):               ${totalFlash}`);
  console.log(`  Pro    (puro):              ${totalPro}`);
  console.log(``);
  console.log(`Concordância Flash↔Pro:        ${agreedFlashPro}`);
  console.log(`Pro pegou e Flash perdeu:      ${proOnlyVsFlash}`);
  console.log(`Flash pegou e Pro perdeu:      ${flashOnlyVsPro}`);
  console.log(``);
  console.log(`Latência média:`);
  console.log(`  Flash: ${avgFlashLatency}ms`);
  console.log(`  Pro:   ${avgProLatency}ms (${(avgProLatency / Math.max(1, avgFlashLatency)).toFixed(1)}× Flash)`);

  console.log(`\n=== Amostra qualitativa ===`);
  console.log(`\nRelações Flash pegou que heurística perdeu (até 10):`);
  for (const ex of exFlashGain.slice(0, 10)) {
    console.log(`  [${ex.act}] ${ex.rel.relationType} → ${ex.rel.targetFullNumber}`);
    console.log(`             "${ex.rel.excerpt.slice(0, 120)}"`);
  }

  console.log(`\nRelações Pro pegou que Flash perdeu (até 10):`);
  for (const ex of exProGain.slice(0, 10)) {
    console.log(`  [${ex.act}] ${ex.rel.relationType} → ${ex.rel.targetFullNumber}`);
    console.log(`             "${ex.rel.excerpt.slice(0, 120)}"`);
  }

  console.log(`\nRelações que Flash pegou e Pro perdeu (até 10) — sinal de regressão?:`);
  for (const ex of exProMissed.slice(0, 10)) {
    console.log(`  [${ex.act}] ${ex.rel.relationType} → ${ex.rel.targetFullNumber}`);
    console.log(`             "${ex.rel.excerpt.slice(0, 120)}"`);
  }

  // Salva JSON detalhado pra análise posterior
  const today = new Date().toISOString().slice(0, 10);
  const outPath = `docs/audits/detector-comparison-${today}.json`;
  const { writeFileSync, mkdirSync, existsSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const fullPath = resolve(outPath);
  if (!existsSync(dirname(fullPath))) mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(
    fullPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        actsCount: results.length,
        models: { flash: FLASH, pro: PRO },
        totals: {
          heuristic: totalHeur,
          flash: totalFlash,
          pro: totalPro,
          agreedFlashPro,
          proOnlyVsFlash,
          flashOnlyVsPro,
        },
        latencyMs: { flashAvg: avgFlashLatency, proAvg: avgProLatency },
        results: results.map((r) => ({
          fullNumber: r.fullNumber,
          counts: { heur: r.heuristic.length, flash: r.flash.length, pro: r.pro.length },
          flashLatencyMs: r.flashLatencyMs,
          proLatencyMs: r.proLatencyMs,
          heuristic: r.heuristic,
          flash: r.flash,
          pro: r.pro,
        })),
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
