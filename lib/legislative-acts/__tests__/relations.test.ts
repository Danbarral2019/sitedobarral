// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique, mockUpsert, mockFindMany, mockDetectHeuristic, mockDetectAI } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
  mockFindMany: vi.fn(),
  mockDetectHeuristic: vi.fn(),
  mockDetectAI: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    legislativeAct: { findUnique: mockFindUnique },
    legislativeActRelation: {
      upsert: mockUpsert,
      findMany: mockFindMany,
    },
  },
}));

vi.mock('../amendment-detector', () => ({
  detectAmendments: (...args: unknown[]) => mockDetectHeuristic(...args),
}));

vi.mock('../amendment-detector-ai', () => ({
  detectAmendmentsAI: (...args: unknown[]) => mockDetectAI(...args),
}));

import { saveDetectedRelations, getRelationsForAct, detectAndSaveRelationsHybrid } from '../relations';

describe('saveDetectedRelations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cria relação quando target existe no DB', async () => {
    mockFindUnique.mockResolvedValue({ id: 'target-id-1' });
    mockUpsert.mockResolvedValue({ id: 'rel-id-1' });

    const result = await saveDetectedRelations('source-id-1', [
      { relationType: 'altera', targetFullNumber: 'Lei 14.133/2021', excerpt: 'altera...', confidence: 0.85 },
    ]);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { fullNumber: 'Lei 14.133/2021' },
      select: { id: true },
    });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { sourceActId_targetActId_relationType: { sourceActId: 'source-id-1', targetActId: 'target-id-1', relationType: 'altera' } },
      create: expect.objectContaining({ sourceActId: 'source-id-1', targetActId: 'target-id-1', relationType: 'altera', source: 'heuristica' }),
      update: expect.objectContaining({ confidence: 0.85, excerpt: 'altera...' }),
    });
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('pula candidato sem target no DB (orphan)', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await saveDetectedRelations('source-id-1', [
      { relationType: 'altera', targetFullNumber: 'Lei 99.999/9999', excerpt: 'x', confidence: 0.85 },
    ]);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.skippedTargets).toContain('Lei 99.999/9999');
  });

  it('NÃO cria self-relation (source == target)', async () => {
    mockFindUnique.mockResolvedValue({ id: 'source-id-1' });

    const result = await saveDetectedRelations('source-id-1', [
      { relationType: 'altera', targetFullNumber: 'Lei 14.133/2021', excerpt: 'x', confidence: 0.85 },
    ]);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('upsert idempotente — segunda execução não duplica', async () => {
    mockFindUnique.mockResolvedValue({ id: 'target-id-1' });
    mockUpsert.mockResolvedValue({ id: 'rel-id-1' });

    await saveDetectedRelations('source-id-1', [
      { relationType: 'altera', targetFullNumber: 'Lei 14.133/2021', excerpt: 'x', confidence: 0.85 },
    ]);
    await saveDetectedRelations('source-id-1', [
      { relationType: 'altera', targetFullNumber: 'Lei 14.133/2021', excerpt: 'y', confidence: 0.85 },
    ]);

    expect(mockUpsert).toHaveBeenCalledTimes(2); // 2 calls, mas Prisma upsert garante 1 row
  });
});

describe('getRelationsForAct', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna alterações que este ato faz e que sofre', async () => {
    mockFindMany
      .mockResolvedValueOnce([
        { id: 'r1', relationType: 'altera', targetAct: { fullNumber: 'Lei 14.133/2021', title: 't' }, excerpt: 'x', confidence: 0.85, reviewStatus: 'confirmed' },
      ])
      .mockResolvedValueOnce([
        { id: 'r2', relationType: 'altera', sourceAct: { fullNumber: 'Decreto 12.926/2026', title: 't' }, excerpt: 'y', confidence: 0.85, reviewStatus: 'pending' },
      ]);

    const result = await getRelationsForAct('act-id-1');

    expect(result.alters).toHaveLength(1);
    expect(result.alters[0].targetAct?.fullNumber).toBe('Lei 14.133/2021');
    expect(result.alteredBy).toHaveLength(1);
    expect(result.alteredBy[0].sourceAct?.fullNumber).toBe('Decreto 12.926/2026');
  });

  it('filtra por reviewStatus se solicitado', async () => {
    mockFindMany.mockResolvedValue([]);

    await getRelationsForAct('act-id-1', { onlyConfirmed: true });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ reviewStatus: 'confirmed' }),
      })
    );
  });
});

describe('detectAndSaveRelationsHybrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({ id: 'target-1' });
    mockUpsert.mockResolvedValue({ id: 'rel-1' });
  });

  it('roda só heurística quando IA está desabilitada (sem env)', async () => {
    delete process.env.DETECT_AMENDMENTS_AI;
    mockDetectHeuristic.mockReturnValue([
      { relationType: 'altera', targetFullNumber: 'Lei 14.133/2021', excerpt: 'x', confidence: 0.85 },
    ]);

    const result = await detectAndSaveRelationsHybrid('source-1', 'ementa', '');

    expect(mockDetectAI).not.toHaveBeenCalled();
    expect(result.heuristicCount).toBe(1);
    expect(result.aiAdded).toBe(0);
    expect(result.created).toBe(1);
  });

  it('NÃO roda IA mesmo habilitada se heurística não achou nada (evita custo)', async () => {
    process.env.DETECT_AMENDMENTS_AI = 'true';
    mockDetectHeuristic.mockReturnValue([]);

    const result = await detectAndSaveRelationsHybrid('source-1', 'ementa sem verbos', '');

    expect(mockDetectAI).not.toHaveBeenCalled();
    expect(result.heuristicCount).toBe(0);
    expect(result.aiAdded).toBe(0);
    expect(result.created).toBe(0);
  });

  it('mescla heurística + IA deduplicando por (type, target)', async () => {
    process.env.DETECT_AMENDMENTS_AI = 'true';
    mockDetectHeuristic.mockReturnValue([
      { relationType: 'altera', targetFullNumber: 'Lei 14.133/2021', excerpt: 'h', confidence: 0.85 },
    ]);
    mockDetectAI.mockResolvedValue([
      // Mesma relação que heurística (dedup): IA tem confidence maior, deve prevalecer
      { relationType: 'altera', targetFullNumber: 'Lei 14.133/2021', excerpt: 'ai-x', confidence: 0.95 },
      // Nova: regulamenta (não estava na heurística — aiAdded)
      { relationType: 'regulamenta', targetFullNumber: 'Lei 14.133/2021', excerpt: 'ai-y', confidence: 0.9 },
    ]);

    const result = await detectAndSaveRelationsHybrid('source-1', 'altera', 'content');

    expect(mockDetectAI).toHaveBeenCalled();
    expect(result.heuristicCount).toBe(1);
    expect(result.aiAdded).toBe(1); // só a regulamenta é nova
    expect(result.created).toBe(2); // total mesclado: 2 únicas
  });
});
