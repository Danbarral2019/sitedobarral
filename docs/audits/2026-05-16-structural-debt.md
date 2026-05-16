# Auditoria de Dívida Estrutural — 2026-05-16

> **Motivação:** o dono do site reconheceu que o projeto cresceu "em camadas de cebola" — features adicionadas umas sobre as outras sem refator estrutural. Esta auditoria é o complemento da [auditoria de falhas silenciosas](2026-05-16-silent-failures.md): em vez de "o que está quebrado em silêncio", responde "o que está pesando, duplicado ou inacabado".
>
> Três agents independentes auditaram (1) arquitetura e complexidade, (2) performance e peso, (3) features inacabadas + discrepâncias doc-vs-código.

## Sumário executivo

- **5 padrões estruturais** dominam o débito técnico — todos têm causa comum: features novas em vez de refator. Soma estimada: ~10.000 LOC duplicadas/mortas, custo Vercel desnecessário, latência DB +150ms desperdiçada.
- **Top 5 wins rápidos** somam <3h de trabalho e impacto direto (latência, bundle, custo).
- **70% das rotas API não seguem o padrão "Fase 8"** — gap principal de qualidade interna.

---

## P0 — Padrões transversais

### P0.1 — Padrão "Fase 8" adotado em apenas 30% das rotas

CLAUDE.md estabelece como standard:
```typescript
throw new NotFoundError('Resource');
return handleApiError(error);
```

Realidade:
- **280 rotas API totais** (`app/api/**/route.ts`)
- **84 rotas (30%)** usam `handleApiError` / erros semânticos
- **196 rotas (70%)** ainda usam `NextResponse.json({error}, {status})` cru
- **45 rotas (16%)** SEM nenhum `try/catch` — risco direto de 500 não logado
- **263 `console.error` vs 7 `Sentry.captureException`** (ratio 37:1; já documentado na auditoria de silent failures)

**Conflito de wrappers:** `lib/api-middleware.ts` (`withAdminAuth`, `withAuth`) e `lib/errors/error-handler.ts` (`handleApiError`) **não conversam**. `withAdminAuth` retorna `NextResponse.json({error}, 403)` direto, ignorando `ApiError`. Os dois caminhos coexistem mas competem.

**Recomendação:** decidir um único padrão (sugerido: `withErrorHandler` que combina ambos) + codemod para migrar 196 rotas. Esforço: 2-3 dias. Impacto: resolve a "70:1 falha silenciosa" reportada na auditoria irmã.

### P0.2 — Múltiplas implementações concorrentes (>6.500 LOC duplicadas)

| Domínio | Implementações vivas | Status |
|---|---|---|
| **Admin de documentos** | `/admin/docs` (hub), `/admin/documentos` (819L), `/admin/adicionar-documentos` (764L) | Os 2 últimos com `redirect` em `next.config.ts:45-46` mas continuam compilados |
| **Admin TCU** | `/admin/tcu` (TcuHubClient), `/admin/tcu-manager` (965L), `/admin/tcu-highlights` | Sem documentação de qual usar |
| **Admin analytics** | `/admin/analytics` (real), `/admin/analytics-documentos` (543L cliente próprio), `/admin/analytics-hub` (só `dynamic(import('../analytics/page'))` — anti-pattern) |
| **AGU scraper** | `lib/agu-scraper.ts` (v1, 494L) e `lib/agu-scraper-v4.ts` (v4, 409L) | **Cron principal `import-documents` ainda usa v1** |
| **Endpoints AGU** | `/api/admin/scrape-agu` e `/api/admin/agu-import` | Praticamente idênticos |
| **Classificadores TCU** | `lib/tcu-classifier.ts` (382L, Anthropic), `lib/tcu-editorial-classifier.ts` (159L, Gemini), `lib/tcu-enrichment.ts` (123L) | Domínios sobrepostos |
| **Classificadores DOU** | `lib/dou-classifier.ts` (1.019L, keyword+Claude) + `lib/dou-editorial-classifier.ts` (196L, Gemini) | Idem |
| **Lei comentada** | `app/area-restrita/lei-comentada/page.tsx` (1.607L) e `app/lei-14133/LeiComentadaClient.tsx` (847L) | Mesma feature para público vs restrito |
| **Hooks de busca** | `hooks/use-search.ts` (109L) e `use-global-search.ts` (613L) | Tipos `DocumentType` divergentes entre eles |

### P0.3 — Abstrações criadas mas ZERO adotadas

`lib/ai/` (registry + retry + logger centralizado) tem **0 consumidores em produção**. Os 6+ lugares que usam AI continuam importando `@anthropic-ai/sdk` ou `@google/genai` direto:

- `lib/tcu-classifier.ts:95` (modelo `claude-3-5-sonnet-20241022` antigo — já documentado em silent failures)
- `lib/claude-classifier.ts:163` (modelo `claude-3-5-haiku-20241022` antigo)
- `lib/summary-generator.ts:57`
- `lib/dou-classifier.ts`
- `lib/conuni-summary.ts` / `lib/conuni-classify.ts`
- `lib/embeddings/gemini-embeddings.ts`
- `lib/ai/document-enhancer.ts` (já `@deprecated` na PR #8)

**Recomendação:** migração das 6 chamadas para `ai.generate(task, ...)` resolve P0.1 e P0.2 da silent failures auditoria simultaneamente. Esforço: 3-4 dias.

### P0.4 — Crons rodando à toa

| Cron | Frequência | Tabela | Custo desperdiçado |
|---|---|---|---|
| `process-index-jobs` | a cada 15 min (96x/dia) | `IndexJob` (3 registros, último em Nov-2025) | ~2.880 execuções/mês para nada |
| `compute-streaks` | diário | `UserStreak` (3 registros, último em Mar-26) | Lock no DB sem benefício |
| `lms-inactivity` | diário | `LessonProgress` (78 total) | Base ridícula |

**Recomendação:** comentar `schedule` dos 3 no `vercel.json` até features decolarem. Esforço: 15 min. Impacto: economia direta de execuções Vercel.

### P0.5 — Schema com 70 models, ~10 "vivos só no papel"

| Model | Total | Sinal de abandono |
|---|---|---|
| `FAQ`, `FAQFeedback` | 0 / 0 | Schema completo (FTS, viewCount, feedback), nenhuma rota `/api/faq*`, nenhuma página `/faq`. Backend pronto mas sem fronteira. |
| `DocumentAnalysis` | 0 | API `/api/admin/analyze-document` existe mas nunca persistiu (Sistema D, deletado na PR #9). Tabela pode ser dropada. |
| `Quiz` / `QuizQuestion` / `QuizAttempt` | 0 | Admin editor + `QuizPlayer.tsx` + 4 models, 0 quizzes criados em ~6 meses |
| `LessonComment` | 0 | `LessonDiscussion.tsx` consome, 0 comentários |
| `CourseVideo` / `LessonVideo` | 0 / 0 | Pipeline admin pronto, 0 vídeos cadastrados |
| `Publication` | 0 | Admin CRUD + página pública, 0 itens |
| `PlanningTrailTemplate` / `SectionTemplate` / `LibrarySnippet` / `DecisionRun` / `Export` | 0 | Sub-sistema "Planejamento" inteiro — **17 rotas + 6 models + 1 sessão real** em 7 meses |
| `LeiArticleNote` | 0 | "Anotações de aluno por artigo" — nunca usado |
| `LeiArticleCrossRef` | 0 | Admin tem `CrossRefsEditor.tsx`, API existe — 0 entries |
| `LeiArticleSuggestedReading` | 0 | Idem |
| `DOUSavedFilter` | 0 | Admin `/admin/dou-filtros` existe — 0 filtros salvos |
| `Badge` | 2 | Gamificação congelada |
| `UserStreak` | 3 | Último update Mar-26 |
| `SocialMediaPost` | 2 | APIs `/api/admin/social/*` existem; última atividade Out-25 |

---

## P1 — Performance e peso

### P1.1 — Vercel `regions` não declarado

`vercel.json` não tem `regions`. Functions vão para região default da conta. **Neon DB está em `sa-east-1`** mas se funcs estão em `gru1` (BR), `sfo1` ou `iad1` (EUA), cada query DB tem ~100-200ms de overhead de rede.

**Fix:** adicionar `"regions": ["gru1"]` no `vercel.json`. 5 min, ganho massivo.

### P1.2 — Header `Cache-Control: no-store` anula CDN para `/api/*`

`next.config.ts:159` força `Cache-Control: no-store, must-revalidate` para **todas** as rotas `/api/*`. Isso anula CDN edge caching mesmo para rotas idempotentes públicas (testimonials, glossário, lei-14133/articles, course-videos, FAQ).

Redis no servidor cobre, mas usuário ainda paga TTFB completo (~500ms vira ~50ms se via CDN).

**Fix:** remover header global + adicionar `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` por rota nas leituras públicas. Esforço: 1h.

### P1.3 — Queries Prisma com JSON-string + LIKE = full-table-scan

Pattern crítico em múltiplas rotas:
```typescript
where: { leiArticles: { contains: `"${num}"` } }
```

Locais:
- `app/api/legislative-acts/route.ts:134-182`
- `lib/lei-14133/queries.ts:167`
- `app/api/artigos/[numero]/chat/route.ts:141,169`
- `app/api/admin/tribunal-decisions/route.ts:36,40`

Cada query escaneia os 6.323 docs sem índice. Migrar `leiArticles` / `themes` para `String[]` Postgres (Prisma `String[]` + `has`) ou tabela relacional `LegislativeActArticle`. Índice GIN também resolve. Esforço: 1-2 dias. Impacto: queries de 800ms → 30ms.

### P1.4 — Dependências mortas no `package.json`

| Pacote | Status |
|---|---|
| `video.js` + `@types/video.js` | Zero imports — **remover** (~150KB) |
| `docx` | Zero imports — **remover** (~600KB) |
| `html2canvas` | Zero imports — **remover** (~200KB) |
| `pino-pretty` | Comentário "TEMP: Disabled" em `lib/logger.ts:44` — confirmar e remover |
| `playwright` | Só em scripts manuais — mover para `devDependencies` |
| `@mailchimp/mailchimp_marketing` | `lib/mailchimp.ts` + `/api/admin/newsletter/sync` ainda chamam, mas só 10 `NewsletterSubscriber` na base. Resend cobre? — Avaliar |

### P1.5 — N+1 e queries sequenciais no LMS analytics

`app/api/admin/lms/analytics/route.ts`:
- Linhas 263-287: `Promise.all` com 1 `findMany` por quiz (N requests). Trocar por `prisma.quizAttempt.groupBy({ by: ['quizId'], _count, _avg })`
- Linhas 241-247: `for (userId) { progress.filter() }` — O(N×M×P) em memória. Pré-agregar com `Map`
- Linhas 39-49, 76-79, 221: 5 queries `await` sequenciais. Embrulhar em `Promise.all`

Dashboard LMS de ~5s vira <1s. Esforço: 2h.

### P1.6 — Cache stampede em `withCache`

`lib/cache/redis-client.ts:674` — implementação básica (`getCache` → miss → `fn()` → `setCache`) sem lock. Em horário de pico, N requests miss simultâneas chamam Gemini N vezes (custo + rate-limit).

**Fix:** single-flight via `SETNX` no Upstash ou `p-limit` por chave. Esforço: 2h.

### P1.7 — Componentes >800 linhas

```
1607  app/area-restrita/lei-comentada/page.tsx     ← duplica /lei-14133 público
1330  app/admin/dou-filtros/DOUFiltrosClient.tsx
1040  app/admin/lms/[courseId]/ModuleManagerClient.tsx
1000  app/(acervo)/legislacao/page.tsx
 965  app/admin/tcu-manager/TCUManagerClient.tsx
 897  app/admin/tribunal-decisions/TribunalDecisionsClient.tsx
 847  app/lei-14133/LeiComentadaClient.tsx
 837  app/lei-14133/preview/page.tsx
 822  app/admin/lms/[courseId]/lessons/[lessonId]/LessonEditorClient.tsx
 819  app/admin/documentos/page.tsx
```

Esforço grande mas alto impacto em manutenibilidade e bundle.

### P1.8 — Server Components subexplorados

244 componentes `'use client'` em app de 280 rotas — proporção alta para Next.js 15. Candidatos a migrar:

- `/area-restrita/meu-progresso` (Server fetch + client só pra interações)
- `/area-restrita/historico`
- `/area-restrita/favoritos`
- `/area-restrita/meus-certificados` (Server pra listagem, client só pro botão de PDF)
- `/jurisprudencia` (page wrapper já é Server, apenas o cliente de filtros precisa ser client)

### P1.9 — Memory leak risk e bundle traps

- `components/AdminLayout.tsx:82` — `setInterval(loadCounts, 60000)` em todas as páginas admin. Cleanup OK, mas dispara 2-3 fetches/min em todas as páginas
- `components/lms/QuizPlayer.tsx:134` — `useEffect` com `[results]` recria interval a cada mudança de `results` (objeto novo). Usar `useRef` para estabilizar
- `data/lei-14133-artigos.ts` (312KB raw) está sendo importado como **valor** (não tipo) em `components/lei-14133/LegalReadingView.tsx:12` — felizmente o componente é órfão (sem importadores). Apagar antes que alguém use e adicione 100KB gzipped ao bundle

---

## P2 — Discrepâncias CLAUDE.md vs realidade

1. **CLAUDE.md:72** diz "26 models" — schema tem **70 models**
2. **CLAUDE.md:507** lista `RESEND_SETUP_COMPLETO.md` — **não existe** na raiz
3. **CLAUDE.md:705** menciona `AuditLog` "aguarda criação" — sem evidência ainda; `AccessLog` e `ProcessedWebhookEvent` cobrem parcialmente
4. **FUTURE_TASKS T15** afirma "Página `/glossario` falta" — **já existe** (`app/(acervo)/glossario/page.tsx`, 193L), com admin completo
5. **CLAUDE.md:85** lista FAQ, DocumentAnalysis, CourseVideo, ArticleQuestion como implementados — 4 desses têm **0 dados** em produção
6. **CLAUDE.md:466** sugere `echo %GEMINI_API_KEY%` no Windows — `.env.example` não cita essa env
7. **CLAUDE.md:391** menciona `MAILCHIMP_*` ativo — base com 10 subscribers, presença duvidosa
8. **`lib/newsletter.ts:15`** tipa `mailchimpId: string | null` no `NewsletterSubscriber` — **coluna não existe no schema** (bug latente)
9. **CLAUDE.md:13** diz "MP foi removido" — schema mantém colunas MP (já assumido na linha 152); `scripts/migrate-mp-to-stripe.ts` ainda existe
10. **Cron `/api/cron/process-index-jobs` 15 min** documentado como ativo — tabela parada há 6 meses

---

## P2 — Componentes e arquivos órfãos

### Componentes (14 confirmados)
- `components/SearchFilters.tsx`
- `components/JurisprudenciaRelacionada.tsx`
- `components/ArticleRelationshipGraph.tsx`
- `components/CollapsibleArticle.tsx`
- `components/ArticleChatInterface.tsx`
- `components/ui/responsive-table.tsx`
- `components/acervo/ListFilters.tsx`
- `components/area-restrita/TreeContentArea.tsx`
- `components/area-restrita/LeiQuickAccess.tsx`
- `components/area-restrita/MobileTreeDrawer.tsx`
- `components/lei-14133/LegalSidebar.tsx`
- `components/lei-14133/LegalSearchBar.tsx`
- `components/lei-14133/LegalCover.tsx`
- `components/lei-14133/LegalReadingView.tsx`

A suite `Legal*` parece protótipo de redesign que ficou no chão.

### Outros artefatos órfãos
- `app/area-restrita/page.tsx.backup` (524 linhas, Jan-2025)
- `data/backups/` (6 backups de 1.268 linhas cada da Lei 14.133)
- `data/lei-14133-artigos.backup-2026-05-01.ts` (88KB na raiz de `data/`)
- 20+ relatórios JSON no root (`agu-pareceres-extraidos.json`, `ins-faltantes-2026-02.json` etc.) não estão em `.gitignore`
- 50+ docs `.md` no root com datas Jan/2025 descrevendo sistemas que evoluíram

### Rotas API sem chamadores
- `app/api/admin/cache/route.ts` (146L)
- `app/api/admin/gemini-test/route.ts` (63L)
- `app/api/admin/internal-search/route.ts` (86L)
- `app/api/admin/courses-list/route.ts` (17L)
- `app/api/admin/users/search/route.ts` (31L)
- `app/api/admin/social/posts|publish|retry/*` (3 rotas — se decisão for descontinuar social)
- `app/api/admin/recommended-sites/*` (sem caller frontend)
- `app/api/admin/testimonials/route.ts` (admin usa `/api/admin/depoimentos`)

---

## Top 5 wins rápidos (executar em ordem)

| # | Ação | Esforço | Impacto |
|---|---|---|---|
| 1 | `regions: ["gru1"]` no `vercel.json` | 5 min | Latência DB -100/-200ms por query |
| 2 | Remover `Cache-Control: no-store` global de `/api/*` + adicionar `s-maxage` nas rotas públicas | 1h | TTFB ~500ms → ~50ms via CDN para repetidas |
| 3 | Remover deps mortas (`video.js`, `docx`, `html2canvas`, `pino-pretty`) + mover `playwright` para devDeps | 30 min | -1MB `node_modules`, build mais rápido |
| 4 | Pausar crons sem demanda (`process-index-jobs`, `compute-streaks`, `lms-inactivity`) | 15 min | Economia direta Vercel + menos ruído |
| 5 | Apagar 14 componentes órfãos + `area-restrita/page.tsx.backup` + `data/backups/` | 1h | Higiene, menos confusão em greps |

**Total: ~3h, todos baixo risco.**

---

## Plano de saneamento de médio prazo

### Sprint 1 (~1 semana) — Consolidações estruturais
- **A.** Migrar 6 SDK calls diretos para `lib/ai/generate()` (`tcu-classifier`, `claude-classifier`, `summary-generator`, `dou-classifier`, `conuni-*`, `embeddings`) — resolve modelos hardcoded antigos da silent failures auditoria simultaneamente
- **B.** Decidir entre `withAdminAuth` ou `handleApiError` e codemod nas 196 rotas legadas — resolve 70% das falhas silenciosas
- **C.** Atualizar CLAUDE.md (corrigir 10 discrepâncias) + FUTURE_TASKS

### Sprint 2 (~1 semana) — Podar features mortas
- **D.** Decisão sobre FAQ: criar páginas + 30 perguntas iniciais OU dropar models (`FAQ`, `FAQFeedback`) do schema
- **E.** Decisão sobre Planejamento (17 rotas + 6 models, 1 sessão real): manter e fazer onboarding ou arquivar a feature
- **F.** Decisão sobre Quizzes, Vídeos, Cross-refs Lei 14.133 — mesmo dilema
- **G.** Drop `DocumentAnalysis` da DB (após confirmação)

### Sprint 3 (~1 semana) — Consolidações de UI
- **H.** Eliminar duplicação `/admin/docs` × `/admin/documentos` × `/admin/adicionar-documentos` — manter só o hub
- **I.** Idem `/admin/analytics*` (3 telas) e `/admin/tcu*` (3 telas)
- **J.** Migrar `agu-scraper.ts` (v1) → `agu-scraper-v4.ts` no `cron/import-documents` + deletar v1

### Sprint 4 (~1 semana) — Performance
- **K.** Migrar `leiArticles`/`themes` JSON-string → `String[]` Postgres
- **L.** Refactor `app/api/admin/lms/analytics/route.ts` (groupBy + Promise.all)
- **M.** Single-flight em `withCache`
- **N.** Migrar 5-6 páginas client para Server Components

---

## Conexão com a sessão atual

Esta auditoria fecha a investigação iniciada com o bug do LeiIndexer:

- **PR #8** (mergear): fix LeiIndexer + rastreabilidade + `wizardEnhance` + backfill
- **PR #9** (mergear): consolida Sistema D (-1.940 LOC) + fix Step 2 + Wizard com extractedText
- **PR #10** (esta): documenta 30+ silent failures + agora 50+ achados estruturais
- **Sprints 1-4 acima**: roadmap para próximas semanas/meses

**Linha mestra:** o projeto cresceu por adição. Cada feature nova foi colocada ao lado da anterior em vez de substituí-la quando virou redundante. Resultado: 70 models, 280 rotas, ~10.000 LOC de duplicação. Saneamento estrutural agora destrava produtividade futura — sem ele, cada novo feature carrega o peso de raciocinar sobre as anteriores.
