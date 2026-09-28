// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CartaoTese from '../CartaoTese';
import type { TeseCard } from '@/lib/teses/consultas';

const base: TeseCard = {
  enunciadoId: 'e1',
  enunciado: 'A pretensão punitiva subordina-se ao prazo de dez anos.',
  inovacao: 'Fixou o prazo geral.',
  numeroAlvo: 1441,
  anoAlvo: 2016,
  colegiadoAlvo: 'Plenário',
  nivel: 'oficial',
  citantesConcordantes: null,
  citacoesNoVoto: 262,
  chaveUrl: '1441-2016-plenario',
  trechos: [
    {
      ordem: 0, trecho: 'Conforme o Acórdão 1441/2016, o prazo é decenal.',
      origemNumero: 100, origemAno: 2020, origemColegiado: 'Plenário',
      origemUrl: 'https://u/100', origemLinkPDF: null, noVoto: true,
    },
  ],
};

describe('CartaoTese', () => {
  it('mostra o enunciado, o precedente e as citações', () => {
    render(<CartaoTese tese={base} />);
    expect(screen.getByText(/prazo de dez anos/)).toBeDefined();
    // Pelo papel, não pelo texto: o trecho-fonte também cita 1441/2016, e
    // getByText casaria os dois. O que importa aqui é o precedente identificado.
    expect(screen.getByRole('link', { name: /Acórdão 1441\/2016/ })).toBeDefined();
    expect(screen.getByText(/262/)).toBeDefined();
  });

  it('nível oficial exibe o colegiado sem ressalva', () => {
    render(<CartaoTese tese={base} />);
    expect(screen.getByText(/Plenário/)).toBeDefined();
    expect(screen.queryByText(/segundo os votos/i)).toBeNull();
  });

  it('nível convergência exibe o colegiado com a contagem que o sustenta', () => {
    render(<CartaoTese tese={{ ...base, nivel: 'convergencia', citantesConcordantes: 23, colegiadoAlvo: 'Segunda Câmara' }} />);
    expect(screen.getByText(/Segunda Câmara/)).toBeDefined();
    expect(screen.getByText(/23/)).toBeDefined();
    expect(screen.getByText(/segundo os votos/i)).toBeDefined();
  });

  it('nível sem-colegiado não afirma colegiado algum', () => {
    render(<CartaoTese tese={{ ...base, nivel: 'sem-colegiado', colegiadoAlvo: null }} />);
    expect(screen.queryByText(/Plenário/)).toBeNull();
    expect(screen.getByText(/não identificado/i)).toBeDefined();
  });

  it('exibe o primeiro trecho-fonte, com link para o inteiro teor do citante', () => {
    render(<CartaoTese tese={base} />);
    expect(screen.getByText(/o prazo é decenal/)).toBeDefined();
    const link = screen.getByRole('link', { name: /100\/2020/ });
    expect(link.getAttribute('href')).toBe('https://u/100');
  });

  it('usa o PDF quando não há URL', () => {
    const semUrl = { ...base, trechos: [{ ...base.trechos[0], origemUrl: null, origemLinkPDF: 'https://p/100' }] };
    render(<CartaoTese tese={semUrl} />);
    expect(screen.getByRole('link', { name: /100\/2020/ }).getAttribute('href')).toBe('https://p/100');
  });

  it('o artigo carrega a âncora do enunciado', () => {
    const { container } = render(<CartaoTese tese={base} />);
    expect(container.querySelector('article')?.id).toBe('e1');
  });

  it('sem `ancora`, o precedente leva à página do acórdão', () => {
    render(<CartaoTese tese={base} />);
    const link = screen.getByRole('link', { name: /Acórdão 1441\/2016/ });
    expect(link.getAttribute('href')).toBe('/teses/1441-2016-plenario');
  });

  // Vindo da busca, o leitor precisa cair na tese que procurou, e não no topo
  // de uma página que pode ter várias (spec §9).
  it('com `ancora`, o precedente leva à tese dentro da página do acórdão', () => {
    render(<CartaoTese tese={base} ancora />);
    const link = screen.getByRole('link', { name: /Acórdão 1441\/2016/ });
    expect(link.getAttribute('href')).toBe('/teses/1441-2016-plenario#e1');
  });
});
