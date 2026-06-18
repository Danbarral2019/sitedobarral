import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../lib/prisma';

async function main() {
  const docs = await prisma.document.findMany({
    where: { category: 'orientacao-normativa' },
    select: { id: true, title: true, onNumber: true, onYear: true, url: true, updatedAt: true },
  });

  // dedupe por onNumber/onYear (mesma ON pode estar replicada por curso)
  const byKey = new Map<string, { onNumber: number | null; onYear: string | null; count: number; title: string }>();
  for (const d of docs) {
    const key = `${d.onNumber ?? '?'}/${d.onYear ?? '?'}`;
    const cur = byKey.get(key);
    if (cur) cur.count++;
    else byKey.set(key, { onNumber: d.onNumber, onYear: d.onYear, count: 1, title: d.title });
  }

  const list = Array.from(byKey.values()).sort((a, b) => {
    const ya = parseInt(a.onYear || '0'); const yb = parseInt(b.onYear || '0');
    if (ya !== yb) return ya - yb;
    return (a.onNumber || 0) - (b.onNumber || 0);
  });

  console.log(`Total de registros 'orientacao-normativa': ${docs.length}`);
  console.log(`ONs distintas (onNumber/onYear): ${list.length}\n`);
  for (const o of list) {
    console.log(`ON ${o.onNumber ?? '?'}/${o.onYear ?? '?'}  (x${o.count})  ${o.title.substring(0, 70)}`);
  }

  // resumo por ano
  const byYear = new Map<string, number>();
  for (const o of list) byYear.set(o.onYear || '?', (byYear.get(o.onYear || '?') || 0) + 1);
  console.log('\nPor ano:');
  Array.from(byYear.entries()).sort().forEach(([y, c]) => console.log(`  ${y}: ${c}`));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
