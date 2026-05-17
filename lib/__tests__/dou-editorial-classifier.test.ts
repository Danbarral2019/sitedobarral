import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));

vi.mock('@/lib/ai', () => ({
  generate: mockGenerate,
}));

import {
  classifyEditorialBatch,
  EDITORIAL_PROMPT_VERSION,
} from '../dou-editorial-classifier';

describe('classifyEditorialBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna o array de classificações na ordem dos candidatos', async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        items: [
          {
            score: 90,
            reason: 'Regulamenta art. 23 da Lei 14.133.',
            summary: 'IN SEGES atualiza pesquisa de preços.',
            affects: ['Lei 14.133', 'PCA'],
            actType: 'in',
            ambiguous: false,
          },
          {
            score: 15,
            reason: 'Atividade-fim do IBAMA.',
            summary: 'Procedimentos de licenciamento ambiental.',
            affects: [],
            actType: 'in',
            ambiguous: false,
          },
        ],
      }),
    });

    const result = await classifyEditorialBatch([
      { title: 'IN SEGES nº 8/2026', abstract: 'pesquisa de preços', hierarchyStr: 'MGI/SEGES' },
      { title: 'IN IBAMA nº 5/2026', abstract: 'licenciamento', hierarchyStr: 'MMA/IBAMA' },
    ]);

    expect(result.classifications).toHaveLength(2);
    expect(result.classifications[0].score).toBe(90);
    expect(result.classifications[0].actType).toBe('in');
    expect(result.classifications[1].score).toBe(15);
    expect(result.promptVersion).toBe(EDITORIAL_PROMPT_VERSION);
  });

  it('retorna [] quando candidates é vazio sem chamar generate', async () => {
    const result = await classifyEditorialBatch([]);
    expect(result.classifications).toEqual([]);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('clampa score fora do range [0,100]', async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        items: [
          { score: 150, reason: '', summary: '', affects: [], actType: 'null', ambiguous: false },
          { score: -10, reason: '', summary: '', affects: [], actType: 'null', ambiguous: false },
        ],
      }),
    });
    const result = await classifyEditorialBatch([
      { title: 'a', abstract: '', hierarchyStr: '' },
      { title: 'b', abstract: '', hierarchyStr: '' },
    ]);
    expect(result.classifications[0].score).toBe(100);
    expect(result.classifications[1].score).toBe(0);
  });

  it('lança erro se IA retornar quantidade diferente de items', async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ items: [{ score: 80, reason: '', summary: '', affects: [], actType: 'null', ambiguous: false }] }),
    });
    await expect(
      classifyEditorialBatch([
        { title: 'a', abstract: '', hierarchyStr: '' },
        { title: 'b', abstract: '', hierarchyStr: '' },
      ]),
    ).rejects.toThrow(/1 items mas foram enviados 2/);
  });

  it('normaliza actType inválido pra null', async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        items: [{ score: 80, reason: '', summary: '', affects: [], actType: 'resolução', ambiguous: false }],
      }),
    });
    const result = await classifyEditorialBatch([{ title: 'a', abstract: '', hierarchyStr: '' }]);
    expect(result.classifications[0].actType).toBeNull();
  });

  it('passa provider=gemini + systemPrompt + responseSchema + model ao lib/ai', async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ items: [{ score: 80, reason: '', summary: '', affects: [], actType: 'null', ambiguous: false }] }),
    });
    await classifyEditorialBatch(
      [{ title: 'a', abstract: '', hierarchyStr: '' }],
      { model: 'gemini-2.5-pro' },
    );
    expect(mockGenerate).toHaveBeenCalledWith(
      'classification',
      expect.objectContaining({
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        temperature: 0,
        thinkingBudget: 0,
      }),
    );
    // Confirma que systemPrompt + responseSchema foram passados
    const args = mockGenerate.mock.calls[0][1];
    expect(args.systemPrompt).toContain('jurista especializado em Lei 14.133/2021');
    expect(args.responseSchema).toMatchObject({ type: 'OBJECT', required: ['items'] });
  });
});
