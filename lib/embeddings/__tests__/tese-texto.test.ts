// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { textoEmbeddavel } from '../tese-texto';

const base = {
  enunciado: 'A exigência de atestado de capacidade técnica deve guardar pertinência com o objeto.',
  assunto: 'Qualificação técnica em licitações',
  numeroAlvo: 1441,
  anoAlvo: 2016,
  colegiadoAlvo: 'Plenário',
  acordaoKey: 'ACORDAO-COMPLETO-123',
  origemIdentidade: 'tcu-oficial',
};

describe('textoEmbeddavel', () => {
  it('prefixa o assunto e o acórdão-líder com colegiado quando ele é sabido', () => {
    expect(textoEmbeddavel(base)).toBe(
      'Qualificação técnica em licitações\nAcórdão 1441/2016 — Plenário\n\n' +
        'A exigência de atestado de capacidade técnica deve guardar pertinência com o objeto.',
    );
  });

  it('mantém o colegiado quando ele vem da convergência dos citantes', () => {
    const texto = textoEmbeddavel({ ...base, acordaoKey: null, origemIdentidade: 'convergencia-citantes' });
    expect(texto).toContain('Acórdão 1441/2016 — Plenário');
  });

  // §4.3: nunca afirmar colegiado que não se sabe. No nível 3 a linha do
  // acórdão termina no ano, e não ganha "colegiado desconhecido" — isso poria
  // a palavra "desconhecido" dentro do vetor, competindo com o conteúdo.
  it('omite o colegiado quando não se sabe qual é', () => {
    const texto = textoEmbeddavel({ ...base, colegiadoAlvo: null, acordaoKey: null, origemIdentidade: null });
    expect(texto).toContain('Acórdão 1441/2016\n');
    expect(texto).not.toContain('—');
  });

  it('não deixa assunto vazio virar linha em branco no começo', () => {
    const texto = textoEmbeddavel({ ...base, assunto: '   ' });
    expect(texto.startsWith('Acórdão')).toBe(true);
  });
});
