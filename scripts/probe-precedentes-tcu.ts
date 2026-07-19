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

  // Índice de casamento sobre TODO o acervo de acórdãos (não só os com inteiro
  // teor): senão uma citação a um acórdão que já temos, mas ainda não catalogado,
  // contaria como "externa" e inflaria a taxa de externas / a lacuna do acervo.
  const todosAcordaos = await prisma.document.findMany({
    where: { category: 'acordao', acordaoNumero: { not: null }, acordaoAno: { not: null } },
    select: { id: true, acordaoNumero: true, acordaoAno: true },
  });
  const indice = new Map<string, string>();
  for (const a of todosAcordaos) {
    const chave = `${a.acordaoNumero}/${a.acordaoAno}`;
    if (!indice.has(chave)) indice.set(chave, a.id);
  }
  console.log(`Acervo de acórdãos no índice de casamento: ${todosAcordaos.length}\n`);

  const cits: CitacaoProcessada[] = [];
  // Um candidato de amostra por DOCUMENTO (a 1ª citação de cada acórdão), para
  // depois amostrar sistematicamente ao longo do corpus. Senão os 40 primeiros
  // viriam todos dos 2-3 primeiros documentos e a amostra não representaria a
  // diversidade de formatos que a folha de calibração precisa fazer o Daniel julgar.
  type ItemAmostra = { origem: string; raw: string; secao: string | null; matched: boolean; trecho: string };
  const candidatos: ItemAmostra[] = [];

  for (const d of docs) {
    const texto = d.tcuTextoCompleto ?? '';
    const secoes = seccionarAcordao(texto);
    let candidatoDoDoc = false;
    for (const c of extractAcordaoCitations(texto)) {
      // Descarta auto-citação (o próprio acórdão no cabeçalho/dispositivo).
      if (d.acordaoNumero === c.numero && d.acordaoAno === c.ano) continue;
      const alvoId = indice.get(`${c.numero}/${c.ano}`) ?? null;
      const secao = secaoDe(secoes, c.index);
      cits.push({ origemId: d.id, numero: c.numero, ano: c.ano, secao, matched: alvoId !== null, alvoId });
      if (!candidatoDoDoc) {
        candidatoDoDoc = true;
        candidatos.push({
          origem: d.title.slice(0, 44),
          raw: c.raw,
          secao,
          matched: alvoId !== null,
          trecho: texto.slice(Math.max(0, c.index - 90), c.index + 90).replace(/\s+/g, ' ').trim(),
        });
      }
    }
  }

  // Amostragem sistemática: ~AMOSTRA_N itens espalhados uniformemente pelos
  // documentos que citam, cobrindo formatos variados (determinístico).
  const step = Math.max(1, Math.floor(candidatos.length / AMOSTRA_N));
  const amostra = candidatos.filter((_, i) => i % step === 0).slice(0, AMOSTRA_N);

  const resumo = {
    geradoEm: '2026-07-18',
    totalAcordaosAnalisados: docs.length,
    acordaosNoIndice: todosAcordaos.length,
    densidade: densidade(cits, docs.length),
    porSecao: porSecao(cits),
    matching: taxaMatching(cits),
    topLeadingCases: rankingLeadingCases(cits, 30),
    amostra,
  };

  writeFileSync(SAIDA, JSON.stringify(resumo, null, 2) + '\n', 'utf8');

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
