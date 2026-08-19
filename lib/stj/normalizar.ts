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
  if (isNaN(d.getTime())) return null;
  // Validar que o Date resultante tem os mesmos year/month/day (evita overflow silencioso)
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }
  return d;
}

/** "DJEN       DATA:22/05/2026" → Date. */
function dataDeRotuloDiario(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const m = valor.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (isNaN(d.getTime())) return null;
  // Validar que o Date resultante tem os mesmos year/month/day (evita overflow silencioso)
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }
  return d;
}

function limpar(valor: string | null | undefined): string {
  // Remover caracteres invisíveis (U+200B, U+200C, U+200D, U+FEFF)
  const texto = (valor ?? '').replace(/[​‌‍﻿]/g, '');
  // Colapsar espaços e trim
  return texto.replace(/\s+/g, ' ').trim();
}

export function normalizarEspelho(
  e: EspelhoBruto,
  orgaoPadrao: string
): StjDecisaoNormalizada | null {
  const registro = limpar(e.numeroRegistro);
  const ementa = limpar(e.ementa);
  if (!registro || !ementa) return null;

  /**
   * O identificador do acórdão é o `id` do espelho, NÃO o `numeroRegistro`.
   *
   * `numeroRegistro` identifica o PROCESSO, e um processo rende vários
   * acórdãos ao longo da vida — o REsp, depois o AgInt, depois os EDcl —
   * todos com o mesmo número. Medido sobre 1.458 espelhos da Segunda Turma:
   * 1.430 números de registro para 1.458 acórdãos, ou seja, um upsert
   * chaveado por registro descartaria 28 julgados (1,9%). O campo `id` é
   * único: 1.458 valores distintos para os mesmos 1.458 acórdãos.
   *
   * Fallback para o registro só cobre espelho sem `id`, que não ocorreu na
   * amostra; nesse caso o comportamento antigo é preferível a descartar.
   */
  const idEspelho = limpar(e.id);
  const chave = idEspelho || registro;

  const dataJulgamento = dataDeAaaammdd(e.dataDecisao);
  const dataPublicacao = dataDeRotuloDiario(e.dataPublicacao);
  const classe = limpar(e.siglaClasse) || 'Acórdão';
  const artigos14133 = extrairArtigos14133(e.referenciasLegislativas);

  // Derivar year com fallback seguro (nunca NaN)
  let year = dataJulgamento?.getUTCFullYear() ?? dataPublicacao?.getUTCFullYear();
  if (!year) {
    const yearFromRegistro = Number(registro.slice(0, 4));
    // Validar que os 4 primeiros dígitos formam um ano plausível (1988 até ano corrente + 1)
    const currentYear = new Date().getUTCFullYear();
    if (yearFromRegistro >= 1988 && yearFromRegistro <= currentYear + 1) {
      year = yearFromRegistro;
    } else {
      year = currentYear;
    }
  }

  return {
    sourceId: chave,
    fullIdentifier: `stj-acordao-${chave}`,
    decisionType: 'acordao',
    classe,
    decisionNumber: registro,
    processNumber: limpar(e.numeroProcesso) || null,
    year,
    title: `${classe} ${registro} - STJ`,
    ementa,
    relator: limpar(e.ministroRelator) || null,
    orgaoJulgador: limpar(e.nomeOrgaoJulgador) || orgaoPadrao,
    dataJulgamento,
    dataPublicacao,
    url: `https://processo.stj.jus.br/processo/pesquisa/?num_registro=${encodeURIComponent(registro)}`,
    numeroRegistro: registro,
    tema: limpar(e.tema) || null,
    tese: limpar(e.teseJuridica) || null,
    artigos14133,
    citaLei14133: citaLei14133(e.referenciasLegislativas),
  };
}
