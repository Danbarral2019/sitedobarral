/**
 * Testes do cabeçalho global: menus "Cursos" e "Mais" (disclosure) e menu móvel.
 *
 * A largura em que cada variante aparece depende de CSS e é medida no navegador
 * (e2e/cabecalho.spec.ts); aqui se verifica o comportamento.
 */

/// <reference types="@testing-library/jest-dom/vitest" />

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '../Header';

// Rota observável, para simular a navegação (inclusive pelo botão Voltar) com
// o componente montado.
const rota = vi.hoisted(() => {
  let atual = '/';
  const ouvintes = new Set<() => void>();
  return {
    obter: () => atual,
    assinar: (ouvinte: () => void) => {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    mudar: (nova: string) => {
      atual = nova;
      ouvintes.forEach((ouvinte) => ouvinte());
    },
  };
});

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    usePathname: () => useSyncExternalStore(rota.assinar, rota.obter, rota.obter),
  };
});

// Sem o roteador do Next, o clique num <Link> seguiria para a navegação do
// jsdom, que não é implementada.
const impedirNavegacao = (event: MouseEvent) => {
  if ((event.target as Element).closest('a')) event.preventDefault();
};

function painelDe(botao: HTMLElement) {
  const painel = document.getElementById(botao.getAttribute('aria-controls') ?? '');
  expect(painel).not.toBeNull();
  return painel as HTMLElement;
}

describe('Header', () => {
  beforeEach(() => {
    rota.mudar('/');
    document.addEventListener('click', impedirNavegacao, true);
  });

  afterEach(() => {
    document.removeEventListener('click', impedirNavegacao, true);
  });

  it('mostra os itens principais e um único link para a Área do Aluno', () => {
    render(<Header />);
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });

    for (const label of ['Base de Conhecimento', 'Legislação', 'Jurisprudência', 'Teses', 'Planos']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    const aluno = within(nav).getAllByRole('link', { name: 'Área do Aluno' });
    expect(aluno).toHaveLength(1);
    expect(aluno[0]).toHaveAttribute('href', '/login');
  });

  it('agrupa as páginas institucionais no menu "Mais"', async () => {
    const user = userEvent.setup();
    render(<Header />);
    const mais = screen.getByRole('button', { name: 'Mais' });

    expect(mais).toHaveAttribute('aria-expanded', 'false');
    // Nem oculto: queryByText também acha elemento com `hidden`, e um rótulo
    // repetido no cabeçalho desviava o getByText(...).first() dos testes de fluxo.
    expect(screen.queryByText('Glossário')).not.toBeInTheDocument();

    await user.click(mais);

    expect(mais).toHaveAttribute('aria-expanded', 'true');
    const links = within(painelDe(mais)).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Sobre', 'Blog', 'Glossário', 'FAQ', 'Contato']);
  });

  it('lista os cursos no menu "Cursos"', async () => {
    const user = userEvent.setup();
    render(<Header />);
    const cursos = screen.getByRole('button', { name: 'Cursos' });
    expect(screen.queryByText('Ver todos os cursos')).not.toBeInTheDocument();

    await user.click(cursos);

    const painel = painelDe(cursos);
    expect(within(painel).getByRole('link', { name: 'Ver todos os cursos' })).toHaveAttribute('href', '/cursos');
    expect(within(painel).getAllByRole('link').length).toBeGreaterThan(1);
  });

  it('Esc fecha o painel e devolve o foco ao botão', async () => {
    const user = userEvent.setup();
    render(<Header />);
    const mais = screen.getByRole('button', { name: 'Mais' });

    await user.click(mais);
    await user.tab();
    expect(screen.getByRole('link', { name: 'Sobre' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(mais).toHaveAttribute('aria-expanded', 'false');
    expect(mais).toHaveFocus();
  });

  it('fecha quando o Tab leva o foco para fora do painel', async () => {
    const user = userEvent.setup();
    render(<Header />);
    const mais = screen.getByRole('button', { name: 'Mais' });

    await user.click(mais);
    for (let i = 0; i < 6; i++) await user.tab();

    expect(screen.getByRole('link', { name: 'Área do Aluno' })).toHaveFocus();
    expect(mais).toHaveAttribute('aria-expanded', 'false');
  });

  it('fecha com clique fora e quando o outro menu é aberto', async () => {
    const user = userEvent.setup();
    render(<Header />);
    const cursos = screen.getByRole('button', { name: 'Cursos' });
    const mais = screen.getByRole('button', { name: 'Mais' });

    await user.click(cursos);
    await user.click(mais);
    expect(cursos).toHaveAttribute('aria-expanded', 'false');
    expect(mais).toHaveAttribute('aria-expanded', 'true');

    await user.click(document.body);
    expect(mais).toHaveAttribute('aria-expanded', 'false');
  });

  it('fecha ao clicar num link do painel e quando a rota muda', async () => {
    const user = userEvent.setup();
    render(<Header />);
    const mais = screen.getByRole('button', { name: 'Mais' });

    await user.click(mais);
    await user.click(screen.getByRole('link', { name: 'FAQ' }));
    expect(mais).toHaveAttribute('aria-expanded', 'false');

    await user.click(mais);
    act(() => rota.mudar('/blog'));
    expect(mais).toHaveAttribute('aria-expanded', 'false');
  });

  it('destaca "Mais" e a página atual quando ela está no menu', async () => {
    rota.mudar('/faq');
    const user = userEvent.setup();
    render(<Header />);
    const mais = screen.getByRole('button', { name: 'Mais' });

    expect(mais).toHaveClass('font-semibold');
    await user.click(mais);
    expect(within(painelDe(mais)).getByRole('link', { name: 'FAQ' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Cursos' })).not.toHaveClass('font-semibold');
  });

  it('abre e fecha o menu móvel com todos os itens', async () => {
    const user = userEvent.setup();
    render(<Header />);
    const toggle = screen.getByRole('button', { name: 'Abrir menu' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Fechar menu');
    const menu = painelDe(toggle);
    expect(within(menu).getAllByRole('link')).toHaveLength(12);

    await user.click(within(menu).getByRole('link', { name: 'Blog' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('cabecalho-menu-movel')).toBeNull();
  });
});
