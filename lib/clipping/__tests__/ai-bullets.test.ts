// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { shouldEnrichWithAi, shouldGenerateBulletsForTribunal } from '../ai-bullets';

const disp = (texto: string) => ({ numero: '1', texto });

describe('shouldEnrichWithAi', () => {
  it('não enriquece quando não há inteiro teor', () => {
    expect(shouldEnrichWithAi({ dispositivos: [], ementa: '', hasInteiroTeor: false })).toBe(false);
  });

  it('não enriquece quando já há 3+ dispositivos longos (>=400 chars)', () => {
    const dispositivos = [disp('a'.repeat(200)), disp('b'.repeat(200)), disp('c'.repeat(200))];
    expect(shouldEnrichWithAi({ dispositivos, ementa: 'x', hasInteiroTeor: true })).toBe(false);
  });

  it('enriquece quando há poucos dispositivos (<2)', () => {
    expect(shouldEnrichWithAi({ dispositivos: [disp('curto')], ementa: 'x', hasInteiroTeor: true })).toBe(true);
  });

  it('enriquece quando o texto total é curto (<250 chars)', () => {
    const dispositivos = [disp('a'.repeat(50)), disp('b'.repeat(50))];
    expect(shouldEnrichWithAi({ dispositivos, ementa: 'x', hasInteiroTeor: true })).toBe(true);
  });

  it('enriquece quando a ementa indica caso processual (palavra-chave)', () => {
    const dispositivos = [disp('a'.repeat(200)), disp('b'.repeat(200))];
    expect(
      shouldEnrichWithAi({ dispositivos, ementa: 'EMBARGOS DE DECLARAÇÃO. rejeição.', hasInteiroTeor: true }),
    ).toBe(true);
  });

  it('NÃO enriquece quando há 2 dispositivos longos, texto >= 250 e ementa não-processual', () => {
    const dispositivos = [disp('a'.repeat(200)), disp('b'.repeat(200))];
    expect(
      shouldEnrichWithAi({ dispositivos, ementa: 'DISPENSA DE LICITAÇÃO POR VALOR', hasInteiroTeor: true }),
    ).toBe(false);
  });
});

describe('shouldGenerateBulletsForTribunal', () => {
  it('rejeita item que não é de tribunal', () => {
    expect(shouldGenerateBulletsForTribunal({ sourceKind: 'document', fullText: 'x'.repeat(9999) } as never)).toBe(false);
  });

  it('rejeita item de tribunal sem fullText', () => {
    expect(shouldGenerateBulletsForTribunal({ sourceKind: 'tribunal-decision', fullText: '' } as never)).toBe(false);
  });

  it('aceita item de tribunal com fullText suficientemente longo', () => {
    expect(shouldGenerateBulletsForTribunal({ sourceKind: 'tribunal-decision', fullText: 'x'.repeat(9999) } as never)).toBe(true);
  });
});
