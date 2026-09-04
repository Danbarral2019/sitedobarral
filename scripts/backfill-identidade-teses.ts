/**
 * Resolve a identidade oficial das destilações atuais contra o TCU.
 *
 * Sem identidade resolvida a destilação fica fora de TODOS os consumidores
 * (spec §6), então este backfill é pré-requisito de qualquer publicação.
 *
 * Uso:
 *   npx tsx scripts/backfill-identidade-teses.ts              # dry-run
 *   npx tsx scripts/backfill-identidade-teses.ts --executar
 *   npx tsx scripts/backfill-identidade-teses.ts --executar --limit 20
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { resolverIdentidade } from '../lib/tcu/resolver-identidade';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

const DELAY_MS = 1000; // 1 req/s — educado com o TCU
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const executar = args.includes('--executar');
  const i = args.indexOf('--limit');
  const limit = i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : undefined;

  const alvos = await prisma.teseDestilacao.findMany({
    where: { atual: true, acordaoKey: null },
    select: { id: true, numeroAlvo: true, anoAlvo: true },
    orderBy: [{ numeroAlvo: 'asc' }, { anoAlvo: 'asc' }],
    ...(limit ? { take: limit } : {}),
  });

  console.log(`\n=== IDENTIDADE OFICIAL DAS TESES ===\n`);
  console.log(`Destilações sem identidade: ${alvos.length}`);
  console.log(executar ? 'Modo: EXECUTAR\n' : 'Modo: dry-run (nada será gravado)\n');

  let resolvidos = 0, ambiguos = 0;
  for (const a of alvos) {
    const ident = await resolverIdentidade(a.numeroAlvo, a.anoAlvo);
    await dorme(DELAY_MS);
    if (!ident) {
      ambiguos++;
      console.log(`  ?  ${a.numeroAlvo}/${a.anoAlvo} — ambíguo ou não encontrado`);
      continue;
    }
    resolvidos++;
    console.log(`  ok ${a.numeroAlvo}/${a.anoAlvo} — ${ident.colegiadoAlvo} (${ident.acordaoKey})`);
    if (executar) {
      await prisma.teseDestilacao.update({ where: { id: a.id }, data: ident });
    }
  }

  console.log(`\nResolvidos: ${resolvidos} · sem identidade: ${ambiguos}`);
  if (!executar) console.log('\nPara aplicar: --executar\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
