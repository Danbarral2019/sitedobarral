import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { AnswerContext } from '../types';

vi.mock('@/lib/ai', () => ({
  generate: vi.fn(),
  LEGAL_SAFETY_SETTINGS: [],
}));
vi.mock('../answerContext', () => ({
  assembleAnswerContext: vi.fn(),
}));

import { generate } from '@/lib/ai';
import { assembleAnswerContext } from '../answerContext';
import { generateAnswer } from '../answerService';

const baseCtx: AnswerContext = {
  empty: false,
  cached: false,
  totalFound: 3,
  systemInstruction: 'SYS',
  synthesisPrompt: 'PROMPT',
  formattedResults: [],
  legalSources: [],
  allDisplayResults: [],
  maxSimilarity: 0.8,
};

describe('generateAnswer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna answer vazio quando o contexto vem vazio, sem chamar o LLM', async () => {
    vi.mocked(assembleAnswerContext).mockResolvedValue({ ...baseCtx, empty: true });
    const r = await generateAnswer({ query: 'x', filters: {}, maxResults: 5, useCache: false });
    expect(r.answer).toBe('');
    expect(r.context.empty).toBe(true);
    expect(generate).not.toHaveBeenCalled();
  });

  it('chama generate com o prompt/sistema do contexto e retorna o texto', async () => {
    vi.mocked(assembleAnswerContext).mockResolvedValue(baseCtx);
    vi.mocked(generate).mockResolvedValue({ text: 'RESPOSTA', provider: 'anthropic', modelId: 'claude-sonnet-5' });

    const r = await generateAnswer(
      { query: 'x', filters: {}, maxResults: 5, useCache: false },
      { provider: 'anthropic', model: 'claude-sonnet-5' },
    );

    expect(r.answer).toBe('RESPOSTA');
    expect(generate).toHaveBeenCalledWith(
      'chat',
      expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        systemPrompt: 'SYS',
        messages: [{ role: 'user', content: 'PROMPT' }],
        thinkingBudget: 0,
      }),
    );
  });
});
