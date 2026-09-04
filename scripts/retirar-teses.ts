/**
 * Retirada editorial de teses (spec §5).
 *
 * Torna o enunciado inelegível em TODOS os consumidores. `retiradoMotivo` é
 * obrigatório: retirada sem motivo registrado é retirada que ninguém consegue
 * auditar depois.
 *
 * Uso:
 *   npx tsx scripts/retirar-teses.ts --chave 1724/2025 --motivo "matéria de pessoal"
 *   npx tsx scripts/retirar-teses.ts --chave 1724/2025 --motivo "..." --executar
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  const args = process.argv.slice(2);
  const val = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  const chave = val('--chave');
  const motivo = val('--motivo');
  const executar = args.includes('--executar');

  if (!chave || !motivo) {
    console.error('Uso: --chave <numero/ano> --motivo "<texto>" [--executar]');
    process.exit(1);
  }

  const alvos = await prisma.teseEnunciado.findMany({
    where: { destilacao: { chave, atual: true }, retiradoEm: null },
    select: { id: true, enunciado: true },
  });

  console.log(`\nTeses de ${chave} a retirar: ${alvos.length}`);
  for (const a of alvos) console.log(`  - ${a.enunciado.slice(0, 90)}...`);
  console.log(`\nMotivo: ${motivo}`);

  if (!executar) {
    console.log('\nDry-run. Para aplicar: --executar\n');
    return;
  }

  const r = await prisma.teseEnunciado.updateMany({
    where: { id: { in: alvos.map((a) => a.id) } },
    data: { retiradoEm: new Date(), retiradoMotivo: motivo, publicado: false, vitrinePublica: false },
  });
  console.log(`\nRetiradas: ${r.count}\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
