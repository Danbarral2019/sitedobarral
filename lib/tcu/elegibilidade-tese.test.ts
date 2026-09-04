// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { indicesDeclarados, evidenciaIntegral, WHERE_ELEGIVEL_BASE, WHERE_ELEGIVEL_VITRINE } from './elegibilidade-tese';

describe('indicesDeclarados', () => {
  it('extrai índices distintos e ordenados', () => {
    expect(indicesDeclarados([2, 0, 2, 1])).toEqual([0, 1, 2]);
  });

  it('ignora valor não-numérico, negativo ou não-inteiro', () => {
    expect(indicesDeclarados([0, -1, 1.5, 'x', null, 3])).toEqual([0, 3]);
  });

  it('devolve vazio para não-array', () => {
    expect(indicesDeclarados(null)).toEqual([]);
    expect(indicesDeclarados({})).toEqual([]);
  });
});

describe('evidenciaIntegral', () => {
  /** Trecho com caminho interno para o inteiro teor (o caso comum). */
  const trecho = (ordem: number) => ({
    ordem, origemDocumentId: `doc-${ordem}`, origemUrl: null, origemLinkPDF: null,
  });

  it('exige ao menos um índice declarado — zero e zero não passa', () => {
    // Sem esta condição, 0 === 0 aprovaria uma tese sem nenhuma evidência.
    expect(evidenciaIntegral({ trechosFonte: [], trechos: [] })).toBe(false);
  });

  it('aprova quando todos os índices declarados estão persistidos', () => {
    expect(evidenciaIntegral({ trechosFonte: [0, 1, 2], trechos: [trecho(0), trecho(1), trecho(2)] })).toBe(true);
  });

  it('reprova perda parcial — 3 declarados, 2 persistidos', () => {
    expect(evidenciaIntegral({ trechosFonte: [0, 1, 2], trechos: [trecho(0), trecho(1)] })).toBe(false);
  });

  it('índices repetidos contam uma vez', () => {
    expect(evidenciaIntegral({ trechosFonte: [0, 0, 1], trechos: [trecho(0), trecho(1)] })).toBe(true);
  });

  it('reprova quando há trecho a mais que o declarado', () => {
    expect(evidenciaIntegral({ trechosFonte: [0], trechos: [trecho(0), trecho(1)] })).toBe(false);
  });

  it('reprova quando um trecho persistido ficou sem caminho para o inteiro teor', () => {
    // O caso real: gravado só com origemDocumentId e o Document do citante foi
    // apagado depois (onDelete: SetNull). A contagem não muda — só a terceira
    // cláusula da spec §6 detecta.
    expect(
      evidenciaIntegral({
        trechosFonte: [0, 1],
        trechos: [
          trecho(0),
          { ordem: 1, origemDocumentId: null, origemUrl: null, origemLinkPDF: null },
        ],
      }),
    ).toBe(false);
  });

  it('aceita trecho que só tem o caminho externo — url ou pdf bastam', () => {
    expect(
      evidenciaIntegral({
        trechosFonte: [0, 1],
        trechos: [
          { ordem: 0, origemDocumentId: null, origemUrl: 'https://tcu/0', origemLinkPDF: null },
          { ordem: 1, origemDocumentId: null, origemUrl: null, origemLinkPDF: 'https://tcu/1.pdf' },
        ],
      }),
    ).toBe(true);
  });
});

describe('WHERE_ELEGIVEL_BASE', () => {
  it('exige veredito fiel, não apenas veredito preenchido', () => {
    expect(WHERE_ELEGIVEL_BASE.veredito).toBe('fiel');
  });

  it('exige ausência de retirada e versão atual — NÃO exige identidade resolvida (spec §4.3)', () => {
    // Identidade não resolvida vira nível de procedência (2 ou 3), não mais
    // motivo de exclusão da base: excluir por acordaoKey ausente descartava
    // 34 das 93 teses aprovadas.
    expect(WHERE_ELEGIVEL_BASE.retiradoEm).toBeNull();
    expect(WHERE_ELEGIVEL_BASE.destilacao).toEqual({ atual: true });
    expect(WHERE_ELEGIVEL_BASE.destilacao).not.toHaveProperty('acordaoKey');
  });

  it('exige ao menos um trecho persistido', () => {
    expect(WHERE_ELEGIVEL_BASE.trechos).toEqual({ some: {} });
  });
});

describe('WHERE_ELEGIVEL_VITRINE', () => {
  it('herda o predicado base e acrescenta a exigência de identidade oficial (nível 1)', () => {
    expect(WHERE_ELEGIVEL_VITRINE.veredito).toBe('fiel');
    expect(WHERE_ELEGIVEL_VITRINE.retiradoEm).toBeNull();
    expect(WHERE_ELEGIVEL_VITRINE.trechos).toEqual({ some: {} });
    expect(WHERE_ELEGIVEL_VITRINE.destilacao).toEqual({ atual: true, acordaoKey: { not: null } });
  });

  it('um enunciado sem acordaoKey mas com evidência é elegível na base e NÃO na vitrine', () => {
    // A distinção que a spec §4.3 exige: a vitrine (nível 1) barra o que o
    // acervo/busca/ELIC (base) aceitam.
    expect(WHERE_ELEGIVEL_BASE.destilacao).not.toEqual(WHERE_ELEGIVEL_VITRINE.destilacao);
  });
});
