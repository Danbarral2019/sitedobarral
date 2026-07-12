/**
 * Lista gatilhos para queries multi-hop (probe do gate BIA-8).
 * Somente leitura. Mostra relações confirmadas entre atos + atos revogados,
 * para o Daniel marcar quais um procurador de fato perguntaria.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/list-multihop-triggers.ts
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function label(a: { type: string; number: string | null; year: number | null; ementa: string | null }) {
  const id = [a.type, a.number, a.year].filter(Boolean).join(' ');
  const em = (a.ementa ?? '').replace(/\s+/g, ' ').trim().slice(0, 90);
  return `${id}${em ? ` — ${em}${em.length >= 90 ? '…' : ''}` : ''}`;
}

async function main() {
  // 1) Relações confirmadas (grafo de legislação já estruturado = Nível 3a)
  const rels = await prisma.legislativeActRelation.findMany({
    where: { reviewStatus: 'confirmed' },
    select: {
      relationType: true,
      confidence: true,
      sourceAct: { select: { type: true, number: true, year: true, ementa: true } },
      targetAct: { select: { type: true, number: true, year: true, ementa: true } },
    },
    orderBy: { relationType: 'asc' },
  });

  const byType = new Map<string, typeof rels>();
  for (const r of rels) {
    if (!byType.has(r.relationType)) byType.set(r.relationType, []);
    byType.get(r.relationType)!.push(r);
  }

  console.log(`\n==================== RELAÇÕES CONFIRMADAS (${rels.length}) ====================`);
  console.log('(grafo de legislação já estruturado — saltos de Nível 3a)\n');
  for (const [type, list] of [...byType.entries()].sort()) {
    console.log(`\n### relationType = "${type}"  (${list.length})`);
    list.slice(0, 25).forEach((r, i) => {
      console.log(`  [${type}-${i + 1}]  ${label(r.sourceAct)}`);
      console.log(`        →${type}→  ${label(r.targetAct)}`);
    });
    if (list.length > 25) console.log(`   … (+${list.length - 25} outras do tipo "${type}")`);
  }

  // 2) Atos marcados como revogados (com nota de quem revogou)
  const revoked = await prisma.legislativeAct.findMany({
    where: { revoked: true },
    select: { type: true, number: true, year: true, ementa: true, revokedNote: true },
    orderBy: [{ year: 'desc' }],
  });

  console.log(`\n\n==================== ATOS REVOGADOS (${revoked.length}) ====================`);
  console.log('(flag revoked=true — candidatos a salto "ainda vale? o que a substituta diz?")\n');
  revoked.forEach((a, i) => {
    console.log(`  [rev-${i + 1}]  ${label(a)}`);
    if (a.revokedNote) console.log(`           nota: ${a.revokedNote.replace(/\s+/g, ' ').trim().slice(0, 120)}`);
  });

  // 3) Resumo de contagens por tipo (para dimensionar)
  console.log(`\n\n==================== RESUMO ====================`);
  for (const [type, list] of [...byType.entries()].sort()) {
    console.log(`  ${type.padEnd(14)} ${list.length} relações confirmadas`);
  }
  console.log(`  ${'revoked'.padEnd(14)} ${revoked.length} atos`);

  // pending (não confirmadas) — só contagem, para saber se vale confirmar mais
  const pending = await prisma.legislativeActRelation.count({ where: { reviewStatus: 'pending' } });
  console.log(`\n  (há ainda ${pending} relações "pending" não revisadas — não usadas como gatilho até confirmar)`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
