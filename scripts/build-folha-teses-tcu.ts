/**
 * Gera a folha de calibração a partir das teses JÁ PERSISTIDAS no banco
 * (`TeseDestilacao` com `atual: true`), para o Daniel julgar cada tese contra os
 * trechos-fonte literais que a sustentam.
 *
 * Diferença para `build-folha-teses.mjs`: aquele lê o JSON do probe de 3 casos
 * de 19/07/2026 e está congelado nele; este lê o acervo destilado corrente, que
 * é o que a onda A-W2 produz.
 *
 * Os índices de `trechosFonte` apontam para posições do dossiê que existia no
 * momento da destilação, e o dossiê NÃO é persistido — é recomposto aqui a
 * partir do grafo. Se ele mudou desde então (o grafo cresceu, um citante novo
 * entrou), os índices deixam de casar; o caso é então marcado
 * `trechosIndisponiveis` e a folha avisa em vez de exibir o trecho errado.
 * Julgar uma tese contra evidência trocada é pior que julgar sem evidência.
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/build-folha-teses-tcu.ts
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/build-folha-teses-tcu.ts --min-no-voto=10 --out=/tmp/folha.html
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { prisma } from '../lib/prisma';
import { coletarTrechosDoAlvo } from '../lib/tcu/trechos-de-citacao';
import { renderFolha, type CasoCard } from './lib/folha-teses-template.mjs';

const OUT_PADRAO = 'docs/audits/folha-teses-tcu.html';

function flag(nome: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1];
}

async function main() {
  const minNoVoto = Number(flag('min-no-voto') ?? 10);
  const out = flag('out') ?? OUT_PADRAO;

  const destilacoes = await prisma.teseDestilacao.findMany({
    where: { atual: true },
    include: {
      enunciados: { orderBy: { ordem: 'asc' } },
      divergencias: true,
    },
  });
  console.log(`destilações atuais no banco: ${destilacoes.length}`);

  const cards: Array<CasoCard & { _ordem: number }> = [];
  let semTrechos = 0;

  for (const d of destilacoes) {
    const dossie = await coletarTrechosDoAlvo({ numero: d.numeroAlvo, ano: d.anoAlvo });
    if (dossie.contagem.noVoto < minNoVoto) continue;

    // O dossiê recomposto só é intercambiável com o original se tiver o mesmo
    // tamanho — mesmo tamanho não prova mesma ordem, mas tamanho diferente
    // prova que os índices se deslocaram.
    const trechosConfiaveis = dossie.trechos.length === d.dossieTrechos;
    if (!trechosConfiaveis) semTrechos++;

    const resolve = (indices: unknown) =>
      (Array.isArray(indices) ? (indices as number[]) : [])
        .map((i) => dossie.trechos[i])
        .filter(Boolean)
        .map((t) => ({ trecho: t.trecho, origemChave: t.origemChave, noVoto: t.noVoto }));

    cards.push({
      _ordem: dossie.contagem.noVoto,
      chave: d.chave,
      assunto: d.assunto,
      confianca: d.confianca,
      contagem: {
        noVoto: dossie.contagem.noVoto,
        citantesDistintos: dossie.contagem.citantesDistintos,
        ocorrenciasTotal: dossie.contagem.ocorrenciasTotal,
      },
      teses: d.enunciados.map((e) => ({
        enunciado: e.enunciado,
        inovacao: e.inovacao,
        trechos: trechosConfiaveis ? resolve(e.trechosFonte) : [],
      })),
      sinais: (Array.isArray(d.sinais) ? d.sinais : []) as CasoCard['sinais'],
      divergencias: d.divergencias.map((v) => ({
        precedenteApontado: v.precedenteApontado,
        natureza: v.natureza,
        trecho: v.trecho,
        origemChave: v.origemChave,
      })),
      trechosIndisponiveis: !trechosConfiaveis,
    });
  }

  // O sinal mais forte de leading case primeiro: citações na razão de decidir.
  cards.sort((a, b) => b._ordem - a._ordem);
  const semTese = cards.filter((c) => c.teses.length === 0).length;
  const enunciados = cards.reduce((s, c) => s + c.teses.length, 0);

  const html = renderFolha({
    cards: cards.map(({ _ordem, ...c }) => c),
    geradoEm: new Date().toISOString().slice(0, 10),
    eyebrow: `Rede de precedentes · onda A-W2 · ${cards.length} leading cases (>=${minNoVoto} no voto)`,
    notaRodape: semTrechos
      ? `${semTrechos} caso(s) tiveram o dossiê alterado após a destilação e aparecem sem trechos-fonte.`
      : '',
  });

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);

  console.log(`\ncards: ${cards.length}  ·  enunciados: ${enunciados}  ·  sem tese: ${semTese}`);
  console.log(`sem trechos-fonte confiáveis: ${semTrechos}`);
  console.log(`OK — ${out} (${(html.length / 1024).toFixed(0)} KB)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
