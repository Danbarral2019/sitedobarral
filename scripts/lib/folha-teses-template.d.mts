// Tipos do template da folha de calibração (o módulo em si é JS puro, para que
// tanto os scripts .mjs quanto os .ts possam consumi-lo).

import type { CartaoReconferencia } from '../../lib/teses/reconferencia';

export type { CartaoReconferencia };

export interface TrechoFonte {
  trecho: string;
  origemChave: string;
  noVoto: boolean;
}

export interface TeseCard {
  enunciado: string;
  inovacao: string;
  trechos: TrechoFonte[];
}

export interface CasoCard {
  chave: string;
  assunto: string;
  confianca: string | null;
  contagem: { noVoto: number; citantesDistintos: number; ocorrenciasTotal: number };
  teses: TeseCard[];
  sinais: Array<{ tipo?: string; origemChave: string; trecho: string }>;
  divergencias: Array<{ precedenteApontado: string; natureza: string; trecho: string; origemChave: string }>;
  /** Dossiê mudou depois da destilação: os índices de trecho já não são confiáveis. */
  trechosIndisponiveis?: boolean;
}

export function renderFolha(opts: {
  cards: CasoCard[];
  geradoEm: string;
  eyebrow?: string;
  notaRodape?: string;
  /** Fila de reconferência (spec §4.1, nível 2) — renderizada no topo, à parte dos cards. */
  cartoesReconferencia?: CartaoReconferencia[];
}): string;

/**
 * Monta as linhas de "VEREDITOS POR CASO" do texto de export, incluindo uma
 * seção à parte para chaves da fila de reconferência ausentes de
 * `chavesData` (recortadas por --min-no-voto/--tema) — sem isso, o veredito
 * marcado nesses cartões desapareceria do texto exportado.
 */
export function montarLinhasVeredito(
  chavesData: string[],
  chavesReconferencia: string[],
  vereditos: Record<string, string>
): string[];

/** Um acórdão da fila de reconferência, com todos os seus pares de texto. */
export interface GrupoReconferencia {
  chave: string;
  julgadoPor: string;
  julgadoEm: Date | string;
  pares: Array<{ enunciadoNovo: string; enunciadoAnterior: string }>;
}

/**
 * Agrupa os cartões da fila por acórdão — a unidade do julgamento, já que o
 * veredito é gravado em `store.cards[chave]`. Sem isso, dois enunciados do
 * mesmo caso rendiam dois cards compartilhando um único estado.
 */
export function agruparReconferencia(cartoes: CartaoReconferencia[]): GrupoReconferencia[];
