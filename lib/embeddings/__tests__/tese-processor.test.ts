// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique, mockUpdate, mockExecuteRaw, mockEmbeddings } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockEmbeddings: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teseEnunciado: { findUnique: mockFindUnique, update: mockUpdate },
    $executeRawUnsafe: mockExecuteRaw,
  },
}));
vi.mock('../gemini-embeddings', () => ({
  generateBatchEmbeddings: mockEmbeddings,
  embeddingToSql: (v: number[]) => `[${v.join(',')}]`,
}));

import { processTeseEnunciado } from '../tese-processor';

const elegivel = {
  id: 'e1',
  enunciado: 'Enunciado de teste com tamanho suficiente para virar vetor.',
  veredito: 'fiel',
  retiradoEm: null,
  trechosFonte: [0],
  trechos: [{ ordem: 0, origemDocumentId: 'd1', origemUrl: null, origemLinkPDF: null }],
  destilacao: {
    atual: true,
    assunto: 'Assunto',
    numeroAlvo: 1441,
    anoAlvo: 2016,
    colegiadoAlvo: 'Plenário',
    acordaoKey: 'ACORDAO-COMPLETO-1',
    origemIdentidade: 'tcu-oficial',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEmbeddings.mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] });
});

describe('processTeseEnunciado', () => {
  it('indexa um enunciado elegível e marca completed', async () => {
    mockFindUnique.mockResolvedValue(elegivel);
    const r = await processTeseEnunciado('e1');
    expect(r.success).toBe(true);
    expect(r.stats?.chunkCount).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ embeddingStatus: 'completed' }) }),
    );
  });

  // O gate fino da §6: a contagem de índices declarados contra os persistidos
  // não é expressável em SQL, então é aqui que ela roda. Sem isto entraria no
  // índice tese cuja evidência ninguém consegue conferir.
  it('recusa enunciado com evidência incompleta, sem gastar embedding', async () => {
    mockFindUnique.mockResolvedValue({ ...elegivel, trechosFonte: [0, 1] });
    const r = await processTeseEnunciado('e1');
    expect(r.success).toBe(false);
    expect(mockEmbeddings).not.toHaveBeenCalled();
  });

  it('recusa enunciado reprovado', async () => {
    mockFindUnique.mockResolvedValue({ ...elegivel, veredito: 'imprecisa' });
    const r = await processTeseEnunciado('e1');
    expect(r.success).toBe(false);
    expect(mockEmbeddings).not.toHaveBeenCalled();
  });
});
