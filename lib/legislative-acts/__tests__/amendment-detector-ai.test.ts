// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerate };
  },
}));

import { detectAmendmentsAI } from '../amendment-detector-ai';

describe('detectAmendmentsAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('extrai relações do JSON retornado pelo Gemini', async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        relations: [
          { type: 'revoga', target: 'Lei 8.666/1993', excerpt: 'Revoga a Lei 8.666/93', confidence: 0.95 },
          { type: 'regulamenta', target: 'Lei 14.133/2021', excerpt: 'regulamenta o art. 12', confidence: 0.9 },
        ],
      }),
    });

    const result = await detectAmendmentsAI('Revoga a Lei 8.666/93 e regulamenta o art. 12 da Lei 14.133/2021.', '');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      relationType: 'revoga',
      targetFullNumber: 'Lei 8.666/1993',
      excerpt: 'Revoga a Lei 8.666/93',
      confidence: 0.95,
    });
  });

  it('filtra tipos inválidos no JSON do Gemini', async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        relations: [
          { type: 'revoga', target: 'Lei 1/2020', excerpt: 'x', confidence: 0.9 },
          { type: 'inventado', target: 'Lei 2/2020', excerpt: 'y', confidence: 0.9 },
        ],
      }),
    });

    const result = await detectAmendmentsAI('texto', '');
    expect(result).toHaveLength(1);
    expect(result[0].relationType).toBe('revoga');
  });

  it('retorna [] se Gemini retornar JSON inválido', async () => {
    mockGenerate.mockResolvedValue({ text: 'não é JSON' });
    const result = await detectAmendmentsAI('texto', '');
    expect(result).toEqual([]);
  });

  it('retorna [] em erro de API', async () => {
    mockGenerate.mockRejectedValue(new Error('rate limit'));
    const result = await detectAmendmentsAI('texto', '');
    expect(result).toEqual([]);
  });

  it('retorna [] sem GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await detectAmendmentsAI('texto', '');
    expect(result).toEqual([]);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
