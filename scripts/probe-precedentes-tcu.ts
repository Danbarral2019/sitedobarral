/**
 * PROBE (Fase 0) da rede de precedentes do TCU — MEDE, não grava.
 *
 * Lê os acórdãos com inteiro teor já guardado, extrai as citações
 * "Acórdão N/AAAA", atribui cada uma a uma seção (voto/relatório/dispositivo),
 * casa com o acervo e agrega. Produz um JSON de calibração para decidir GO/NO-GO
 * antes de construir a infra de grafo (lição do BIA-8). Não escreve no banco.
 *
 * Uso: npx tsx scripts/probe-precedentes-tcu.ts
 *
 * Ref.: docs/superpowers/specs/2026-07-18-rede-precedentes-tcu-probe-design.md
 */
import { writeFileSync } from 'fs';
import { prisma } from '../lib/prisma';
import { extractAcordaoCitations } from '../lib/tcu/acordao-citation-extractor';
import { seccionarAcordao, secaoDe } from '../lib/tcu/seccionar-acordao';
import {
  densidade,
  porSecao,
  taxaMatching,
  rankingLeadingCases,
  type CitacaoProcessada,
} from '../lib/tcu/precedentes-probe-stats';

const SAIDA = 'docs/audits/2026-07-18-probe-precedentes-tcu.json';
const AMOSTRA_N = 40;

async function main() {
  const docs = await prisma.document.findMany({
    where: { category: 'acordao', tcuTextoCompleto: { not: null } },
    select: { id: true, title: true, acordaoNumero: true, acordaoAno: true, tcuTextoCompleto: true },
    orderBy: { id: 'asc' },
  });
  console.log(`Acórdãos com texto guardado: ${docs.length}\n`);

  // Índice de casamento: "numero/ano" -> id do primeiro Document com esse par.
  const indice = new Map<string, string>();
  for (const d of docs) {
    if (d.acordaoNumero != null && d.acordaoAno != null) {
      const chave = `${d.acordaoNumero}/${d.acordaoAno}`;
      if (!indice.has(chave)) indice.set(chave, d.id);
    }
  }

  const cits: CitacaoProcessada[] = [];
  const amostra: Array<{ origem: string; raw: string; secao: string | null; matched: boolean; trecho: string }> = [];

  for (const d of docs) {
    const texto = d.tcuTextoCompleto ?? '';
    const secoes = seccionarAcordao(texto);
    for (const c of extractAcordaoCitations(texto)) {
      // Descarta auto-citação (o próprio acórdão no cabeçalho/dispositivo).
      if (d.acordaoNumero === c.numero && d.acordaoAno === c.ano) continue;
      const alvoId = indice.get(`${c.numero}/${c.ano}`) ?? null;
      const secao = secaoDe(secoes, c.index);
      cits.push({ origemId: d.id, numero: c.numero, ano: c.ano, secao, matched: alvoId !== null, alvoId });
      if (amostra.length < AMOSTRA_N) {
        amostra.push({
          origem: d.title.slice(0, 44),
          raw: c.raw,
          secao,
          matched: alvoId !== null,
          trecho: texto.slice(Math.max(0, c.index - 90), c.index + 90).replace(/\s+/g, ' ').trim(),
        });
      }
    }
  }

  const resumo = {
    geradoEm: '2026-07-18',
    totalAcordaosAnalisados: docs.length,
    densidade: densidade(cits, docs.length),
    porSecao: porSecao(cits),
    matching: taxaMatching(cits),
    topLeadingCases: rankingLeadingCases(cits, 30),
    amostra,
  };

  writeFileSync(SAIDA, JSON.stringify(resumo, null, 2), 'utf8');

  console.log('Densidade:', resumo.densidade);
  console.log('Por seção:', resumo.porSecao);
  console.log('Matching:', resumo.matching);
  console.log('\nTop 10 leading cases:');
  for (const lc of resumo.topLeadingCases.slice(0, 10)) {
    console.log(
      `  ${lc.chave.padEnd(12)} citado por ${String(lc.citadoPor).padStart(3)} (voto: ${lc.noVoto})  ${lc.alvoId ? '✓ na base' : '✗ externo'}`
    );
  }
  console.log(`\n📄 JSON completo em ${SAIDA}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
