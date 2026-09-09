/**
 * Persistência das teses destiladas (spec 2026-07-21). Núcleo único,
 * compartilhado entre o cron diário e o backfill da onda A-W2, para as duas
 * rotas não divergirem.
 *
 * A unidade versionada é a destilação INTEIRA de um caso, nunca a tese
 * individual: o motor pode reordenar, fundir ou dividir teses entre rodadas,
 * então "a tese 2 do acórdão" não é uma identidade estável. O que existe é
 * "este enunciado, nesta versão".
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { carregarVeredito } from './carregar-veredito';
import { indicesDeclarados } from './elegibilidade-tese';
import { citantesDoDossie, citanteDoTrecho, type LookupCitantes } from './citantes-do-dossie';
import type { TeseDestilada } from './destilar-tese';
import type { DossieUso } from './trechos-de-citacao';

/**
 * Resolve os índices declarados contra o dossiê EM MÃOS — aqui não há
 * reconstrução nem verificação a fazer: o cron acabou de montar este dossiê,
 * então os índices casam por construção.
 *
 * Tudo ou nada: se qualquer índice declarado estiver fora do dossiê, devolve
 * lista vazia. Evidência parcial faria a tese parecer fundamentada pela metade
 * (spec §6, EVIDENCIA_INTEGRAL).
 */
function trechosParaGravar(
  trechosFonte: unknown,
  dossie: DossieUso,
  citantes: LookupCitantes,
): Prisma.TeseTrechoFonteUncheckedCreateWithoutEnunciadoInput[] {
  // Unchecked, não Checked: gravamos `origemDocumentId` como escalar solto
  // (pode ser null quando o citante não está na base), não como
  // `origemDocument: { connect: ... } `— a variante Checked exige a relação.
  const indices = indicesDeclarados(trechosFonte);
  if (indices.length === 0) return [];
  const linhas: Prisma.TeseTrechoFonteUncheckedCreateWithoutEnunciadoInput[] = [];
  for (const i of indices) {
    const t = dossie.trechos[i];
    if (!t) return []; // índice fora do dossiê invalida o enunciado inteiro
    const [num, ano] = t.origemChave.split('/');
    const origemNumero = parseInt(num, 10);
    const origemAno = parseInt(ano, 10);
    if (!Number.isFinite(origemNumero) || !Number.isFinite(origemAno)) return [];
    const doc = citanteDoTrecho(citantes, t);
    // Invariante da spec §7.1: todo trecho consumível tem ao menos um caminho
    // para o inteiro teor. Sem nenhum, o enunciado inteiro fica sem evidência.
    if (!doc?.id && !doc?.url && !doc?.tcuLinkPDF) return [];
    linhas.push({
      ordem: i,
      trecho: t.trecho,
      origemNumero,
      origemAno,
      origemColegiado: doc?.tcuOrgaoJulgador ?? null,
      origemUrl: doc?.url ?? null,
      origemLinkPDF: doc?.tcuLinkPDF ?? null,
      origemDocumentId: doc?.id ?? null,
      noVoto: t.noVoto,
    });
  }
  return linhas;
}

/** Faixa medida em que o motor produz tese em vez de se calar. */
export const MIN_NO_VOTO = 5;
/** Evita redestilar por ruído de crescimento. */
export const FATOR_CRESCIMENTO = 1.5;
/** Evita cascata de redestilação enquanto a campanha da frente C1 ingere. */
export const DIAS_MINIMOS = 7;
/** Sobe quando prompt ou modelo do motor mudarem, forçando redestilação. */
export const VERSAO_MOTOR = 1;
/** Janela de reavaliação: a ambiguidade só some se o TCU mudar os próprios
 *  dados, o que é raro. 90 dias derruba ~109 requisições/dia para ~1,2. */
export const DIAS_REAVALIACAO_IDENTIDADE = 90;

export interface Candidato {
  numero: number;
  ano: number;
  chave: string;
  noVoto: number;
}

export function ehElegivel(
  noVotoAtual: number,
  versaoAtual: { dossieNoVoto: number; criadoEm: Date } | null,
  agora: Date,
  minNoVoto: number = MIN_NO_VOTO
): boolean {
  if (versaoAtual === null) return noVotoAtual >= minNoVoto;
  const cresceu = noVotoAtual >= versaoAtual.dossieNoVoto * FATOR_CRESCIMENTO;
  const dias = (agora.getTime() - versaoAtual.criadoEm.getTime()) / (24 * 60 * 60 * 1000);
  return cresceu && dias > DIAS_MINIMOS;
}

/**
 * Candidatos à destilação. A contagem de citantes-no-voto vem do grafo
 * (`AcordaoCitacao`), que é a fonte da verdade da Fase 1.
 *
 * `minNoVoto` acima do padrão restringe a onda às faixas mais fortes — o
 * backfill da A-W2 destila primeiro os casos com ≥10 citações no voto e deixa a
 * cauda para depois. O limiar vai ao `HAVING`, não a um filtro em memória:
 * o grafo tem dezenas de milhares de alvos e quase todos ficariam de fora.
 */
export async function selecionarElegiveis(
  limite: number,
  minNoVoto: number = MIN_NO_VOTO,
  opcoes: { temas?: readonly string[] } = {}
): Promise<Candidato[]> {
  const agora = new Date();

  const alvos = await prisma.$queryRaw<Array<{ numero: number; ano: number; no_voto: number }>>`
    SELECT "numeroAlvo" AS numero, "anoAlvo" AS ano,
           count(DISTINCT "origemId") FILTER (WHERE "noVoto")::int AS no_voto
    FROM "AcordaoCitacao"
    GROUP BY 1, 2
    HAVING count(DISTINCT "origemId") FILTER (WHERE "noVoto") >= ${minNoVoto}
    ORDER BY no_voto DESC`;

  const atuais = await prisma.teseDestilacao.findMany({
    where: { atual: true },
    select: { numeroAlvo: true, anoAlvo: true, dossieNoVoto: true, criadoEm: true, versaoMotor: true },
  });
  const porChave = new Map(atuais.map((a) => [`${a.numeroAlvo}/${a.anoAlvo}`, a]));

  // Recorte por matéria (`AcordaoTema`): destilar por volume de citação sozinho
  // enche a base de pessoal, que é a matéria que mais reincide. Quem ainda não
  // tem tema fica de fora deste recorte — classificar antes é barato, destilar
  // à toa não é.
  const noTema = opcoes.temas
    ? new Set(
        (
          await prisma.acordaoTema.findMany({
            where: { tema: { in: [...opcoes.temas] } },
            select: { chave: true },
          })
        ).map((t) => t.chave)
      )
    : null;

  // Sumidouro do cron (2026-09-04): um alvo cuja identidade não resolve
  // (ambíguo ou não encontrado) nunca é destilado, então nunca ganha versão
  // `atual` — sem essa exclusão ele voltaria ao topo todo dia, para sempre.
  // A janela é reavaliada porque o TCU pode publicar o que faltava ou
  // desambiguar o que existe hoje, ainda que raramente.
  const janelaReavaliacao = new Date(agora.getTime() - DIAS_REAVALIACAO_IDENTIDADE * 24 * 60 * 60 * 1000);
  const irresolviveis = new Set(
    (
      await prisma.alvoIdentidadeIrresolvida.findMany({
        where: { verificadoEm: { gte: janelaReavaliacao } },
        select: { chave: true },
      })
    ).map((a) => a.chave)
  );

  const out: Candidato[] = [];
  for (const alvo of alvos) {
    if (out.length >= limite) break;
    const chave = `${alvo.numero}/${alvo.ano}`;
    if (noTema && !noTema.has(chave)) continue;
    if (irresolviveis.has(chave)) continue;
    const atual = porChave.get(chave) ?? null;
    // Versão de motor antiga força redestilação, independente do crescimento.
    const motorDesatualizado = atual !== null && atual.versaoMotor < VERSAO_MOTOR;
    if (motorDesatualizado || ehElegivel(alvo.no_voto, atual, agora, minNoVoto)) {
      out.push({ numero: alvo.numero, ano: alvo.ano, chave, noVoto: alvo.no_voto });
    }
  }
  return out;
}

/**
 * Grava uma versão nova e desmarca a anterior, numa transação — duas versões
 * com `atual: true` para o mesmo caso quebrariam a exibição.
 */
export interface IdentidadeAlvo {
  /** Nulo no nível 2 (convergência) — não há identidade oficial nesse nível. */
  acordaoKey: string | null;
  colegiadoAlvo: string | null;
  relatorAlvo: string | null;
  urlAlvo: string | null;
  /**
   * Nível 2 de procedência (spec §4.3): passado pelo chamador quando a
   * identidade vem de convergência dos citantes, não do TCU. `persistirDestilacao`
   * NÃO confia nisso quando `acordaoKey` está presente — ver comentário abaixo.
   */
  origemIdentidade?: 'convergencia-citantes' | null;
  /** Quantos citantes sustentam o colegiado, no nível de convergência. */
  citantesConcordantes?: number | null;
}

export async function persistirDestilacao(
  alvo: { numero: number; ano: number },
  tese: TeseDestilada,
  dossie: DossieUso,
  identidade?: IdentidadeAlvo | null,
): Promise<{ destilacaoId: string; herdados: number; novos: number }> {
  const chave = `${alvo.numero}/${alvo.ano}`;

  const anterior = await prisma.teseDestilacao.findFirst({
    where: { numeroAlvo: alvo.numero, anoAlvo: alvo.ano, atual: true },
    include: {
      enunciados: {
        select: {
          id: true, enunciado: true, veredito: true, julgadoEm: true, julgadoPor: true,
          publicado: true, vitrinePublica: true, retiradoEm: true, retiradoMotivo: true,
        },
      },
      divergencias: { select: { id: true, trecho: true, veredito: true, julgadoEm: true, julgadoPor: true } },
    },
  });

  const anterioresEnunciados = anterior?.enunciados ?? [];
  const anterioresDivergencias = (anterior?.divergencias ?? []).map((d) => ({
    id: d.id,
    enunciado: d.trecho, // a divergência é pareada pelo trecho de apoio
    veredito: d.veredito,
    julgadoEm: d.julgadoEm,
    julgadoPor: d.julgadoPor,
  }));

  const citantes = await citantesDoDossie(dossie);

  let herdados = 0;
  const enunciados = (tese.teses ?? []).map((t, i) => {
    // Nível 2 ligado só aqui: TeseDivergencia não tem `reconferenciaPendente`,
    // então um veredito provisório numa divergência ficaria invisível. O `map`
    // das divergências, logo abaixo, segue chamando sem a opção.
    const h = carregarVeredito(t.enunciado, anterioresEnunciados, { herdarComTextoDiferente: true });
    if (h.veredito !== null) herdados++;
    return {
      ordem: i,
      enunciado: t.enunciado,
      inovacao: t.inovacao,
      trechosFonte: t.trechosFonte as unknown as object,
      ...h,
      trechos: { create: trechosParaGravar(t.trechosFonte, dossie, citantes) },
    };
  });

  const divergencias = (tese.divergencias ?? []).map((d, i) => {
    const h = carregarVeredito(d.trecho, anterioresDivergencias);
    if (h.veredito !== null) herdados++;
    return {
      ordem: i,
      origemChave: d.origemChave,
      precedenteApontado: d.precedenteApontado,
      trecho: d.trecho,
      natureza: d.natureza,
      // Espalhar `h` inteiro quebraria: TeseDivergencia não tem os campos
      // editoriais (publicado/vitrinePublica/retiradoEm/retiradoMotivo) que
      // carregarVeredito devolve desde o Step 4 — só TeseEnunciado tem.
      veredito: h.veredito,
      herdadoDe: h.herdadoDe,
      julgadoEm: h.julgadoEm,
      julgadoPor: h.julgadoPor,
    };
  });

  const criada = await prisma.$transaction(async (tx) => {
    // `updateMany` condicional por (numeroAlvo, anoAlvo, atual), reavaliado no
    // momento do commit — NÃO `update` pelo `id` de `anterior`, capturado antes
    // da transação. Se o cron e o backfill destilarem o mesmo alvo em paralelo,
    // um `update` por id fixo deixaria as duas transações desmarcarem a MESMA
    // linha antiga (idempotente, sem erro) e cada uma criar a sua com
    // `atual: true` — duas versões atuais para o mesmo caso. O `updateMany`
    // condicional reconsulta `atual: true` dentro da transação, então a segunda
    // a commitar também desmarca a que a primeira acabou de criar.
    // (Um índice único parcial em `(numeroAlvo, anoAlvo) WHERE atual` reforçaria
    // isso no banco, mas o deploy usa `prisma db push`, que remove objetos fora
    // do schema — índice criado via SQL cru seria apagado no próximo push.)
    await tx.teseDestilacao.updateMany({
      where: { numeroAlvo: alvo.numero, anoAlvo: alvo.ano, atual: true },
      data: { atual: false },
    });
    return tx.teseDestilacao.create({
      data: {
        numeroAlvo: alvo.numero,
        anoAlvo: alvo.ano,
        chave,
        assunto: tese.assunto ?? '',
        confianca: tese.confianca ?? 'baixa',
        versaoMotor: VERSAO_MOTOR,
        dossieTrechos: dossie.trechos.length,
        dossieNoVoto: dossie.contagem.noVoto,
        acordaoKey: identidade?.acordaoKey ?? null,
        colegiadoAlvo: identidade?.colegiadoAlvo ?? null,
        relatorAlvo: identidade?.relatorAlvo ?? null,
        urlAlvo: identidade?.urlAlvo ?? null,
        // A origem é derivada aqui, não confiada ao chamador: `acordaoKey`
        // gravado SEMPRE significa nível 1 (spec §4.3), mesmo que o chamador
        // tenha esquecido de anotar `origemIdentidade`. Sem `acordaoKey`, cai
        // no que o chamador passou (nível 2) ou null (nível 3).
        origemIdentidade: identidade?.acordaoKey
          ? 'tcu-oficial'
          : identidade?.origemIdentidade ?? null,
        citantesConcordantes: identidade?.acordaoKey ? null : identidade?.citantesConcordantes ?? null,
        sinais: (tese.sinaisQualitativos ?? []) as unknown as object,
        atual: true,
        enunciados: { create: enunciados },
        divergencias: { create: divergencias },
      },
    });
  });

  return {
    destilacaoId: criada.id,
    herdados,
    novos: enunciados.length + divergencias.length - herdados,
  };
}
