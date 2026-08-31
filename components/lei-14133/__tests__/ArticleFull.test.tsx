import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArticleFull } from '../ArticleFull';

/**
 * O texto da lei é o produto. Estas regras vêm do DESIGN.md e do PRODUCT.md, e
 * quebram em silêncio: nada lança erro se o ordinal sair errado ou se o inciso
 * perder o recuo — a página só fica pior.
 */
describe('ArticleFull', () => {
  it('usa ordinal º nos artigos 1º a 9º', () => {
    render(<ArticleFull numero="5" ementa="Para os fins desta Lei, consideram-se:" />);
    expect(screen.getByText(/Art\. 5/).textContent).toContain('º');
  });

  it('usa cardinal do artigo 10 em diante', () => {
    render(<ArticleFull numero="75" ementa="É dispensável a licitação:" />);
    expect(screen.getByText(/Art\. 75/).textContent).not.toContain('º');
  });

  it('trata artigo com sufixo de letra, como 184-A', () => {
    render(<ArticleFull numero="184-A" ementa="Texto do artigo." />);
    expect(screen.getByText(/Art\. 184-A/).textContent).not.toContain('º');
  });

  it('renderiza inciso romano separado do texto, para o recuo pendente', () => {
    render(
      <ArticleFull
        numero="75"
        ementa={'É dispensável a licitação:\n\nI - para contratação de baixo valor;'}
      />,
    );
    expect(screen.getByText('I —')).toBeInTheDocument();
    expect(screen.getByText('para contratação de baixo valor;')).toBeInTheDocument();
  });

  it('renderiza alínea com o marcador separado', () => {
    render(
      <ArticleFull
        numero="75"
        ementa={'Caput do artigo aqui:\n\na) primeira alínea do inciso;'}
      />,
    );
    expect(screen.getByText('a)')).toBeInTheDocument();
    expect(screen.getByText('primeira alínea do inciso;')).toBeInTheDocument();
  });

  it('destaca o marcador do parágrafo sem separá-lo do texto', () => {
    render(
      <ArticleFull
        numero="75"
        ementa={'Caput do artigo aqui:\n\n§ 1º O somatório será apurado no exercício.'}
      />,
    );
    expect(screen.getByText('§ 1º')).toBeInTheDocument();
  });

  it('usa a classe de leitura do sistema, não a tipografia de interface', () => {
    const { container } = render(<ArticleFull numero="75" ementa="É dispensável a licitação:" />);
    expect(container.querySelector('.font-reading')).not.toBeNull();
  });

  it('mostra as contagens de acórdãos e pareceres quando existem', () => {
    render(
      <ArticleFull
        numero="75"
        ementa="É dispensável a licitação:"
        counts={{ acordaos: 47, pareceresOns: 3 }}
      />,
    );
    expect(screen.getByText(/47 acórdãos/)).toBeInTheDocument();
    expect(screen.getByText(/3 pareceres\/ONs/)).toBeInTheDocument();
  });

  it('usa singular quando há uma só referência', () => {
    render(
      <ArticleFull numero="75" ementa="Texto." counts={{ acordaos: 1, pareceresOns: 1 }} />,
    );
    expect(screen.getByText(/1 acórdão/)).toBeInTheDocument();
  });

  it('omite as contagens quando são zero', () => {
    render(
      <ArticleFull numero="75" ementa="Texto." counts={{ acordaos: 0, pareceresOns: 0 }} />,
    );
    expect(screen.queryByText(/acórdão/)).toBeNull();
  });

  it('sempre oferece o link para o texto oficial no Planalto', () => {
    render(<ArticleFull numero="75" ementa="Texto." />);
    const link = screen.getByText(/planalto\.gov\.br/).closest('a');
    expect(link).toHaveAttribute('href', expect.stringContaining('planalto.gov.br'));
  });
});
