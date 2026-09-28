import { describe, it, expect } from 'vitest';
import {
  subtituloDoAto,
  dataDoAto,
  dataPorExtenso,
  mesmoDia,
  dataDePublicacao,
  orgaoEmissor,
  rotuloArtigo,
  ementaNoTexto,
} from '../cabecalho';

describe('subtituloDoAto', () => {
  it('mantém nome descritivo', () => {
    expect(subtituloDoAto('Credenciamento para Contratação na Administração Pública Federal')).toBe(
      'Credenciamento para Contratação na Administração Pública Federal',
    );
  });
  it('omite a epígrafe, inclusive quebrada em linhas', () => {
    expect(subtituloDoAto('DECRETO Nº 11.345, DE 1º DE JANEIRO DE 2023')).toBeNull();
    expect(subtituloDoAto('DECRETO Nº\n7.404,\nDE 23 DE DEZEMBRO DE 2010.')).toBeNull();
    expect(subtituloDoAto('Lei nº 8.212, de 24 de julho de 1991')).toBeNull();
    expect(subtituloDoAto('DECRETO Nº 1.819, DE 16 DE FEVEREIRO DE')).toBeNull();
    expect(subtituloDoAto('PORTARIA Nº 295, de 26 DE SETEMBRO')).toBeNull();
  });
  it('epígrafe com apelido fica só com o apelido', () => {
    expect(subtituloDoAto('Lei nº 10.973, de 2 de dezembro de 2004 — Lei da Inovação')).toBe('Lei da Inovação');
    expect(subtituloDoAto('Lei 10.522/2002, de 19 de julho de 2002 (CADIN — Cadastro Informativo)')).toBe(
      'CADIN — Cadastro Informativo',
    );
    expect(subtituloDoAto('Lei 4.320/1964, de 17 de março de 1964')).toBeNull();
  });
  it('nome que começa com "Dispõe" continua', () => {
    expect(subtituloDoAto('Dispõe sobre a licitação pelo critério de julgamento por técnica e preço')).toBe(
      'Dispõe sobre a licitação pelo critério de julgamento por técnica e preço',
    );
  });
});

describe('dataDoAto', () => {
  it('lê a data da epígrafe do próprio ato', () => {
    const d = dataDoAto('2.715', [
      'Contratação de Estações de Trabalho',
      'Portaria SGD/MGI nº 2.715, de 21 de junho de 2023\n\nEstabelece Modelo',
    ]);
    expect(d?.toISOString().slice(0, 10)).toBe('2023-06-21');
  });
  it('aceita epígrafe em caixa alta com "1º"', () => {
    expect(dataDoAto('11.345', ['DECRETO Nº 11.345, DE 1º DE JANEIRO DE 2023'])?.toISOString().slice(0, 10)).toBe(
      '2023-01-01',
    );
  });
  it('ignora epígrafe de outro ato citado', () => {
    expect(dataDoAto('6.364', ['Altera a Portaria SEGES/MGI nº 9.510, de 1º de outubro de 2024'])).toBeNull();
  });
  it('sem número ou sem epígrafe, nada', () => {
    expect(dataDoAto(null, ['Lei nº 1, de 1º de janeiro de 2000'])).toBeNull();
    expect(dataDoAto('14.133', ['Texto sem epígrafe'])).toBeNull();
  });
});

describe('datas por extenso', () => {
  it('formata com ordinal no dia 1', () => {
    expect(dataPorExtenso(new Date(Date.UTC(2023, 0, 1)))).toBe('1º de janeiro de 2023');
    expect(dataPorExtenso('2023-06-21T00:00:00.000Z')).toBe('21 de junho de 2023');
  });
  it('compara pelo dia UTC', () => {
    expect(mesmoDia('2023-06-21T00:00:00.000Z', new Date(Date.UTC(2023, 5, 21)))).toBe(true);
    expect(mesmoDia('2023-06-30T00:00:00.000Z', new Date(Date.UTC(2023, 5, 21)))).toBe(false);
  });
});

describe('orgaoEmissor', () => {
  it('omite "Outro" e vazio; completa "Presidência"', () => {
    expect(orgaoEmissor('Outro')).toBeNull();
    expect(orgaoEmissor('Não informado')).toBeNull();
    expect(orgaoEmissor('')).toBeNull();
    expect(orgaoEmissor('Presidência')).toBe('Presidência da República');
    expect(orgaoEmissor('SEGES')).toBe('SEGES');
  });
});

describe('rotuloArtigo', () => {
  it('ordinal só até o 9', () => {
    expect(rotuloArtigo('1')).toBe('Art. 1º');
    expect(rotuloArtigo('9')).toBe('Art. 9º');
    expect(rotuloArtigo('10')).toBe('Art. 10');
    expect(rotuloArtigo('75')).toBe('Art. 75');
    expect(rotuloArtigo('1-A')).toBe('Art. 1º-A');
    expect(rotuloArtigo('184-A')).toBe('Art. 184-A');
  });
});

describe('ementaNoTexto', () => {
  const ementa = 'Dispõe sobre incentivos à inovação e à pesquisa científica e tecnológica no ambiente produtivo.';
  it('encontra a ementa no começo do texto, mesmo quebrada em linhas', () => {
    expect(
      ementaNoTexto(ementa, 'LEI Nº 10.973\n\nDispõe sobre incentivos à inovação e à pesquisa\ncientífica e tecnológica no ambiente produtivo.'),
    ).toBe(true);
  });
  it('texto sem a ementa ou ausente', () => {
    expect(ementaNoTexto(ementa, 'Perguntas e respostas sobre o tema')).toBe(false);
    expect(ementaNoTexto(ementa, null)).toBe(false);
  });
});

describe('dataDePublicacao', () => {
  const ato = new Date(Date.UTC(2023, 5, 21));
  const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
  it('prefere a data declarada no texto', () => {
    const act = { publishDate: '2023-06-30T00:00:00.000Z', officialUrl: 'https://www.gov.br/x', content: 'Este texto não substitui o publicado no DOU de 23/06/2023, seção 1' };
    expect(iso(dataDePublicacao(act, ato))).toBe('2023-06-23');
    expect(iso(dataDePublicacao({ ...act, content: 'publicado no D.O.U. de 24.7.1991' }, new Date(Date.UTC(1991, 6, 24))))).toBeNull();
    expect(iso(dataDePublicacao({ ...act, content: 'publicado no DOU de 25.7.1991' }, new Date(Date.UTC(1991, 6, 24))))).toBe('1991-07-25');
  });
  it('sem data no texto, só o cadastro de ato vindo do DOU', () => {
    const dou = { publishDate: '2023-06-22T03:00:00.000Z', officialUrl: 'https://www.in.gov.br/web/dou/-/x', content: 'Texto' };
    expect(iso(dataDePublicacao(dou, ato))).toBe('2023-06-22');
    expect(dataDePublicacao({ ...dou, officialUrl: 'https://www.gov.br/x' }, ato)).toBeNull();
  });
  it('mesmo dia (mesmo com hora gravada), anterior ou distante: omitida', () => {
    const dou = { publishDate: '2023-06-21T03:00:00.000Z', officialUrl: 'https://www.in.gov.br/x', content: null };
    expect(dataDePublicacao(dou, ato)).toBeNull();
    expect(dataDePublicacao({ ...dou, publishDate: '2023-02-01T00:00:00.000Z' }, ato)).toBeNull();
    expect(dataDePublicacao({ ...dou, publishDate: '2023-12-01T00:00:00.000Z' }, ato)).toBeNull();
  });
});
