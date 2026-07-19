import { describe, it, expect } from 'vitest';
import { recortarTrechos } from './trechos-de-citacao';

const VOTO = 'VOTO';
// Texto sintético com relatório + voto. A citação ao alvo 1441/2016 cai no voto.
const texto =
  'RELATÓRIO\n' +
  'Trata-se de tomada de contas. '.repeat(20) +
  '\n' + VOTO + '\n' +
  'A jurisprudência é firme. Conforme o Acórdão 1441/2016-Plenário, o prazo prescricional das ' +
  'sanções aplicadas pelo Tribunal subordina-se ao prazo geral de cinco anos. ' +
  'Assim, ' + 'segue a fundamentação. '.repeat(10) +
  '\nACÓRDÃO\nVISTOS, os Ministros decidem.';

describe('recortarTrechos', () => {
  it('recorta a janela ao redor da citação e marca noVoto', () => {
    const ts = recortarTrechos(texto, { numero: 1441, ano: 2016 }, '9999/2020');
    expect(ts).toHaveLength(1);
    expect(ts[0].origemChave).toBe('9999/2020');
    expect(ts[0].noVoto).toBe(true);
    expect(ts[0].secao).toBe('voto');
    expect(ts[0].trecho).toContain('prazo prescricional das sanções');
    expect(ts[0].trecho).toContain('Acórdão 1441/2016');
  });

  it('ignora citações a outros acórdãos', () => {
    const ts = recortarTrechos(texto, { numero: 9999, ano: 1999 }, '9999/2020');
    expect(ts).toHaveLength(0);
  });

  it('retorna vazio para texto vazio', () => {
    expect(recortarTrechos('', { numero: 1441, ano: 2016 }, 'x')).toEqual([]);
  });
});
