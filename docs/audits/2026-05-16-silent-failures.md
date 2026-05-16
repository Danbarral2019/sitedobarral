# Auditoria de Falhas Silenciosas — 2026-05-16

> **Motivação:** após corrigir um bug no `LeiIndexer` que vinha sabotando ~80% da catalogação de `leiArticles` há meses sem alarme, surgiu a pergunta: o que mais está falhando silenciosamente?
>
> Três agents independentes auditaram (1) modelos de IA hardcoded e thinking budget, (2) saúde de scrapers/crons e estado do banco, (3) integrações externas e webhooks. Relatório consolidado.

## Sumário executivo

- **30+ problemas identificados**, distribuídos em P0 (crítico, sintoma ativo em produção), P1 (importante) e P2 (cosmético).
- **Padrão comum a quase todos:** ausência de telemetria estruturada (467 `console.error` vs 7 `Sentry.captureException` no codebase — ratio 67:1).
- **Lição transversal:** todo cron que escreve em DB deveria gravar `ScraperHealthLog` na entrada e na saída. Hoje 32% dos crons (8/25) têm essa proteção.

---

## P0 — Críticos (sintoma ativo, agir esta semana)

### P0.1 — Bugs com mesmo perfil do LeiIndexer (Gemini thinking sem `thinkingBudget: 0`)

Modelos Gemini 2.5+ / 3.x consomem ~1.500 tokens em raciocínio interno antes do output visível. Sem `thinkingConfig.thinkingBudget: 0`, com `maxOutputTokens` baixo, o JSON sai truncado, `JSON.parse` falha, catch silencioso retorna fallback. Casos confirmados como vulneráveis (provavelmente quebrando hoje):

| Arquivo:linha | `maxOutputTokens` | Sintoma esperado |
|---|---|---|
| `lib/dou-classifier.ts:493` | 256 | Classificação DOU pode estar 100% no fallback; catch silencioso (linha 538+) |
| `lib/embeddings/reranker.ts:132` | 512 | Reranker colapsa para ordem original — degradação silenciosa de relevância |
| `lib/tribunal-scrapers/classifier.ts:266` | 300 | Sumário tribunais — texto, mas abaixo do thinking footprint típico |
| `lib/tribunal-scrapers/classifier.ts:315` | 512 | JSON classificação + status — trunca |
| `app/api/documents/query/route.ts:210` | 256 | Query expansion → fallback `expanded=[]` em catch silencioso linha 232 |
| `app/api/admin/gemini-test/route.ts:39` | 20 | Endpoint admin sempre retorna string vazia com modelo 3.x |

**Correção estrutural recomendada:** trocar default em `lib/gemini/cached-client.ts:233` de `thinkingBudget = undefined` para `= 0`. Vira opt-in para thinking, não opt-out. Elimina toda a classe de bug.

**Já corrigidos** (referência): `lib/lei-indexer.ts`, `lib/tcu-enrichment.ts`, `lib/document-enrichment.ts`, `lib/conuni-classify.ts`, `lib/conuni-summary.ts`, `lib/dou-editorial-classifier.ts`, `lib/tcu-highlight-analyzer.ts`, `lib/tribunal-highlight-analyzer.ts`, `lib/clipping/ai-bullets.ts`, `lib/newsletter/relevance-filter.ts`, `lib/newsletter/intro-generator.ts`, `app/api/lei-14133/search/route.ts`, `app/api/documents/query/route.ts:609`, `app/api/artigos/[numero]/chat/route.ts`.

### P0.2 — Modelos Claude geração antiga com catch silencioso

| Arquivo:linha | Modelo hardcoded | Sintoma |
|---|---|---|
| `lib/tcu-classifier.ts:96` | `claude-3-5-sonnet-20241022` (out/2024) | Catch → `classifyWithRules` fallback heurístico. Classificações TCU podem estar 100% heurísticas há semanas. Apenas `console.error` |
| `lib/claude-classifier.ts:164` | `claude-3-5-haiku-20241022` (out/2024) | `return null` silencioso, sem Sentry. Mesma classe do `claude-analyzer.ts` deletado |

Ambos deveriam migrar para `resolveTask('classification')` que aponta para `claude-haiku-4-5-20251001` no registry.

### P0.3 — Crons parados há meses

Detectado por comparar último `uploadedAt`/timestamp por categoria contra a frequência esperada:

| Cron | Schedule | Última evidência | Atrasado |
|---|---|---|---|
| `sync-tcu-informativos` | seg 5h | `informativo` em 2026-02-16 | **89 dias** |
| `sync-tcu-manual` | mensal | `manual-tcu` em 2026-02-09 | **96 dias** (3 runs perdidos) |
| `process-index-jobs` | a cada 15 min | último `IndexJob` em Nov-2025 | **MORTO** |
| `summarize-conuni` | mensal | 1.669 docs CONUNI sem `summary` | **Não popula** |
| `compute-streaks` | diário | `UserStreak.updatedAt` em 2026-03-26 | **51 dias** — gamificação LMS sem efeito |
| `sync-dou-atos-normativos` (parcial) | diário | `LeiArticleNote` com 0 registros | **Detector de alterações não cria notas** |

Os 17+ outros crons sem `ScraperHealthLog` podem ter problemas similares não detectáveis sem instrumentação.

### P0.4 — Webhooks vulneráveis

**`app/api/webhooks/resend/route.ts`** — sem validação Svix (Resend usa headers `svix-id`, `svix-timestamp`, `svix-signature`). Qualquer POST com JSON válido pode:
- Marcar subscribers como `isActive: false` (linha 31)
- Inflar contadores de `clicks` (linha 44)

Sem Sentry, sem `apiLogger`, sem dedup por `svix-id`. Apenas `console.log/error`. Risco real de vandalismo ou bug de integração não detectado.

**Referência boa** (replicar padrão): `app/api/pagamento/webhook/route.ts` (Stripe) — valida `constructEvent`, fail-closed em secret faltando, dedup via `ProcessedWebhookEvent`, rollback em falha, `apiLogger.error/warn` com contexto.

### P0.5 — Cron de monitoring-alerts não checa erro do Resend

`app/api/cron/monitoring-alerts/route.ts:114` — envia email de alerta via `resend.emails.send` sem checar `result.error`. Se o Resend devolver erro silencioso, o admin nunca é notificado dos próprios alertas. **Ironia perfeita: o cron de detectar falhas pode estar falhando sem detecção.**

CLAUDE.md já alerta: "Resend SDK retorna `{data, error}`, não lança exceções."

### P0.6 — Estado dos embeddings

- `Document.embeddingStatus`:
  - `completed`: 6.320 (99.9%)
  - `failed`: 3 (R2 missing — `Acórdão 2550/2025`, parecer CONUNI, ON 77/2023)
  - `pending >7d`: 0

- `TribunalDecision.embeddingStatus`:
  - `completed`: 546
  - `pending`: **372** (aging — mais antigo de 2026-02-19, **>85 dias parado**)
  - `failed`: 1

Causa: `process-index-jobs` morto (P0.3). Embeddings de `TribunalDecision` dependem do fallback `pendingDecisions` no cron, que não está sendo executado.

---

## P1 — Importantes (próximas semanas)

### P1.1 — Default global `thinkingBudget: 0` no `cached-client`

Atualizar `lib/gemini/cached-client.ts:233-237` para `thinkingBudget = 0` por padrão. Atualizar os 2-3 sites que precisam de thinking (chat artigos premium, etc.) para explicitar `thinkingBudget: undefined`.

### P1.2 — Migrar chamadas Anthropic diretas para `lib/ai/generate()`

Arquivos que chamam `anthropic.messages.create` direto, sem o wrapper de retry/logging:

- `lib/tcu-classifier.ts:95`
- `lib/summary-generator.ts:57`
- `lib/claude-classifier.ts:163`
- `lib/ai/document-enhancer.ts:102` (já `@deprecated` na PR #8; quando deletado de vez, fim do problema)

### P1.3 — Timeouts em fetches externos

- `lib/conuni-sync.ts:144` — sem `AbortSignal`/timeout. Server CONUNI travado bloqueia o cron até timeout do runtime
- `lib/agu-modules/{pareceres-conuni.ts:68, pareceres-vinculantes.ts:63, sumulas.ts:45, orientacoes-normativas.ts:64}` — todos `fetch(...)` cru sem timeout/retry

Wrapper `fetchWithRetry` já existe em `lib/tribunal-scrapers/utils.ts:39`. Padronizar uso.

### P1.4 — Backlog de catalogação

- **4.987 docs** com `leiIndexedAt IS NULL` ainda não tocados pelo backfill (que está rodando só nas categorias prioritárias)
- **123/262 atos legislativos** sem `themes` (cron `enrich-themes` lento — `TAKE_LIMIT=20` semanal)
- **85 `DOUStagingDocument` pending** acumulados (aguardando revisão admin ou auto-aprovação por idade)

### P1.5 — `email.ts` quando `RESEND_API_KEY` faltar

`lib/email.ts:78` — hoje só `console.warn`. Em produção deveria virar `Sentry.captureMessage` severity warning.

### P1.6 — Adicionar `Sentry.captureException` aos crons

Crons que hoje só fazem `console.error` no catch fatal:
- `sync-conuni`, `sync-tcu-acordaos`, `sync-dou-atos-normativos`, `lms-inactivity`, `monthly-newsletter`, `check-legislative-updates`

Cron retornando 500 não dispara alerta sozinho — sem Sentry, falha silenciosa.

### P1.7 — Catch silenciosos críticos

Top 5 dos 138 ocorrências em `lib/` + `app/api/`:

1. `lib/tcu-classifier.ts:122-128` — classifica acórdãos TCU; erro → `classifyWithRules`. Sem Sentry.
2. `lib/claude-classifier.ts:193-196` — `return null` silencioso, modelo antigo.
3. `lib/summary-generator.ts:86-89` — gera resumo IA → `null`. Usuário vê doc sem resumo sem saber porquê.
4. `lib/clipping/ai-bullets.ts:110-112, 159-162` — clipping diário TCU em produção; parse JSON falha → `[]`. Email diário pode ir sem bullets sem alarme.
5. `lib/tribunal-highlight-analyzer.ts:201-203` e `lib/tcu-highlight-analyzer.ts:156-158` — análise de highlights → `null`. Visual degradado sem trace.

---

## P2 — Cosméticos / consistência

### P2.1 — Substituir `console.error` por `apiLogger.error` nos crons

Ratio 467:7 (`console.error` vs `Sentry.captureException`). Pino já configurado. Gap enorme.

### P2.2 — CLAUDE.md vs código atual

CLAUDE.md fala de Mercado Pago mas `lib/stripe.ts` está ativo em produção. Atualizar doc ou consolidar — confusão semântica.

### P2.3 — Modelos AI obsoletos em arquivos arquivados

- `scripts/.archived/test-claude-api.js:65` — `claude-3-haiku-20240307` (descontinuado)
- `scripts/.archived/update-act-titles.ts:24` — `gemini-2.0-flash` (deprecação 2026-06-01)
- `FUNCIONALIDADES_FUTURAS/analise-ia/claude-analyzer.ts:110` — `claude-3-haiku-20240307`
- `scripts/import-tcu-precedentes.ts:436` — `claude-3-5-haiku-20241022` (geração antiga)

Risco runtime baixo (arquivados), mas confunde grep. Deletar ou atualizar comentário.

### P2.4 — `app/api/admin/gemini-test/route.ts:41`

`maxOutputTokens: 20` retorna sempre vazio com `gemini-3-flash-preview`. Aumentar para ≥1024 e adicionar `thinkingBudget: 0` — endpoint de ping inútil hoje.

### P2.5 — Tabelas dormentes

- `FAQ` (0 registros) — feature implementada mas nunca populada. Confirmar se é viva.
- `DocumentAnalysis` (0 registros) — descartado pela PR #9 que deleta `lib/analytics-tracker.ts`. Tabela pode ser dropada no futuro.
- 3 `Document.embeddingStatus='failed'` antigos (R2 missing) — limpar ou re-tentar.

### P2.6 — `Document.themes` em 6.323/6.323

Nenhum cron popula. Confirmar se feature está rolada ou se é débito de produto.

### P2.7 — `lib/storage/r2-client.ts`

Validação lazy (`validateR2Config()`). Faltar config em prod só aparece no primeiro request real. Adicionar `Sentry.captureMessage` quando falhar.

### P2.8 — Rate limiting em webhooks

Webhooks Stripe e Resend não têm rate limit. `lib/cache/rate-limit-helper.ts` já existe. Adicionar para prevenir replay storms.

---

## Lição transversal

Todo o codebase ganharia de uma instrumentação padronizada:

```typescript
// Padrão proposto para crons:
const healthLog = await prisma.scraperHealthLog.create({
  data: { scraper: 'sync-tcu-acordaos', status: 'started', startedAt: new Date() },
});
try {
  // ... lógica do cron
  await prisma.scraperHealthLog.update({
    where: { id: healthLog.id },
    data: { status: 'success', finishedAt: new Date(), itemsProcessed: count },
  });
} catch (error) {
  Sentry.captureException(error, { tags: { cron: 'sync-tcu-acordaos' } });
  await prisma.scraperHealthLog.update({
    where: { id: healthLog.id },
    data: { status: 'failed', finishedAt: new Date(), error: String(error).slice(0, 500) },
  });
  throw error; // re-lança para o cron retornar 500
}
```

Aplicar isso aos 17 crons sem `ScraperHealthLog` evitaria 90% dos casos de "falha silenciosa por meses sem detectar".

---

## Conexão com a sessão atual

Esta auditoria foi disparada pela investigação que motivou:

- **PR #8** (`fix/lei-indexer-consolidation`): corrigiu o bug original do LeiIndexer + criou `wizardEnhance` + rastreabilidade `leiIndexedAt`/`leiIndexerError` + backfill dos órfãos
- **PR #9** (`fase5/unify-document-analyzer`): eliminou o Sistema D legado (cadeia paralela com modelo Claude obsoleto), -1.940 LOC de duplicação

Esta auditoria é o **passo seguinte natural**: agora que sabemos que essa classe de bug existe e que a observabilidade é insuficiente, listar todos os outros candidatos antes que sejam descobertos por acidente.

---

**Próximos passos sugeridos** (decisão do PO):

1. Priorizar P0.1 (thinkingBudget global) e P0.4 (webhook Resend) — risco real e fix barato
2. Investigar P0.3 caso-a-caso (crons parados) — pode haver bugs específicos
3. P0.6 (TribunalDecision embeddings) precisa decisão sobre o `process-index-jobs` (revisar ou deletar?)
4. P1.6 (Sentry nos crons) destrava toda a observabilidade futura — sem isso, a próxima Fase 6 vai descobrir N novos problemas pela mesma falta de telemetria.
