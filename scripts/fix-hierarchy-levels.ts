/**
 * Conserta `hierarchyLevel` divergente do `type` em `LegislativeAct`.
 *
 * Auditoria de 2026-05-13 achou 30 atos com `hierarchyLevel` inconsistente:
 * Decretos como h=3 ou h=4, Leis como h=2, Portarias como h=4. Provável causa:
 * import manual sem fornecer `hierarchyLevel` (e default antigo veio bagunçado)
 * ou type alterado posteriormente sem propagar pro level.
 *
 * Mapeamento canônico (espelha o usado em `sync-dou-atos-normativos`):
 *   lei | lei-complementar | medida-provisoria → 1
 *   decreto | decreto-lei                       → 2
 *   portaria                                    → 3
 *   in | instrucao-normativa | resolucao        → 4
 *   ordem-servico                               → 5
 *
 * Por padrão é dry-run. Com `--apply`, atualiza `hierarchyLevel`.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/fix-hierarchy-levels.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/fix-hierarchy-levels.ts --apply
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

const HIERARCHY_MAP: Record<string, number> = {
  lei: 1,
  'lei-complementar': 1,
  'medida-provisoria': 1,
  decreto: 2,
  'decreto-lei': 2,
  portaria: 3,
  in: 4,
  'instrucao-normativa': 4,
  resolucao: 4,
  'ordem-servico': 5,
};

async function main() {
  console.log(`\n=== Fix hierarchyLevel ${APPLY ? '[APPLY]' : '[DRY-RUN]'} ===\n`);

  const acts = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, type: true, hierarchyLevel: true },
    orderBy: { fullNumber: 'asc' },
  });

  const updates: Array<{ id: string; fullNumber: string; type: string; from: number; to: number }> = [];
  for (const a of acts) {
    const expected = HIERARCHY_MAP[a.type];
    if (expected !== undefined && expected !== a.hierarchyLevel) {
      updates.push({ id: a.id, fullNumber: a.fullNumber, type: a.type, from: a.hierarchyLevel, to: expected });
    }
  }

  console.log(`Atos a corrigir: ${updates.length}\n`);
  for (const u of updates) {
    console.log(`  ${u.fullNumber.padEnd(45)} type=${u.type.padEnd(20)} ${u.from} → ${u.to}`);
  }

  if (updates.length === 0) {
    console.log('✅ Nada a corrigir.');
    await prisma.$disconnect();
    return;
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Rode com --apply para corrigir ${updates.length} atos.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\nAplicando ${updates.length} updates...`);
  let ok = 0;
  for (const u of updates) {
    await prisma.legislativeAct.update({
      where: { id: u.id },
      data: { hierarchyLevel: u.to },
    });
    ok++;
  }
  console.log(`\n✅ ${ok} ato(s) corrigido(s).`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
