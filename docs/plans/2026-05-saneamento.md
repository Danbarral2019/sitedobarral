# Plano de Saneamento — 2026-05 a 2026-08

> **Contexto:** consolida as ações para resolver os ~80 achados das duas auditorias de 2026-05-16:
> - [`docs/audits/2026-05-16-silent-failures.md`](../audits/2026-05-16-silent-failures.md) (30+ falhas mascaradas)
> - [`docs/audits/2026-05-16-structural-debt.md`](../audits/2026-05-16-structural-debt.md) (50+ dívidas estruturais)
>
> **Princípio mestre:** o erro mais comum em projeto acumulado é "começar a refatorar tudo" e travar em mudanças concorrentes. Este plano evita isso seguindo 3 regras: **observabilidade antes de fix, ondas independentes, cada PR reversível em 1 comando**.

---

## Princípios de segurança

1. **Observabilidade vem antes de qualquer outro fix.** Sem Sentry + ScraperHealthLog universais, nenhuma correção é verificável — mesma lição do bug do LeiIndexer que ficou meses invisível.
2. **Cada PR pequena e isolada** — máximo ~500 LOC. Conflitos crescem exponencial com tamanho.
3. **Schema sempre backward-compat** — só adicionar campos NULLABLE, nunca DROP ou rename. Drops vão em PR separada após N semanas de monitoramento.
4. **Mudanças de comportamento atrás de env var/feature flag** — permite rollback instantâneo sem deploy.
5. **Instrumentar baseline antes** de cada onda — medir taxa de erro / latência / cobertura ANTES, comparar DEPOIS.
6. **Trunk-based**: 1 branch por PR, merge para `main`, sem branches longas.

---

## Visão geral em 6 ondas

| Onda | Duração | Foco | Risco | Entrega de valor |
|---|---|---|---|---|
| **0. Preparação** | 1 dia | Mergear PRs abertas, finalizar backfill | Mínimo | Imediato |
| **1. Observabilidade universal** | 3-5 dias | Sentry + ScraperHealthLog em tudo | Baixo | Toda falha futura visível em <24h |
| **2. Wins rápidos** | 1 dia | regions, Cache-Control, deps, órfãos | Muito baixo | Latência -200ms, TTFB -450ms |
| **3. Bugs P0 ativos** | 3-5 dias | thinkingBudget global, modelos antigos, crons parados | Médio | Restaura features quebradas |
| **4. Padronização** | 2 semanas | 196 rotas → Fase 8, `lib/ai` adotado, JSON→String[] | Médio | Reduz superfície de bug em 70% |
| **5. Podar features mortas** | 1 semana | Decisões produto + arquivamento | Baixo | Schema -20 models, mente leve |
| **6. Refactor estrutural** | 2-3 semanas | Componentes >800 linhas, Server Components, CLAUDE.md | Médio | Manutenibilidade futura |

**Total: ~6-8 semanas calendar**, executável em paralelo a desenvolvimento de features. Cada onda pode pausar se surgir prioridade.

---

## Onda 0 — Preparação

**Estado em 2026-05-16:** 3 PRs abertas, backfill em ~88%. Verificar e mergear:

- [ ] PR #10 (docs) — risco zero, mergear primeiro
- [ ] PR #8 (LeiIndexer fix + wizardEnhance) — testado manualmente, mergear após PR #10
- [ ] PR #9 (consolidação Sistema D, -1.940 LOC) — precisa teste manual em `/admin/docs?tab=central`, mergear depois
- [ ] Backfill completar e validar nova cobertura `leiArticles` global (esperado: ≥80%)

**Critério de sucesso:** 3 PRs mergeadas, backfill concluído, cobertura sobe de 58,7% → ≥80%.

---

## Onda 1 — Observabilidade universal

> **Por que primeiro:** sem isso, ondas 3-6 vão criar bugs invisíveis. Investir aqui paga juros em todo o resto.

### PR 1.1 — Helper `withCronTelemetry` (1 dia)
Criar `lib/cron-telemetry.ts` exportando wrapper que automaticamente:
- Cria `ScraperHealthLog` na entrada (status: 'started')
- Captura exceção com `Sentry.captureException(error, { tags: { cron: name } })`
- Atualiza `ScraperHealthLog` na saída (status: success/failed, error message truncada)
- Re-lança erro para o handler retornar 500 corretamente

Critério: 1 cron migrado como prova (sugerido: `sync-tcu-acordaos`), com teste unitário.

### PR 1.2 — Migrar 17 crons restantes (2 dias)
Aplicar `withCronTelemetry` nos 17 crons sem `ScraperHealthLog`. **Cada cron em commit separado** (rollback granular). Lista:
- `sync-conuni`, `classify-conuni`, `summarize-conuni`
- `import-documents`, `import-dou`
- `monthly-newsletter`, `notify-new-documents`
- `lms-inactivity`, `compute-streaks`
- `check-legislative-updates`, `enrich-themes`
- `daily-tcu-clipping`, `clipping-health-check`
- `monitoring-alerts`, `revalidate-acervo`, `cleanup-orphaned-files`, `process-index-jobs`

### PR 1.3 — Webhook Resend com Svix (0.5 dia)
- Adicionar validação `svix-signature` em `app/api/webhooks/resend/route.ts`
- Dedup via `svix-id` em `ProcessedWebhookEvent` (tabela já existe)
- Adicionar Sentry + `apiLogger.warn/error`

### PR 1.4 — Cron monitoring-alerts (0.5 dia)
`app/api/cron/monitoring-alerts/route.ts:114` — checar `result.error` do Resend. Dispara `Sentry.captureMessage` se email falhar.

### PR 1.5 — Codemod `console.error → apiLogger.error` (1 dia)
Codemod simples para os 263 `console.error` em `app/` e `lib/`. PR grande em LOC mas trivial: troca direta sem mudança semântica. Mantém `console.log` (uso intencional em scripts).

**Critério de sucesso da Onda 1:**
- Ratio `console.error : Sentry.captureException` cai de 67:1 para <5:1
- Todos os 25 crons têm `ScraperHealthLog`
- Próximo bug silencioso é detectado em <24h via Sentry

---

## Onda 2 — Wins rápidos

5 PRs pequenas com valor imediato. Pode rodar em paralelo da Onda 1.

### PR 2.1 — `regions: ["gru1"]` no vercel.json (5 min)
Functions vão para São Paulo, próximo do Neon DB (sa-east-1). **Impacto:** latência DB -100/-200ms por query.

### PR 2.2 — Fix Cache-Control global (1h)
- Remover header `Cache-Control: no-store` blanket em `next.config.ts:159`
- Adicionar `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` por rota nas leituras públicas idempotentes (testimonials, glossary, lei-14133/articles, course-videos, faq, recommended-sites)
- **Impacto:** TTFB ~500ms → ~50ms via CDN para usuários repetidos

### PR 2.3 — Remover deps mortas (30 min)
```bash
npm uninstall video.js @types/video.js docx html2canvas pino-pretty
npm install --save-dev playwright
```
**Reversão:** `npm install` os pacotes.

### PR 2.4 — Pausar crons sem demanda (15 min)
- Comentar (não deletar) `schedule` de `process-index-jobs`, `compute-streaks`, `lms-inactivity` no `vercel.json`
- Adicionar TODO com critério de reativação (ex: "reativar quando ≥10 quizzes criados")

### PR 2.5 — Limpeza de artefatos órfãos (1h)
- Deletar 14 componentes confirmados sem importadores (lista no relatório de structural debt)
- Deletar `app/area-restrita/page.tsx.backup` e `data/lei-14133-artigos.backup-2026-05-01.ts`
- Adicionar ao `.gitignore`:
  - `data/backups/`
  - `*.json` no root (deixar específicos com nome explícito)

**Critério de sucesso da Onda 2:** Métricas Vercel mostram redução de latência. Bundle analyzer mostra deps removidas. Repo mais limpo.

---

## Onda 3 — Bugs P0 ativos

Agora com observabilidade, mexer em código com confiança.

### PR 3.1 — `thinkingBudget: 0` global no cached-client (0.5 dia)
Mudar default em `lib/gemini/cached-client.ts:233` de `undefined` → `0`. Identificar e marcar explicitamente os 2-3 sites que dependem de thinking (chat premium). **Impacto:** elimina toda a classe de bug do LeiIndexer prospectivamente.

### PR 3.2 — 6 call-sites Gemini vulneráveis (0.5 dia)
Verificar se PR 3.1 já cobriu. Caso não (alguns call-sites podem bypassar o cached-client), adicionar explicitamente:
- `lib/dou-classifier.ts:493`
- `lib/embeddings/reranker.ts:132`
- `lib/tribunal-scrapers/classifier.ts:266` e `:315`
- `app/api/documents/query/route.ts:210`
- `app/api/admin/gemini-test/route.ts:39`

### PR 3.3 — Modelos Claude antigos (1 dia)
- `lib/tcu-classifier.ts:96` — `claude-3-5-sonnet-20241022` → `claude-haiku-4-5-20251001`
- `lib/claude-classifier.ts:164` — `claude-3-5-haiku-20241022` → `claude-haiku-4-5-20251001`
- Sem migração para `lib/ai/` ainda (vem na onda 4)
- Validar manualmente que classificações continuam coerentes

### PR 3.4 — Investigar crons parados (2 dias)
Com `ScraperHealthLog` agora populado (Onda 1), debugar cada cron:
- `sync-tcu-informativos` (89d parado)
- `sync-tcu-manual` (96d parado)
- `process-index-jobs` (morto desde Nov-2025) — decisão: corrigir ou deletar definitivamente
- `summarize-conuni` (não popula 1.669 docs sem summary)

Cada um vira PR específica.

### PR 3.5 — Backfill expandido (1 dia)
Estender `backfill-lei-articles-orphans.ts` (script criado na PR #8) para incluir as 4.987 docs com `leiIndexedAt IS NULL` (não só órfãos prioritários). Custo estimado: ~$5 Gemini.

**Critério de sucesso da Onda 3:** Sentry detecta 0 erros de truncamento Gemini em 1 semana. Crons parados de volta à rotina. Cobertura `leiArticles` ≥95%.

---

## Onda 4 — Padronização

> **Por que agora:** com observabilidade + bugs críticos corrigidos, padronizar sem medo.

### PR 4.1 — Documento de design "Padrão API" (1 dia, sem código)
Definir formalmente: `lib/api-middleware.withAdminAuth` vs `lib/errors/handleApiError` — escolher um. Sugestão: criar `withAdminApiHandler` que combina ambos (auth + erros semânticos + Sentry). Sem código ainda — apenas alinhamento e exemplo de migração.

### PR 4.2 — Codemod das 196 rotas (4 dias)
Script automatizado convertendo `NextResponse.json({error}, {status})` em `throw new XError() + handleApiError`. Aplicar em **20 rotas por PR** (10 PRs pequenas) para revisão incremental.

**Risco:** médio — pode quebrar contract de error response em algum lugar específico. **Mitigação:** testes E2E nas rotas mais críticas antes do codemod (login, checkout, webhook).

### PR 4.3 — Adoção da `lib/ai` (3 dias, 1 PR por arquivo)
Migrar 6 call sites:
- `lib/tcu-classifier.ts`
- `lib/claude-classifier.ts`
- `lib/summary-generator.ts`
- `lib/dou-classifier.ts`
- `lib/conuni-summary.ts`
- `lib/embeddings/gemini-embeddings.ts`

Cada migração valida com smoke test (similar ao que foi feito com LeiIndexer).

### PR 4.4 — Migrar JSON-string → String[] (2 dias)
- Schema: `leiArticles String?` → `leiArticles String[]` em `Document`, `LegislativeAct`
- Migração de dados: script idempotente convertendo JSON-strings em arrays
- Adaptar queries em `legislative-acts/route.ts`, `lib/lei-14133/queries.ts`, `artigos/[numero]/chat/route.ts`, `tribunal-decisions/route.ts`
- **Impacto:** queries de 800ms → 30ms (elimina full-table-scan)
- **Risco:** médio (mudança de schema + queries). Testar em staging primeiro.

### PR 4.5 — Performance LMS analytics (0.5 dia)
`admin/lms/analytics/route.ts`: paralelizar queries sequenciais + trocar N+1 do quizStats por `groupBy`. Dashboard 5s → <1s.

### PR 4.6 — Single-flight em `withCache` (0.5 dia)
Adicionar `SETNX` lock no Upstash em `lib/cache/redis-client.ts:674`. Evita stampede no Gemini em horário de pico.

**Critério de sucesso da Onda 4:**
- 100% das rotas usam padrão Fase 8
- `lib/ai` tem ≥6 consumidores
- Queries de Lei 14.133 sub-segundo

---

## Onda 5 — Podar features mortas

> **Por que agora:** Onda 4 simplificou o que era para ficar. O que sobrou: decidir o que jogar fora.

### PR 5.1 — Documento de decisões de produto (0.5 dia, sem código)
Para cada feature 80% pronta inativa: **manter+divulgar OU arquivar**?

- **Planejamento** (17 rotas, 6 models, 1 sessão real em 7 meses)
- **Quizzes LMS** (admin + player, 0 quizzes)
- **FAQ** (schema + busca FTS, sem páginas)
- **Vídeos** (`CourseVideo`/`LessonVideo`, 0 cadastrados)
- **Cross-refs Lei 14.133** (admin + API, 0 entries)
- **DOUSavedFilter** (admin existe, 0 filtros salvos)
- **Social media posts** (APIs existem, 2 posts em 7 meses)

Sem código. Apenas decisões registradas em `docs/decisions/2026-05-feature-triage.md`.

### PR 5.2 — Arquivar features escolhidas (2 dias)
Para cada decisão "arquivar":
- Deletar rotas e componentes
- Mover backend admin para `app/admin/_archived/`
- **NÃO deletar models do schema ainda** — fazer drop em PR separada após 4 semanas de monitoramento (PR 5.5)
- Atualizar CLAUDE.md removendo menção

### PR 5.3 — Consolidar admins duplicados (3 dias)
- Decisão: `/admin/docs` (hub com tabs) é o canônico
- Deletar `/admin/documentos/page.tsx` e `/admin/adicionar-documentos/page.tsx` (já redirecionam, mas códigos vivos confundem)
- Idem `/admin/analytics-hub/page.tsx` (wrapper inútil que faz `dynamic(import('../analytics/page'))`)
- Idem `/admin/tcu*` — manter `/admin/tcu` (hub), arquivar os outros 2

### PR 5.4 — AGU scraper v1 → v4 (1 dia)
- Migrar `cron/import-documents/route.ts` de `lib/agu-scraper.ts` para `lib/agu-scraper-v4.ts`
- Deletar `lib/agu-scraper.ts` v1
- Consolidar `/api/admin/scrape-agu` e `/api/admin/agu-import` (escolher um)

### PR 5.5 — Drops de schema (após 4 semanas de monitoramento)
DROP TABLE dos models confirmados mortos (sem nenhum INSERT em 4 semanas pós-arquivamento): `DocumentAnalysis`, `FAQ` (se decisão foi arquivar), models de Planejamento, etc. **Migration Prisma com warning explícito.**

**Critério de sucesso da Onda 5:**
- Schema reduz de 70 para ~50 models
- ~6.500 LOC de duplicação removidas
- Cada feature ativa tem usuário real OU está formalmente arquivada

---

## Onda 6 — Refactor estrutural

> **Por que por último:** com tudo padronizado, refactor é menos arriscado.

### PR 6.1 — Quebrar componentes >800 linhas (1-2 semanas, 1 por PR)
Por ordem de impacto:
- **Unificar** `area-restrita/lei-comentada/page.tsx` (1.607) e `lei-14133/LeiComentadaClient.tsx` (847) — mesma feature
- `dou-filtros/DOUFiltrosClient.tsx` (1.330) — quebrar em sub-componentes
- `lms/[courseId]/ModuleManagerClient.tsx` (1.040)
- `tcu-manager/TCUManagerClient.tsx` (965)
- `tribunal-decisions/TribunalDecisionsClient.tsx` (897)
- `legislacao/page.tsx` (1.000) — converter para Server Component híbrido

### PR 6.2 — Server Components (3 dias)
Migrar 5-6 páginas client para Server Components:
- `app/area-restrita/meu-progresso/page.tsx`
- `app/area-restrita/historico/page.tsx`
- `app/area-restrita/favoritos/page.tsx`
- `app/area-restrita/meus-certificados/page.tsx`
- Shell de `app/(acervo)/jurisprudencia/`

### PR 6.3 — Atualizar CLAUDE.md (1 dia)
Corrigir 10 discrepâncias documentadas:
- 26 → 70 models (ou contagem real pós-Onda 5)
- Remover referência a `RESEND_SETUP_COMPLETO.md` inexistente
- Remover menção a `AuditLog` "aguarda criação"
- Corrigir FUTURE_TASKS T15 (glossário já existe)
- Atualizar lista de "Recent Features" com estado pós-saneamento
- Refletir Stripe (não Mercado Pago) onde apropriado
- Corrigir `lib/newsletter.ts:15` (campo `mailchimpId` que não existe)

**Critério de sucesso da Onda 6:**
- Nenhum componente >800 linhas
- Bundle First Load JS médio reduzido (medir via `npm run analyze`)
- CLAUDE.md reflete realidade

---

## Governança e risco

### Regra de pausa
Se qualquer onda introduzir bug em produção (detectado via Sentry — agora universal pós-Onda 1), **pausar todas as outras ondas** até root cause identificado.

### Branching
- 1 PR = 1 escopo do plano
- Nomear branches: `wave1/<descricao-curta>`, `wave2/...`
- Reviewer: dono do site + Claude no PR description com contexto

### Métricas a acompanhar semanalmente
- Errors no Sentry (deve descer)
- Latência p95 de rotas API (deve descer com Onda 2 e 4)
- Cobertura `leiArticles` (deve estabilizar ≥95% após Onda 3)
- LOC total do repo (deve descer com Ondas 5 e 6)
- Bundle First Load JS (deve descer com Onda 6)

### Critério de "feito" do plano inteiro
- 0 P0 da auditoria de silent failures aberto
- 0 P0 da auditoria de structural debt aberto
- Sentry detecta o próximo bug em <24h (não em meses)
- CLAUDE.md alinha 100% com código

---

## Dependências entre ondas

```
Onda 0 (preparação)
    ↓
Onda 1 (observabilidade) ──┐
    ↓                       │
Onda 2 (wins rápidos)       │  paralelo com 1
    ↓                       │
Onda 3 (bugs P0) ←──────────┘  precisa observabilidade pra validar
    ↓
Onda 4 (padronização) — precisa Onda 3 pra não consolidar bugs
    ↓
Onda 5 (podar mortos) — precisa Onda 4 pra saber o que é mesmo morto
    ↓
Onda 6 (refactor) — por último, com tudo padronizado
```

---

## Decisões pendentes (do PO)

Antes de iniciar a Onda 5, registrar decisões em `docs/decisions/2026-05-feature-triage.md`:

1. **Planejamento**: manter e fazer onboarding OU arquivar?
2. **Quizzes LMS**: criar 5-10 quizzes iniciais OU arquivar?
3. **FAQ**: criar 30 perguntas e ativar páginas OU dropar schema?
4. **Vídeos** (CourseVideo/LessonVideo): pipeline de produção de vídeo será ativado?
5. **Cross-refs Lei 14.133**: editorial vai povoar OU arquivar?
6. **Social media posts**: produção de social vai ser retomada?
7. **Mercado Pago migration legacy**: schema mantém colunas MP — manter por backward-compat ou DROP?

---

## Conexão com sessão de 2026-05-16

Esta sessão entregou:
- PR #8: bug fix LeiIndexer + rastreabilidade + wizardEnhance + backfill
- PR #9: consolida Sistema D (-1.940 LOC)
- PR #10: documentação completa (esta inclusive)

Este plano transforma os achados das auditorias em **roadmap executável**. Sem ele, a sessão entrega "diagnóstico" — com ele, entrega "caminho".
