/**
 * Documento bruto do índice do STF → forma interna normalizada.
 *
 * Função pura: não toca rede nem banco.
 *
 * Lastro empírico (corpus 2.516 docs, 16/08/2026):
 * - 52% dos títulos contêm sufixos (AgR, ED, MC-Ref, etc.) após o número.
 * - Sem `julgamento_data`, 100% dos casos têm `publicacao_data` disponível.
 */

import { extrairArtigos14133, citaLei14133 } from './legislacao-citada';
import type { StfDocumentoBruto, StfDecisaoNormalizada } from './types';

/**
 * O índice do STF corta `decisao_texto` em 6.000 caracteres — medido em 1.023
 * dos 1.050 registros do corpus de 16/08/2026. Marcamos o corte para que nada
 * a jusante trate o texto de monocrática como inteiro teor.
 *
 * Medição sobre 154 monocráticas selecionadas: 138 têm `decisao_texto` bruto
 * com ≥ 6.000 chars (realmente truncadas). Detecção via comprimento BRUTO,
 * antes de colapsar espaços.
 */
export const LIMITE_TRUNCAMENTO_STF = 6000;

/** Tamanho mínimo de texto para o documento valer ingestão. */
const MIN_TEXTO = 50;

export function linkStf(id: string): string {
  return `https://jurisprudencia.stf.jus.br/pages/search/${id}/false`;
}

export function texto(v: string | string[] | null | undefined): string {
  if (v === null || v === undefined) return '';
  const bruto = Array.isArray(v) ? v.join(' ') : String(v);
  return bruto.replace(/\s+/g, ' ').trim();
}

/** Junta o campo sem colapsar espaços — usado só para medir o corte do índice do STF. */
export function textoBruto(v: string | string[] | null | undefined): string {
  if (v === null || v === undefined) return '';
  return Array.isArray(v) ? v.join(' ') : String(v);
}

function dataISO(v: string | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizarDocumentoStf(
  doc: StfDocumentoBruto
): StfDecisaoNormalizada | null {
  const sourceId = (doc.id || '').trim();
  if (!sourceId) return null;

  const ementaTexto = texto(doc.ementa_texto);
  const decisaoTexto = texto(doc.decisao_texto);
  const corpo = ementaTexto || decisaoTexto;
  if (corpo.length < MIN_TEXTO) return null;

  const titulo = texto(doc.titulo) || sourceId;
  const numero = /(\d[\d.]*)/.exec(titulo);
  const dataJulgamento = dataISO(doc.julgamento_data);
  const dataPublicacao = dataISO(doc.publicacao_data);
  const legislacao = doc.documental_legislacao_citada_texto;

  return {
    sourceId,
    fullIdentifier: `STF ${sourceId}`,
    decisionType: doc.base === 'decisoes' ? 'decisao' : 'acordao',
    classe: (doc.processo_classe_processual_unificada_classe_sigla || '').trim(),
    decisionNumber: numero ? numero[1].replace(/\./g, '') : titulo,
    processNumber: texto(doc.processo_numero) || null,
    year: dataJulgamento
      ? dataJulgamento.getUTCFullYear()
      : dataPublicacao
        ? dataPublicacao.getUTCFullYear()
        : new Date().getUTCFullYear(),
    title: titulo,
    ementa: corpo,
    ementaTruncada: !ementaTexto && textoBruto(doc.decisao_texto).length >= LIMITE_TRUNCAMENTO_STF,
    relator:
      texto(doc.relator_processo_nome) ||
      texto(doc.relator_acordao_nome) ||
      texto(doc.relator_decisao_nome) ||
      null,
    orgaoJulgador: texto(doc.orgao_julgador) || null,
    dataJulgamento,
    dataPublicacao,
    url: linkStf(sourceId),
    uf: (doc.procedencia_geografica_uf_sigla || '').trim() || null,
    repercussaoGeral: doc.is_repercussao_geral === true,
    tema: texto(doc.documental_tese_tema_texto) || null,
    tese: texto(doc.documental_tese_texto) || null,
    indexacao: texto(doc.documental_indexacao_texto) || null,
    legislacaoCitada: texto(legislacao) || null,
    artigos14133: extrairArtigos14133(legislacao),
    citaLei14133: citaLei14133(legislacao),
  };
}
