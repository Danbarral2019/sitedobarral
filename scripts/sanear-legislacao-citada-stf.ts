/**
 * Saneia o acervo do STF depois da correção do parser de legislação citada.
 *
 * A triagem antiga aceitava qualquer bloco cujo número fosse 14133, sem olhar
 * a esfera nem o ano, e lia o sufixo do artigo só na forma hifenizada. Isso
 * deixou no banco dois tipos de registro errado:
 *
 *  1. julgados de OUTRA lei — a 14.113/2020 (FUNDEB) e a lei municipal
 *     14.133/2006 de São Paulo — aprovados como se citassem a Lei 14.133, com
 *     dispositivos dela amarrados;
 *  2. julgados legítimos com o artigo errado, porque `ART-0337L` virava `337`
 *     e `ART-0005A` virava `5`.
 *
 * Este script relê a fonte com o parser corrigido e conserta o que já está
 * gravado. Nada é excluído — por política do projeto, decisões coletadas são
 * preservadas e apenas marcadas, como se fez com os 254 registros do DataJud.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/sanear-legislacao-citada-stf.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/sanear-legislacao-citada-stf.ts --apply
 *   STF_DADOS_JSON=/caminho/arquivo.json npx tsx scripts/sanear-legislacao-citada-stf.ts
 *
 * Sem `--apply` o script é dry-run: lê tudo, imprime o plano e não grava.
 *
 * Contexto e números em `docs/audits/2026-08-19-verificacao-material-stf.md`.
 */

import { readFileSync } from 'node:fs';
import { prisma } from '@/lib/prisma';
import { citaLei14133, extrairArtigos14133 } from '@/lib/jurisprudencia/legislacao-citada';
import type { StfDocumentoBruto } from '@/lib/stf/types';

const CAMINHO_PADRAO =
  'D:/OneDrive/XX - Arquivos/Documentos/STF_licitacoes/stf_lei14133_dados_2026-08-16.json';

const APLICAR = process.argv.includes('--apply');

/** Nota gravada em `adminNotes`, para que a mudança seja rastreável no admin. */
const NOTA_DESAMARRACAO =
  'Saneamento 2026-08-30: o bloco de legislação citada não é da Lei 14.133/2021 ' +
  '(esfera não-federal ou ANO-2020, que é a Lei 14.113/2020 do FUNDEB). ' +
  'Aprovação automática revogada e dispositivos desamarrados.';

interface CorpusStf {
  acordaos?: StfDocumentoBruto[];
  monocraticas?: StfDocumentoBruto[];
  amplo?: StfDocumentoBruto[];
}

function arg(nome: string): string | null {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : null;
}

/**
 * Token cru do número da lei — o que a triagem ANTIGA considerava suficiente.
 * Serve para isolar o delta: sem isto, um julgado que nunca citou a Lei 14.133
 * (e entrou no acervo pelo mérito que o classificador viu na ementa) seria
 * confundido com um julgado cuja citação a nova triagem rejeitou. São 395 de
 * 600 registros de diferença — a coleta do STF é mais larga que a citação.
 */
const RE_TOKEN_CRU = /LEI[-:]0*14133\b/i;

interface EstadoNaFonte {
  /** O parser antigo diria que cita. */
  temToken: boolean;
  /** O parser corrigido diz que cita. */
  cita: boolean;
  artigos: string[];
}

/**
 * Um mesmo julgado aparece em mais de um grupo do corpus com o mesmo `id`
 * (`amplo` repete `acordaos`), e o bloco pode variar só na quebra de linha.
 * A primeira ocorrência vence — o parser é indiferente a essa variação.
 */
function indexarFonte(corpus: CorpusStf): Map<string, EstadoNaFonte> {
  const porId = new Map<string, EstadoNaFonte>();

  for (const grupo of ['acordaos', 'monocraticas', 'amplo'] as const) {
    for (const doc of corpus[grupo] ?? []) {
      const id = String(doc.id);
      if (porId.has(id)) continue;
      const campo = doc.documental_legislacao_citada_texto;
      const bs = campo === null || campo === undefined ? [] : (Array.isArray(campo) ? campo : [campo]).map(String);
      porId.set(id, {
        temToken: bs.some((b) => RE_TOKEN_CRU.test(b)),
        cita: citaLei14133(campo),
        artigos: extrairArtigos14133(campo),
      });
    }
  }

  return porId;
}

async function main() {
  const caminho = arg('--fonte') ?? process.env.STF_DADOS_JSON ?? CAMINHO_PADRAO;
  console.log(`fonte: ${caminho}`);
  console.log(`modo: ${APLICAR ? 'APPLY (grava)' : 'dry-run (não grava)'}\n`);

  const fonte = indexarFonte(JSON.parse(readFileSync(caminho, 'utf8')) as CorpusStf);
  console.log(`documentos distintos na fonte: ${fonte.size}`);

  const acervo = await prisma.tribunalDecision.findMany({
    where: { tribunalCode: 'STF' },
    select: {
      id: true, sourceId: true, title: true, approvalStatus: true,
      isRelevant: true, leiArticlesArr: true, reviewedBy: true,
    },
  });
  console.log(`registros do STF no acervo: ${acervo.length}\n`);

  const desamarrar: typeof acervo = [];
  const reamarrar: { reg: (typeof acervo)[number]; artigos: string[] }[] = [];
  const semAmarracao: typeof acervo = [];
  let foraDaFonte = 0;
  let nuncaCitou = 0;

  for (const reg of acervo) {
    const naFonte = reg.sourceId ? fonte.get(reg.sourceId) : undefined;
    if (!naFonte) {
      foraDaFonte++;
      continue;
    }

    // Quem nunca teve o token não é assunto deste saneamento: entrou no acervo
    // pelo mérito que o classificador viu na ementa, não por citação.
    if (!naFonte.temToken) {
      nuncaCitou++;
      continue;
    }

    if (!naFonte.cita) {
      // A citação era de outra lei. Só há o que desfazer se ela chegou a
      // amarrar dispositivo — é a amarração que sobrepõe o classificador e
      // auto-aprova (ver `aplicarAmarracaoAutoritativa`). Sem artigo, o status
      // é juízo do classificador e não cabe a este script revogá-lo.
      if (reg.leiArticlesArr.length > 0) desamarrar.push(reg);
      else semAmarracao.push(reg);
      continue;
    }

    const atual = [...reg.leiArticlesArr].sort();
    const novo = [...naFonte.artigos].sort();
    if (atual.join('|') !== novo.join('|')) reamarrar.push({ reg, artigos: naFonte.artigos });
  }

  console.log(`sem correspondência na fonte (intocados): ${foraDaFonte}`);
  console.log(`nunca citaram a lei — coletados por mérito da ementa (intocados): ${nuncaCitou}\n`);

  console.log(`=== NÃO É A LEI 14.133, e amarrou dispositivo — revogar: ${desamarrar.length}`);
  for (const r of desamarrar) {
    const revisado = r.reviewedBy ? '  [REVISADO POR HUMANO — status preservado]' : '';
    console.log(
      `  ${r.title.slice(0, 26).padEnd(26)} ${r.approvalStatus.padEnd(14)} arts=[${r.leiArticlesArr.join(', ')}]${revisado}`
    );
  }

  console.log(
    `\n=== NÃO É A LEI 14.133, mas não amarrou nada — só reportado, INTOCADO: ${semAmarracao.length}`
  );
  for (const r of semAmarracao) {
    console.log(`  ${r.title.slice(0, 26).padEnd(26)} ${r.approvalStatus}`);
  }

  console.log(`\n=== ARTIGOS AMARRADOS ERRADOS — reamarrar: ${reamarrar.length}`);
  for (const { reg, artigos } of reamarrar) {
    console.log(
      `  ${reg.title.slice(0, 26).padEnd(26)} [${reg.leiArticlesArr.join(', ')}] -> [${artigos.join(', ')}]`
    );
  }

  if (!APLICAR) {
    console.log('\ndry-run: nada foi gravado. Rode de novo com --apply para aplicar.');
    return;
  }

  let revogados = 0;
  let reamarrados = 0;

  for (const r of desamarrar) {
    // Veredito humano não é sobrescrito — mesma política de `montarDadosUpdateStf`
    // no conector. Os dispositivos, que são conteúdo e não juízo, sempre saem.
    await prisma.tribunalDecision.update({
      where: { id: r.id },
      data: {
        leiArticlesArr: [],
        adminNotes: NOTA_DESAMARRACAO,
        ...(r.reviewedBy ? {} : { approvalStatus: 'auto_rejected', isRelevant: false }),
      },
    });
    revogados++;
  }

  for (const { reg, artigos } of reamarrar) {
    await prisma.tribunalDecision.update({
      where: { id: reg.id },
      data: { leiArticlesArr: artigos },
    });
    reamarrados++;
  }

  console.log(`\naplicado: ${revogados} desamarrados, ${reamarrados} reamarrados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
