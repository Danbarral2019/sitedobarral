/**
 * Audit diagnóstico de LegislativeAct.
 * Read-only. Produz relatório markdown + dump JSON em docs/audits/.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --skip-fetch
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --spot-check-limit=20
 *   npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --dry-run
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as fs from 'node:fs';
import * as path from 'node:path';

const connStr = process.env.DATABASE_URL;
if (!connStr) {
  console.error('DATABASE_URL not set. Run `vercel env pull .env.local` first.');
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: connStr });
const prisma = new PrismaClient({ adapter });

// ── CLI args ──────────────────────────────────────────────────────────────

function parseIntArg(name: string, defaultValue: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return defaultValue;
  const value = parseInt(arg.split('=')[1], 10);
  return Number.isFinite(value) ? value : defaultValue;
}

const SPOT_CHECK_LIMIT = parseIntArg('spot-check-limit', 12);
const SKIP_FETCH = process.argv.includes('--skip-fetch');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Audit de LegislativeAct ===');
  console.log(`Spot-check limit: ${SPOT_CHECK_LIMIT}`);
  console.log(`Skip fetch: ${SKIP_FETCH}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('');

  const total = await prisma.legislativeAct.count();
  console.log(`Total de atos: ${total}`);
}

main()
  .catch((err) => {
    console.error('ERRO:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
