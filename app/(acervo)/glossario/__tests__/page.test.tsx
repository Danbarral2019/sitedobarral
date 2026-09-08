import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/glossary/GlossaryTermCard', () => ({
  GlossaryTermCard: ({ term }: { term: { term: string } }) => <div>{term.term}</div>,
}));

import GlossarioPage from '@/app/(acervo)/glossario/page';

const firstPage = {
  terms: [
    {
      id: 'term-1',
      term: 'Adjudicação',
      slug: 'adjudicacao',
      definition: 'Definição 1',
      shortDef: null,
      category: 'Fase',
      viewCount: 1,
      leiArticlesArr: ['71'],
      relatedTerms: null,
    },
  ],
  categories: ['Fase'],
  availableLetters: ['A', 'H'],
  pagination: {
    page: 1,
    pageSize: 30,
    total: 31,
    totalPages: 2,
    hasMore: true,
  },
};

const secondPage = {
  ...firstPage,
  terms: [
    {
      ...firstPage.terms[0],
      id: 'term-2',
      term: 'Habilitação',
      slug: 'habilitacao',
    },
  ],
  pagination: {
    ...firstPage.pagination,
    page: 2,
    hasMore: false,
  },
};

function response(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

describe('GlossarioPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('carrega 30 termos por página e acrescenta a página seguinte sob demanda', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response(firstPage))
      .mockResolvedValueOnce(response(secondPage));

    render(<GlossarioPage />);

    expect(await screen.findByText('Adjudicação')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/glossary?page=1&pageSize=30');

    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }));

    expect(await screen.findByText('Habilitação')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/glossary?page=2&pageSize=30');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /carregar mais/i })).not.toBeInTheDocument();
    });
  });
});
