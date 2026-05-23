export type TstSumulaSituacao = 'CRIADA' | 'ALTERADA' | 'CANCELADA' | 'REVISTA';

export interface TstSumulaItem {
  ordem: string;
  texto: string;
  cancelled: boolean;
  cancelMotivo?: string;
}

export interface TstSumulaResolucao {
  numero: string;
  ano: number | null;
  tipo: string | null;
  divulgadoEm: string | null;
}

export interface TstSumulaIrr {
  numero: string;
  rrNumero: string | null;
  publicadoEm: string | null;
  relator: string | null;
  titulo: string;
  tese: string;
}

export interface TstSumulaParsed {
  numero: number;
  titulo: string;
  observacao: string;
  tese: string;
  situacao: TstSumulaSituacao;
  situacaoMotivo: string | null;
  url: string | null;
  itens: TstSumulaItem[];
  irrs: TstSumulaIrr[];
  resolucoes: TstSumulaResolucao[];
  ano: number | null;
  leiArticles: string[];
  cltArticles: string[];
  themes: string[];
  fullTextMarkdown: string;
  rawBlock: string;
}
