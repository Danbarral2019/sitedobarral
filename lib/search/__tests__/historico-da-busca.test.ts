// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    searchHistory: {
      create: (...a: unknown[]) => mocks.create(...a),
      findFirst: (...a: unknown[]) => mocks.findFirst(...a),
    },
  },
}));

import {
  buscarCompartilhamento,
  registrarBuscaNoHistorico,
  shareIdValido,
} from '../historico-da-busca';

const SHARE_22 = 'AbCdEfGhIjKlMnOpQrSt_-';
const ORIGINAL_FLAG = process.env.SEARCH_ANALYTICS_ENABLED;

describe('historico-da-busca', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SEARCH_ANALYTICS_ENABLED;
    mocks.create.mockResolvedValue({ id: 'sh-1' });
  });

  afterEach(() => {
    if (ORIGINAL_FLAG === undefined) delete process.env.SEARCH_ANALYTICS_ENABLED;
    else process.env.SEARCH_ANALYTICS_ENABLED = ORIGINAL_FLAG;
  });

  describe('registrarBuscaNoHistorico', () => {
    it('grava marcando respostaDoServidor e serializando fontes e filtros', async () => {
      const id = await registrarBuscaNoHistorico({
        userId: 'u1',
        type: 'documents',
        query: '  dispensa  ',
        filters: { courseId: '3' },
        aiAnswer: 'resposta',
        sources: [{ title: 'Doc', category: 'apostila', url: 'https://x/doc' }],
        legalSources: [{ type: 'lei-article', title: 'Art. 75', url: '/lei-14133/75' }],
      });

      expect(id).toBe('sh-1');
      expect(mocks.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          type: 'documents',
          query: 'dispensa',
          filters: JSON.stringify({ courseId: '3' }),
          aiAnswer: 'resposta',
          sources: JSON.stringify([{ title: 'Doc', category: 'apostila', url: 'https://x/doc' }]),
          legalSources: JSON.stringify([{ type: 'lei-article', title: 'Art. 75', url: '/lei-14133/75' }]),
          respostaDoServidor: true,
        },
        select: { id: true },
      });
    });

    it('não grava com SEARCH_ANALYTICS_ENABLED=false', async () => {
      process.env.SEARCH_ANALYTICS_ENABLED = 'false';
      expect(await registrarBuscaNoHistorico({ userId: 'u1', type: 'documents', query: 'x', aiAnswer: 'r' })).toBeNull();
      expect(mocks.create).not.toHaveBeenCalled();
    });

    it('falha no banco não propaga (devolve null)', async () => {
      mocks.create.mockRejectedValue(new Error('db down'));
      expect(await registrarBuscaNoHistorico({ userId: 'u1', type: 'documents', query: 'x', aiAnswer: 'r' })).toBeNull();
    });
  });

  describe('shareIdValido', () => {
    it('aceita só base64url de 22 caracteres', () => {
      expect(shareIdValido(SHARE_22)).toBe(true);
      expect(shareIdValido('abcd1234')).toBe(false); // formato antigo (8)
      expect(shareIdValido(SHARE_22 + 'a')).toBe(false);
      expect(shareIdValido('AbCdEfGhIjKlMnOpQrSt+/')).toBe(false);
      expect(shareIdValido(undefined)).toBe(false);
    });
  });

  describe('buscarCompartilhamento', () => {
    it('link antigo de 8 caracteres não chega ao banco', async () => {
      expect(await buscarCompartilhamento('abcd1234')).toBeNull();
      expect(mocks.findFirst).not.toHaveBeenCalled();
    });

    it('exige compartilhamento público e resposta gravada pelo servidor', async () => {
      mocks.findFirst.mockResolvedValue(null);
      expect(await buscarCompartilhamento(SHARE_22)).toBeNull();
      expect(mocks.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shareId: SHARE_22, isPublic: true, respostaDoServidor: true },
        }),
      );
    });

    it('devolve consulta, resposta e fontes (JSON inválido vira lista vazia)', async () => {
      const createdAt = new Date('2026-09-30T12:00:00Z');
      mocks.findFirst.mockResolvedValue({
        query: 'dispensa',
        aiAnswer: 'resposta',
        sources: JSON.stringify([{ title: 'Doc', category: 'apostila' }]),
        legalSources: '{quebrado',
        createdAt,
      });
      expect(await buscarCompartilhamento(SHARE_22)).toEqual({
        query: 'dispensa',
        aiAnswer: 'resposta',
        sources: [{ title: 'Doc', category: 'apostila' }],
        legalSources: [],
        createdAt,
      });
    });
  });
});
