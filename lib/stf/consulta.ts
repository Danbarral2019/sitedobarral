/**
 * Montagem do corpo da consulta ao índice de jurisprudência do STF.
 *
 * Puro de propósito: o mesmo objeto é serializado pelo runner (Node) e
 * injetado dentro da página do navegador, que é quem de fato executa o fetch —
 * o host está atrás de um AWS WAF com desafio JavaScript.
 */

export const URL_API_STF = 'https://jurisprudencia.stf.jus.br/api/search/search';

export const CAMPOS_BUSCA_STF = [
  'ementa_texto',
  'decisao_texto',
  'acordao_ata',
  'documental_tese_texto',
  'documental_tese_tema_texto',
  'documental_legislacao_citada_texto',
  'documental_indexacao_texto',
] as const;

export const CAMPOS_FONTE_STF = [
  'base',
  'id',
  'titulo',
  'processo_classe_processual_unificada_classe_sigla',
  'processo_classe_processual_unificada_extenso',
  'processo_numero',
  'relator_processo_nome',
  'relator_acordao_nome',
  'relator_decisao_nome',
  'orgao_julgador',
  'julgamento_data',
  'publicacao_data',
  'is_repercussao_geral',
  'procedencia_geografica_uf_sigla',
  'ementa_texto',
  'decisao_texto',
  'documental_tese_texto',
  'documental_tese_tema_texto',
  'documental_legislacao_citada_texto',
  'documental_indexacao_texto',
] as const;

export interface OpcoesConsultaStf {
  termo: string;
  base: 'acordaos' | 'decisoes';
  dataInicio?: string;
  dataFim?: string;
  tamanho?: number;
  desloc?: number;
}

export function montarCorpoConsulta(o: OpcoesConsultaStf): object {
  const filter: object[] = [
    { term: { base: o.base } },
    {
      query_string: {
        query: o.termo,
        default_operator: 'AND',
        fields: [...CAMPOS_BUSCA_STF],
      },
    },
  ];

  const faixa: Record<string, string> = {};
  if (o.dataInicio) faixa.gte = o.dataInicio;
  if (o.dataFim) faixa.lte = o.dataFim;
  if (Object.keys(faixa).length > 0) {
    filter.push({ range: { julgamento_data: faixa } });
  }

  return {
    query: { bool: { filter } },
    _source: [...CAMPOS_FONTE_STF],
    size: o.tamanho ?? 200,
    from: o.desloc ?? 0,
    sort: [{ julgamento_data: 'desc' }],
    track_total_hits: true,
  };
}
