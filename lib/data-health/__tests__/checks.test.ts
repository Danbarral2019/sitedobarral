// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isArtigoMalFormatado, revokerFromNote, contentMostraAlteracao } from '../checks';

describe('isArtigoMalFormatado', () => {
  it('aceita número puro e sufixo -A como bem formatados', () => {
    expect(isArtigoMalFormatado('75')).toBe(false);
    expect(isArtigoMalFormatado('166-A')).toBe(false);
  });

  it('rejeita formato com prefixo "Art. " (regressão do classifier)', () => {
    expect(isArtigoMalFormatado('Art. 75')).toBe(true);
    expect(isArtigoMalFormatado('art.30')).toBe(true);
  });
});

describe('revokerFromNote', () => {
  it('extrai o número do ato revogador da nota', () => {
    expect(revokerFromNote('Revogado pelo Decreto nº 12.218, de 2024')).toBe('12.218');
    expect(revokerFromNote('Revogado pela Medida Provisória nº 782, de 2017')).toBe('782');
  });

  it('retorna null quando não há padrão de revogação', () => {
    expect(revokerFromNote(null)).toBeNull();
    expect(revokerFromNote('texto qualquer')).toBeNull();
  });
});

describe('contentMostraAlteracao', () => {
  it('detecta que o revogador apenas ALTEROU (falso positivo de revogação total)', () => {
    const content = 'Art. 2º ... I - margem (Redação dada pelo Decreto nº 12.218, de 2024)';
    expect(contentMostraAlteracao(content, '12.218')).toBe(true);
  });

  it('retorna false quando o content não menciona alteração pelo revogador', () => {
    expect(contentMostraAlteracao('texto sem referência', '12.218')).toBe(false);
  });
});
