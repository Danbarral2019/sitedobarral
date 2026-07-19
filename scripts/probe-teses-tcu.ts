/**
 * Probe da Fase 2-A: destila a tese de 3 leading cases (2 fixos + 1 par
 * concorrente descoberto no grafo) e emite JSON p/ a folha de calibração.
 * Uso: dotenv -e .env.local -- tsx scripts/probe-teses-tcu.ts
 */
import { writeFileSync } from 'fs';
import { prisma } from '../lib/prisma';
import { coletarTrechosDoAlvo } from '../lib/tcu/trechos-de-citacao';
import { buscarAcordaoPorNumero, escolherCandidato } from '../lib/tcu/buscar-acordao-tcu';
import { destilarTese, type CasoDestilacao, type TeseDestilada } from '../lib/tcu/destilar-tese';
import type { DossieUso } from '../lib/tcu/trechos-de-citacao';

const FIXOS = [{ numero: 1441, ano: 2016 }, { numero: 2622, ano: 2013 }];
const SAIDA = 'docs/audits/2026-07-19-probe-teses-tcu.json';

/** Acha um par de alvos fortes com muitos citantes em comum (candidato a divergência). */
async function descobrirParConcorrente(): Promise<Array<{ numero: number; ano: number }>> {
  // Dois alvos citados no voto por muitos acórdãos, com sobreposição de citantes.
  const topAlvos = await prisma.$queryRaw<Array<{ numeroAlvo: number; anoAlvo: number; n: bigint }>>`
    SELECT "numeroAlvo", "anoAlvo", COUNT(*) AS n
    FROM "AcordaoCitacao" WHERE "noVoto" = true
    GROUP BY "numeroAlvo", "anoAlvo" ORDER BY n DESC LIMIT 15;`;
  // Heurística simples: pega o 3º e 4º mais citados no voto como par (fora dos FIXOS).
  const cands = topAlvos.filter((a) => !FIXOS.some((f) => f.numero === a.numeroAlvo && f.ano === a.anoAlvo));
  return cands.slice(2, 4).map((a) => ({ numero: a.numeroAlvo, ano: a.anoAlvo }));
}

async function montarCaso(alvo: { numero: number; ano: number }): Promise<{ caso: CasoDestilacao; dossie: DossieUso }> {
  const dossie = await coletarTrechosDoAlvo(alvo);
  const cands = await buscarAcordaoPorNumero(alvo.numero, alvo.ano).catch(() => []);
  const escolhido = escolherCandidato(cands); // sem colegiado preferido: usa não-relação / 1º relevante
  const caso: CasoDestilacao = {
    chave: `${alvo.numero}/${alvo.ano}`,
    ementaPropria: escolhido?.ementa ?? null,
    colegiado: escolhido?.colegiado ?? null,
    relator: escolhido?.relator ?? null,
    dossie,
  };
  return { caso, dossie };
}

async function main() {
  const par = await descobrirParConcorrente();
  const alvos = [...FIXOS, ...par];
  console.log('Alvos do probe:', alvos.map((a) => `${a.numero}/${a.ano}`).join(', '));

  const casos: TeseDestilada[] = [];
  const dossies: DossieUso[] = [];
  for (const alvo of alvos) {
    const { caso, dossie } = await montarCaso(alvo);
    console.log(`  ${caso.chave}: ${dossie.contagem.noVoto} no voto, ${dossie.trechos.length} trechos, ementa ${caso.ementaPropria ? 'ok' : 'ausente'}`);
    const t = await destilarTese(caso);
    console.log(`    → ${t.teses.length} tese(s), ${t.sinaisQualitativos.length} sinal(is), ${t.divergencias.length} divergência(s), confiança ${t.confianca}`);
    casos.push(t);
    dossies.push(dossie);
  }

  writeFileSync(SAIDA, JSON.stringify({ geradoEm: '2026-07-19', casos, dossies }, null, 2) + '\n', 'utf8');
  console.log(`\n📄 ${SAIDA}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
