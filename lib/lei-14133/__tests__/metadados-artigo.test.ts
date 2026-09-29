import { describe, it, expect } from 'vitest';
import {
  artigoIndexavel,
  artigosIndexaveis,
  descricaoDoArtigo,
  metadadosDoArtigo,
  urlDoArtigo,
} from '../metadados-artigo';

describe('metadadosDoArtigo', () => {
  it('artigo de 1 a 9 usa ordinal no título', () => {
    const m = metadadosDoArtigo('1');
    expect(m?.title).toBe('Art. 1º da Lei 14.133/2021');
    expect(m?.alternates?.canonical).toBe('/lei-14133?artigo=1');
  });

  it('artigo a partir do 10 usa cardinal, mesmo que os dados tragam "10º"', () => {
    expect(metadadosDoArtigo('10')?.title).toBe('Art. 10 da Lei 14.133/2021');
    expect(descricaoDoArtigo('10')).not.toMatch(/^Art\./);
  });

  it('artigo com letra', () => {
    const m = metadadosDoArtigo('184-A');
    expect(m?.title).toBe('Art. 184-A da Lei 14.133/2021');
    expect(m?.alternates?.canonical).toBe('/lei-14133?artigo=184-A');
  });

  it('descrição começa pelo texto do artigo e respeita o limite', () => {
    const d = descricaoDoArtigo('1');
    expect(d.startsWith('Esta Lei estabelece normas gerais')).toBe(true);
    expect(d.length).toBeLessThanOrEqual(156);
    expect(d.endsWith('…')).toBe(true);
  });

  it('ignora parâmetro inválido, inexistente ou do Código Penal', () => {
    expect(metadadosDoArtigo(undefined)).toBeNull();
    expect(metadadosDoArtigo('abc')).toBeNull();
    expect(metadadosDoArtigo('9999')).toBeNull();
    expect(metadadosDoArtigo('337-E')).toBeNull();
    expect(artigoIndexavel('337-P')).toBe(false);
  });
});

describe('artigosIndexaveis', () => {
  it('exclui os arts. 337-E a 337-P e mantém os da Lei', () => {
    const lista = artigosIndexaveis();
    expect(lista).toContain('1');
    expect(lista).toContain('75');
    expect(lista).toContain('184-A');
    expect(lista.some((n) => n.startsWith('337-'))).toBe(false);
  });
});

describe('urlDoArtigo', () => {
  it('monta a URL da página com o parâmetro', () => {
    expect(urlDoArtigo('75')).toBe('/lei-14133?artigo=75');
  });
});
