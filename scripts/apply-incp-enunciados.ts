/**
 * apply-incp-enunciados.ts
 *
 * Audita e atualiza enunciados INCP no DB com texto oficial do site
 * incpbrasil.com.br. Pra ONs no DB sem match no site oficial, lista
 * em "sem fonte oficial" pra revisão manual.
 *
 * --apply pra escrever.
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';

interface IncpEnunciado {
  numero: number;
  reuniao: 1 | 2;
  texto: string;
  fonte: string;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function jaccard(a: string, b: string): number {
  const wa = new Set(normalize(a).split(' '));
  const wb = new Set(normalize(b).split(' '));
  const inter = Array.from(wa).filter((w) => wb.has(w)).length;
  return (2 * inter) / (wa.size + wb.size);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const today = new Date().toISOString().slice(0, 10);
  const inputPath = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-incp-enunciados-scraped.json`
  );

  const { enunciados } = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as {
    enunciados: IncpEnunciado[];
  };

  console.log('='.repeat(60));
  console.log(`APPLY-INCP-ENUNCIADOS — ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(60));
  console.log(`Site oficial: ${enunciados.length} enunciados\n`);

  const dbAll = await prisma.document.findMany({
    where: { category: 'enunciados', isPublic: true, tags: { contains: '"INCP"' } },
    select: { id: true, title: true, description: true, tags: true },
  });
  console.log(`DB: ${dbAll.length} enunciados INCP públicos\n`);

  const dbByNum = new Map<number, (typeof dbAll)[number]>();
  for (const e of dbAll) {
    const m = e.title.match(/n[º°]?\s*(\d+)/i);
    if (m) dbByNum.set(parseInt(m[1], 10), e);
  }

  type Plan = {
    numero: number;
    action: 'update' | 'skip' | 'site-only' | 'db-only';
    motivo: string;
    similaridade?: number;
    dbId?: string;
    descAntiga?: string;
    descNova?: string;
  };

  const plans: Plan[] = [];

  // Para cada enunciado do site, comparar com DB
  for (const e of enunciados) {
    const dbDoc = dbByNum.get(e.numero);
    if (!dbDoc) {
      plans.push({ numero: e.numero, action: 'site-only', motivo: 'no site mas não no DB' });
      continue;
    }
    const descAntiga = (dbDoc.description || '').trim();
    const sim = jaccard(descAntiga, e.texto);
    if (sim >= 0.92) {
      plans.push({ numero: e.numero, action: 'skip', motivo: `igual (sim=${sim.toFixed(2)})`, similaridade: sim, dbId: dbDoc.id });
    } else {
      plans.push({
        numero: e.numero,
        action: 'update',
        motivo: `diff (sim=${sim.toFixed(2)})`,
        similaridade: sim,
        dbId: dbDoc.id,
        descAntiga,
        descNova: e.texto,
      });
    }
  }

  // Para cada DB sem match no site
  const siteNumeros = new Set(enunciados.map((e) => e.numero));
  for (const e of dbAll) {
    const m = e.title.match(/n[º°]?\s*(\d+)/i);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (!siteNumeros.has(n)) {
      plans.push({ numero: n, action: 'db-only', motivo: 'no DB mas não no site oficial', dbId: e.id });
    }
  }

  const toUpdate = plans.filter((p) => p.action === 'update');
  const toSkip = plans.filter((p) => p.action === 'skip');
  const siteOnly = plans.filter((p) => p.action === 'site-only');
  const dbOnly = plans.filter((p) => p.action === 'db-only');

  console.log(`Plano: 🔄 atualizar ${toUpdate.length} | ⏭️ igual ${toSkip.length} | site-only ${siteOnly.length} | db-only ${dbOnly.length}`);

  if (toUpdate.length > 0) {
    console.log('\nTop 3 atualizações (similaridade mais baixa):');
    toUpdate.sort((a, b) => (a.similaridade ?? 0) - (b.similaridade ?? 0));
    for (const p of toUpdate.slice(0, 3)) {
      console.log(`\n  Enunciado ${p.numero} (sim=${p.similaridade?.toFixed(2)}):`);
      console.log(`    DB:   ${p.descAntiga?.slice(0, 120)}...`);
      console.log(`    Site: ${p.descNova?.slice(0, 120)}...`);
    }
  }

  if (dbOnly.length > 0) {
    console.log(`\nDB-only (${dbOnly.length}): números ${dbOnly.map((p) => p.numero).sort((a, b) => a - b).join(', ')}`);
  }

  if (!apply) {
    console.log('\nPara aplicar:');
    console.log('  npx dotenv -e .env.local -- npx tsx scripts/apply-incp-enunciados.ts --apply');
    await prisma.$disconnect();
    return;
  }

  // APPLY
  console.log('\nAplicando...');
  let success = 0;
  let errors = 0;
  for (const p of toUpdate) {
    if (!p.dbId) continue;
    const e = enunciados.find((x) => x.numero === p.numero)!;
    try {
      await prisma.document.update({
        where: { id: p.dbId },
        data: {
          description: e.texto,
          content: e.texto,
          url: e.fonte,
          reviewed: false,
          reviewedAt: null,
        },
      });
      success++;
    } catch (err) {
      errors++;
      console.log(`  ❌ Enunciado ${p.numero}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n✅ Atualizadas: ${success} | ❌ Falhas: ${errors}`);

  const logPath = path.join(process.cwd(), 'docs', 'audits', `${today}-incp-apply-log.json`);
  fs.writeFileSync(logPath, JSON.stringify({ runAt: new Date().toISOString(), apply, plans }, null, 2));
  console.log(`📄 Log: ${logPath}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
