# Backup Gemini API key + erro amigável de quota

**Data:** 2026-06-08
**Autor:** Daniel + Claude
**Status:** Aprovado para implementação

## Contexto

Em 2026-06-08 a busca IA (`/api/documents/query`) retornou 500 nas duas únicas tentativas do dia (~07:59 BRT). Investigação mostrou que a Google AI Studio sinalizou `RESOURCE_EXHAUSTED` (429) na conta do projeto Gemini em produção:

> `Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.`

O handler captura o erro no outer `catch` e devolve 500 genérico. Todo o pipeline RAG e a síntese IA são bloqueados, porque tanto `generateQueryEmbedding` (em `lib/embeddings/gemini-embeddings.ts`) quanto `generate`/`generateStream` (em `lib/ai/providers/gemini.ts`) dependem da mesma `GEMINI_API_KEY`. Não há fallback de provider, e o aluno recebe apenas "Falha na busca com IA".

Impacto observado: 100% de falha na janela em que créditos zeraram. Como o mesmo key alimenta também chat assistente, busca semântica do blog, classificação DOU, relevance-filter da newsletter e clipping AI bullets, esses fluxos provavelmente degradaram em silêncio nos últimos dias.

## Objetivo

Tornar a busca IA resiliente a quota exhausted via duas camadas independentes:

1. **Continuidade operacional** — uma segunda chave (`GEMINI_API_KEY_BACKUP`) é tentada automaticamente quando a primária retorna 429. Se ambas falharem, o sistema degrada graciosamente.
2. **UX amigável** — quando o fallback se exaure, o aluno recebe HTTP 503 (não 500) com mensagem clara que distingue "IA indisponível agora" de "bug". Resultados textuais continuam funcionando via `/api/area-restrita/global-search`, que é endpoint independente.

Fora de escopo (sugestões estruturais separadas):
- Re-indexação com Cohere/Voyage (não funciona sem re-embeddar 1.598 chunks no banco — vetores Gemini 768d e Cohere 1024d vivem em espaços diferentes).
- Alerta proativo de saldo Google AI próximo do limite.
- Dashboard de uso por key.

## Não-objetivos

- Não cobre demais consumidores Gemini (clipping, newsletter, classificação DOU). Cada um tem seu próprio entry point e será endereçado quando/se virar problema separado. Esta mudança encapsula o fallback no wrapper compartilhado, então futuros consumidores migram facilmente.
- Não altera o comportamento atual quando `GEMINI_API_KEY_BACKUP` está ausente — o sistema continua com 1 tentativa só, exatamente como hoje.
- Não troca o status code 500 atual para outros tipos de erro (network, safety, auth). Só o caso `isRateLimitError` ganha 503/evento amigável.

## Arquitetura

### Helper compartilhado novo

`lib/gemini/api-key-fallback.ts`:

```ts
import { isRateLimitError } from '@/lib/ai/error-detection'
import { apiLogger } from '@/lib/logger'

export async function withGeminiKeyFallback<T>(
  fn: (apiKey: string) => Promise<T>,
): Promise<T> {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_BACKUP,
  ].filter((k): k is string => typeof k === 'string' && k.length > 0)

  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  let lastErr: unknown
  for (let i = 0; i < keys.length; i++) {
    try {
      return await fn(keys[i])
    } catch (err) {
      lastErr = err
      const isLast = i === keys.length - 1
      if (isLast || !isRateLimitError(err)) throw err
      apiLogger.warn(
        { keyIndex: i, nextIndex: i + 1 },
        'gemini.key.quota-exhausted, trying backup',
      )
    }
  }
  throw lastErr
}
```

Características:
- Filtragem na entrada garante "1 tentativa só" quando backup não configurado (zero mudança de comportamento).
- Decisão de cascade reusa `isRateLimitError` (já cobre `429`, `RESOURCE_EXHAUSTED`, `quota exceeded`, `rate limit`, `too many requests` — `lib/ai/error-detection.ts:10-20`).
- Log estruturado torna visível no Vercel quando produção passou a depender do backup.
- Aceita qualquer `fn` que receba uma key e devolva uma Promise (genérico T).

### Integração nos dois pontos de uso Gemini

**1. `lib/ai/providers/gemini.ts`** (chat / síntese de busca):

O `getClient()` cacheado é removido. `generate()` e `generateStream()` chamam:

```ts
return withGeminiKeyFallback(async (apiKey) => {
  const client = new GoogleGenAI({ apiKey })
  // ... resto da lógica atual
})
```

Custo de instanciar `GoogleGenAI` por chamada é desprezível (SDK só abre conexão no `.models.generateContent*()`). Cache em memória do client perde a utilidade aqui — cada cold start já reconstruía, e instâncias warm não trocam de key.

**Comportamento mid-stream:** se primary falha **antes** do primeiro chunk (rejeição na promessa `generateContentStream`), wrapper troca de key e tenta backup. Se primary falha **depois** do primeiro chunk (erro no iterator), wrapper propaga sem trocar — backup não dá retry mid-stream porque os tokens já foram entregues ao cliente. Documentado no JSDoc do `generateStream`.

**2. `lib/embeddings/gemini-embeddings.ts`** (RAG):

`getGenAI()` removido. `generateQueryEmbedding()` e `generateEmbeddings()` (batch) usam:

```ts
return withGeminiKeyFallback(async (apiKey) => {
  const client = new GoogleGenAI({ apiKey })
  const result = await client.models.embedContent({ ... })
  return result
})
```

Cache key dos embeddings continua igual — `gemini-embedding-001` é determinístico-suficiente entre projetos.

### Erro amigável no endpoint `/api/documents/query`

**Caminho non-stream** (atualmente linhas 1027-1042 em `app/api/documents/query/route.ts`):

```ts
} catch (error) {
  apiLogger.error({ error }, 'Document query failed')

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
      { status: 503 },
    )
  }

  // 500 path atual para outros erros (sem mudança)
  return NextResponse.json<QueryResponse>(
    { /* payload atual */ },
    { status: 500 },
  )
}
```

`QueryResponse` interface ganha campo opcional `code?: 'QUOTA_EXHAUSTED'`.

**Caminho stream** (atualmente linhas 971-979 — catch dentro do `start()` do ReadableStream):

```ts
} catch (err) {
  apiLogger.error({ error: err }, 'SSE streaming error')

  if (isRateLimitError(err)) {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          type: 'error',
          code: 'QUOTA_EXHAUSTED',
          message: 'Síntese IA temporariamente indisponível por excesso de uso. A busca textual segue funcionando — tente novamente em alguns minutos.',
        })}\n\n`,
      ),
    )
  } else {
    // fallback atual (token genérico)
    const fallback = 'Não consegui sintetizar uma resposta agora...'
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: fallback })}\n\n`))
  }
  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
}
```

Quando quota exhaustion é detectada **antes** do `return new Response(stream, ...)` (no `hybridSearch`, `prisma.document.findMany` complementary etc.), o outer catch já trata como non-stream e devolve 503 — o stream nem chega a iniciar. Isso é importante porque o caller (frontend) só verá o erro como HTTP status nessa janela.

### Frontend (`hooks/use-global-search.ts`)

Branch novo paralelo ao 429 existente (`hooks/use-global-search.ts:205`):

```ts
if (response.status === 503) {
  const body = await response.json().catch(() => ({}))
  if (body?.code === 'QUOTA_EXHAUSTED') {
    setAiError(body.error || 'Síntese IA indisponível no momento.')
    setAiAnswer(null)
    setAiSources([])
    setAiLegalSources([])
    return
  }
}
```

No loop SSE, detecção do evento de erro:

```ts
if (parsed.type === 'error' && parsed.code === 'QUOTA_EXHAUSTED') {
  setAiError(parsed.message || 'Síntese IA indisponível no momento.')
  setAiAnswer(null)
  break
}
```

O componente `AIAnswerCard` em `components/area-restrita/SearchResultsList.tsx` já lê `aiError` e exibe a mensagem — sem mudança visual nova.

## Plano de testes

`lib/gemini/__tests__/api-key-fallback.test.ts` (4 casos):

1. Sem `GEMINI_API_KEY` configurado → `fn` não é chamada, throw com mensagem clara
2. Primary disponível, retorna OK → `fn` invocada 1 vez com primary key, backup nunca usada
3. Primary lança 429 (`RESOURCE_EXHAUSTED`), backup OK → `fn` invocada 2 vezes (primary depois backup), resultado vem do backup, log warn emitido
4. Primary 429, backup 429 → throw com o erro do backup (último), 2 invocações

`app/api/documents/query/__tests__/quota-exhausted.test.ts` (2 casos):

1. Mock de `generateQueryEmbedding` lançando erro com mensagem `'429 RESOURCE_EXHAUSTED'` → POST com `stream: false` recebe HTTP 503, body inclui `code: 'QUOTA_EXHAUSTED'` e a mensagem amigável
2. Mock de `generateStream` (em `lib/ai`) lançando 429 com `stream: true` no payload → recebe HTTP 200 (SSE já iniciado nesse ponto), primeiro evento SSE é `{type:'error', code:'QUOTA_EXHAUSTED'}`, seguido de `[DONE]`. Mock em `generateQueryEmbedding` no caminho streaming cai no outer catch (não chega ao SSE) → retorna 503, coberto pelo teste 1 implicitamente.

Testes existentes em `lib/embeddings/__tests__/vector-search.test.ts` e `lib/ai/__tests__/*` continuam passando (mocks já cobrem `GoogleGenAI`).

## Observabilidade

- `apiLogger.warn({ keyIndex, nextIndex }, 'gemini.key.quota-exhausted, trying backup')` — sinal que dispara no Vercel quando produção passa a depender do backup. Útil para diagnosticar o dia em que primária esgotar de novo.
- `apiLogger.error({ error }, 'Document query failed')` existente continua. Soma o `code` no payload da resposta, então também aparece no log do request.
- Sem dashboard novo — fora de escopo.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Cache key não diferencia primary/backup | Aceito. Modelo Gemini determinístico → mesmo input gera embedding idêntico. Se trocarmos modelo entre keys no futuro, revisar. |
| Backup também esgota | Comportamento idêntico ao "sem backup" hoje: 503/evento amigável. Aluno vê mensagem clara. |
| Erro mid-stream após tokens entregues | Wrapper só faz cascade na iniciação. Mid-stream propaga sem trocar key (documentado no JSDoc do `generateStream`). |
| Concorrência alta após primary esgotar | ~30 chamadas/dia hoje. Mesmo com burst de 100 simultâneos depois de primary morrer, backup aguenta. Não precisa rate-limit local entre keys. |
| Refactor de `getClient()` cacheado pode quebrar testes existentes | Testes do `lib/ai/providers/gemini.ts` mockam `GoogleGenAI` no nível do módulo, não dependem da função `getClient`. Revisado durante implementação. |

## Plano de rollout

PR único com 4 commits atômicos:

1. `feat(gemini): wrapper de fallback entre GEMINI_API_KEY e GEMINI_API_KEY_BACKUP` — helper + 4 testes
2. `refactor(gemini): providers e embeddings usam api-key fallback wrapper` — modifica `lib/ai/providers/gemini.ts` e `lib/embeddings/gemini-embeddings.ts`
3. `feat(busca-ia): 503 amigável quando Gemini quota esgota` — modifica `app/api/documents/query/route.ts` e `hooks/use-global-search.ts`; adiciona teste do endpoint
4. `chore(docs): documenta GEMINI_API_KEY_BACKUP opcional` — `.env.example` e `CLAUDE.md`

Sem deploy intermediário. Após merge, auto-deploy padrão (~4min). Validar em produção:

- Endpoint `/api/documents/query` responde 200 normalmente para queries válidas (primary key ativa)
- Forçar 503: temporariamente apontar `GEMINI_API_KEY` para uma chave inválida e deixar `GEMINI_API_KEY_BACKUP` vazio → endpoint deve retornar 503 com `code: 'QUOTA_EXHAUSTED'`, não 500
- Reverter env vars

Rollback: revert do PR (4 commits em squash → 1 revert). Behavior pre-PR é restaurado integralmente porque o wrapper é aditivo.
