/**
 * Tipos para o parser do "Livro de Súmulas, OJs e PNs do TST" (Res. 225/2025,
 * versão RTF). O formato é distinto do PDF de Súmulas usado na importação
 * anterior — tem TAB entre prefixo+número e título, situação inline em
 * parênteses, sem tokens "Tese:" / "Observação:" / "Situação:" separados.
 */

export type TstLivroSerie =
  | 'sumula'
  | 'oj-tp-oe'
  | 'oj-sdi1'
  | 'oj-sdi1t'
  | 'oj-sdi2'
  | 'oj-sdc'
  | 'pn';

export type TstLivroSituacao = 'CRIADA' | 'ALTERADA' | 'CANCELADA' | 'REVISTA';

export interface TstLivroResolucao {
  /** Ex.: "121/2003". */
  numero: string;
  /** Ano extraído (2003). */
  ano: number | null;
  /** Veículo: "DJ" | "DEJT" | "RA". */
  tipo: string | null;
  /** Data textual: "19, 20 e 21.11.2003". */
  divulgadoEm: string | null;
}

export interface TstLivroItem {
  /** Ordem romana ("I", "II", "III"…). */
  ordem: string;
  /** Texto canônico do item. */
  texto: string;
  /** True quando há marcação explícita de cancelamento no item. */
  cancelled: boolean;
  /** Motivo descritivo do cancelamento, quando presente. */
  cancelMotivo?: string;
}

export interface TstLivroHistoricoEntrada {
  /** Texto bruto da entrada (preservado para citação). */
  texto: string;
}

export interface TstLivroBlock {
  /** Série do documento (SUM / OJ-SDI1 / PN / etc.). */
  serie: TstLivroSerie;
  /** Número do documento dentro da série. */
  numero: number;
  /** Sub-número quando aplicável (raro — alguns documentos têm "OJ-X-N-A"). */
  subnumero?: string;
  /** Identificador único: "SUM-1", "OJ-SDI1-31", "PN-7"… */
  rotulo: string;
  /** Título em caixa alta (sem o sufixo de situação entre parênteses). */
  titulo: string;
  /** Linha completa do cabeçalho (antes do TAB do corpo) — para auditoria. */
  cabecalhoCompleto: string;
  /** Situação canônica derivada do cabeçalho. */
  situacao: TstLivroSituacao;
  /** Motivo textual da situação (entre parênteses), quando presente. */
  situacaoMotivo: string | null;
  /** Tese canônica — texto após o cabeçalho até "Histórico:" ou próximo bloco. */
  tese: string;
  /** Itens romanos, quando a tese é estruturada (I, II, III…). */
  itens: TstLivroItem[];
  /** Resoluções extraídas do cabeçalho e do corpo. */
  resolucoes: TstLivroResolucao[];
  /** Entradas da seção "Histórico:", quando presente. */
  historico: TstLivroHistoricoEntrada[];
  /** URL "Inteiro teor no formato HTML" do TST, quando o RTF expõe. */
  url: string | null;
  /** Refs cruzadas a artigos da Lei 14.133 mencionados no texto. */
  leiArticles: string[];
  /** Refs a artigos da CLT mencionados no texto. */
  cltArticles: string[];
  /** Bloco bruto original — útil para depuração. */
  rawBlock: string;
}
