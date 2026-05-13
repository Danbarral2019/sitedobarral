/**
 * Auditoria de hierarchyLevel vs type em LegislativeAct.
 *
 * Atos com hierarchyLevel inconsistente com o type produzem violações falsas
 * (e silenciam violações reais) na validação hierárquica de relações.
 *
 * Read-only: só reporta.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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
  const acts = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, type: true, hierarchyLevel: true },
    orderBy: { fullNumber: 'asc' },
  });

  console.log(`\n=== Auditoria hierarchyLevel vs type ===\n`);
  console.log(`Total atos: ${acts.length}\n`);

  console.log('Distribuição (type × hierarchyLevel):');
  const grouped = new Map<string, number>();
  const typesSeen = new Set<string>();
  for (const a of acts) {
    typesSeen.add(a.type);
    const k = `${a.type.padEnd(25)} h=${a.hierarchyLevel}`;
    grouped.set(k, (grouped.get(k) ?? 0) + 1);
  }
  for (const [k, v] of [...grouped].sort()) {
    console.log(`  ${k}: ${v}`);
  }

  const unknownTypes = [...typesSeen].filter((t) => !(t in HIERARCHY_MAP));
  if (unknownTypes.length > 0) {
    console.log(`\n⚠️  Tipos não mapeados em HIERARCHY_MAP: ${JSON.stringify(unknownTypes)}`);
  }

  const bad: Array<{ id: string; fullNumber: string; type: string; has: number; expected: number }> = [];
  for (const a of acts) {
    const expected = HIERARCHY_MAP[a.type];
    if (expected !== undefined && expected !== a.hierarchyLevel) {
      bad.push({ id: a.id, fullNumber: a.fullNumber, type: a.type, has: a.hierarchyLevel, expected });
    }
  }

  console.log(`\nAtos com hierarchyLevel inconsistente: ${bad.length}\n`);
  if (bad.length === 0) {
    console.log('✅ Tudo consistente.');
  } else {
    console.log('Lista completa:');
    for (const b of bad) {
      console.log(`  ${b.fullNumber.padEnd(45)} [type=${b.type.padEnd(20)} has=${b.has} expected=${b.expected}]`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
