/**
 * Vigência dos atos que entram em vigor "na data de sua publicação" (ou após
 * vacância em dias) mas cujo texto gravado não registra a data da publicação,
 * caso das instruções normativas copiadas do portal gov.br, que não trazem o
 * rodapé do DOU.
 *
 * Para cada ato sem vigência, busca a publicação na consulta oficial do DOU
 * (in.gov.br, via `lib/dou-api.ts`) pela frase exata do título ("10, de 12 de
 * novembro de 2012"), entre a data do ato e 60 dias depois, e calcula a vigência com
 * `lib/legislacao/vigencia.ts`.
 *
 * Dry-run (padrão): nada é gravado; relata e salva um CSV em scripts/output/.
 * --apply: grava effectiveDate dos encontrados (só onde ainda está vazio).
 *
 * O in.gov.br precisa estar acessível da máquina que roda o script.
 *
 * Uso:
 *   npx tsx scripts/vigencia-pela-publicacao-dou.ts
 *   npx tsx scripts/vigencia-pela-publicacao-dou.ts --apply
 *   npx tsx scripts/vigencia-pela-publicacao-dou.ts --id=<uuid> [--apply]
 */
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { DOUClient, DOUField, DOUPeriod, DOUSection, type DOUSearchResult } from '../lib/dou-api';
import { dataDoAto } from '../lib/legislacao/cabecalho';
import {
  clausulaDeVigencia,
  regraDeVigencia,
  publicacaoNoTexto,
  calcularVigencia,
  dentroDaJanela,
  tituloDoDouEDoAto,
} from '../lib/legislacao/vigencia';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
const ddmmaaaa = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "DD/MM/YYYY" do resultado do DOU → Date UTC. */
function dataDoResultado(r: DOUSearchResult): Date | null {
  const m = r.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
}

async function buscarPublicacao(
  dou: DOUClient,
  tipo: string,
  numero: string,
  ato: Date,
): Promise<{ data: Date; titulo: string } | 'falhou' | null> {
  const dia = ato.getUTCDate();
  const mes = MESES[ato.getUTCMonth()];
  const ano = ato.getUTCFullYear();
  const ate = new Date(ato.getTime() + 60 * 86_400_000);
  // Frase exata no texto todo: a busca restrita ao título (title-"...") não
  // acha nada no portal atual, e a busca sem aspas devolve milhares de
  // resultados em que o ato não aparece entre os primeiros. O filtro
  // tituloDoDouEDoAto separa o ato das publicações que só o citam.
  const d = dia === 1 ? '1º' : String(dia);
  const termos = [...new Set([
    `${numero}, de ${d} de ${mes} de ${ano}`,
    `${numero} de ${d} de ${mes} de ${ano}`,
    `${numero}, de ${dia} de ${mes} de ${ano}`,
  ])];
  let falhas = 0;
  for (const termo of termos) {
    let resultados: DOUSearchResult[] = [];
    try {
      resultados = await dou.search({
        searchTerm: termo,
        field: DOUField.TUDO,
        isExactSearch: true,
        period: DOUPeriod.PERSONALIZADO,
        publishFrom: ddmmaaaa(ato),
        publishTo: ddmmaaaa(ate),
        sections: [DOUSection.TODOS],
        maxResults: 20,
      });
    } catch (err) {
      falhas++;
      console.log(`    busca falhou (${termo}): ${err instanceof Error ? err.message : err}`);
    }
    const achados = resultados
      .filter((r) => tituloDoDouEDoAto(r.title, r.abstract, tipo, numero, ano))
      .map((r) => ({ data: dataDoResultado(r), titulo: r.title }))
      .filter((x): x is { data: Date; titulo: string } => !!x.data && dentroDaJanela(x.data, ato))
      .sort((a, b) => a.data.getTime() - b.data.getTime());
    if (achados.length) return achados[0];
    await sleep(1500);
  }
  // Todas as buscas deram erro (rede, bloqueio): não é o mesmo que "não achou".
  return falhas === termos.length ? 'falhou' : null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const onlyId = process.argv.find((a) => a.startsWith('--id='))?.split('=')[1];

  const acts = await prisma.legislativeAct.findMany({
    where: { effectiveDate: null, ...(onlyId ? { id: onlyId } : {}) },
    select: { id: true, fullNumber: true, type: true, number: true, title: true, content: true },
    orderBy: { fullNumber: 'asc' },
  });

  const dou = new DOUClient();
  const linhas: string[][] = [['ato', 'situacao', 'publicacao_dou', 'vigencia', 'titulo_no_dou', 'clausula']];
  const gravar: Array<{ id: string; ato: string; vigencia: Date }> = [];

  console.log(`\n${acts.length} atos sem vigência${apply ? '' : ' (dry-run: nada será gravado)'}.\n`);
  for (const a of acts) {
    const cl = clausulaDeVigencia(a.content);
    const regra = cl ? regraDeVigencia(cl.resto) : null;
    const ato = dataDoAto(a.number, [a.title, a.content]);
    let situacao = '';
    let pub: { data: Date; titulo: string } | null = null;
    let falhou = false;
    let vigencia: Date | null = null;

    if (!cl || !regra) situacao = 'sem cláusula de vigência no texto';
    else if (regra.tipo === 'especial' || regra.tipo === 'data') situacao = 'regra que exige leitura (fora do escopo)';
    else if (cl.multiplas) situacao = 'mais de uma cláusula de vigência (fora do escopo)';
    else if (!ato) situacao = 'data do ato não identificada no texto';
    else if (publicacaoNoTexto(a.content, ato)) situacao = 'publicação já consta do texto (fora do escopo)';
    else {
      const achado = await buscarPublicacao(dou, a.type, a.number, ato);
      falhou = achado === 'falhou';
      pub = achado === 'falhou' ? null : achado;
      vigencia = pub ? calcularVigencia(regra, pub.data) : null;
      situacao = pub
        ? regra.tipo === 'vacancia' ? `publicação no DOU + ${regra.dias} dias` : 'publicação no DOU'
        : falhou ? 'busca no DOU falhou (rede ou bloqueio)' : 'não encontrado no DOU';
      if (vigencia) gravar.push({ id: a.id, ato: a.fullNumber, vigencia });
      await sleep(1500);
    }

    console.log(`  ${vigencia ? '✓' : '·'} ${a.fullNumber}: ${situacao}${vigencia ? ` → ${iso(vigencia)} (DOU ${iso(pub!.data)})` : ''}`);
    linhas.push([a.fullNumber, situacao, iso(pub?.data ?? null), iso(vigencia), pub?.titulo ?? '', cl?.texto ?? '']);
  }

  const dir = path.join(process.cwd(), 'scripts', 'output');
  mkdirSync(dir, { recursive: true });
  const arquivo = path.join(dir, `vigencia-dou-${new Date().toISOString().slice(0, 10)}.csv`);
  const csv = linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n');
  writeFileSync(arquivo, '﻿' + csv, 'utf8');
  const falhas = linhas.filter((l) => l[1].startsWith('busca no DOU falhou')).length;
  console.log(`\n${gravar.length} com vigência encontrada. Relatório: ${arquivo}`);
  if (falhas) console.log(`⚠️  ${falhas} busca(s) falharam por rede ou bloqueio; o in.gov.br está acessível desta máquina?`);

  if (!apply) {
    console.log('🔒 dry-run: nada foi gravado. Confira o CSV e rode com --apply para gravar.');
    return;
  }
  let gravados = 0;
  for (const g of gravar) {
    // Só onde ainda está vazio: não sobrescreve vigência gravada no meio do caminho.
    const r = await prisma.legislativeAct.updateMany({
      where: { id: g.id, effectiveDate: null },
      data: { effectiveDate: g.vigencia },
    });
    gravados += r.count;
  }
  console.log(`✅ ${gravados} vigência(s) gravada(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
