/**
 * A busca com IA da Lei 14.133 exige login: o visitante vê o convite a entrar
 * ou cadastrar-se no lugar do erro (painel de resultados) e no lugar do botão
 * morto do cabeçalho público.
 */

/// <reference types="@testing-library/jest-dom/vitest" />

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const authState = vi.hoisted(() => ({ isAuthenticated: false }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ isAuthenticated: authState.isAuthenticated }),
}));

import { LeiAISearchResults } from '../LeiAISearchResults';
import { LeiPreviewHeader } from '../LeiPreviewHeader';

const headerProps = {
  searchQuery: '',
  onSearchChange: () => {},
  onlyWithDocuments: false,
  onToggleOnlyWithDocs: () => {},
  totalArticles: 195,
  totalWithDocs: 100,
};

describe('convite a entrar para usar a IA da Lei 14.133', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
  });

  it('painel de resultados mostra o convite quando a API exige login', () => {
    render(
      <LeiAISearchResults
        isSearching={false}
        results={null}
        onClose={() => {}}
        onResultClick={() => {}}
        exigeLogin
        returnTo="/area-restrita/lei-comentada"
      />,
    );

    expect(screen.getByText(/exclusiva para usuários cadastrados/i)).toBeInTheDocument();
    expect(screen.queryByText(/erro ao processar/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /entrar/i })).toHaveAttribute(
      'href',
      '/login?returnTo=%2Farea-restrita%2Flei-comentada',
    );
    expect(screen.getByRole('link', { name: /criar cadastro/i })).toHaveAttribute('href', '/registro');
  });

  it('sem exigir login, o erro continua como antes', () => {
    render(
      <LeiAISearchResults isSearching={false} results={null} onClose={() => {}} onResultClick={() => {}} />,
    );
    expect(screen.getByText(/erro ao processar/i)).toBeInTheDocument();
  });

  it('cabeçalho público: visitante abre o convite ao clicar em Buscar com IA', async () => {
    render(<LeiPreviewHeader {...headerProps} />);

    expect(screen.queryByText(/exclusiva para usuários cadastrados/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /buscar com ia/i }));
    expect(screen.getByText(/exclusiva para usuários cadastrados/i)).toBeInTheDocument();
  });

  it('cabeçalho público: usuário logado vai direto à Lei comentada com IA', () => {
    authState.isAuthenticated = true;
    render(<LeiPreviewHeader {...headerProps} />);

    expect(screen.getByRole('link', { name: /buscar com ia/i })).toHaveAttribute(
      'href',
      '/area-restrita/lei-comentada',
    );
  });
});
