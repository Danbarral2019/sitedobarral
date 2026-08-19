/** Espelho de acórdão como o STJ publica no dump JSON mensal. */
export interface EspelhoBruto {
  id?: string;
  numeroDocumento?: string | null;
  numeroProcesso?: string | null;
  numeroRegistro?: string | null;
  siglaClasse?: string | null;
  descricaoClasse?: string | null;
  classePadronizada?: string | null;
  nomeOrgaoJulgador?: string | null;
  ministroRelator?: string | null;
  /** Vem como "DJEN       DATA:22/05/2026". */
  dataPublicacao?: string | null;
  ementa?: string | null;
  tipoDeDecisao?: string | null;
  /** Formato AAAAMMDD, ex.: "20260519". */
  dataDecisao?: string | null;
  decisao?: string | null;
  jurisprudenciaCitada?: string | null;
  notas?: string | null;
  informacoesComplementares?: string | null;
  termosAuxiliares?: string | null;
  teseJuridica?: string | null;
  tema?: string | null;
  referenciasLegislativas?: string[] | null;
  acordaosSimilares?: string[] | null;
}

/** Forma interna, saneada, pronta para a persistência. */
export interface StjDecisaoNormalizada {
  sourceId: string;
  fullIdentifier: string;
  decisionType: 'acordao';
  classe: string;
  decisionNumber: string;
  /** Número de registro do PROCESSO. Não identifica o acórdão — ver normalizar.ts. */
  numeroRegistro: string;
  processNumber: string | null;
  year: number;
  title: string;
  ementa: string;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: Date | null;
  dataPublicacao: Date | null;
  url: string;
  tema: string | null;
  tese: string | null;
  artigos14133: string[];
  citaLei14133: boolean;
}
