# Portar camada `lib/ai/` para o site do Barral — Fase 1

> **⚠️ NOTA HISTÓRICA (2026-04-22):** Este plano original fixava os defaults
> em `gemini-2.0-flash`. A Google depois deprecou esse modelo
> (shutdown 2026-06-01) e o billing pago do usuário migrou para a família
> 2.5. Os defaults atuais (já no código) são `gemini-2.5-flash`, ajustados
> em `docs/ROADMAP_GEMINI_MODELO_25.md`. Partes deste plano abaixo refletem
> o estado original e **não devem mais ser executadas sem releitura**.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduzir uma camada única de abstração de provedores de LLM (`lib/ai/`) no site do Barral, permitindo trocar provider/modelo de cada tarefa via env var, sem alterar nenhum chamador existente nesta fase.

**Architecture:** Espelha 1:1 a camada já em produção no projeto-elic (`projeto-elic/lib/ai/`), com adaptações: (a) remove persistência em `AuditLog` (modelo não existe neste schema — fica para fase futura), (b) o conjunto de `AiTask` é redefinido para refletir as cargas reais do site (search, chat, extraction, classification, summarization, enhancement), (c) defaults são fixados nos modelos hoje em uso para garantir paridade comportamental — nenhuma rota muda nesta fase.

**Tech Stack:** TypeScript, Next.js 16, `@anthropic-ai/sdk` (já instalado v^0.78.0), Gemini REST API (`generativelanguage.googleapis.com`), pino, Vitest.

**Não-objetivos desta fase (entram em fases posteriores):**
- Trocar modelos hardcoded em rotas existentes (`app/api/documents/query`, `app/api/lei-14133/search`, `lib/claude-classifier.ts`, etc.)
- Adicionar Cohere Rerank, hybrid search, golden set, contextual retrieval
- Persistência de auditoria em DB
- Migração de embeddings

---

## Estrutura de arquivos

```
sitedobarral/
├── lib/ai/
│   ├── types.ts            (CRIAR — interfaces AiTask, AiProvider, AiMessage, AiGenerateRequest, AiGenerateResponse)
│   ├── retry.ts            (CRIAR — withRetry + isTransientError; copy verbatim do elic)
│   ├── registry.ts         (CRIAR — DEFAULTS por tarefa + override por env)
│   ├── index.ts            (CRIAR — generate(); SEM persistência em AuditLog)
│   ├── providers/
│   │   ├── gemini.ts       (CRIAR — copy verbatim do elic)
│   │   └── anthropic.ts    (CRIAR — copy verbatim do elic)
│   └── document-enhancer.ts (NÃO TOCAR nesta fase)
└── lib/__tests__/ai/
    └── registry.test.ts    (CRIAR — testes de defaults + overrides)
```

**Tarefas (`AiTask`) definidas nesta fase, com defaults preservando comportamento atual:**

| Task | Provider default | Modelo default | Env override |
|---|---|---|---|
| `search` | `gemini` | `gemini-2.0-flash` | `AI_SEARCH_PROVIDER` / `AI_SEARCH_MODEL` |
| `chat` | `gemini` | `gemini-2.0-flash` | `AI_CHAT_PROVIDER` / `AI_CHAT_MODEL` |
| `extraction` | `gemini` | `gemini-2.0-flash` | `AI_EXTRACTION_PROVIDER` / `AI_EXTRACTION_MODEL` |
| `classification` | `anthropic` | `claude-3-5-haiku-20241022` | `AI_CLASSIFICATION_PROVIDER` / `AI_CLASSIFICATION_MODEL` |
| `summarization` | `anthropic` | `claude-3-5-haiku-20241022` | `AI_SUMMARIZATION_PROVIDER` / `AI_SUMMARIZATION_MODEL` |
| `enhancement` | `anthropic` | `claude-sonnet-4-20250514` | `AI_ENHANCEMENT_PROVIDER` / `AI_ENHANCEMENT_MODEL` |

---

## Pré-requisitos

- Node + npm instalados, working tree limpo (`git status` → clean)
- `GEMINI_API_KEY` no `.env.local` (já existe)
- `ANTHROPIC_API_KEY` no `.env.local` (provavelmente já existe — `lib/claude-classifier.ts` usa)

---

## Task 1: `lib/ai/types.ts`

**Files:**
- Create: `lib/ai/types.ts`

- [ ] **Step 1: Criar o arquivo com as interfaces**

```ts
/**
 * Camada de abstracao de provedores de LLM.
 *
 * Permite trocar o modelo/provedor de cada tarefa via env vars
 * (AI_<TASK>_PROVIDER, AI_<TASK>_MODEL) sem mexer no codigo dos chamadores.
 */

export type AiTask =
  | 'search'
  | 'chat'
  | 'extraction'
  | 'classification'
  | 'summarization'
  | 'enhancement'

export type AiProviderName = 'gemini' | 'anthropic'

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiGenerateRequest {
  /** Prompt de sistema (instrucoes globais). */
  systemPrompt?: string
  /** Historico de mensagens. Para tarefas single-turn, passar [{ role: 'user', content }]. */
  messages: AiMessage[]
  /** 0..1, default 0.3. */
  temperature?: number
  /** Default 4096. */
  maxTokens?: number
  /** Se true, instrui o modelo a retornar JSON puro. */
  jsonMode?: boolean
  /** Opcional: usuario que disparou a chamada (uso futuro p/ auditoria). */
  userId?: string
}

export interface AiGenerateResponse {
  text: string
  inputTokens?: number
  outputTokens?: number
  /** Provider e modelo efetivamente usados — util para auditoria/billing. */
  provider: AiProviderName
  modelId: string
}

export interface AiProvider {
  name: AiProviderName
  generate(modelId: string, req: AiGenerateRequest): Promise<AiGenerateResponse>
}
```

- [ ] **Step 2: Verificar que typecheck passa**

Run: `npx tsc --noEmit lib/ai/types.ts`
Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/types.ts
git commit -m "feat(ai): add types for LLM provider abstraction"
```

---

## Task 2: `lib/ai/retry.ts`

**Files:**
- Create: `lib/ai/retry.ts`

- [ ] **Step 1: Criar arquivo (cópia verbatim da versão do elic)**

```ts
import { logger } from '@/lib/logger'

export interface RetryOptions {
  /** Numero maximo de tentativas (incluindo a primeira). Default 3. */
  maxAttempts?: number
  /** Atraso inicial em ms. Default 500. */
  initialDelayMs?: number
  /** Multiplicador exponencial. Default 2. */
  factor?: number
  /** Atraso maximo em ms. Default 8000. */
  maxDelayMs?: number
  /** Etiqueta para logs. */
  label?: string
}

/**
 * Identifica erros transitorios que valem retry: 429 (rate limit),
 * 500/502/503/504 (server side), erros de rede.
 */
export function isTransientError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  if (/\b(429|500|502|503|504)\b/.test(msg)) return true
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up/i.test(msg)) return true
  // Anthropic SDK e Gemini lancam objetos com .status
  const status = (err as { status?: number }).status
  if (status && (status === 429 || (status >= 500 && status < 600))) return true
  return false
}

/**
 * Executa fn com backoff exponencial em erros transitorios.
 * Para erros nao-transitorios (4xx exceto 429), falha imediatamente.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3
  const initialDelay = opts.initialDelayMs ?? 500
  const factor = opts.factor ?? 2
  const maxDelay = opts.maxDelayMs ?? 8000
  const label = opts.label ?? 'retry'

  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt === maxAttempts || !isTransientError(err)) {
        throw err
      }
      const delay = Math.min(maxDelay, initialDelay * Math.pow(factor, attempt - 1))
      // jitter +- 25%
      const jittered = delay * (0.75 + Math.random() * 0.5)
      logger.warn({ label, attempt, nextDelayMs: Math.round(jittered), err: (err as Error).message }, 'ai.retry')
      await new Promise((r) => setTimeout(r, jittered))
    }
  }
  throw lastErr
}
```

- [ ] **Step 2: Verificar import do logger resolve**

Run: `npx tsc --noEmit lib/ai/retry.ts`
Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/retry.ts
git commit -m "feat(ai): add withRetry helper with exponential backoff"
```

---

## Task 3: `lib/ai/providers/gemini.ts`

**Files:**
- Create: `lib/ai/providers/gemini.ts`

- [ ] **Step 1: Criar arquivo (cópia verbatim da versão do elic)**

```ts
import type { AiProvider, AiGenerateRequest, AiGenerateResponse } from '../types'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export const geminiProvider: AiProvider = {
  name: 'gemini',
  async generate(modelId: string, req: AiGenerateRequest): Promise<AiGenerateResponse> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

    const contents = req.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.3,
        maxOutputTokens: req.maxTokens ?? 4096,
        ...(req.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    }
    if (req.systemPrompt) {
      body.systemInstruction = { parts: [{ text: req.systemPrompt }] }
    }

    const res = await fetch(`${BASE_URL}/models/${modelId}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Gemini API error ${res.status}: ${errBody}`)
    }

    const data = await res.json()
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const usage = data.usageMetadata ?? {}

    return {
      text,
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
      provider: 'gemini',
      modelId,
    }
  },
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit lib/ai/providers/gemini.ts`
Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/providers/gemini.ts
git commit -m "feat(ai): add Gemini provider"
```

---

## Task 4: `lib/ai/providers/anthropic.ts`

**Files:**
- Create: `lib/ai/providers/anthropic.ts`

- [ ] **Step 1: Criar arquivo**

```ts
import Anthropic from '@anthropic-ai/sdk'
import type { AiProvider, AiGenerateRequest, AiGenerateResponse } from '../types'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
    client = new Anthropic({ apiKey })
  }
  return client
}

export const anthropicProvider: AiProvider = {
  name: 'anthropic',
  async generate(modelId: string, req: AiGenerateRequest): Promise<AiGenerateResponse> {
    const c = getClient()

    let system = req.systemPrompt
    if (req.jsonMode) {
      system = (system ? system + '\n\n' : '') +
        'IMPORTANTE: Responda APENAS com JSON valido, sem markdown, sem cercas de codigo, sem texto explicativo antes ou depois.'
    }

    const messages = req.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const resp = await c.messages.create({
      model: modelId,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.3,
      ...(system ? { system } : {}),
      messages,
    })

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    return {
      text,
      inputTokens: resp.usage?.input_tokens,
      outputTokens: resp.usage?.output_tokens,
      provider: 'anthropic',
      modelId,
    }
  },
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit lib/ai/providers/anthropic.ts`
Expected: nenhum erro. Se falhar com "Cannot find module '@anthropic-ai/sdk'", confirmar `npm ls @anthropic-ai/sdk` (deveria estar em ^0.78.0).

- [ ] **Step 3: Commit**

```bash
git add lib/ai/providers/anthropic.ts
git commit -m "feat(ai): add Anthropic provider"
```

---

## Task 5: `lib/ai/registry.ts`

**Files:**
- Create: `lib/ai/registry.ts`

- [ ] **Step 1: Criar arquivo com defaults preservando comportamento atual**

```ts
import { geminiProvider } from './providers/gemini'
import { anthropicProvider } from './providers/anthropic'
import type { AiProvider, AiProviderName, AiTask } from './types'

const PROVIDERS: Record<AiProviderName, AiProvider> = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
}

interface TaskDefault {
  provider: AiProviderName
  model: string
}

/**
 * Defaults por tarefa. Sobrescritiveis via env vars.
 *
 * Esta fase preserva os modelos atualmente em uso no codigo (gemini-2.0-flash
 * em search/chat/extraction, claude-3-5-haiku para classificacao/sumarizacao,
 * claude-sonnet-4 para enhancement). Upgrades acontecem em fases posteriores.
 */
const DEFAULTS: Record<AiTask, TaskDefault> = {
  'search': { provider: 'gemini', model: 'gemini-2.0-flash' },
  'chat': { provider: 'gemini', model: 'gemini-2.0-flash' },
  'extraction': { provider: 'gemini', model: 'gemini-2.0-flash' },
  'classification': { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
  'summarization': { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
  'enhancement': { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
}

const ENV_KEYS: Record<AiTask, { providerKey: string; modelKey: string }> = {
  'search': { providerKey: 'AI_SEARCH_PROVIDER', modelKey: 'AI_SEARCH_MODEL' },
  'chat': { providerKey: 'AI_CHAT_PROVIDER', modelKey: 'AI_CHAT_MODEL' },
  'extraction': { providerKey: 'AI_EXTRACTION_PROVIDER', modelKey: 'AI_EXTRACTION_MODEL' },
  'classification': { providerKey: 'AI_CLASSIFICATION_PROVIDER', modelKey: 'AI_CLASSIFICATION_MODEL' },
  'summarization': { providerKey: 'AI_SUMMARIZATION_PROVIDER', modelKey: 'AI_SUMMARIZATION_MODEL' },
  'enhancement': { providerKey: 'AI_ENHANCEMENT_PROVIDER', modelKey: 'AI_ENHANCEMENT_MODEL' },
}

export interface ResolvedTask {
  provider: AiProvider
  modelId: string
}

export function resolveTask(task: AiTask): ResolvedTask {
  const env = ENV_KEYS[task]
  const def = DEFAULTS[task]
  const providerName = (process.env[env.providerKey] || def.provider) as AiProviderName
  const modelId = process.env[env.modelKey] || def.model

  const provider = PROVIDERS[providerName]
  if (!provider) {
    throw new Error(
      `Unknown AI provider "${providerName}" for task "${task}". ` +
      `Valid providers: ${Object.keys(PROVIDERS).join(', ')}`
    )
  }

  return { provider, modelId }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit lib/ai/registry.ts`
Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/registry.ts
git commit -m "feat(ai): add task registry with env override"
```

---

## Task 6: `lib/ai/index.ts`

Notas: ao contrário do elic, esta versão **não** persiste em `AuditLog` (modelo não existe). Apenas loga via pino. Persistência em DB fica para fase futura, exigirá migração de schema.

**Files:**
- Create: `lib/ai/index.ts`

- [ ] **Step 1: Criar arquivo**

```ts
import { logger } from '@/lib/logger'
import { resolveTask } from './registry'
import { withRetry } from './retry'
import type { AiTask, AiGenerateRequest, AiGenerateResponse } from './types'

export type {
  AiTask,
  AiGenerateRequest,
  AiGenerateResponse,
  AiMessage,
  AiProvider,
  AiProviderName,
} from './types'

export { resolveTask } from './registry'
export { withRetry, isTransientError } from './retry'

/**
 * Ponto de entrada unico para chamadas a LLMs no projeto.
 *
 * - Resolve provider/modelo via env vars (AI_<TASK>_PROVIDER / AI_<TASK>_MODEL)
 *   ou defaults de registry.ts
 * - Aplica retry com backoff exponencial em erros transitorios (429, 5xx, rede)
 * - Loga via pino info/error com tokens, modelo, duracao
 *
 * NOTA: persistencia de auditoria em DB sera adicionada em fase posterior
 * (depende de criar modelo AuditLog no schema).
 *
 * Chamadores devem tratar excecoes — esta funcao re-lanca apos retries.
 */
export async function generate(
  task: AiTask,
  req: AiGenerateRequest
): Promise<AiGenerateResponse> {
  const { provider, modelId } = resolveTask(task)
  const start = Date.now()
  try {
    const result = await withRetry(() => provider.generate(modelId, req), {
      label: `ai.${task}`,
    })
    const durationMs = Date.now() - start

    logger.info(
      {
        task,
        provider: provider.name,
        modelId,
        durationMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        userId: req.userId,
      },
      'ai.generate.ok'
    )

    return result
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error(
      { err, task, provider: provider.name, modelId, durationMs, userId: req.userId },
      'ai.generate.error'
    )
    throw err
  }
}
```

- [ ] **Step 2: Typecheck do projeto inteiro**

Run: `npx tsc --noEmit`
Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/index.ts
git commit -m "feat(ai): add generate() entrypoint with retry + structured logging"
```

---

## Task 7: Testes do registry

**Files:**
- Create: `lib/__tests__/ai/registry.test.ts`

- [ ] **Step 1: Escrever testes que devem falhar antes (não falham — registry já existe — mas validam contrato)**

```ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveTask } from '@/lib/ai/registry'

describe('lib/ai/registry', () => {
  const ENV_KEYS = [
    'AI_SEARCH_PROVIDER',
    'AI_SEARCH_MODEL',
    'AI_CHAT_PROVIDER',
    'AI_CHAT_MODEL',
    'AI_EXTRACTION_PROVIDER',
    'AI_EXTRACTION_MODEL',
    'AI_CLASSIFICATION_PROVIDER',
    'AI_CLASSIFICATION_MODEL',
    'AI_SUMMARIZATION_PROVIDER',
    'AI_SUMMARIZATION_MODEL',
    'AI_ENHANCEMENT_PROVIDER',
    'AI_ENHANCEMENT_MODEL',
  ]

  const originals: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      originals[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originals[k] === undefined) delete process.env[k]
      else process.env[k] = originals[k]
    }
  })

  it('search default e Gemini 2.0 Flash', () => {
    const r = resolveTask('search')
    expect(r.provider.name).toBe('gemini')
    expect(r.modelId).toBe('gemini-2.0-flash')
  })

  it('chat default e Gemini 2.0 Flash', () => {
    const r = resolveTask('chat')
    expect(r.provider.name).toBe('gemini')
    expect(r.modelId).toBe('gemini-2.0-flash')
  })

  it('extraction default e Gemini 2.0 Flash', () => {
    const r = resolveTask('extraction')
    expect(r.provider.name).toBe('gemini')
    expect(r.modelId).toBe('gemini-2.0-flash')
  })

  it('classification default e Claude 3.5 Haiku', () => {
    const r = resolveTask('classification')
    expect(r.provider.name).toBe('anthropic')
    expect(r.modelId).toBe('claude-3-5-haiku-20241022')
  })

  it('summarization default e Claude 3.5 Haiku', () => {
    const r = resolveTask('summarization')
    expect(r.provider.name).toBe('anthropic')
    expect(r.modelId).toBe('claude-3-5-haiku-20241022')
  })

  it('enhancement default e Claude Sonnet 4', () => {
    const r = resolveTask('enhancement')
    expect(r.provider.name).toBe('anthropic')
    expect(r.modelId).toBe('claude-sonnet-4-20250514')
  })

  it('permite trocar search para Gemini 2.5 Pro via env', () => {
    process.env.AI_SEARCH_PROVIDER = 'gemini'
    process.env.AI_SEARCH_MODEL = 'gemini-2.5-pro'
    const r = resolveTask('search')
    expect(r.provider.name).toBe('gemini')
    expect(r.modelId).toBe('gemini-2.5-pro')
  })

  it('permite trocar enhancement para Anthropic Opus via env', () => {
    process.env.AI_ENHANCEMENT_PROVIDER = 'anthropic'
    process.env.AI_ENHANCEMENT_MODEL = 'claude-opus-4-6'
    const r = resolveTask('enhancement')
    expect(r.provider.name).toBe('anthropic')
    expect(r.modelId).toBe('claude-opus-4-6')
  })

  it('lanca erro para provider desconhecido', () => {
    process.env.AI_CHAT_PROVIDER = 'openai'
    expect(() => resolveTask('chat')).toThrow(/Unknown AI provider/)
  })
})
```

- [ ] **Step 2: Rodar testes**

Run: `npx vitest run lib/__tests__/ai/registry.test.ts`
Expected: 9 passed.

- [ ] **Step 3: Commit**

```bash
git add lib/__tests__/ai/registry.test.ts
git commit -m "test(ai): cover registry defaults and env overrides"
```

---

## Task 8: Smoke test de integração (live API, opt-in)

Objetivo: provar que a camada falha de pé num call real para Gemini e Anthropic. Marcado como `it.skipIf` para não rodar em CI sem chaves.

**Files:**
- Create: `lib/__tests__/ai/generate.smoke.test.ts`

- [ ] **Step 1: Escrever smoke test**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { generate } from '@/lib/ai'

const hasGemini = !!process.env.GEMINI_API_KEY
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY

describe('lib/ai generate (smoke, requer chaves)', () => {
  it.skipIf(!hasGemini)('chama Gemini default em search', async () => {
    const r = await generate('search', {
      messages: [{ role: 'user', content: 'Responda apenas: ok' }],
      maxTokens: 10,
      temperature: 0,
    })
    expect(r.provider).toBe('gemini')
    expect(r.text.length).toBeGreaterThan(0)
  }, 30_000)

  it.skipIf(!hasAnthropic)('chama Anthropic default em classification', async () => {
    const r = await generate('classification', {
      messages: [{ role: 'user', content: 'Responda apenas: ok' }],
      maxTokens: 10,
      temperature: 0,
    })
    expect(r.provider).toBe('anthropic')
    expect(r.text.length).toBeGreaterThan(0)
  }, 30_000)
})
```

- [ ] **Step 2: Rodar localmente (com chaves no `.env.local`)**

Run: `npx vitest run lib/__tests__/ai/generate.smoke.test.ts`
Expected: 2 passed (ou 2 skipped se faltarem chaves — ambos cenários são aceitáveis para considerar a task completa).

- [ ] **Step 3: Commit**

```bash
git add lib/__tests__/ai/generate.smoke.test.ts
git commit -m "test(ai): add opt-in smoke tests for live LLM calls"
```

---

## Task 9: Verificação final + documentação

**Files:**
- Modify: `CLAUDE.md` (raiz do site do Barral)

- [ ] **Step 1: Rodar a suíte inteira pra garantir não-regressão**

Run: `npm run test:run`
Expected: todos os testes verdes, incluindo os 9 novos do registry.

- [ ] **Step 2: Rodar lint**

Run: `npm run lint`
Expected: nenhum erro/warning novo introduzido por arquivos de `lib/ai/`.

- [ ] **Step 3: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 4: Adicionar seção sobre `lib/ai/` ao `CLAUDE.md`**

Localizar o `CLAUDE.md` na raiz do projeto e acrescentar (no fim, antes da última seção, ou em local apropriado pelo conteúdo existente):

```markdown
## Camada de IA (`lib/ai/`)

Ponto de entrada único: `import { generate } from '@/lib/ai'`.

```ts
const { text } = await generate('search', {
  systemPrompt: '...',
  messages: [{ role: 'user', content: '...' }],
  temperature: 0.2,
  maxTokens: 1024,
})
```

Tasks suportadas e defaults atuais:

| Task | Provider default | Modelo default |
|---|---|---|
| `search` | gemini | `gemini-2.0-flash` |
| `chat` | gemini | `gemini-2.0-flash` |
| `extraction` | gemini | `gemini-2.0-flash` |
| `classification` | anthropic | `claude-3-5-haiku-20241022` |
| `summarization` | anthropic | `claude-3-5-haiku-20241022` |
| `enhancement` | anthropic | `claude-sonnet-4-20250514` |

Override por env: `AI_<TASK>_PROVIDER` e `AI_<TASK>_MODEL`. Ex.:
```
AI_SEARCH_PROVIDER=gemini
AI_SEARCH_MODEL=gemini-2.5-pro
```

Embeddings continuam fora desta camada (interface diferente, controlado por `EMBEDDING_MODEL`).

Esta camada inclui retry com backoff exponencial em erros transitórios (429/5xx/rede) e logging estruturado via pino. Persistência de auditoria em DB ainda não implementada (aguarda criação do modelo `AuditLog`).
```

- [ ] **Step 5: Commit final**

```bash
git add CLAUDE.md
git commit -m "docs(ai): document lib/ai abstraction layer in CLAUDE.md"
```

---

## Critérios de aceitação (Definition of Done)

- [ ] `lib/ai/{types,retry,registry,index}.ts` e `lib/ai/providers/{gemini,anthropic}.ts` existem e tipo-checam
- [ ] `lib/__tests__/ai/registry.test.ts` passa com 9 testes verdes
- [ ] `npm run test:run` continua verde (sem regressões)
- [ ] `npm run lint` limpo
- [ ] `npm run build` conclui sem erros
- [ ] Nenhuma rota existente teve seu modelo alterado nesta fase (verificar `git diff main -- app/ lib/` — só deve mostrar arquivos novos em `lib/ai/` e `lib/__tests__/ai/`, mais a edição do `CLAUDE.md`)
- [ ] `CLAUDE.md` documenta a camada
- [ ] Smoke test (Task 8) passa ou está skipped por falta de chaves — ambos aceitáveis

## Próxima fase (não faz parte deste plano)

Fase 2: criar golden set de avaliação (50 queries jurídicas com respostas anotadas) + script de avaliação que mede recall@5 e MRR. Sem isso, as fases seguintes (hybrid search, rerank, query understanding) não têm como ser medidas.
