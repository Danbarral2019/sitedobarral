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

import { montarDossie } from './trechos-de-citacao';

describe('montarDossie', () => {
  const t = (origemChave: string, noVoto: boolean, trecho: string): import('./trechos-de-citacao').TrechoCitacao =>
    ({ origemChave, secao: noVoto ? 'voto' : 'relatorio', noVoto, trecho, offset: 0 });

  it('prioriza trechos no voto e conta citantes distintos', () => {
    const d = montarDossie({ numero: 1441, ano: 2016 }, [
      t('1/2020', false, 'menção de rotina no relatório sobre o tema aqui'),
      t('2/2021', true, 'no voto: o prazo prescricional é de cinco anos conforme o precedente'),
      t('2/2021', true, 'no voto: segunda ocorrência no mesmo acórdão citante distinta'),
    ]);
    expect(d.trechos[0].noVoto).toBe(true); // voto vem primeiro
    expect(d.contagem.citantesDistintos).toBe(2); // 1/2020 e 2/2021
    expect(d.contagem.noVoto).toBe(1); // só 2/2021 tem trecho no voto
    expect(d.contagem.ocorrenciasTotal).toBe(3);
  });

  it('deduplica trechos boilerplate quase idênticos', () => {
    const boiler = 'No mesmo sentido, os Acórdãos 1441/2016 e 534/2023, ambos do Plenário.';
    const d = montarDossie({ numero: 1441, ano: 2016 }, [
      t('1/2020', true, boiler),
      t('2/2020', true, boiler + ' '), // idêntico após normalizar
    ]);
    expect(d.trechos).toHaveLength(1);
  });

  it('respeita o limite de trechos', () => {
    const muitos = Array.from({ length: 60 }, (_, i) => t(`${i}/2020`, true, `trecho único número ${i} com conteúdo`));
    const d = montarDossie({ numero: 1441, ano: 2016 }, muitos, 40);
    expect(d.trechos).toHaveLength(40);
  });
});
