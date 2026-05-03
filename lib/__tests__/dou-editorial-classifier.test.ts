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
});
