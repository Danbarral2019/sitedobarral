# Fase 1 — Régua de avaliação da IA + extração `lib/rag/`

Parte do `docs/PLANO_RETOMADA_2026-07.md`. Objetivo duplo:
1. **Régua de síntese** (LLM-as-judge) para medir a qualidade das respostas — hoje só medimos retrieval.
2. **Extrair a geração da rota** `app/api/documents/query/route.ts` (1.220 linhas) para `lib/rag/`,
   chamável pela rota (produção) **e** pelo eval (baseline fiel). Também quita a dívida "fatiar route" da Fase 2.

## Costura de extração (o que sai da rota, o que fica)

**Fica na rota (HTTP):** auth (1), rate-limit (2), parse body (3), validação (4), resposta SSE
streaming (13), resposta JSON (14), error handling. **A chamada ao LLM fica na rota** (mantém o
streaming intacto).

**Sai para `lib/rag/` (montagem determinística de resposta — etapas 4b→12b):** enriquecimento de
query, expansão, detecção de domínio (~110 regexes), hybrid search + early-return sem resultados,
retrieval complementar, separação por tipo, artigos citados + seleção semântica (5B), atos
relacionados, contexto em camadas, histórico, fontes legais, prompt (systemInstruction +
synthesisPrompt), formattedResults. Helpers puros: `diversifyResults`, `generateExcerpt`, `hashQueryStr`.

## Interface alvo

```ts
// lib/rag/assembleAnswerContext.ts
interface AssembleAnswerInput {
  query: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
  ticMode?: boolean;
  scopeChips?: string[];        // 'tst-only' | 'no-tst' etc.
  maxResults: number;           // default 5
  expansionEnabled?: boolean;
}
interface AnswerContext {
  empty: boolean;               // early-return: sem resultados
  systemInstruction: string;
  synthesisPrompt: string;
  formattedResults: DocumentResult[];
  legalSources: LegalSource[];
  lowCoverage: boolean;
  telemetry: { maxSimilarity: number; docCount: number; contextChars: number; /* ... */ };
}
async function assembleAnswerContext(input: AssembleAnswerInput): Promise<AnswerContext>

// lib/rag/answerService.ts — usado pelo eval (e opcionalmente pelo caminho non-streaming da rota)
async function generateAnswer(
  input: AssembleAnswerInput,
  opts?: { provider?: 'gemini' | 'anthropic'; model?: string },
): Promise<{ answer: string; context: AnswerContext }>
```

## Passos incrementais (cada um: tsc verde + suíte verde + commit)

1. **Helpers puros** → `lib/rag/util.ts` (`diversifyResults`, `generateExcerpt`, `hashQueryStr`).
   Rota reimporta. Risco ~zero. + testes de unidade dos helpers.
2. **Detecção de domínio** (etapa 5a, as regexes) → `lib/rag/domain-detection.ts` com testes de unidade
   (casos trabalhistas/TCE que hoje vivem só na rota). Testável isoladamente.
3. **`assembleAnswerContext`** (4b→12b) → `lib/rag/assembleAnswerContext.ts`; rota passa a chamá-la.
   Mover **linha-a-linha**, não reescrever. Verificar suíte + smoke manual (1 pergunta real).
   Tipos `DocumentResult`/`QueryResponse` movidos p/ `lib/rag/types.ts` (hoje inline na rota).
4. **`answerService.generateAnswer`** (non-streaming) = assemble + `generate('chat', ...)` com modelo configurável.
5. **Régua de síntese:** `eval/judge.ts` (LLM-as-judge Claude: faithfulness, correção de citações,
   completude 0–1 + justificativa), `eval/synthesis-runner.ts`, `eval/answer-adapter.ts` (usa
   `generateAnswer`), CLI `eval/cli/run-synthesis.ts` + script `eval:synthesis`. Reusa golden-set.json.
6. **Baseline:** rodar sobre as ~53 queries anotadas (+ importar queries 👎 do SearchHistory numa 2ª volta)
   com Gemini atual → congelar números num report versionado em `eval/reports/`.

## Estratégia de teste / preservação de comportamento

- Rede de segurança atual é fina (só `app/api/documents/query/__tests__/quota-exhausted.test.ts`).
- Mitigação: mover código **verbatim**; `npx tsc --noEmit` e `npm run test:run` verdes a cada passo;
  testes de unidade novos para `util`, `domain-detection`, `assembleAnswerContext` (com `hybridSearch` mockado).
- Smoke manual do passo 3: comparar a resposta de 1–2 perguntas reais antes/depois (mesmo texto).
- Juiz: começar por **faithfulness + correção de citações** (não precisam de resposta-referência — julgam
  resposta × contexto). **Completude** precisa de rubrica por query = trabalho pessoal do Daniel, plugado depois.

## Notas
- Query expansion (5) e seleção semântica de artigos (5B) chamam Gemini → `assembleAnswerContext` não é
  puro; mockar nos testes de unidade. O eval reflete o custo real (bom).
- Ao mergear PR #129 (Fase 0), rebase desta branch. Trabalho desta fase em branch própria off `fase-0-hardening`.
```
