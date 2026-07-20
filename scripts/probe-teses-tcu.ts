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

/**
 * Acha um par de alvos que COMPETEM pelo mesmo assunto: muitos acórdãos citam os DOIS
 * (mesmo origemId) no voto. Sobreposição de citantes é o sinal de que os dois leading
 * cases disputam o mesmo tema — é aí que a divergência (se existir) aparece, quando um
 * voto posterior cita um em vez do outro para a mesma questão. Ranquear só por contagem
 * individual (como antes) pega dois leading cases populares mas desconectados; ranquear
 * por overlap de citantes pega o par que efetivamente compete.
 */
async function descobrirParConcorrente(): Promise<Array<{ numero: number; ano: number }>> {
  const pares = await prisma.$queryRaw<
    Array<{ n1: number; y1: number; n2: number; y2: number; overlap: bigint }>
  >`
    SELECT a."numeroAlvo" AS n1, a."anoAlvo" AS y1,
           b."numeroAlvo" AS n2, b."anoAlvo" AS y2,
           COUNT(*) AS overlap
    FROM "AcordaoCitacao" a
    JOIN "AcordaoCitacao" b
      ON a."origemId" = b."origemId"
     AND (a."numeroAlvo", a."anoAlvo") < (b."numeroAlvo", b."anoAlvo")
    WHERE a."noVoto" = true AND b."noVoto" = true
    GROUP BY a."numeroAlvo", a."anoAlvo", b."numeroAlvo", b."anoAlvo"
    HAVING COUNT(*) >= 5
    ORDER BY overlap DESC
    LIMIT 20;`;

  const ehFixo = (numero: number, ano: number) => FIXOS.some((f) => f.numero === numero && f.ano === ano);
  const candidato = pares.find((p) => !ehFixo(p.n1, p.y1) && !ehFixo(p.n2, p.y2));

  if (candidato) {
    console.log(
      `Par concorrente descoberto: ${candidato.n1}/${candidato.y1} × ${candidato.n2}/${candidato.y2} (overlap de citantes no voto: ${candidato.overlap})`,
    );
    return [
      { numero: candidato.n1, ano: candidato.y1 },
      { numero: candidato.n2, ano: candidato.y2 },
    ];
  }

  console.log('⚠️ Nenhum par com overlap de citantes >= 5 encontrado (fora dos FIXOS) — caindo no fallback: top-2 alvos mais citados no voto (sem garantia de disputa de tema).');
  const topAlvos = await prisma.$queryRaw<Array<{ numeroAlvo: number; anoAlvo: number; n: bigint }>>`
    SELECT "numeroAlvo", "anoAlvo", COUNT(*) AS n
    FROM "AcordaoCitacao" WHERE "noVoto" = true
    GROUP BY "numeroAlvo", "anoAlvo" ORDER BY n DESC LIMIT 15;`;
  const cands = topAlvos.filter((a) => !ehFixo(a.numeroAlvo, a.anoAlvo));
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
