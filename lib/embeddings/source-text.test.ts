// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { selectSourceText } from './source-text';

describe('selectSourceText', () => {
  it('prefere o inteiro teor do TCU a qualquer texto derivado', () => {
    // Regressão 09/2026: com a ementa na frente, 1.844 acórdãos com ~68 mil
    // chars de inteiro teor eram indexados por ~600 chars de ementa.
    const texto = selectSourceText({
      tcuTextoCompleto: 'RELATÓRIO ... VOTO ... ACÓRDÃO',
      content: 'conteúdo',
      tcuEmentaCompleta: 'ementa oficial',
      description: 'resumo IA',
    });
    expect(texto).toBe('RELATÓRIO ... VOTO ... ACÓRDÃO');
  });

  it('mantém a ordem antiga quando não há inteiro teor', () => {
    expect(
      selectSourceText({ tcuEmentaCompleta: 'ementa oficial', description: 'resumo IA' }),
    ).toBe('ementa oficial');
    expect(selectSourceText({ description: 'resumo IA' })).toBe('resumo IA');
  });

  it('ignora candidato vazio ou só com espaços', () => {
    expect(
      selectSourceText({ tcuTextoCompleto: '   ', tcuEmentaCompleta: 'ementa oficial' }),
    ).toBe('ementa oficial');
    expect(selectSourceText({})).toBe('');
  });
});
