/** Documento como vem do índice Elasticsearch do STF (`_source`). */
export interface StfDocumentoBruto {
  base?: string;
  id?: string;
  titulo?: string;
  processo_numero?: string;
  processo_classe_processual_unificada_classe_sigla?: string;
  processo_classe_processual_unificada_extenso?: string;
  procedencia_geografica_uf_sigla?: string;
  relator_processo_nome?: string | string[];
  relator_acordao_nome?: string | string[];
  relator_decisao_nome?: string | string[];
  orgao_julgador?: string;
  julgamento_data?: string;
  publicacao_data?: string;
  is_repercussao_geral?: boolean;
  ementa_texto?: string | string[];
  decisao_texto?: string | string[];
  documental_tese_texto?: string | string[];
  documental_tese_tema_texto?: string | string[];
  documental_legislacao_citada_texto?: string | string[];
  documental_indexacao_texto?: string | string[];
}

/** Forma interna, já saneada, pronta para o recorte e para a persistência. */
export interface StfDecisaoNormalizada {
  sourceId: string;
  fullIdentifier: string;
  decisionType: 'acordao' | 'decisao';
  classe: string;
  decisionNumber: string;
  processNumber: string | null;
  year: number;
  title: string;
  ementa: string;
  /** `decisao_texto` vem cortado em 6.000 chars no índice do STF. */
  ementaTruncada: boolean;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: Date | null;
  dataPublicacao: Date | null;
  url: string;
  uf: string | null;
  repercussaoGeral: boolean;
  tema: string | null;
  tese: string | null;
  indexacao: string | null;
  artigos14133: string[];
  citaLei14133: boolean;
}
