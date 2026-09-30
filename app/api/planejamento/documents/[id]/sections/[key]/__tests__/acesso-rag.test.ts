// @vitest-environment node
/**
 * As rotas de contexto e de geração de seção calculam o acesso do usuário a
 * partir do payload do JWT e o repassam ao RAG do planejamento.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  hasAnyActiveAccess: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  getAcessoDoUsuario: vi.fn(),
  buildSectionContext: vi.fn(),
  generateSectionText: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...a: unknown[]) => mocks.getCurrentUser(...a),
  hasAnyActiveAccess: (...a: unknown[]) => mocks.hasAnyActiveAccess(...a),
}));
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: async () => undefined,
  getClientIp: () => '127.0.0.1',
}));
vi.mock('@/lib/logger', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => logger };
  return { apiLogger: logger };
});
vi.mock('@/lib/prisma', () => ({
  prisma: {
    planningDocumentSection: {
      findFirst: (...a: unknown[]) => mocks.findFirst(...a),
      update: (...a: unknown[]) => mocks.update(...a),
    },
  },
}));
vi.mock('@/lib/search/acesso-documentos', () => ({
  getAcessoDoUsuario: (...a: unknown[]) => mocks.getAcessoDoUsuario(...a),
}));
vi.mock('@/lib/planejamento/rag', () => ({
  buildSectionContext: (...a: unknown[]) => mocks.buildSectionContext(...a),
}));
vi.mock('@/lib/planejamento/section-generator', () => ({
  generateSectionText: (...a: unknown[]) => mocks.generateSectionText(...a),
}));

import { GET } from '../context/route';
import { POST } from '../generate/route';
import { getTrailBySlug } from '@/data/planejamento/trails';

const trail = getTrailBySlug('servico-comum-continuado-etp')!;
const KEY = trail.sections[0].key;
const params = { params: Promise.resolve({ id: 'doc-1', key: KEY }) };
const USER = { userId: 'u1', email: 'a@x.com', role: 'student' };
const ACESSO = { isAdmin: false, temAcessoAtivo: true, cursosAtivos: ['2'] };

const SECTION = {
  id: 'sec-1',
  status: 'PENDING',
  contentMd: null,
  document: {
    type: 'ETP',
    session: {
      trailTemplate: null,
      natureza: 'SERVICO_CONTINUADO',
      descricaoLivre: 'contratação de serviço de limpeza predial continuada',
    },
  },
};

describe('planejamento: rotas de seção repassam o acesso ao RAG', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(USER);
    mocks.hasAnyActiveAccess.mockResolvedValue(true);
    mocks.findFirst.mockResolvedValue(SECTION);
    mocks.update.mockResolvedValue({ id: 'sec-1' });
    mocks.getAcessoDoUsuario.mockResolvedValue(ACESSO);
    mocks.buildSectionContext.mockResolvedValue({
      excerpts: [], articles: [], relatedActs: [], sources: [], anchorageScore: 0, topSimilarity: 0,
    });
    mocks.generateSectionText.mockResolvedValue({
      text: 'texto', provenance: 'NOT_ANCHORED', sources: [], anchorageScore: 0, topSimilarity: 0,
      model: { provider: 'p', modelId: 'm' }, latencyMs: 1, tokens: {},
    });
  });

  it('GET context calcula o acesso do usuário e o passa ao buildSectionContext', async () => {
    const res = await GET(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(200);
    expect(mocks.getAcessoDoUsuario).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', role: 'student' }));
    expect(mocks.buildSectionContext.mock.calls[0][1]).toMatchObject({ acesso: ACESSO });
  });

  it('POST generate calcula o acesso do usuário e o passa ao generateSectionText', async () => {
    const res = await POST(
      new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ mode: 'fresh' }) }),
      params,
    );
    expect(res.status).toBe(200);
    expect(mocks.getAcessoDoUsuario).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
    expect(mocks.generateSectionText.mock.calls[0][0]).toMatchObject({ acesso: ACESSO });
  });
});
