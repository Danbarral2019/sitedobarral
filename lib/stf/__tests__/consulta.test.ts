// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { montarCorpoConsulta, CAMPOS_BUSCA_STF, URL_API_STF } from '../consulta';

describe('montarCorpoConsulta', () => {
  it('filtra pela base pedida', () => {
    const c = montarCorpoConsulta({ termo: '"Lei 14.133"', base: 'acordaos' }) as any;
    expect(c.query.bool.filter[0]).toEqual({ term: { base: 'acordaos' } });
  });

  it('usa AND como operador padrão sobre os campos de busca', () => {
    const c = montarCorpoConsulta({ termo: '"Lei 14.133"', base: 'acordaos' }) as any;
    expect(c.query.bool.filter[1].query_string).toMatchObject({
      query: '"Lei 14.133"',
      default_operator: 'AND',
      fields: CAMPOS_BUSCA_STF,
    });
  });

  it('acrescenta faixa de datas só quando pedida', () => {
    const sem = montarCorpoConsulta({ termo: 'licitação', base: 'acordaos' }) as any;
    expect(sem.query.bool.filter).toHaveLength(2);

    const com = montarCorpoConsulta({
      termo: 'licitação',
      base: 'acordaos',
      dataInicio: '2021-04-01',
    }) as any;
    expect(com.query.bool.filter[2]).toEqual({
      range: { julgamento_data: { gte: '2021-04-01' } },
    });
  });

  it('ordena por julgamento decrescente e pede o total real', () => {
    const c = montarCorpoConsulta({ termo: 'x', base: 'decisoes' }) as any;
    expect(c.sort).toEqual([{ julgamento_data: 'desc' }]);
    expect(c.track_total_hits).toBe(true);
  });

  it('pagina com size e from', () => {
    const c = montarCorpoConsulta({ termo: 'x', base: 'acordaos', tamanho: 50, desloc: 100 }) as any;
    expect(c.size).toBe(50);
    expect(c.from).toBe(100);
  });

  it('aponta para o endpoint público do STF', () => {
    expect(URL_API_STF).toBe('https://jurisprudencia.stf.jus.br/api/search/search');
  });
});
