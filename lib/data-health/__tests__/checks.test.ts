// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  isArtigoMalFormatado,
  isArtigoInexistente,
  revokerFromNote,
  contentMostraAlteracao,
} from '../checks';

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

/**
 * O formato bem-feito não garante que o artigo exista: "199" e "132-D" passam
 * na validação de formato e não são dispositivos da Lei 14.133. Medido em
 * 30/08/2026, 114 amarrações do acervo estavam nessa situação — invisíveis ao
 * único check que havia.
 */
describe('isArtigoInexistente', () => {
  it('aceita artigos reais da lei, inclusive os sufixados', () => {
    expect(isArtigoInexistente('75')).toBe(false);
    expect(isArtigoInexistente('184-A')).toBe(false);
    expect(isArtigoInexistente('44-A')).toBe(false);
  });

  it('aceita os arts. 337-E a 337-P, que a lei inseriu no Código Penal', () => {
    expect(isArtigoInexistente('337-E')).toBe(false);
    expect(isArtigoInexistente('337-P')).toBe(false);
  });

  it('rejeita número que a lei não tem, ainda que bem formatado', () => {
    // Vindos do acervo real: CPC, Código Civil e Lei Orgânica do TCE-PE.
    expect(isArtigoMalFormatado('199')).toBe(false); // formato OK...
    expect(isArtigoInexistente('199')).toBe(true); // ...mas não é da lei
    expect(isArtigoInexistente('966')).toBe(true);
    expect(isArtigoInexistente('132-D')).toBe(true);
  });

  it('rejeita o 166-A, que parece plausível e não existe', () => {
    expect(isArtigoInexistente('166-A')).toBe(true);
  });

  it('ignora espaço em volta, como o check de formato faz', () => {
    expect(isArtigoInexistente('  75  ')).toBe(false);
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
