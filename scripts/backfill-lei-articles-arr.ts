/**
 * Backfill `leiArticles` (JSON-em-String legado) → `leiArticlesArr` (array nativo Postgres).
 *
 * Onda 4.5 — PR 4.5.2. Roda APÓS PR 4.5.1 (ADD COLUMN). Depois desta:
 *   - 4.5.3: dual-write nos helpers (lib/lei-articles.ts)
 *   - 4.5.4: dual-read + GIN indexes + flag de leitura
 *   - 4.5.5: drop coluna legada
 *
 * Estratégia: UPDATE SQL atômico por tabela usando jsonb_array_elements_text.
 * Safe porque validamos pré-PR que 100% dos valores não-vazios são JSON arrays válidos
 * (Document: 5455/5455, TribunalDecision: 935/935, GlossaryTerm: 95/95, etc).
 *
 * Idempotente: pula rows onde leiArticlesArr já está preenchido (a menos que --force).
 * Não toca updatedAt (raw SQL bypassa @updatedAt do Prisma).
 *
 * Flags:
 *   --dry-run           só conta candidatos, não atualiza
 *   --force             sobrescreve mesmo se leiArticlesArr já populado
 *   --table=Document    backfill só uma tabela
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const tableArg = args.find((a) => a.startsWith('--table='))?.split('=')[1];

const TABLES = [
  'Document',
  'BlogPost',
  'Publication',
  'GlossaryTerm',
  'LegislativeAct',
  'Lesson',
  'TribunalDecision',
] as const;

type TableName = (typeof TABLES)[number];

const connStr = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connStr) {
  console.error('DATABASE_URL_UNPOOLED ou DATABASE_URL não setado');
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: connStr });
const prisma = new PrismaClient({ adapter });

interface TableStats {
  table: string;
  totalWithLeiArticles: number;
  alreadyBackfilled: number;
  candidates: number;
  updated: number;
  remainingMismatches: number;
  durationMs: number;
}

const skipPopulated = force ? '' : `AND cardinality("leiArticlesArr") = 0`;

async function backfillTable(table: string): Promise<TableStats> {
  const start = Date.now();

  const baseline = await prisma.$queryRawUnsafe<
    Array<{ total_with: bigint; already_back: bigint; candidates: bigint }>
  >(`
    SELECT
      COUNT(*) FILTER (WHERE "leiArticles" IS NOT NULL AND "leiArticles" != '')::bigint AS total_with,
      COUNT(*) FILTER (
        WHERE "leiArticles" IS NOT NULL
          AND "leiArticles" != ''
          AND cardinality("leiArticlesArr") > 0
      )::bigint AS already_back,
      COUNT(*) FILTER (
        WHERE "leiArticles" IS NOT NULL
          AND "leiArticles" != ''
          AND "leiArticles" ~ '^\\['
          ${skipPopulated}
      )::bigint AS candidates
    FROM "${table}"
  `);

  const stats: TableStats = {
    table,
    totalWithLeiArticles: Number(baseline[0].total_with),
    alreadyBackfilled: Number(baseline[0].already_back),
    candidates: Number(baseline[0].candidates),
    updated: 0,
    remainingMismatches: 0,
    durationMs: 0,
  };

  if (stats.candidates === 0 || dryRun) {
    stats.durationMs = Date.now() - start;
    return stats;
  }

  // UPDATE atômico: parseia JSON, agrega como array, atribui à coluna nova.
  // LATERAL jsonb_array_elements_text explode cada elemento; array_agg recombina.
  const updateResult = await prisma.$executeRawUnsafe(`
    UPDATE "${table}" t
    SET "leiArticlesArr" = COALESCE(src.arr, ARRAY[]::TEXT[])
    FROM (
      SELECT id, array_agg(value) AS arr
      FROM "${table}",
      LATERAL jsonb_array_elements_text("leiArticles"::jsonb) AS value
      WHERE "leiArticles" IS NOT NULL
        AND "leiArticles" != ''
        AND "leiArticles" ~ '^\\['
        ${skipPopulated}
      GROUP BY id
    ) src
    WHERE t.id = src.id
  `);
  stats.updated = Number(updateResult);

  const remaining = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
    SELECT COUNT(*)::bigint AS count
    FROM "${table}"
    WHERE "leiArticles" IS NOT NULL
      AND "leiArticles" != ''
      AND "leiArticles" ~ '^\\['
      AND cardinality("leiArticlesArr") = 0
  `);
  stats.remainingMismatches = Number(remaining[0].count);

  stats.durationMs = Date.now() - start;
  return stats;
}

async function main() {
  console.log(`=== Backfill leiArticles → leiArticlesArr ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}${force ? ' (--force: overwrite)' : ''}`);
  if (tableArg) console.log(`Table filter: ${tableArg}`);
  console.log('');

  const tablesToRun = tableArg
    ? TABLES.filter((t) => t === tableArg)
    : Array.from(TABLES);

  if (tablesToRun.length === 0) {
    console.error(`Tabela "${tableArg}" não reconhecida. Válidas: ${TABLES.join(', ')}`);
    process.exit(1);
  }

  const allStats: TableStats[] = [];

  for (const table of tablesToRun) {
    process.stdout.write(`Processing ${table}... `);
    try {
      const s = await backfillTable(table);
      allStats.push(s);
      console.log(`done (${s.durationMs}ms)`);
    } catch (err) {
      console.log(`ERROR: ${(err as Error).message}`);
      throw err;
    }
  }

  console.log('\n=== Summary ===\n');
  console.log(
    'table'.padEnd(20) +
      'with-lei'.padEnd(12) +
      'already'.padEnd(12) +
      'candidates'.padEnd(13) +
      'updated'.padEnd(10) +
      'remaining'.padEnd(11) +
      'duration',
  );
  console.log('-'.repeat(85));
  for (const s of allStats) {
    const remMark = s.remainingMismatches > 0 ? '⚠️ ' : '';
    console.log(
      s.table.padEnd(20) +
        String(s.totalWithLeiArticles).padEnd(12) +
        String(s.alreadyBackfilled).padEnd(12) +
        String(s.candidates).padEnd(13) +
        String(s.updated).padEnd(10) +
        `${remMark}${s.remainingMismatches}`.padEnd(11) +
        `${s.durationMs}ms`,
    );
  }

  const totalRemaining = allStats.reduce((sum, s) => sum + s.remainingMismatches, 0);
  console.log('');
  if (totalRemaining > 0) {
    console.log(`⚠️  ${totalRemaining} rows com leiArticles populado mas leiArticlesArr vazio.`);
    console.log(`   Investigue antes de PR 4.5.3. Possíveis causas:`);
    console.log(`     - JSON malformado (não começa com '[')`);
    console.log(`     - Encoding issues`);
    console.log(`     - Caracteres especiais não-tratados pelo jsonb cast`);
    process.exit(1);
  }
  if (dryRun) {
    console.log(`✅ Dry run OK. Rode sem --dry-run pra aplicar.`);
  } else {
    console.log(`✅ Backfill completo. Pronto pra PR 4.5.3 (dual-write nos helpers).`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
