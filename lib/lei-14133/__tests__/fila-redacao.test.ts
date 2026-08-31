// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  calcularProgresso,
  temComentario,
  ordenarFila,
  ordemNumerica,
  proximoDaFila,
  type ArtigoNaFila,
} from '../fila-redacao';

const art = (
  numero: string,
  documentCount: number,
  professorComment: string | null = null,
): ArtigoNaFila => ({ numero, documentCount, professorComment, ementa: `Ementa do art. ${numero}` });

describe('temComentario', () => {
  it('conta como comentado quando há texto', () => {
    expect(temComentario(art('75', 10, 'Comentário do professor.'))).toBe(true);
  });

  it('não conta null, vazio nem só espaços', () => {
    expect(temComentario(art('75', 10, null))).toBe(false);
    expect(temComentario(art('75', 10, ''))).toBe(false);
    expect(temComentario(art('75', 10, '   \n  '))).toBe(false);
  });
});

describe('calcularProgresso', () => {
  it('conta comentados, total e percentual', () => {
    const artigos = [art('1', 5, 'texto'), art('2', 3), art('3', 1, 'texto'), art('4', 0)];
    expect(calcularProgresso(artigos)).toEqual({ comentados: 2, total: 4, percentual: 50 });
  });

  it('não divide por zero com lista vazia', () => {
    expect(calcularProgresso([])).toEqual({ comentados: 0, total: 0, percentual: 0 });
  });
});

describe('ordemNumerica', () => {
  // Ordem alfabética poria o art. 100 antes do art. 9º.
  it('ordena por valor, não por texto', () => {
    expect(ordemNumerica('9')).toBeLessThan(ordemNumerica('10'));
    expect(ordemNumerica('99')).toBeLessThan(ordemNumerica('100'));
  });

  it('põe o sufixo de letra logo depois do número base', () => {
    expect(ordemNumerica('184')).toBeLessThan(ordemNumerica('184-A'));
    expect(ordemNumerica('184-A')).toBeLessThan(ordemNumerica('185'));
  });
});

describe('ordenarFila', () => {
  it('põe os mais citados na frente', () => {
    const fila = ordenarFila([art('1', 3), art('75', 195), art('40', 20)]);
    expect(fila.map((a) => a.numero)).toEqual(['75', '40', '1']);
  });

  it('esconde os já comentados por padrão', () => {
    const fila = ordenarFila([art('75', 195, 'pronto'), art('40', 20)]);
    expect(fila.map((a) => a.numero)).toEqual(['40']);
  });

  it('quando pedido, mostra os comentados depois dos pendentes', () => {
    const fila = ordenarFila(
      [art('75', 195, 'pronto'), art('40', 20), art('1', 300, 'pronto')],
      { incluirComentados: true },
    );
    expect(fila.map((a) => a.numero)).toEqual(['40', '1', '75']);
  });

  it('desempata por número, em ordem numérica', () => {
    const fila = ordenarFila([art('100', 5), art('9', 5), art('10', 5)]);
    expect(fila.map((a) => a.numero)).toEqual(['9', '10', '100']);
  });

  it('não altera o array recebido', () => {
    const entrada = [art('1', 3), art('75', 195)];
    ordenarFila(entrada);
    expect(entrada.map((a) => a.numero)).toEqual(['1', '75']);
  });
});

describe('proximoDaFila', () => {
  it('devolve o pendente mais citado, pulando o que acabou de ser salvo', () => {
    const artigos = [art('75', 195), art('40', 20), art('1', 3)];
    expect(proximoDaFila(artigos, '75')?.numero).toBe('40');
  });

  it('pula os já comentados', () => {
    const artigos = [art('75', 195), art('40', 20, 'pronto'), art('1', 3)];
    expect(proximoDaFila(artigos, '75')?.numero).toBe('1');
  });

  it('devolve null quando não há mais nada pendente', () => {
    expect(proximoDaFila([art('75', 195)], '75')).toBeNull();
    expect(proximoDaFila([art('75', 195, 'pronto')], '75')).toBeNull();
  });
});
