/**
 * Persiste a evidência das teses já destiladas, reconstruindo o dossiê
 * histórico (spec §7.2).
 *
 * URGENTE: a janela fecha com o crescimento do grafo. Cada dia aumenta a chance
 * de a contagem não casar e o enunciado ficar sem evidência para sempre.
 *
 * Idempotente: a gravação é um upsert por (enunciadoId, ordem) dentro de uma
 * transação por enunciado — reexecutar reescreve as mesmas linhas.
 *
 * Uso:
 *   npx tsx scripts/backfill-evidencia-teses.ts              # dry-run
 *   npx tsx scripts/backfill-evidencia-teses.ts --executar
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { reconstruirEvidencia } from '../lib/tcu/reconstruir-evidencia';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  const executar = process.argv.includes('--executar');

  const destilacoes = await prisma.teseDestilacao.findMany({
    where: { atual: true, enunciados: { some: { veredito: 'fiel' } } },
    select: {
      id: true, numeroAlvo: true, anoAlvo: true, criadoEm: true, dossieTrechos: true,
      enunciados: { where: { veredito: 'fiel' }, select: { id: true, trechosFonte: true } },
    },
    orderBy: { criadoEm: 'asc' },
  });

  console.log(`\n=== EVIDÊNCIA DAS TESES ===\n`);
  console.log(`Destilações com tese fiel: ${destilacoes.length}`);
  console.log(executar ? 'Modo: EXECUTAR\n' : 'Modo: dry-run (nada será gravado)\n');

  let comEvidencia = 0, semEvidencia = 0, divergentes = 0, linhas = 0;

  for (const d of destilacoes) {
    const r = await reconstruirEvidencia(d, d.enunciados);
    if (r.status === 'contagem-divergente') {
      divergentes++;
      console.log(`  !  ${d.numeroAlvo}/${d.anoAlvo} — dossiê mudou desde a destilação`);
      continue;
    }
    for (const e of d.enunciados) {
      const ls = r.linhasPorEnunciado[e.id];
      if (!ls) { semEvidencia++; continue; }
      comEvidencia++;
      linhas += ls.length;
      if (executar) {
        await prisma.$transaction(
          ls.map((l) =>
            prisma.teseTrechoFonte.upsert({
              where: { enunciadoId_ordem: { enunciadoId: e.id, ordem: l.ordem } },
              create: { enunciadoId: e.id, ...l },
              update: { ...l },
            }),
          ),
        );
      }
    }
  }

  console.log(`\nEnunciados com evidência: ${comEvidencia} (${linhas} trechos)`);
  console.log(`Sem evidência: ${semEvidencia} · destilações com dossiê divergente: ${divergentes}`);
  if (!executar) console.log('\nPara aplicar: --executar\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
