/**
 * apply-ibda-enunciados.ts
 *
 * Compara os 61 enunciados IBDA extraídos do PDF oficial com o DB
 * e atualiza description com texto oficial.
 *
 * Read-only por padrão. --apply pra escrever.
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';

interface IbdaEnunciado {
  numero: number;
  texto: string;
  fonte: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    `${today}-ibda-enunciados-scraped.json`
  );
  if (!fs.existsSync(inputPath)) {
    console.error(`Input não encontrado: ${inputPath}`);
    process.exit(1);
  }

  const { enunciados } = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as {
    enunciados: IbdaEnunciado[];
  };

  console.log('='.repeat(60));
  console.log(`APPLY-IBDA-ENUNCIADOS — ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(60));
  console.log(`Scraped: ${enunciados.length} enunciados\n`);

  const dbAll = await prisma.document.findMany({
    where: {
      category: 'enunciados',
      isPublic: true,
      tags: { contains: '"IBDA"' },
    },
    select: { id: true, title: true, description: true, tags: true, url: true },
  });
  console.log(`DB: ${dbAll.length} enunciados IBDA públicos\n`);

  const dbByNum = new Map<number, (typeof dbAll)[number]>();
  for (const e of dbAll) {
    const m = e.title.match(/n[º°]?\s*(\d+)/i);
    if (m) dbByNum.set(parseInt(m[1], 10), e);
  }

  type Plan = {
    numero: number;
    action: 'update' | 'create' | 'skip';
    motivo: string;
    similaridade?: number;
    dbId?: string;
    descAntiga?: string;
    descNova?: string;
  };

  const plans: Plan[] = [];

  for (const e of enunciados) {
    const dbDoc = dbByNum.get(e.numero);
    if (!dbDoc) {
      plans.push({ numero: e.numero, action: 'create', motivo: 'novo' });
      continue;
    }

    const descAntiga = (dbDoc.description || '').trim();
    const sim = jaccard(descAntiga, e.texto);

    if (sim >= 0.92) {
      plans.push({
        numero: e.numero,
        action: 'skip',
        motivo: `já igual (sim=${sim.toFixed(2)})`,
        similaridade: sim,
        dbId: dbDoc.id,
      });
    } else {
      plans.push({
        numero: e.numero,
        action: 'update',
        motivo: `texto diferente (sim=${sim.toFixed(2)})`,
        similaridade: sim,
        dbId: dbDoc.id,
        descAntiga,
        descNova: e.texto,
      });
    }
  }

  const toUpdate = plans.filter((p) => p.action === 'update');
  const toCreate = plans.filter((p) => p.action === 'create');
  const toSkip = plans.filter((p) => p.action === 'skip');

  console.log(`Plano: ✅ criar ${toCreate.length} | 🔄 atualizar ${toUpdate.length} | ⏭️ skip ${toSkip.length}\n`);

  console.log('Top 5 atualizações (similaridade mais baixa):');
  toUpdate.sort((a, b) => (a.similaridade ?? 0) - (b.similaridade ?? 0));
  for (const p of toUpdate.slice(0, 5)) {
    console.log(`\n  Enunciado ${p.numero} (sim=${p.similaridade?.toFixed(2)}):`);
    console.log(`    DB:  ${p.descAntiga?.slice(0, 120)}...`);
    console.log(`    PDF: ${p.descNova?.slice(0, 120)}...`);
  }

  if (!apply) {
    console.log('\nPara aplicar:');
    console.log('  npx dotenv -e .env.local -- npx tsx scripts/apply-ibda-enunciados.ts --apply');
    await prisma.$disconnect();
    return;
  }

  // APPLY
  console.log('\nAplicando...');
  let success = 0;
  let errors = 0;

  for (const p of plans) {
    if (p.action === 'skip') continue;
    const e = enunciados.find((x) => x.numero === p.numero)!;

    try {
      if (p.action === 'update') {
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
      } else {
        // create — porém precisaria de tags válidas. Vou só atualizar; create não esperado pra IBDA
        console.log(`  ⚠ Enunciado ${p.numero} é novo — skip create (DB pode estar incompleto)`);
        continue;
      }
      success++;
    } catch (err) {
      errors++;
      console.log(`  ❌ Enunciado ${p.numero}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n✅ Atualizadas: ${success} | ❌ Falhas: ${errors}`);

  const logPath = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-ibda-apply-log.json`
  );
  fs.writeFileSync(
    logPath,
    JSON.stringify({ runAt: new Date().toISOString(), apply, stats: { success, errors }, plans }, null, 2)
  );
  console.log(`📄 Log: ${logPath}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
