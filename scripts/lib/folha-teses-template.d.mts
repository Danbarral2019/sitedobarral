// Tipos do template da folha de calibração (o módulo em si é JS puro, para que
// tanto os scripts .mjs quanto os .ts possam consumi-lo).

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
}): string;
