import { describe, it, expect } from 'vitest';
import {
  clausulaDeVigencia,
  regraDeVigencia,
  publicacaoNoTexto,
  vigenciaAposVacancia,
  calcularVigencia,
  tituloDoDouEDoAto,
} from '../vigencia';

const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe('clausulaDeVigencia', () => {
  it('acha a cláusula, inclusive com erro de digitação e caixa alta', () => {
    expect(clausulaDeVigencia('Art. 2º Esta Portaria entre em vigor na data de sua publicação.')?.resto).toBe(
      'na data de sua publicação',
    );
    expect(clausulaDeVigencia('ESTA INSTRUÇÃO ENTRARÁ EM VIGOR NA DATA DA SUA PUBLICAÇÃO.')?.resto).toBe(
      'NA DATA DA SUA PUBLICAÇÃO',
    );
    expect(clausulaDeVigencia('Art. 2.046. Este Código entrará em vigor 1 (um) ano após a sua publicação.')?.resto).toBe(
      '1 (um) ano após a sua publicação',
    );
    expect(clausulaDeVigencia('Texto sem cláusula.')).toBeNull();
  });
  it('com mais de uma, prefere o caput ao parágrafo', () => {
    const c = clausulaDeVigencia(
      'Art. 88. Esta Lei entra em vigor após decorridos quinhentos e quarenta dias de sua publicação oficial, observado o disposto nos §§ 1º e 2º. § 1º Para os Municípios, esta Lei entra em vigor a partir de 1º de janeiro de 2017.',
    );
    expect(c?.multiplas).toBe(true);
    expect(c?.resto).toMatch(/^após decorridos quinhentos/);
  });
});

describe('regraDeVigencia', () => {
  it('data expressa', () => {
    const r = regraDeVigencia('em 1º de janeiro de 2026');
    expect(r.tipo === 'data' && iso(r.data)).toBe('2026-01-01');
    const s = regraDeVigencia('1° de abril de 2022');
    expect(s.tipo === 'data' && iso(s.data)).toBe('2022-04-01');
  });
  it('na publicação', () => {
    expect(regraDeVigencia('na data de sua publicação').tipo).toBe('publicacao');
    expect(regraDeVigencia('na data de sua publicação no Diário Oficial da União').tipo).toBe('publicacao');
    expect(
      regraDeVigencia('na data de sua publicação, revogadas as disposições em contrário, em especial a IN nº 1').tipo,
    ).toBe('publicacao');
  });
  it('vacância em dias, por extenso ou em algarismos', () => {
    expect(regraDeVigencia('trinta dias após a data de sua publicação')).toEqual({ tipo: 'vacancia', dias: 30 });
    expect(regraDeVigencia('60 (sessenta) dias após a data da sua publicação')).toEqual({ tipo: 'vacancia', dias: 60 });
    expect(regraDeVigencia('após decorridos 180 (cento e oitenta) dias de sua publicação oficial')).toEqual({
      tipo: 'vacancia',
      dias: 180,
    });
    expect(regraDeVigencia('no prazo de noventa dias, a partir da data de sua publicação')).toEqual({
      tipo: 'vacancia',
      dias: 90,
    });
  });
  it('escalonada, com exceções ou em anos: especial', () => {
    expect(regraDeVigencia(': I - em 1º de outubro de 2018, quanto ao art').tipo).toBe('especial');
    expect(regraDeVigencia('na data de sua publicação, produzindo efeitos financeiros a partir de 1º de janeiro').tipo).toBe(
      'especial',
    );
    expect(regraDeVigencia('1 (um) ano após a sua publicação').tipo).toBe('especial');
    expect(regraDeVigencia('uma semana após a data de sua publicação').tipo).toBe('especial');
  });
});

describe('publicacaoNoTexto', () => {
  it('formatos do rodapé', () => {
    expect(iso(publicacaoNoTexto('Este texto não substitui o publicado no DOU de 22.6.1993', utc(1993, 6, 21)))).toBe(
      '1993-06-22',
    );
    expect(iso(publicacaoNoTexto('Publicada no D.O.U. nº 220, de 14/11/2012, seção 1', utc(2012, 11, 12)))).toBe(
      '2012-11-14',
    );
    expect(iso(publicacaoNoTexto('publicada no DOU de 03 de julho de 2024', utc(2024, 7, 1)))).toBe('2024-07-03');
  });
  it('ignora a publicação de outro ato citado e exige a data do ato', () => {
    expect(publicacaoNoTexto('Altera a IN publicada no DOU de 6 de dezembro de 2024', utc(2026, 2, 10))).toBeNull();
    expect(publicacaoNoTexto('DOU de 22.6.1993', null)).toBeNull();
  });
});

describe('vacância (LC 95/1998, art. 8º, § 1º)', () => {
  it('confere com vigências conhecidas', () => {
    // Decreto 7.892/2013: publicado em 23/1/2013, 30 dias.
    expect(iso(vigenciaAposVacancia(utc(2013, 1, 23), 30))).toBe('2013-02-22');
    // Lei 12.527/2011: publicada em 18/11/2011, 180 dias.
    expect(iso(vigenciaAposVacancia(utc(2011, 11, 18), 180))).toBe('2012-05-16');
    // Lei 12.846/2013: publicada em 2/8/2013, 180 dias.
    expect(iso(vigenciaAposVacancia(utc(2013, 8, 2), 180))).toBe('2014-01-29');
  });
  it('calcularVigencia precisa da publicação, salvo data expressa', () => {
    expect(calcularVigencia({ tipo: 'publicacao' }, null)).toBeNull();
    expect(iso(calcularVigencia({ tipo: 'publicacao' }, utc(2020, 3, 5)))).toBe('2020-03-05');
    expect(iso(calcularVigencia({ tipo: 'data', data: utc(2026, 1, 1) }, null))).toBe('2026-01-01');
    expect(calcularVigencia({ tipo: 'especial' }, utc(2020, 3, 5))).toBeNull();
  });
});

describe('tituloDoDouEDoAto', () => {
  it('reconhece o próprio ato, nos formatos novo e antigo', () => {
    expect(tituloDoDouEDoAto('INSTRUÇÃO NORMATIVA SEGES/ME Nº 67, DE 8 DE JULHO DE 2021', '', 'in', '67', 2021)).toBe(true);
    expect(tituloDoDouEDoAto('INSTRUÇÃO NORMATIVA No- 2, DE 11 DE OUTUBRO DE 2010', '', 'in', '2', 2010)).toBe(true);
    expect(tituloDoDouEDoAto('PORTARIA Nº 12.395, DE 26 DE MAIO DE 2020', '', 'portaria', '12.395', 2020)).toBe(true);
    expect(tituloDoDouEDoAto('INSTRUÇÃO NORMATIVA Nº 07, DE 20 DE SETEMBRO DE 2018', '', 'in', '7', 2018)).toBe(true);
  });
  it('recusa outro número, outro tipo, outro ano e retificação', () => {
    expect(tituloDoDouEDoAto('INSTRUÇÃO NORMATIVA Nº 167, DE 8 DE JULHO DE 2021', '', 'in', '67', 2021)).toBe(false);
    expect(tituloDoDouEDoAto('PORTARIA Nº 67, DE 8 DE JULHO DE 2021', '', 'in', '67', 2021)).toBe(false);
    expect(tituloDoDouEDoAto('INSTRUÇÃO NORMATIVA Nº 67, DE 8 DE JULHO DE 2020', '', 'in', '67', 2021)).toBe(false);
    expect(tituloDoDouEDoAto('RETIFICAÇÃO', 'Na Instrução Normativa nº 67, de 2021', 'in', '67', 2021)).toBe(false);
    expect(tituloDoDouEDoAto('INSTRUÇÃO NORMATIVA Nº 67, DE 8 DE JULHO DE 2021', 'Retificação: onde se lê', 'in', '67', 2021)).toBe(false);
  });
});
