import { describe, it, expect } from 'vitest';
import { trechoDeAmostra } from '../text-preview';

describe('trechoDeAmostra', () => {
  it('devolve o texto inteiro, sem marcar corte, quando cabe no limite', () => {
    const texto = 'Ementa curta sobre dispensa de licitação.';

    expect(trechoDeAmostra(texto, 200)).toEqual({ trecho: texto, cortado: false });
  });

  it('corta no fim da última frase completa que cabe', () => {
    const texto =
      'É dispensável a licitação por valor. O limite é aferido pelo somatório anual. '
      + 'A divisão do objeto para manter cada contratação abaixo do valor é irregular.';

    const { trecho, cortado } = trechoDeAmostra(texto, 90);

    expect(cortado).toBe(true);
    expect(trecho).toBe('É dispensável a licitação por valor. O limite é aferido pelo somatório anual.');
  });

  it('nunca parte uma palavra ao meio quando não há fim de frase', () => {
    const texto = 'LICITAÇÃO E CONTRATAÇÃO PÚBLICA SISTEMA DE REGISTRO DE PREÇOS CONTRATAÇÃO DIRETA EXIGÊNCIA';

    const { trecho, cortado } = trechoDeAmostra(texto, 40);

    expect(cortado).toBe(true);
    expect(texto.startsWith(trecho)).toBe(true);
    // O caractere seguinte no original é espaço: o corte caiu entre palavras.
    expect(texto[trecho.length]).toBe(' ');
    expect(trecho).toBe('LICITAÇÃO E CONTRATAÇÃO PÚBLICA SISTEMA');
  });

  it('reconhece interrogação e exclamação como fim de frase', () => {
    const texto = 'Cabe dispensa nesse caso? A resposta depende do somatório anual do exercício.';

    expect(trechoDeAmostra(texto, 50).trecho).toBe('Cabe dispensa nesse caso?');
  });

  it('não deixa espaço nem pontuação solta no fim do trecho', () => {
    const texto = 'Primeira frase completa aqui , e depois um resto que não cabe de jeito nenhum.';

    const { trecho } = trechoDeAmostra(texto, 45);

    expect(trecho).not.toMatch(/[\s,;:]$/);
  });

  it('trata texto vazio ou só de espaços sem quebrar', () => {
    expect(trechoDeAmostra('', 100)).toEqual({ trecho: '', cortado: false });
    expect(trechoDeAmostra('   \n  ', 100)).toEqual({ trecho: '', cortado: false });
  });

  it('preserva a quebra de parágrafo dentro do trecho', () => {
    const texto = 'Primeiro parágrafo da ementa.\nSegundo parágrafo da ementa.\nTerceiro que não cabe.';

    const { trecho } = trechoDeAmostra(texto, 60);

    expect(trecho).toContain('\n');
    expect(trecho.split('\n')).toHaveLength(2);
  });
});
