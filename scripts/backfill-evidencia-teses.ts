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

  // TODO enunciado de TODA destilação atual — sem o recorte por `veredito:
  // 'fiel'` que a spec §7.2 item 3 sugeria. A reconstrução é perecível e
  // irreversível: restringi-la aos 93 já julgados condenaria os ~419 ainda não
  // julgados a nascerem inelegíveis para sempre, sem sinal nenhum do porquê
  // quando alguém os julgasse `fiel` meses depois. Ampliar custa quase nada —
  // a reconstrução é só banco (sem LLM, sem rede) e, para as destilações que já
  // entram na varredura, o dossiê e o lookup de citantes já foram montados, de
  // modo que os enunciados irmãos saem de graça.
  const destilacoes = await prisma.teseDestilacao.findMany({
    where: { atual: true },
    select: {
      id: true, numeroAlvo: true, anoAlvo: true, criadoEm: true, dossieTrechos: true,
      enunciados: { select: { id: true, trechosFonte: true } },
    },
    orderBy: { criadoEm: 'asc' },
  });

  console.log(`\n=== EVIDÊNCIA DAS TESES ===\n`);
  const totalEnunciados = destilacoes.reduce((s, d) => s + d.enunciados.length, 0);
  console.log(`Destilações atuais: ${destilacoes.length} (${totalEnunciados} enunciados, independentemente de veredito)`);
  console.log(executar ? 'Modo: EXECUTAR\n' : 'Modo: dry-run (nada será gravado)\n');

  let comEvidencia = 0, semEvidencia = 0, divergentes = 0, linhas = 0;

  for (const d of destilacoes) {
    const r = await reconstruirEvidencia(d, d.enunciados);
    if (r.status === 'contagem-divergente') {
      divergentes++;
      // `descartados` é o que a reconstrução perdeu aqui — sem somá-lo, quem
      // roda o script termina sem saber quantos enunciados ficaram sem
      // evidência, porque o contador de destilações não diz quantos há dentro.
      semEvidencia += r.descartados;
      console.log(`  !  ${d.numeroAlvo}/${d.anoAlvo} — dossiê mudou desde a destilação (${r.descartados} enunciados sem evidência)`);
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
  console.log(`Enunciados sem evidência: ${semEvidencia} (inclui os de destilação divergente)`);
  console.log(`Destilações com dossiê divergente: ${divergentes}`);
  if (!executar) console.log('\nPara aplicar: --executar\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
