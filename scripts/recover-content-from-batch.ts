/**
 * Recupera content (e embeddings) de atos cujo `content` foi zerado por algum
 * batch import antigo. Foi criado pra recuperar os 29 IN SEGES que perderam
 * content na sessão 2026-04-25 — generalizado pra qualquer JSON batch.
 *
 * Lê a lista de `fullNumber` do JSON, busca cada ato no DB, e se ele tiver
 * `officialUrl` E `content` vazio/curto, chama `scrapeAndIndexAct(id)` (mesmo
 * caminho de produção usado por crons e admin API).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/recover-content-from-batch.ts <json-path> [--dry-run] [--limit N] [--delay-ms N]
 *
 * Ex:
 *   npx dotenv -e .env.local -- npx tsx scripts/recover-content-from-batch.ts ins-faltantes-2026-02.json --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/recover-content-from-batch.ts ins-faltantes-2026-02.json --limit 3
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { scrapeAndIndexAct } from '@/lib/legislative-scrapers/scrape-and-index';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const jsonPath = args.find((a) => !a.startsWith('--'));

const limitArgIdx = args.indexOf('--limit');
const LIMIT = limitArgIdx >= 0 ? parseInt(args[limitArgIdx + 1] ?? '0', 10) : 0;

const delayArgIdx = args.indexOf('--delay-ms');
const DELAY_MS = delayArgIdx >= 0 ? parseInt(args[delayArgIdx + 1] ?? '2000', 10) : 2000;

if (!jsonPath) {
  console.error('Uso: tsx scripts/recover-content-from-batch.ts <json-path> [--dry-run] [--limit N] [--delay-ms N]');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const fullPath = resolve(process.cwd(), jsonPath!);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Recovery de Content para Atos Legislativos`);
  console.log(`  Fonte:    ${fullPath}`);
  console.log(`  Modo:     ${DRY_RUN ? '🔍 DRY-RUN' : '✅ EXECUÇÃO'}`);
  console.log(`  Delay:    ${DELAY_MS}ms entre cada`);
  if (LIMIT > 0) console.log(`  Limit:    ${LIMIT}`);
  console.log(`${'='.repeat(60)}\n`);

  const json = JSON.parse(readFileSync(fullPath, 'utf-8'));
  const fullNumbers = (json.legislativeActs as Array<{ fullNumber: string }>).map((a) => a.fullNumber);

  // Busca atos do DB que têm URL e content vazio/curto
  const acts = await prisma.legislativeAct.findMany({
    where: {
      fullNumber: { in: fullNumbers },
      officialUrl: { not: null },
    },
    select: { id: true, fullNumber: true, officialUrl: true, content: true },
  });

  const needsRecovery = acts.filter((a) => !a.content || a.content.length < 100);
  const sample = LIMIT > 0 ? needsRecovery.slice(0, LIMIT) : needsRecovery;

  console.log(`Atos no JSON:               ${fullNumbers.length}`);
  console.log(`Encontrados no DB com URL:  ${acts.length}`);
  console.log(`Precisam recovery:          ${needsRecovery.length}`);
  console.log(`Vão processar nesta run:    ${sample.length}\n`);

  if (DRY_RUN) {
    console.log('Atos que seriam re-scraped:');
    for (const a of sample) console.log(`  - ${a.fullNumber}  (URL: ${a.officialUrl})`);
    await prisma.$disconnect();
    return;
  }

  if (sample.length === 0) {
    console.log('Nada a fazer.');
    await prisma.$disconnect();
    return;
  }

  const startTime = Date.now();
  const stats = { sucesso: 0, falha: 0 };
  const failures: { fullNumber: string; error: string }[] = [];

  for (let i = 0; i < sample.length; i++) {
    const act = sample[i];
    const prefix = `[${i + 1}/${sample.length}] ${act.fullNumber}`;
    console.log(`\n${prefix}`);
    console.log(`   URL: ${act.officialUrl}`);

    try {
      const result = await scrapeAndIndexAct(act.id);
      if (result.scraped && result.indexed) {
        console.log(`   ✅ scraped + indexed`);
        stats.sucesso++;
      } else if (result.scraped && !result.indexed) {
        console.log(`   ⚠️  scraped mas FALHOU índice (provável >100 chunks)`);
        stats.sucesso++; // content recuperado, embedding pode ser feito depois
      } else {
        console.log(`   ❌ FALHA: ${result.error || 'sem detalhes'}`);
        stats.falha++;
        failures.push({ fullNumber: act.fullNumber, error: result.error || 'sem detalhes' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ❌ EXCEÇÃO: ${msg.slice(0, 200)}`);
      stats.falha++;
      failures.push({ fullNumber: act.fullNumber, error: msg.slice(0, 200) });
    }

    if (i < sample.length - 1) await sleep(DELAY_MS);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  RESULTADO:`);
  console.log(`  ✅ Sucesso:  ${stats.sucesso}`);
  console.log(`  ❌ Falha:    ${stats.falha}`);
  console.log(`  ⏱️  Tempo:    ${totalTime}s`);
  console.log(`${'='.repeat(60)}\n`);

  if (failures.length > 0) {
    console.log('Falhas:');
    for (const f of failures) console.log(`  - ${f.fullNumber}: ${f.error}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
