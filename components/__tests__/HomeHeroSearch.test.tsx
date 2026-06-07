/**
 * Testes para componente HomeHeroSearch (barra de busca do hero da home).
 */

/// <reference types="@testing-library/jest-dom/vitest" />

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomeHeroSearch from '../HomeHeroSearch';

// Mock do router do Next
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe('HomeHeroSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza campo de busca e botão', () => {
    render(<HomeHeroSearch />);
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/pesquisar acórdãos/i)
    ).toBeInTheDocument();
  });

  it('navega para /busca?q= com o termo ao enviar', async () => {
    const user = userEvent.setup();
    render(<HomeHeroSearch />);

    await user.type(
      screen.getByPlaceholderText(/pesquisar acórdãos/i),
      'dispensa'
    );
    await user.keyboard('{Enter}');

    expect(pushMock).toHaveBeenCalledWith('/busca?q=dispensa');
  });

  it('codifica caracteres especiais no termo', async () => {
    const user = userEvent.setup();
    render(<HomeHeroSearch />);

    await user.type(
      screen.getByPlaceholderText(/pesquisar acórdãos/i),
      'lei 14.133 & contratos'
    );
    await user.keyboard('{Enter}');

    expect(pushMock).toHaveBeenCalledWith(
      `/busca?q=${encodeURIComponent('lei 14.133 & contratos')}`
    );
  });

  it('não navega quando o termo está vazio ou só com espaços', async () => {
    const user = userEvent.setup();
    render(<HomeHeroSearch />);

    await user.type(screen.getByPlaceholderText(/pesquisar acórdãos/i), '   ');
    await user.keyboard('{Enter}');

    expect(pushMock).not.toHaveBeenCalled();
  });
});
