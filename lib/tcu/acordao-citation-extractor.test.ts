import { describe, it, expect } from 'vitest';
import { extractAcordaoCitations } from './acordao-citation-extractor';

describe('extractAcordaoCitations', () => {
  it('reconhece "Acórdão 4851/2017"', () => {
    const [c] = extractAcordaoCitations('Conforme o Acórdão 4851/2017, decido.');
    expect(c).toMatchObject({ numero: 4851, ano: 2017, colegiado: null });
  });

  it('normaliza pontos de milhar e captura o Plenário', () => {
    const [c] = extractAcordaoCitations('Vide Acórdão nº 4.851/2017-Plenário.');
    expect(c).toMatchObject({ numero: 4851, ano: 2017, colegiado: 'Plenário' });
  });

  it('reconhece "AC 1234/2020-TCU-Plenário"', () => {
    const [c] = extractAcordaoCitations('AC 1234/2020-TCU-Plenário');
    expect(c).toMatchObject({ numero: 1234, ano: 2020, colegiado: 'Plenário' });
  });

  it('canoniza as câmaras', () => {
    const [a] = extractAcordaoCitations('Acórdão 10/2019-Primeira Câmara');
    expect(a.colegiado).toBe('Primeira Câmara');
    const [b] = extractAcordaoCitations('Acórdão 11/2019 - 2ª Câmara');
    expect(b.colegiado).toBe('Segunda Câmara');
  });

  it('reconhece a cauda de lista "Acórdãos 1/2020, 2/2021 e 3/2022"', () => {
    const cs = extractAcordaoCitations('Vide Acórdãos 1/2020, 2/2021 e 3/2022.');
    expect(cs.map((c) => `${c.numero}/${c.ano}`)).toEqual(['1/2020', '2/2021', '3/2022']);
  });

  it('NÃO casa "acórdão recorrido" (sem número)', () => {
    expect(extractAcordaoCitations('mantém o acórdão recorrido em seus termos')).toHaveLength(0);
  });

  it('NÃO casa "o presente acórdão"', () => {
    expect(extractAcordaoCitations('o presente acórdão não se aplica ao caso')).toHaveLength(0);
  });

  it('NÃO confunde "Lei 14.133/2021" mencionada depois de "acórdão"', () => {
    expect(extractAcordaoCitations('acórdão que trata da Lei 14.133/2021')).toHaveLength(0);
  });

  it('o index aponta para o começo da citação', () => {
    const t = 'texto texto Acórdão 500/2015 fim';
    const [c] = extractAcordaoCitations(t);
    expect(t.slice(c.index, c.index + 7)).toBe('Acórdão');
  });

  it('descarta ano implausível', () => {
    expect(extractAcordaoCitations('Acórdão 1/0007 sem sentido')).toHaveLength(0);
  });
});
