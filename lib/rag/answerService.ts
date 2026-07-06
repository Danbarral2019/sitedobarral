/**
 * Serviço de geração de resposta do assistente (non-streaming), montado sobre
 * `assembleAnswerContext` + a porta única de LLM `lib/ai`. Fase 1, passo 4
 * (`docs/PLANO_FASE1_ANSWERSERVICE.md`).
 *
 * Espelha os parâmetros de geração da rota de produção (temperature 0.5,
 * maxTokens 8192, thinkingBudget 0, safety jurídico), mas com provider/modelo
 * CONFIGURÁVEIS — o que permite o harness de avaliação comparar Gemini × Claude
 * sobre exatamente o mesmo contexto (base para a Fase 3).
 */
import { generate, LEGAL_SAFETY_SETTINGS } from '@/lib/ai';
import type { AiProviderName } from '@/lib/ai/types';
import { assembleAnswerContext } from './answerContext';
import type { AssembleAnswerInput, AnswerContext } from './types';

export interface GenerateAnswerOptions {
  /** Override de provider (default: resolvido pela task 'chat' em lib/ai). */
  provider?: AiProviderName;
  /** Override de modelo (default: resolvido pela task 'chat'). */
  model?: string;
  /** Cascata de fallback (404/deprecado/quota). */
  fallbackModels?: string[];
}

export interface GenerateAnswerResult {
  answer: string;
  context: AnswerContext;
}

/**
 * Executa a pipeline completa: monta o contexto e sintetiza a resposta.
 * Retorna `answer: ''` quando o contexto vem vazio (sem resultados de busca).
 */
export async function generateAnswer(
  input: AssembleAnswerInput,
  opts: GenerateAnswerOptions = {},
): Promise<GenerateAnswerResult> {
  const context = await assembleAnswerContext(input);
  if (context.empty) {
    return { answer: '', context };
  }

  const { text } = await generate('chat', {
    provider: opts.provider,
    model: opts.model,
    fallbackModels: opts.fallbackModels,
    systemPrompt: context.systemInstruction,
    messages: [{ role: 'user', content: context.synthesisPrompt }],
    // Sonnet 5 / Opus 4.x DEPRECARAM `temperature` (rejeitam a requisição).
    // Só passamos temperature no caminho Gemini; o Claude usa seu default.
    temperature: opts.provider === 'anthropic' ? undefined : 0.5,
    maxTokens: 8192,
    // Gemini 2.5/3 trunca sem thinkingBudget=0; ignorado pelo Anthropic.
    thinkingBudget: 0,
    safetySettings: LEGAL_SAFETY_SETTINGS,
  });

  return { answer: text, context };
}
