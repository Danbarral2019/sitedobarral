import { describe, it, expect } from 'vitest';
import { compararTextos, dispositivos, resumoDaComparacao, trechosAlterados } from '../comparar-textos';

const TEXTO = [
  'Art. 1º Este Decreto regulamenta o sistema de registro de\npreços.',
  'Art. 2º Para fins deste Decreto, considera-se:',
  'I - ata de registro de preços - documento vinculativo;',
  'II - órgão gerenciador - órgão responsável pela condução do procedimento;',
  'Art. 3º Este Decreto entra em vigor na data de sua publicação.',
].join('\n\n');

describe('dispositivos', () => {
  it('um por parágrafo, com as quebras de linha internas desfeitas', () => {
    const d = dispositivos(TEXTO);
    expect(d).toHaveLength(5);
    expect(d[0]).toBe('Art. 1º Este Decreto regulamenta o sistema de registro de preços.');
  });
});

describe('compararTextos', () => {
  it('mudança só de apresentação não é alteração', () => {
    const outro = TEXTO.replace('Art. 1º', '**Art. 1º**').replace(/ - /g, ' – ').replace('de\npreços', 'de preços');
    const c = compararTextos(TEXTO, outro);
    expect(c.soFormatacao).toBe(true);
    expect(c.alteracoes).toEqual([]);
    expect(resumoDaComparacao(c)).toMatch(/texto é o mesmo/);
  });

  it('parágrafo partido em dois, com o mesmo texto, também não', () => {
    const outro = TEXTO.replace('considera-se:', 'considera-se:\n\n');
    expect(compararTextos(TEXTO, outro).soFormatacao).toBe(true);
  });

  it('nova redação de um inciso, situada no artigo', () => {
    const outro = TEXTO.replace('pela condução do procedimento', 'pela condução do conjunto de procedimentos');
    const c = compararTextos(TEXTO, outro);
    expect(c.soFormatacao).toBe(false);
    expect(c.alterados).toBe(1);
    const [a] = c.alteracoes;
    expect(a.tipo).toBe('alterado');
    expect(a.artigo).toEqual({ id: 'art-2', rotulo: 'art. 2º' });
    if (a.tipo === 'alterado') {
      expect(a.trechos.filter((t) => t.tipo === 'suprimido').map((t) => t.texto)).toEqual(['procedimento;']);
      expect(a.trechos.filter((t) => t.tipo === 'incluido').map((t) => t.texto)).toEqual(['conjunto de procedimentos;']);
    }
    expect(resumoDaComparacao(c)).toBe('1 dispositivo alterado');
  });

  it('inciso incluído e artigo suprimido', () => {
    const outro = TEXTO.replace(
      'condução do procedimento;',
      'condução do procedimento;\n\nIII - órgão participante - órgão que integra a ata;',
    ).replace('\n\nArt. 3º Este Decreto entra em vigor na data de sua publicação.', '');
    const c = compararTextos(TEXTO, outro);
    expect(c.incluidos).toBe(1);
    expect(c.suprimidos).toBe(1);
    expect(c.alteracoes.find((x) => x.tipo === 'incluido')?.artigo?.id).toBe('art-2');
    expect(c.alteracoes.find((x) => x.tipo === 'suprimido')?.artigo?.id).toBe('art-3');
    expect(resumoDaComparacao(c)).toBe('1 dispositivo incluído e 1 suprimido');
  });

  it('texto anterior vazio: tudo incluído', () => {
    const c = compararTextos('', TEXTO);
    expect(c.incluidos).toBe(5);
  });
});

describe('trechosAlterados', () => {
  it('agrupa palavras vizinhas do mesmo tipo', () => {
    expect(trechosAlterados('prazo de dez dias úteis', 'prazo de quinze dias úteis')).toEqual([
      { tipo: 'igual', texto: 'prazo de' },
      { tipo: 'suprimido', texto: 'dez' },
      { tipo: 'incluido', texto: 'quinze' },
      { tipo: 'igual', texto: 'dias úteis' },
    ]);
  });

  it('exibe o texto como está, com travessão e sem negrito', () => {
    const t = trechosAlterados('**I** – órgão gerenciador', 'I - órgão participante');
    expect(t[0]).toEqual({ tipo: 'igual', texto: 'I - órgão' });
    expect(t).toContainEqual({ tipo: 'suprimido', texto: 'gerenciador' });
  });
});
