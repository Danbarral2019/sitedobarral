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
import { prisma } from '../prisma';
import { carregarVeredito } from './carregar-veredito';
import type { TeseDestilada } from './destilar-tese';
import type { DossieUso } from './trechos-de-citacao';

/** Faixa medida em que o motor produz tese em vez de se calar. */
export const MIN_NO_VOTO = 5;
/** Evita redestilar por ruído de crescimento. */
export const FATOR_CRESCIMENTO = 1.5;
/** Evita cascata de redestilação enquanto a campanha da frente C1 ingere. */
export const DIAS_MINIMOS = 7;
/** Sobe quando prompt ou modelo do motor mudarem, forçando redestilação. */
export const VERSAO_MOTOR = 1;

export interface Candidato {
  numero: number;
  ano: number;
  chave: string;
  noVoto: number;
}

export function ehElegivel(
  noVotoAtual: number,
  versaoAtual: { dossieNoVoto: number; criadoEm: Date } | null,
  agora: Date
): boolean {
  if (versaoAtual === null) return noVotoAtual >= MIN_NO_VOTO;
  const cresceu = noVotoAtual >= versaoAtual.dossieNoVoto * FATOR_CRESCIMENTO;
  const dias = (agora.getTime() - versaoAtual.criadoEm.getTime()) / (24 * 60 * 60 * 1000);
  return cresceu && dias > DIAS_MINIMOS;
}

/**
 * Candidatos à destilação. A contagem de citantes-no-voto vem do grafo
 * (`AcordaoCitacao`), que é a fonte da verdade da Fase 1.
 */
export async function selecionarElegiveis(limite: number): Promise<Candidato[]> {
  const agora = new Date();

  const alvos = await prisma.$queryRaw<Array<{ numero: number; ano: number; no_voto: number }>>`
    SELECT "numeroAlvo" AS numero, "anoAlvo" AS ano,
           count(DISTINCT "origemId") FILTER (WHERE "noVoto")::int AS no_voto
    FROM "AcordaoCitacao"
    GROUP BY 1, 2
    HAVING count(DISTINCT "origemId") FILTER (WHERE "noVoto") >= ${MIN_NO_VOTO}
    ORDER BY no_voto DESC`;

  const atuais = await prisma.teseDestilacao.findMany({
    where: { atual: true },
    select: { numeroAlvo: true, anoAlvo: true, dossieNoVoto: true, criadoEm: true, versaoMotor: true },
  });
  const porChave = new Map(atuais.map((a) => [`${a.numeroAlvo}/${a.anoAlvo}`, a]));

  const out: Candidato[] = [];
  for (const alvo of alvos) {
    if (out.length >= limite) break;
    const chave = `${alvo.numero}/${alvo.ano}`;
    const atual = porChave.get(chave) ?? null;
    // Versão de motor antiga força redestilação, independente do crescimento.
    const motorDesatualizado = atual !== null && atual.versaoMotor < VERSAO_MOTOR;
    if (motorDesatualizado || ehElegivel(alvo.no_voto, atual, agora)) {
      out.push({ numero: alvo.numero, ano: alvo.ano, chave, noVoto: alvo.no_voto });
    }
  }
  return out;
}

/**
 * Grava uma versão nova e desmarca a anterior, numa transação — duas versões
 * com `atual: true` para o mesmo caso quebrariam a exibição.
 */
export async function persistirDestilacao(
  alvo: { numero: number; ano: number },
  tese: TeseDestilada,
  dossie: DossieUso
): Promise<{ destilacaoId: string; herdados: number; novos: number }> {
  const chave = `${alvo.numero}/${alvo.ano}`;

  const anterior = await prisma.teseDestilacao.findFirst({
    where: { numeroAlvo: alvo.numero, anoAlvo: alvo.ano, atual: true },
    include: {
      enunciados: { select: { id: true, enunciado: true, veredito: true, julgadoEm: true, julgadoPor: true } },
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

  let herdados = 0;
  const enunciados = (tese.teses ?? []).map((t, i) => {
    const h = carregarVeredito(t.enunciado, anterioresEnunciados);
    if (h.veredito !== null) herdados++;
    return {
      ordem: i,
      enunciado: t.enunciado,
      inovacao: t.inovacao,
      trechosFonte: t.trechosFonte as unknown as object,
      ...h,
    };
  });

  const divergencias = (tese.divergencias ?? []).map((d) => {
    const h = carregarVeredito(d.trecho, anterioresDivergencias);
    if (h.veredito !== null) herdados++;
    return {
      origemChave: d.origemChave,
      precedenteApontado: d.precedenteApontado,
      trecho: d.trecho,
      natureza: d.natureza,
      ...h,
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
