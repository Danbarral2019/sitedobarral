import { describe, it, expect, vi } from 'vitest';
import {
  classifyEditorialBatch,
  EDITORIAL_PROMPT_VERSION,
} from '../dou-editorial-classifier';

describe('classifyEditorialBatch', () => {
  it('retorna o array de classificações na ordem dos candidatos', async () => {
    const fakeGenAI = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
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
        }),
      },
    };

    const result = await classifyEditorialBatch(
      [
        { title: 'IN SEGES nº 8/2026', abstract: 'pesquisa de preços', hierarchyStr: 'MGI/SEGES' },
        { title: 'IN IBAMA nº 5/2026', abstract: 'licenciamento', hierarchyStr: 'MMA/IBAMA' },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { genAI: fakeGenAI as any },
    );

    expect(result.classifications).toHaveLength(2);
    expect(result.classifications[0].score).toBe(90);
    expect(result.classifications[0].actType).toBe('in');
    expect(result.classifications[1].score).toBe(15);
    expect(result.promptVersion).toBe(EDITORIAL_PROMPT_VERSION);
  });

  it('retorna [] quando candidates é vazio sem chamar Gemini', async () => {
    const fakeGenAI = { models: { generateContent: vi.fn() } };
    const result = await classifyEditorialBatch(
      [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { genAI: fakeGenAI as any },
    );
    expect(result.classifications).toEqual([]);
    expect(fakeGenAI.models.generateContent).not.toHaveBeenCalled();
  });

  it('clampa score fora do range [0,100]', async () => {
    const fakeGenAI = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            items: [
              { score: 150, reason: '', summary: '', affects: [], actType: 'null', ambiguous: false },
              { score: -10, reason: '', summary: '', affects: [], actType: 'null', ambiguous: false },
            ],
          }),
        }),
      },
    };
    const result = await classifyEditorialBatch(
      [
        { title: 'a', abstract: '', hierarchyStr: '' },
        { title: 'b', abstract: '', hierarchyStr: '' },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { genAI: fakeGenAI as any },
    );
    expect(result.classifications[0].score).toBe(100);
    expect(result.classifications[1].score).toBe(0);
  });

  it('lança erro se IA retornar quantidade diferente de items', async () => {
    const fakeGenAI = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({ items: [{ score: 80, reason: '', summary: '', affects: [], actType: 'null', ambiguous: false }] }),
        }),
      },
    };
    await expect(
      classifyEditorialBatch(
        [
          { title: 'a', abstract: '', hierarchyStr: '' },
          { title: 'b', abstract: '', hierarchyStr: '' },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { genAI: fakeGenAI as any },
      ),
    ).rejects.toThrow(/1 items mas foram enviados 2/);
  });

  it('normaliza actType inválido pra null', async () => {
    const fakeGenAI = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            items: [{ score: 80, reason: '', summary: '', affects: [], actType: 'resolução', ambiguous: false }],
          }),
        }),
      },
    };
    const result = await classifyEditorialBatch(
      [{ title: 'a', abstract: '', hierarchyStr: '' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { genAI: fakeGenAI as any },
    );
    expect(result.classifications[0].actType).toBeNull();
  });
});
