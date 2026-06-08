# Backup Gemini API key + erro amigável de quota — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar fallback automático entre `GEMINI_API_KEY` (primária) e `GEMINI_API_KEY_BACKUP` (opcional) em todas as chamadas Gemini, e devolver HTTP 503 (em vez de 500) com `code: 'QUOTA_EXHAUSTED'` quando ambas esgotam.

**Architecture:** Helper compartilhado `withGeminiKeyFallback` envolve as 2 lazy-init Gemini do projeto (provider em `lib/ai/providers/gemini.ts` e embeddings em `lib/embeddings/gemini-embeddings.ts`). `/api/documents/query` detecta `isRateLimitError` no catch externo (non-stream) e no catch do `ReadableStream` (SSE) e responde com 503/evento amigável. Frontend hook `use-global-search.ts` ganha branches paralelos ao 429 existente.

**Tech Stack:** Next.js 15 App Router · TypeScript · Vitest 4 · `@google/genai` SDK · pino logger

**Spec:** `docs/superpowers/specs/2026-06-08-gemini-backup-key-quota-friendly-design.md`

---

## File structure

**Novos:**
- `lib/gemini/api-key-fallback.ts` — função `withGeminiKeyFallback<T>(fn)` (responsabilidade única: aplicar cascade entre 2 keys quando 1ª retorna quota error)
- `lib/gemini/__tests__/api-key-fallback.test.ts` — 4 testes do wrapper
- `app/api/documents/query/__tests__/quota-exhausted.test.ts` — 2 testes do endpoint (non-stream 503, stream emite evento error)

**Modificados:**
- `lib/ai/providers/gemini.ts` — remove `getClient()` cacheado, `generate`/`generateStream` instanciam cliente via wrapper
- `lib/embeddings/gemini-embeddings.ts` — remove `getGenAI()` cacheado, `generateEmbedding`/`generateBatchEmbeddings` usam wrapper
- `app/api/documents/query/route.ts` — adiciona `code?` em `QueryResponse`, branches `isRateLimitError` no outer catch e no SSE catch
- `hooks/use-global-search.ts` — branch para 503 + detecção de evento de erro no SSE
- `.env.example` — documenta `GEMINI_API_KEY` e `GEMINI_API_KEY_BACKUP`
- `CLAUDE.md` — adiciona `GEMINI_API_KEY_BACKUP` em Environment Variables (opcional)

---

### Task 1: Helper `withGeminiKeyFallback` + testes (TDD)

**Files:**
- Create: `lib/gemini/api-key-fallback.ts`
- Test: `lib/gemini/__tests__/api-key-fallback.test.ts`

- [ ] **Step 1: Escrever testes que falham**

Conteúdo do `lib/gemini/__tests__/api-key-fallback.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  authLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  dbLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { withGeminiKeyFallback } from '../api-key-fallback';
import { apiLogger } from '@/lib/logger';

describe('withGeminiKeyFallback', () => {
  const origPrimary = process.env.GEMINI_API_KEY;
  const origBackup = process.env.GEMINI_API_KEY_BACKUP;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (origPrimary !== undefined) process.env.GEMINI_API_KEY = origPrimary;
    else delete process.env.GEMINI_API_KEY;
    if (origBackup !== undefined) process.env.GEMINI_API_KEY_BACKUP = origBackup;
    else delete process.env.GEMINI_API_KEY_BACKUP;
  });

  it('throws com mensagem clara quando nenhuma key está configurada', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_BACKUP;
    const fn = vi.fn();

    await expect(withGeminiKeyFallback(fn)).rejects.toThrow('GEMINI_API_KEY not configured');
    expect(fn).not.toHaveBeenCalled();
  });

  it('invoca fn uma vez com primary quando primary retorna OK', async () => {
    process.env.GEMINI_API_KEY = 'primary-key';
    process.env.GEMINI_API_KEY_BACKUP = 'backup-key';
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await withGeminiKeyFallback(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('primary-key');
  });

  it('cai pra backup quando primary lança erro 429 RESOURCE_EXHAUSTED', async () => {
    process.env.GEMINI_API_KEY = 'primary-key';
    process.env.GEMINI_API_KEY_BACKUP = 'backup-key';
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED quota exceeded'))
      .mockResolvedValueOnce('ok-from-backup');

    const result = await withGeminiKeyFallback(fn);

    expect(result).toBe('ok-from-backup');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'primary-key');
    expect(fn).toHaveBeenNthCalledWith(2, 'backup-key');
    expect(apiLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ keyIndex: 0, nextIndex: 1 }),
      expect.stringContaining('quota-exhausted'),
    );
  });

  it('lança o erro do backup quando ambas keys retornam 429', async () => {
    process.env.GEMINI_API_KEY = 'primary-key';
    process.env.GEMINI_API_KEY_BACKUP = 'backup-key';
    const primaryErr = new Error('429 primary quota exceeded');
    const backupErr = new Error('429 backup quota exceeded');
    const fn = vi.fn().mockRejectedValueOnce(primaryErr).mockRejectedValueOnce(backupErr);

    await expect(withGeminiKeyFallback(fn)).rejects.toBe(backupErr);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propaga erro não-quota direto sem tentar backup', async () => {
    process.env.GEMINI_API_KEY = 'primary-key';
    process.env.GEMINI_API_KEY_BACKUP = 'backup-key';
    const authErr = new Error('401 invalid api key');
    const fn = vi.fn().mockRejectedValue(authErr);

    await expect(withGeminiKeyFallback(fn)).rejects.toBe(authErr);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run lib/gemini/__tests__/api-key-fallback.test.ts`
Expected: FAIL — "Cannot find module '../api-key-fallback'" (ou similar)

- [ ] **Step 3: Implementar `lib/gemini/api-key-fallback.ts`**

Conteúdo:

```ts
/**
 * Wrapper de fallback entre GEMINI_API_KEY (primária) e GEMINI_API_KEY_BACKUP
 * (secundária, opcional). Quando a primária retorna erro de quota (429 /
 * RESOURCE_EXHAUSTED), tenta automaticamente a backup. Outros erros (auth,
 * network, safety) propagam direto sem cascade.
 *
 * Se apenas uma key estiver configurada, comportamento é idêntico ao atual
 * (1 tentativa só). Se nenhuma estiver configurada, lança erro claro.
 *
 * Uso:
 *   const client = await withGeminiKeyFallback(async (apiKey) => {
 *     const sdk = new GoogleGenAI({ apiKey });
 *     return sdk.models.generateContent({ ... });
 *   });
 */

import { isRateLimitError } from '@/lib/ai/error-detection';
import { apiLogger } from '@/lib/logger';

export async function withGeminiKeyFallback<T>(
  fn: (apiKey: string) => Promise<T>,
): Promise<T> {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_BACKUP,
  ].filter((k): k is string => typeof k === 'string' && k.length > 0);

  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  let lastErr: unknown;
  for (let i = 0; i < keys.length; i++) {
    try {
      return await fn(keys[i]);
    } catch (err) {
      lastErr = err;
      const isLast = i === keys.length - 1;
      if (isLast || !isRateLimitError(err)) throw err;
      apiLogger.warn(
        { keyIndex: i, nextIndex: i + 1 },
        'gemini.key.quota-exhausted, trying backup',
      );
    }
  }
  throw lastErr;
}
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run lib/gemini/__tests__/api-key-fallback.test.ts`
Expected: PASS — 5 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add lib/gemini/api-key-fallback.ts lib/gemini/__tests__/api-key-fallback.test.ts
GIT_COMMITTER_EMAIL="danbarral@gmail.com" GIT_COMMITTER_NAME="Daniel Barral" \
  git commit --author="Daniel Barral <danbarral@gmail.com>" -m "$(cat <<'EOF'
feat(gemini): wrapper de fallback entre GEMINI_API_KEY e GEMINI_API_KEY_BACKUP

Helper compartilhado withGeminiKeyFallback() tenta primária →
(se 429/RESOURCE_EXHAUSTED) tenta backup → propaga último erro.
Outros erros (auth, network, safety) propagam sem cascade.

Sem backup configurada, comportamento idêntico ao atual (1 tentativa).
Log estruturado quando produção passa a depender do backup.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Refatorar `lib/ai/providers/gemini.ts` para usar o wrapper

**Files:**
- Modify: `lib/ai/providers/gemini.ts`

Sem novos testes — `lib/ai/__tests__/generate.test.ts` e `generate-stream.test.ts` mockam o provider inteiro, então o refactor interno do provider não quebra esses testes. Verificação é rodar a suite existente.

- [ ] **Step 1: Substituir conteúdo de `lib/ai/providers/gemini.ts`**

Substituir o arquivo todo por:

```ts
/**
 * Provider Gemini via @google/genai SDK.
 *
 * Suporta generate() + generateStream() com features completas:
 *   - systemInstruction (via req.systemPrompt)
 *   - jsonMode / responseSchema (structured output)
 *   - thinkingBudget (Gemini 2.5+)
 *   - safetySettings (preset LEGAL_SAFETY_SETTINGS em lib/ai/safety)
 *   - streaming via models.generateContentStream
 *
 * Cliente instanciado por chamada (sem cache em memória) para suportar
 * fallback entre GEMINI_API_KEY e GEMINI_API_KEY_BACKUP via
 * withGeminiKeyFallback. Custo de instanciar GoogleGenAI é desprezível
 * (SDK só abre conexão na primeira chamada de método).
 *
 * Streaming + fallback: cascade entre keys só ocorre na INICIAÇÃO do stream
 * (antes do primeiro chunk). Erro mid-stream propaga sem trocar de key
 * porque tokens já foram entregues ao cliente.
 */

import { GoogleGenAI } from '@google/genai'
import { withGeminiKeyFallback } from '@/lib/gemini/api-key-fallback'
import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AiProvider,
  AiStreamChunk,
} from '../types'

function mapContents(req: AiGenerateRequest) {
  return req.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
}

function buildConfig(req: AiGenerateRequest): Record<string, unknown> {
  // responseSchema implica JSON output mesmo sem jsonMode explicito — alinha
  // com o comportamento padrao da SDK @google/genai.
  const wantsJson = req.jsonMode || req.responseSchema !== undefined
  const config: Record<string, unknown> = {
    temperature: req.temperature ?? 0.3,
    maxOutputTokens: req.maxTokens ?? 4096,
  }
  if (req.systemPrompt) {
    config.systemInstruction = req.systemPrompt
  }
  if (wantsJson) {
    config.responseMimeType = 'application/json'
  }
  if (req.responseSchema !== undefined) {
    config.responseSchema = req.responseSchema
  }
  if (req.thinkingBudget !== undefined) {
    config.thinkingConfig = { thinkingBudget: req.thinkingBudget }
  }
  if (req.safetySettings && req.safetySettings.length > 0) {
    config.safetySettings = req.safetySettings
  }
  return config
}

export const geminiProvider: AiProvider = {
  name: 'gemini',

  async generate(modelId: string, req: AiGenerateRequest): Promise<AiGenerateResponse> {
    return withGeminiKeyFallback(async (apiKey) => {
      const client = new GoogleGenAI({ apiKey })
      const result = await client.models.generateContent({
        model: modelId,
        contents: mapContents(req),
        config: buildConfig(req),
      })

      // Checks que cached-client legacy fazia — promovidos pra dentro do provider
      // pra detectar problemas semanticos (RECITATION, SAFETY) em vez de
      // retornar string vazia silenciosamente.
      const blockReason = result.promptFeedback?.blockReason
      if (blockReason) {
        throw new Error(`Gemini blocked prompt: ${blockReason}`)
      }
      const finishReason = result.candidates?.[0]?.finishReason
      if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
        throw new Error(`Gemini finished with reason: ${finishReason}`)
      }

      return {
        text: result.text ?? '',
        inputTokens: result.usageMetadata?.promptTokenCount,
        outputTokens: result.usageMetadata?.candidatesTokenCount,
        provider: 'gemini',
        modelId,
      }
    })
  },

  async generateStream(
    modelId: string,
    req: AiGenerateRequest,
  ): Promise<AsyncIterable<AiStreamChunk>> {
    return withGeminiKeyFallback(async (apiKey) => {
      const client = new GoogleGenAI({ apiKey })
      const stream = await client.models.generateContentStream({
        model: modelId,
        contents: mapContents(req),
        config: buildConfig(req),
      })

      // Wrap em async generator para mapear chunks SDK -> AiStreamChunk.
      // finishReason + usage saem do ultimo chunk (SDK acumula metadata ali).
      return (async function* (): AsyncGenerator<AiStreamChunk> {
        type GenAIChunk = {
          text?: string
          candidates?: Array<{ finishReason?: string }>
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
        }
        let lastChunk: GenAIChunk | undefined
        for await (const chunk of stream as AsyncIterable<GenAIChunk>) {
          lastChunk = chunk
          const text = chunk.text
          if (text) {
            yield { text, provider: 'gemini', modelId }
          }
        }
        // Chunk terminal — emite finishReason + usage se disponiveis.
        const finishReason = lastChunk?.candidates?.[0]?.finishReason
        const usage = lastChunk?.usageMetadata
        yield {
          finishReason,
          usage: usage
            ? {
                inputTokens: usage.promptTokenCount,
                outputTokens: usage.candidatesTokenCount,
              }
            : undefined,
          provider: 'gemini',
          modelId,
        }
      })()
    })
  },
}
```

- [ ] **Step 2: Rodar testes do `lib/ai`**

Run: `npx vitest run lib/ai/__tests__/`
Expected: PASS — todos os testes existentes verdes (mocks abstraem o provider inteiro, então o refactor interno não os afeta).

- [ ] **Step 3: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: PASS sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/providers/gemini.ts
GIT_COMMITTER_EMAIL="danbarral@gmail.com" GIT_COMMITTER_NAME="Daniel Barral" \
  git commit --author="Daniel Barral <danbarral@gmail.com>" -m "$(cat <<'EOF'
refactor(ai): gemini provider usa withGeminiKeyFallback

Remove o client cacheado por process e instancia GoogleGenAI por
chamada via withGeminiKeyFallback. Custo desprezível (SDK só abre
conexão na primeira chamada de método).

generate() e generateStream() agora tentam GEMINI_API_KEY → (se 429)
GEMINI_API_KEY_BACKUP automaticamente. Cascade só na iniciação do
stream — erro mid-stream propaga sem trocar de key.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Refatorar `lib/embeddings/gemini-embeddings.ts` para usar o wrapper

**Files:**
- Modify: `lib/embeddings/gemini-embeddings.ts`

Sem novos testes — testes existentes em `lib/embeddings/__tests__/` mockam `@google/genai` no módulo level e não dependem de `getGenAI`.

- [ ] **Step 1: Editar `lib/embeddings/gemini-embeddings.ts`**

Trocar as linhas 17–32 (configuração + `getGenAI`):

Antes:
```ts
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-2-preview';
const EMBEDDING_DIMENSION = 768; // Nosso banco usa vector(768); Matryoshka truncation

// Lazy-loaded client
let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return genAI;
}
```

Depois:
```ts
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-2-preview';
const EMBEDDING_DIMENSION = 768; // Nosso banco usa vector(768); Matryoshka truncation

// Cliente instanciado por chamada via withGeminiKeyFallback (sem cache em
// memória) para suportar fallback entre GEMINI_API_KEY e GEMINI_API_KEY_BACKUP.
// Custo desprezível: SDK só abre conexão na primeira chamada de método.
```

E adicionar o import perto da linha 11:

```ts
import { GoogleGenAI } from '@google/genai';
import { withGeminiKeyFallback } from '@/lib/gemini/api-key-fallback';
```

- [ ] **Step 2: Wrapper em `generateEmbedding`**

Substituir o corpo de `generateEmbedding` (linhas 61-86):

Antes:
```ts
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const ai = getGenAI();

  const result = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      outputDimensionality: EMBEDDING_DIMENSION,
    },
  });

  const embedding = result.embeddings?.[0]?.values;
  if (!embedding) {
    throw new Error('No embedding returned from Gemini API');
  }

  return {
    embedding,
    model: EMBEDDING_MODEL,
    dimension: EMBEDDING_DIMENSION,
  };
}
```

Depois:
```ts
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  return withGeminiKeyFallback(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });

    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: {
        outputDimensionality: EMBEDDING_DIMENSION,
      },
    });

    const embedding = result.embeddings?.[0]?.values;
    if (!embedding) {
      throw new Error('No embedding returned from Gemini API');
    }

    return {
      embedding,
      model: EMBEDDING_MODEL,
      dimension: EMBEDDING_DIMENSION,
    };
  });
}
```

- [ ] **Step 3: Wrapper em `generateBatchEmbeddings`**

Substituir o corpo após a validação de entrada (linhas 115-151):

Antes:
```ts
  const ai = getGenAI();

  // Gemini API limita BatchEmbedContentsRequest a 100 requests por call (limite hard,
  // independente do tier). Tentativa de 250 falhava com 400 INVALID_ARGUMENT em
  // atos grandes (Portaria SGD/MGI 1.070/2023 e 5.950/2023, ~200 chunks cada).
  // Fix descoberto em 2026-04-25 quando rodando index-legislative-acts.
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
    const batch = validTexts.slice(i, i + BATCH_SIZE);

    // embedContent com contents como array retorna multiple embeddings
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch.map(text => ({ role: 'user' as const, parts: [{ text }] })),
      config: {
        outputDimensionality: EMBEDDING_DIMENSION,
      },
    });

    if (!result.embeddings || result.embeddings.length !== batch.length) {
      throw new Error(`Expected ${batch.length} embeddings, got ${result.embeddings?.length ?? 0}`);
    }

    for (const emb of result.embeddings) {
      if (!emb.values) {
        throw new Error('No embedding values returned from Gemini API in batch');
      }
      allEmbeddings.push(emb.values);
    }

    // Small delay between batches to avoid rate limiting (tier pago, ROADMAP_GEMINI_PAGO.md Fase 4)
    if (i + BATCH_SIZE < validTexts.length) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
```

Depois (envolver o loop em `withGeminiKeyFallback`):
```ts
  // Gemini API limita BatchEmbedContentsRequest a 100 requests por call (limite hard,
  // independente do tier). Tentativa de 250 falhava com 400 INVALID_ARGUMENT em
  // atos grandes (Portaria SGD/MGI 1.070/2023 e 5.950/2023, ~200 chunks cada).
  // Fix descoberto em 2026-04-25 quando rodando index-legislative-acts.
  const BATCH_SIZE = 100;

  const allEmbeddings = await withGeminiKeyFallback(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });
    const result: number[][] = [];

    for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
      const batch = validTexts.slice(i, i + BATCH_SIZE);

      // embedContent com contents como array retorna multiple embeddings
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: batch.map(text => ({ role: 'user' as const, parts: [{ text }] })),
        config: {
          outputDimensionality: EMBEDDING_DIMENSION,
        },
      });

      if (!response.embeddings || response.embeddings.length !== batch.length) {
        throw new Error(`Expected ${batch.length} embeddings, got ${response.embeddings?.length ?? 0}`);
      }

      for (const emb of response.embeddings) {
        if (!emb.values) {
          throw new Error('No embedding values returned from Gemini API in batch');
        }
        result.push(emb.values);
      }

      // Small delay between batches to avoid rate limiting (tier pago, ROADMAP_GEMINI_PAGO.md Fase 4)
      if (i + BATCH_SIZE < validTexts.length) {
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }

    return result;
  });
```

Nota: se o primeiro batch já entrou no loop e falhar com 429 mid-loop, o wrapper inteiro reinicia do começo na backup. Isso é aceitável — esses batches são offline (scripts de indexação), reset de embeddings é seguro.

- [ ] **Step 4: Rodar testes de embeddings**

Run: `npx vitest run lib/embeddings/__tests__/`
Expected: PASS — testes existentes verdes (mocks abstraem `GoogleGenAI`).

- [ ] **Step 5: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: PASS sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add lib/embeddings/gemini-embeddings.ts
GIT_COMMITTER_EMAIL="danbarral@gmail.com" GIT_COMMITTER_NAME="Daniel Barral" \
  git commit --author="Daniel Barral <danbarral@gmail.com>" -m "$(cat <<'EOF'
refactor(embeddings): gemini-embeddings usa withGeminiKeyFallback

Remove o client cacheado por process. generateEmbedding e
generateBatchEmbeddings instanciam GoogleGenAI por chamada via
withGeminiKeyFallback — tentam GEMINI_API_KEY → (se 429)
GEMINI_API_KEY_BACKUP automaticamente.

Batch reseta do começo na backup se 429 ocorre mid-loop. Aceitável
porque batches são scripts offline de indexação, idempotentes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 503 amigável no `/api/documents/query` + testes (TDD)

**Files:**
- Modify: `app/api/documents/query/route.ts`
- Test: `app/api/documents/query/__tests__/quota-exhausted.test.ts`

- [ ] **Step 1: Escrever testes que falham**

Conteúdo do `app/api/documents/query/__tests__/quota-exhausted.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyAuth,
  mockCheckRateLimit,
  mockHybridSearch,
  mockGenerateStream,
  mockQueryGeminiText,
  mockApiLoggerError,
} = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockHybridSearch: vi.fn(),
  mockGenerateStream: vi.fn(),
  mockQueryGeminiText: vi.fn(),
  mockApiLoggerError: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

vi.mock('@/lib/cache/redis-client', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  withCache: async (_key: string, fn: () => Promise<unknown>) => fn(),
  CACHE_TTL: { GEMINI_QUERY: 86400, SEARCH_RESULTS: 3600 },
}));

vi.mock('@/lib/embeddings/hybrid-search', () => ({
  hybridSearch: (...args: unknown[]) => mockHybridSearch(...args),
}));

vi.mock('@/lib/embeddings/vector-search', () => ({
  buildContextForLLM: () => '',
}));

vi.mock('@/lib/embeddings/citation-validator', () => ({
  validateQuotedCitations: () => ({ invalidQuotes: [], totalQuotes: 0 }),
  buildCitationWarning: () => '',
}));

vi.mock('@/lib/gemini/cached-client', () => ({
  queryGeminiText: (...args: unknown[]) => mockQueryGeminiText(...args),
}));

vi.mock('@/lib/gemini/config', () => ({
  PRIMARY_GEMINI_MODEL: 'gemini-test',
  FALLBACK_GEMINI_MODELS: [],
}));

vi.mock('@/lib/ai', () => ({
  generateStream: (...args: unknown[]) => mockGenerateStream(...args),
  LEGAL_SAFETY_SETTINGS: [],
}));

vi.mock('@/lib/lei-articles', () => ({
  parseLeiArticles: () => [],
  getLeiArticles: () => [],
}));

vi.mock('@/lib/monitoring/events', () => ({
  trackServerEvent: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockApiLoggerError,
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/legal-context', () => ({
  extractCitedArticles: () => [],
  selectRelevantArticles: async () => [],
  buildLeiContext: () => '',
  findRelatedActs: async () => [],
  buildLayeredContext: () => '',
  formatActsContext: () => '',
  buildLegalSources: () => [],
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: async () => [] },
    legislativeAct: { findMany: async () => [] },
  },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/documents/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/documents/query — quota exhausted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({
      valid: true,
      user: { userId: 'u1', role: 'student' },
    });
    mockCheckRateLimit.mockResolvedValue({ allowed: true, limit: 10, remaining: 9, reset: 0 });
    mockQueryGeminiText.mockResolvedValue({ response: '[]' }); // query expansion ignora erros
  });

  it('non-stream: retorna 503 com code=QUOTA_EXHAUSTED quando hybridSearch lança 429', async () => {
    mockHybridSearch.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED quota'));

    const res = await POST(makeReq({ query: 'dispensa de licitação', stream: false }));
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('QUOTA_EXHAUSTED');
    expect(body.error).toMatch(/temporariamente indisponível/i);
    expect(body.results).toEqual([]);
  });

  it('non-stream: mantém 500 quando erro não é quota', async () => {
    mockHybridSearch.mockRejectedValue(new Error('boom unexpected'));

    const res = await POST(makeReq({ query: 'dispensa de licitação', stream: false }));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBeUndefined();
    expect(body.error).toBe('boom unexpected');
  });

  it('stream: emite evento error com code=QUOTA_EXHAUSTED quando generateStream lança 429', async () => {
    // hybridSearch sucesso para que o pipeline chegue até o stream
    mockHybridSearch.mockResolvedValue({
      results: [
        {
          documentId: 'd1',
          documentTitle: 'Doc',
          category: 'apostila',
          chunkContent: 'conteúdo',
          chunkIndex: 0,
          similarity: 0.7,
          isCommon: true,
          sourceType: 'document',
          leiArticles: null,
        },
      ],
      totalFound: 1,
      cached: false,
    });
    mockGenerateStream.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'));

    const res = await POST(makeReq({ query: 'dispensa de licitação', stream: true }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const text = await res.text();
    expect(text).toContain('"type":"error"');
    expect(text).toContain('"code":"QUOTA_EXHAUSTED"');
    expect(text).toContain('data: [DONE]');
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run app/api/documents/query/__tests__/quota-exhausted.test.ts`
Expected: FAIL — testes 1 e 3 falham (body retorna 500 sem `code`; stream emite token genérico em vez de evento error).

- [ ] **Step 3: Adicionar campo `code` em `QueryResponse`**

Editar `app/api/documents/query/route.ts` linhas 85-95:

Antes:
```ts
interface QueryResponse {
  success: boolean;
  results: DocumentResult[];
  totalDocuments: number;
  cached: boolean;
  latency: number;
  query: string;
  error?: string;
  synthesizedAnswer?: string;
  legalSources?: LegalSource[];
}
```

Depois:
```ts
interface QueryResponse {
  success: boolean;
  results: DocumentResult[];
  totalDocuments: number;
  cached: boolean;
  latency: number;
  query: string;
  error?: string;
  /** Código machine-readable para classificação de falhas pelo frontend.
   *  'QUOTA_EXHAUSTED' = Gemini sem cota em todas as keys configuradas. */
  code?: 'QUOTA_EXHAUSTED';
  synthesizedAnswer?: string;
  legalSources?: LegalSource[];
}
```

- [ ] **Step 4: Importar `isRateLimitError` no topo do route.ts**

Adicionar perto dos outros imports (depois do import de `apiLogger` em linha 22):

```ts
import { isRateLimitError } from '@/lib/ai/error-detection';
```

- [ ] **Step 5: Mudar o catch externo para devolver 503 em quota**

Substituir o catch externo (linhas 1027-1042):

Antes:
```ts
  } catch (error) {
    apiLogger.error({ error }, 'Document query failed');

    return NextResponse.json<QueryResponse>(
      {
        success: false,
        results: [],
        totalDocuments: 0,
        cached: false,
        latency: Date.now() - startTime,
        query: '',
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
```

Depois:
```ts
  } catch (error) {
    apiLogger.error({ error }, 'Document query failed');

    // Quota Gemini esgotada em todas as keys configuradas — degrada
    // graciosamente. Frontend trata 503 + code='QUOTA_EXHAUSTED' para
    // esconder card IA e mostrar mensagem amigável; resultados textuais
    // via /api/area-restrita/global-search seguem funcionando.
    if (isRateLimitError(error)) {
      return NextResponse.json<QueryResponse>(
        {
          success: false,
          code: 'QUOTA_EXHAUSTED',
          error: 'Síntese IA temporariamente indisponível por excesso de uso. A busca textual segue funcionando — tente novamente em alguns minutos.',
          results: [],
          totalDocuments: 0,
          cached: false,
          latency: Date.now() - startTime,
          query: '',
        },
        { status: 503 }
      );
    }

    return NextResponse.json<QueryResponse>(
      {
        success: false,
        results: [],
        totalDocuments: 0,
        cached: false,
        latency: Date.now() - startTime,
        query: '',
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
```

- [ ] **Step 6: Mudar o catch interno do ReadableStream para emitir evento error em quota**

Substituir o catch interno (linhas 971-979):

Antes:
```ts
          } catch (err) {
            apiLogger.error({ error: err }, 'SSE streaming error');
            const fallback = 'Não consegui sintetizar uma resposta agora. Consulte as fontes abaixo — elas contêm a informação relevante para sua pergunta.';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: fallback })}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } finally {
```

Depois:
```ts
          } catch (err) {
            apiLogger.error({ error: err }, 'SSE streaming error');

            // Quota Gemini esgotada mid-stream (ou na iniciação do stream).
            // Emite evento de erro estruturado em vez do token genérico — o
            // frontend distingue por code='QUOTA_EXHAUSTED' e mostra mensagem
            // amigável + esconde o card de síntese IA.
            if (isRateLimitError(err)) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'error',
                    code: 'QUOTA_EXHAUSTED',
                    message: 'Síntese IA temporariamente indisponível por excesso de uso. A busca textual segue funcionando — tente novamente em alguns minutos.',
                  })}\n\n`,
                ),
              );
            } else {
              const fallback = 'Não consegui sintetizar uma resposta agora. Consulte as fontes abaixo — elas contêm a informação relevante para sua pergunta.';
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: fallback })}\n\n`));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } finally {
```

- [ ] **Step 7: Rodar teste — deve passar**

Run: `npx vitest run app/api/documents/query/__tests__/quota-exhausted.test.ts`
Expected: PASS — 3 testes verdes.

- [ ] **Step 8: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: PASS sem erros novos.

- [ ] **Step 9: Commit**

```bash
git add app/api/documents/query/route.ts app/api/documents/query/__tests__/quota-exhausted.test.ts
GIT_COMMITTER_EMAIL="danbarral@gmail.com" GIT_COMMITTER_NAME="Daniel Barral" \
  git commit --author="Daniel Barral <danbarral@gmail.com>" -m "$(cat <<'EOF'
feat(busca-ia): 503 amigável quando Gemini quota esgota

QueryResponse ganha campo opcional code='QUOTA_EXHAUSTED'. Outer
catch e SSE catch detectam isRateLimitError e devolvem:
- Non-stream: HTTP 503 com code + mensagem amigável
- Stream: SSE event {type:'error',code:'QUOTA_EXHAUSTED'} + [DONE]

Outros erros (auth, network, safety) mantêm 500 atual. Cobertura via
quota-exhausted.test.ts (non-stream 503, non-stream 500 boom, stream
emite evento error).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Frontend handle 503 + stream error event em `hooks/use-global-search.ts`

**Files:**
- Modify: `hooks/use-global-search.ts`

Sem testes — codebase não tem testes para hooks de UI. Verificação manual no dev server.

- [ ] **Step 1: Adicionar branch 503 paralelo ao 429**

Editar `hooks/use-global-search.ts` adicionando um bloco logo após o 429 existente (após linha 213):

Antes (linhas 205-217):
```ts
        if (response.status === 429) {
          if (!controller.signal.aborted) {
            setAiError('Limite de consultas atingido. Aguarde um momento e tente novamente.');
            setAiAnswer(null);
            setAiSources([]);
            setAiLegalSources([]);
          }
          return;
        }

        if (!response.ok) {
          throw new Error('Falha na busca com IA');
        }
```

Depois:
```ts
        if (response.status === 429) {
          if (!controller.signal.aborted) {
            setAiError('Limite de consultas atingido. Aguarde um momento e tente novamente.');
            setAiAnswer(null);
            setAiSources([]);
            setAiLegalSources([]);
          }
          return;
        }

        if (response.status === 503) {
          // Quota Gemini esgotada em todas as keys configuradas. Resultados
          // textuais via /api/area-restrita/global-search continuam normais —
          // só escondemos o card de síntese IA.
          const body = await response.json().catch(() => ({} as { code?: string; error?: string }));
          if (!controller.signal.aborted) {
            setAiError(body.error || 'Síntese IA indisponível no momento. Tente novamente em alguns minutos.');
            setAiAnswer(null);
            setAiSources([]);
            setAiLegalSources([]);
          }
          return;
        }

        if (!response.ok) {
          throw new Error('Falha na busca com IA');
        }
```

- [ ] **Step 2: Detectar evento error no parser SSE**

Editar o parser SSE (linhas 241-263) adicionando o branch `type === 'error'`:

Antes:
```ts
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'meta') {
                streamSources = (parsed.results || []).map((r: AISource) => ({
                  documentId: r.documentId,
                  title: r.title,
                  category: r.category,
                  relevance: r.relevance,
                  excerpt: r.excerpt,
                  url: r.url,
                }));
                streamLegalSources = parsed.legalSources || [];
                if (!controller.signal.aborted) {
                  setAiSources(streamSources);
                  setAiLegalSources(streamLegalSources);
                }
              } else if (parsed.type === 'token') {
                fullAnswer += parsed.text;
                if (!controller.signal.aborted) {
                  setAiAnswer(fullAnswer);
                }
              }
            } catch { /* ignore parse errors */ }
```

Depois:
```ts
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'meta') {
                streamSources = (parsed.results || []).map((r: AISource) => ({
                  documentId: r.documentId,
                  title: r.title,
                  category: r.category,
                  relevance: r.relevance,
                  excerpt: r.excerpt,
                  url: r.url,
                }));
                streamLegalSources = parsed.legalSources || [];
                if (!controller.signal.aborted) {
                  setAiSources(streamSources);
                  setAiLegalSources(streamLegalSources);
                }
              } else if (parsed.type === 'token') {
                fullAnswer += parsed.text;
                if (!controller.signal.aborted) {
                  setAiAnswer(fullAnswer);
                }
              } else if (parsed.type === 'error' && parsed.code === 'QUOTA_EXHAUSTED') {
                // Quota Gemini esgotada mid-stream. Esconde card IA e mostra
                // mensagem amigável. Resultados textuais continuam intactos
                // via /api/area-restrita/global-search.
                if (!controller.signal.aborted) {
                  setAiError(parsed.message || 'Síntese IA indisponível no momento. Tente novamente em alguns minutos.');
                  setAiAnswer(null);
                  setAiSources([]);
                  setAiLegalSources([]);
                }
                // Para de processar este stream (próximo [DONE] vai sair sozinho).
                return;
              }
            } catch { /* ignore parse errors */ }
```

- [ ] **Step 3: Verificação manual**

Em terminal separado, com a feature branch:

```bash
cd "/Users/danba/Site do Barral/sitedobarral"
npm run dev
```

Em outro terminal, simular quota:

```bash
# Apontar GEMINI_API_KEY para chave inválida temporariamente e deixar BACKUP vazio
echo "VERIFY: ajuste manual em .env.local ou abra DevTools → Network"
```

Abrir http://localhost:3000/area-restrita, logar como `aluno@teste.com / aluno123`, abrir DevTools → Network, fazer uma busca. Verificar:

1. Request `/api/documents/query` retorna 503 (não 500) com body `{code:'QUOTA_EXHAUSTED', error:'Síntese IA temporariamente...'}`
2. Card "Análise IA" some
3. Banner ou mensagem com texto da IA indisponibilizada aparece (ou fica vazio sem erro vermelho — depende do componente que lê `aiError`)
4. Resultados textuais da `/api/area-restrita/global-search` continuam aparecendo normais

Restaurar `.env.local` ao terminar.

- [ ] **Step 4: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: PASS sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-global-search.ts
GIT_COMMITTER_EMAIL="danbarral@gmail.com" GIT_COMMITTER_NAME="Daniel Barral" \
  git commit --author="Daniel Barral <danbarral@gmail.com>" -m "$(cat <<'EOF'
feat(busca-ia): hook handle 503 + evento error de quota no stream

use-global-search ganha:
- Branch 503 paralelo ao 429: lê body e seta aiError com mensagem do
  backend (fallback genérico se body malformado).
- Detecção de evento {type:'error',code:'QUOTA_EXHAUSTED'} no parser
  SSE: esconde card IA, seta aiError, encerra leitura do stream.

Resultados textuais via /api/area-restrita/global-search ficam
intactos (endpoint independente, não afetado por quota Gemini).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Docs — `.env.example` + `CLAUDE.md`

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Adicionar `GEMINI_API_KEY` e `GEMINI_API_KEY_BACKUP` em `.env.example`**

Inserir antes da linha 124 (`# GEMINI MODEL OVERRIDE (rollback rápido sem deploy)`):

```
# -----------------------------------------------------------------------------
# GEMINI API KEYS (Chat RAG + Busca IA + Embeddings)
# -----------------------------------------------------------------------------
# Chave do projeto principal Google AI Studio (https://aistudio.google.com/app/apikey).
# Usada em todas as chamadas Gemini: chat, síntese de busca, embeddings,
# classificação DOU, relevance-filter da newsletter etc.
GEMINI_API_KEY=

# Chave de backup (opcional, mas RECOMENDADO em produção). Quando a primária
# retorna 429/RESOURCE_EXHAUSTED, o sistema tenta automaticamente a backup
# antes de degradar para FTS-only. Crie como projeto Google AI separado.
# Sem essa env, comportamento é idêntico ao anterior: 1 tentativa só.
# GEMINI_API_KEY_BACKUP=

```

- [ ] **Step 2: Adicionar nota em `CLAUDE.md` na seção "Environment Variables"**

Editar `CLAUDE.md` na seção `**Optional:**` próximo à linha 428:

Antes:
```
**Optional:**

- `ANTHROPIC_API_KEY` - AI summaries
- `GEMINI_API_KEY` - Chat RAG e busca semântica
- `MAILCHIMP_*` - Newsletter
```

Depois:
```
**Optional:**

- `ANTHROPIC_API_KEY` - AI summaries
- `GEMINI_API_KEY` - Chat RAG e busca semântica
- `GEMINI_API_KEY_BACKUP` - chave Gemini de backup (opcional). Quando a primária retorna 429/RESOURCE_EXHAUSTED, sistema tenta a backup antes de degradar para FTS-only. Recomendado em produção. Implementação: `lib/gemini/api-key-fallback.ts`.
- `MAILCHIMP_*` - Newsletter
```

- [ ] **Step 3: Commit**

```bash
git add .env.example CLAUDE.md
GIT_COMMITTER_EMAIL="danbarral@gmail.com" GIT_COMMITTER_NAME="Daniel Barral" \
  git commit --author="Daniel Barral <danbarral@gmail.com>" -m "$(cat <<'EOF'
chore(docs): documenta GEMINI_API_KEY_BACKUP opcional

.env.example ganha seção dedicada de Gemini com primary + backup,
explicando que backup é tentada automaticamente em 429. CLAUDE.md
adiciona a env na seção Optional, com pointer para o módulo
api-key-fallback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Validação final (não é commit)

Após todas as tasks:

- [ ] **Rodar suite de testes inteira:**

Run: `npx vitest run`
Expected: todos os testes verdes — nenhuma regressão.

- [ ] **Rodar typecheck:**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo.

- [ ] **Push e abrir PR:**

```bash
git push -u origin feat/gemini-backup-key-quota
gh pr create --title "feat(busca-ia): backup Gemini key + 503 amigável de quota" --body "$(cat <<'EOF'
## Summary

- Helper compartilhado `withGeminiKeyFallback` em `lib/gemini/api-key-fallback.ts` cascateia entre `GEMINI_API_KEY` e `GEMINI_API_KEY_BACKUP` quando 1ª retorna 429/RESOURCE_EXHAUSTED.
- Refatora `lib/ai/providers/gemini.ts` e `lib/embeddings/gemini-embeddings.ts` para usar o wrapper (remove cache de client por process; instancia GoogleGenAI por chamada — custo desprezível).
- `/api/documents/query` devolve HTTP 503 (não 500) com `code='QUOTA_EXHAUSTED'` quando ambas keys esgotam. Stream SSE emite evento `{type:'error',code:'QUOTA_EXHAUSTED'}` em vez de token genérico.
- Frontend `hooks/use-global-search.ts` ganha branch 503 e detecção do evento error no SSE — esconde card IA, mostra mensagem amigável.
- Docs: `.env.example` e `CLAUDE.md`.

## Motivação

Incidente 2026-06-08: créditos prepagos Google AI zerados → 100% das chamadas a `/api/documents/query` falhando com 500 genérico. Spec em `docs/superpowers/specs/2026-06-08-gemini-backup-key-quota-friendly-design.md`.

## Test plan

- [x] `npx vitest run lib/gemini/__tests__/api-key-fallback.test.ts` — 5 testes do wrapper
- [x] `npx vitest run app/api/documents/query/__tests__/quota-exhausted.test.ts` — 3 testes do endpoint
- [x] `npx vitest run lib/ai/__tests__/` — testes existentes do provider seguem verdes
- [x] `npx vitest run lib/embeddings/__tests__/` — testes existentes de embeddings seguem verdes
- [x] `npx tsc --noEmit` — sem erros novos
- [ ] Pós-merge: confirmar deploy + smoke manual de busca IA em produção com primary OK
- [ ] Pós-merge (opcional): testar 503 forçando chave inválida em `GEMINI_API_KEY` e deixando `GEMINI_API_KEY_BACKUP` vazio temporariamente em preview

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist

- [x] **Spec coverage:** Toda seção da spec (Helper, integração nos 2 lazy-inits, 503 non-stream, evento error stream, frontend, docs) tem task correspondente.
- [x] **No placeholders:** Sem "TBD"/"TODO"/"implement later". Cada code block tem código completo e final.
- [x] **Type consistency:** `withGeminiKeyFallback<T>(fn: (apiKey: string) => Promise<T>): Promise<T>` consistente em todos os call sites (Task 1, 2, 3). `code?: 'QUOTA_EXHAUSTED'` consistente em route.ts e teste (Task 4).
- [x] **Mensagens consistentes:** "Síntese IA temporariamente indisponível por excesso de uso. A busca textual segue funcionando — tente novamente em alguns minutos." aparece idêntica no payload non-stream, no evento SSE e no fallback do frontend.
- [x] **Author/committer:** Todos os commits usam `Daniel Barral <danbarral@gmail.com>` em author E committer via env vars (memória `feedback_git_author.md`).
