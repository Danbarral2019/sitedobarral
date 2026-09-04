import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../GlossaryTermCard', () => ({
  GlossaryTermCard: ({ term }: { term: { term: string } }) => <div>{term.term}</div>,
}));

import { GlossaryPanel } from '../GlossaryPanel';

function apiResponse(term: string, page: number, hasMore: boolean): Response {
  return {
    ok: true,
    json: async () => ({
      terms: [{
        id: `term-${page}`,
        term,
        slug: term.toLowerCase(),
        definition: 'Definição',
        category: 'Fase',
        viewCount: 0,
      }],
      categories: ['Fase'],
      availableLetters: ['A', 'H'],
      pagination: { page, pageSize: 30, total: 31, totalPages: 2, hasMore },
    }),
  } as Response;
}

describe('GlossaryPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('preserva acesso às páginas seguintes da API compartilhada', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(apiResponse('Adjudicação', 1, true))
      .mockResolvedValueOnce(apiResponse('Habilitação', 2, false));

    render(<GlossaryPanel />);

    expect(await screen.findByText('Adjudicação')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }));

    expect(await screen.findByText('Habilitação')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/glossary?page=2&pageSize=30');
  });
});
