// @vitest-environment node
/**
 * Regressão: o cron de ONs não pode desfazer a curadoria de uma ON existente.
 *
 * Em 21/07/2026 o cron import-documents (overrides `isPublic: false`) passou
 * por findOrCreateWithVersioning, que sobrescreve o registro inteiro quando
 * detecta mudança: 101 ONs ficaram ocultas e o link DOU específico voltou a ser
 * a página genérica /onsagu (e o texto integral pelo enunciado raspado).
 * Regra: o cron só cria ON nova; redação alterada passa por revisão humana.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindFirst, mockFindOrCreate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindOrCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { document: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } } }));
vi.mock('../versioning', () => ({ findOrCreateWithVersioning: (...a: unknown[]) => mockFindOrCreate(...a) }));
vi.mock('@/lib/logger', () => ({ apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { saveOrientacaoNormativaWithVersioning } from '../orientacoes-normativas';
import type { AGUDocument } from '../../agu-types';

const DOU = 'https://www.in.gov.br/web/dou/-/orientacao-normativa-n-56-de-28-de-maio-de-2018-16320949';
const ONSAGU = 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu';

const aguDoc = {
  titulo: 'Orientação Normativa AGU nº 56/2018',
  descricao: 'Enunciado oficial.',
  numero: 'ON 56/2018',
  numeroInt: 56,
  ano: 2018,
  url: ONSAGU,
  urlsAlternativas: ['https://www.gov.br/agu/pt-br/composicao/cgu/cgu/ons/fundamentacao-on-56.pdf'],
  tags: [],
  temas: [],
  cursosIds: [],
  relevanciaScore: 50,
} as unknown as AGUDocument;

const cronOverrides = { isPublic: false, reviewed: false, courseId: '2', isCommon: true };

beforeEach(() => {
  mockFindFirst.mockReset();
  mockFindOrCreate.mockReset().mockResolvedValue({ document: {}, isNew: false, hasChanges: true });
});

describe('saveOrientacaoNormativaWithVersioning — curadoria', () => {
  it('ON existente: não reescreve nada (nem visibilidade, nem link DOU, nem texto)', async () => {
    const existing = { id: 'x', url: DOU, isPublic: true };
    mockFindFirst.mockResolvedValue(existing);
    const r = await saveOrientacaoNormativaWithVersioning(aguDoc, cronOverrides);
    expect(mockFindOrCreate).not.toHaveBeenCalled();
    expect(r).toEqual({ success: true, document: existing, isNew: false, hasChanges: false });
  });

  it('dedup por onNumber + onYear', async () => {
    mockFindFirst.mockResolvedValue(null);
    await saveOrientacaoNormativaWithVersioning(aguDoc, cronOverrides);
    expect(mockFindFirst.mock.calls[0][0].where).toEqual({ onNumber: 56, onYear: 2018 });
  });

  it('ON excluída a pedido (104/2026): não é recriada nem consultada', async () => {
    mockFindFirst.mockResolvedValue(null);
    const r = await saveOrientacaoNormativaWithVersioning(
      { ...aguDoc, numeroInt: 104, ano: 2026 } as AGUDocument,
      cronOverrides,
    );
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockFindOrCreate).not.toHaveBeenCalled();
    expect(r).toEqual({ success: true, isNew: false, hasChanges: false });
  });

  it('ON nova: criada com os overrides do cron (privada até revisão)', async () => {
    mockFindFirst.mockResolvedValue(null);
    await saveOrientacaoNormativaWithVersioning(aguDoc, cronOverrides);
    const data = mockFindOrCreate.mock.calls[0][1];
    expect(data.isPublic).toBe(false);
    expect(data.courseId).toBe('2');
    expect(data.url).toBe(ONSAGU);
  });
});
