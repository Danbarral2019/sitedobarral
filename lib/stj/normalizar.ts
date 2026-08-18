/**
 * Espelho publicado pelo STJ → forma interna.
 *
 * Dois cuidados vêm de defeitos reais do conector DataJud que este substitui:
 * data que virava `Invalid Date` e mojibake nos nomes dos ministros.
 */

import { citaLei14133, extrairArtigos14133 } from '@/lib/jurisprudencia/legislacao-citada';
import type { EspelhoBruto, StjDecisaoNormalizada } from './types';

/** "20260519" → Date. Qualquer outra coisa vira null, nunca Invalid Date. */
function dataDeAaaammdd(valor: string | null | undefined): Date | null {
  if (!valor || !/^\d{8}$/.test(valor)) return null;
  const ano = Number(valor.slice(0, 4));
  const mes = Number(valor.slice(4, 6));
  const dia = Number(valor.slice(6, 8));
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return isNaN(d.getTime()) ? null : d;
}

/** "DJEN       DATA:22/05/2026" → Date. */
function dataDeRotuloDiario(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const m = valor.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return isNaN(d.getTime()) ? null : d;
}

function limpar(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\s+/g, ' ').trim();
}

export function normalizarEspelho(
  e: EspelhoBruto,
  orgaoPadrao: string
): StjDecisaoNormalizada | null {
  const registro = limpar(e.numeroRegistro);
  const ementa = limpar(e.ementa);
  if (!registro || !ementa) return null;

  const dataJulgamento = dataDeAaaammdd(e.dataDecisao);
  const dataPublicacao = dataDeRotuloDiario(e.dataPublicacao);
  const classe = limpar(e.siglaClasse) || 'Acórdão';
  const artigos14133 = extrairArtigos14133(e.referenciasLegislativas);

  return {
    sourceId: registro,
    fullIdentifier: `stj-acordao-${registro}`,
    decisionType: 'acordao',
    classe,
    decisionNumber: registro,
    processNumber: limpar(e.numeroProcesso) || null,
    year:
      dataJulgamento?.getUTCFullYear() ??
      dataPublicacao?.getUTCFullYear() ??
      Number(registro.slice(0, 4)),
    title: `${classe} ${registro} - STJ`,
    ementa,
    relator: limpar(e.ministroRelator) || null,
    orgaoJulgador: limpar(e.nomeOrgaoJulgador) || orgaoPadrao,
    dataJulgamento,
    dataPublicacao,
    url: `https://processo.stj.jus.br/processo/pesquisa/?num_registro=${encodeURIComponent(registro)}`,
    tema: limpar(e.tema) || null,
    tese: limpar(e.teseJuridica) || null,
    artigos14133,
    citaLei14133: citaLei14133(e.referenciasLegislativas),
  };
}
