// @vitest-environment node
//
// Cobre o defeito da rodada de correção 1 da Task 4: a fila de reconferência
// é selecionada FORA dos recortes de --min-no-voto/--tema, então pode conter
// uma chave ausente de `cards` (DATA na folha). Sem uma seção própria no
// texto de export para essas chaves, o veredito marcado no cartão de
// reconferência ficava salvo em `store.cards` mas sumia do texto exportado.
import { describe, it, expect } from 'vitest';
import { montarLinhasVeredito } from '../../scripts/lib/folha-teses-template.mjs';

describe('montarLinhasVeredito', () => {
  it('lista as chaves de DATA na ordem dada, marcando pendente quando falta veredito', () => {
    const linhas = montarLinhasVeredito(['1441/2016', '999/2020'], [], { '1441/2016': 'fiel' });
    expect(linhas).toEqual([
      'VEREDITOS POR CASO:',
      '  Acórdão 1441/2016: fiel',
      '  Acórdão 999/2020: (pendente)',
    ]);
  });

  it('não abre a seção de reconferência quando toda chave da fila já está em DATA', () => {
    const linhas = montarLinhasVeredito(['1441/2016'], ['1441/2016'], { '1441/2016': 'imprecisa' });
    expect(linhas).toEqual(['VEREDITOS POR CASO:', '  Acórdão 1441/2016: imprecisa']);
  });

  // O bug: --min-no-voto/--tema excluíram 500/2019 de DATA, mas a fila de
  // reconferência (selecionada fora desses recortes) ainda o inclui, e o
  // veredito marcado nesse cartão não pode sumir do export.
  it('acrescenta seção própria para chave de reconferência ausente de DATA', () => {
    const linhas = montarLinhasVeredito(['1441/2016'], ['500/2019'], {
      '1441/2016': 'fiel',
      '500/2019': 'errada',
    });
    expect(linhas).toEqual([
      'VEREDITOS POR CASO:',
      '  Acórdão 1441/2016: fiel',
      '',
      'VEREDITOS POR CASO (RECONFERÊNCIA, FORA DO RECORTE DESTA FOLHA):',
      '  Acórdão 500/2019: errada',
    ]);
  });

  it('marca pendente a chave extra de reconferência ainda não julgada', () => {
    const linhas = montarLinhasVeredito(['1441/2016'], ['500/2019'], { '1441/2016': 'fiel' });
    expect(linhas).toContain('  Acórdão 500/2019: (pendente)');
  });

  it('não repete a mesma chave extra duas vezes quando a fila tem duas pendências do mesmo caso', () => {
    const linhas = montarLinhasVeredito([], ['500/2019', '500/2019'], { '500/2019': 'fiel' });
    expect(linhas.filter((l) => l.includes('500/2019'))).toHaveLength(1);
  });
});
