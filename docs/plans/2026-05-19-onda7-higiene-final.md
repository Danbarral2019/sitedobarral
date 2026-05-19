# Onda 7 — Higiene Final (proposta)

> Fecha os ~30 itens pendentes do [status report](../audits/2026-05-19-saneamento-status-report.md). Bucketed por **valor × esforço × risco** pra você priorizar.

## Filosofia desta onda

Diferente das Ondas 1-6 (refactor estrutural), esta é **manutenção leve**. Sem novos sistemas, só:
- Deletar código órfão confirmado (zero refs)
- Aplicar padrões existentes onde ainda não estão (Sentry, fetchWithRetry, ScraperHealthLog)
- Decisões binárias sobre features dormentes (manter/dropar)

Cada sub-onda é independente. Você pode parar em qualquer uma.

---

## Onda 7.1 — Limpeza zero-risco (1 PR, ~1h)

**Tudo aqui tem zero ou ~zero refs no código. Risco mínimo de regressão.**

| # | Item | Detalhe | Esforço |
|---|---|---|---|
| 1 | Remover `docx` de package.json | Zero imports confirmado | 5 min |
| 2 | Mover `playwright` deps→devDeps | Só usado em scripts manuais | 5 min |
| 3 | Deletar `app/api/admin/cache/route.ts` | 0 refs (146 LOC) | 5 min |
| 4 | Deletar `app/api/admin/gemini-test/route.ts` | 0 refs (63 LOC) + endpoint inútil (P2.4 original) | 5 min |
| 5 | Deletar `app/api/admin/recommended-sites/*` | 0 refs frontend | 10 min |
| 6 | Deletar `app/api/admin/testimonials/route.ts` | Admin usa `/api/admin/depoimentos` | 5 min |
| 7 | Mover 7 JSONs do root → `data/raw-extracts/` ou `.gitignore` | atos-fundacionais, ins-faltantes, orphan-leis, etc. | 15 min |
| 8 | `.gitignore` para `data/backups/*` ou deletar arquivos >30d | 7 arquivos antigos | 5 min |
| 9 | Auditar 20+ .md no root — consolidar em `docs/` ou deletar obsoletos | CLAUDE.md fica, mover ou deletar resto | 30 min |

**Total: ~80 minutos. Net diff: provavelmente -500 LOC + ~50 arquivos deletados.**

**Risco:** baixíssimo. Tudo verificado por grep.

---

## Onda 7.2 — Observabilidade incremental (1-2 PRs, ~4h)

**Aplicar padrões já estabelecidos onde ainda não estão.**

| # | Item | Detalhe | Esforço |
|---|---|---|---|
| 10 | `fetchWithRetry` em 5 fetches AGU/CONUNI | `lib/agu-modules/{orientacoes-normativas, pareceres-conuni, pareceres-vinculantes, sumulas}.ts` + `lib/conuni-sync.ts` | 1h |
| 11 | Sentry.captureException nos 15 crons sem instrumentação | Padrão: try { ... } catch (e) { Sentry.captureException(e, { tags: { cron: 'X' } }); throw } | 2h |
| 12 | ScraperHealthLog em crons que escrevem em DB | Aplicar só nos ~6 crons restantes que processam dados (sync-conuni, classify-conuni, summarize-conuni, import-dou, import-documents, enrich-themes) — NÃO aplicar em cleanup/check-expiration | 1h |
| 13 | r2-client Sentry.captureMessage quando validateR2Config falhar | Atualmente lazy fail silencioso | 15 min |
| 14 | Rate limiting nos webhooks Stripe/Resend | `lib/cache/rate-limit-helper.ts` já existe — adicionar 10 req/min/IP | 30 min |

**Total: ~4 horas. Net diff: +~200 LOC.**

**Risco:** baixo. Adiciona checks defensivos, não muda comportamento de happy path.

---

## Onda 7.3 — Duplicação restante (1 PR grande ou 2 PRs, ~1.5 dia)

**Aplica patterns das Ondas 4.4 e 6.1 nas duplicações que sobraram.**

| # | Item | Estratégia | Esforço |
|---|---|---|---|
| 15 | `AdicionarDocumentosClient.tsx` 764 LOC | Quebrar com pattern Onda 6.1 (hook + sub-comps). Page tem upload + wizard + 4 steps | 4h |
| 16 | Consolidar tcu-classifier + tcu-editorial-classifier | Mesma lógica, providers diferentes. Unificar em `lib/tcu/classifier.ts` com variant `editorial` | 2h |
| 17 | Consolidar dou-classifier + dou-editorial-classifier | Idem | 2h |
| 18 | Unificar use-search + use-global-search | Tipos `DocumentType` divergem. Decidir qual é canônico, deletar outro | 2h |

**Total: ~12 horas (1.5 dia). Net diff: provavelmente -800 LOC.**

**Risco:** médio. Mudanças em código que está em produção; precisa smoke test cuidadoso. Por isso recomendo 2 PRs separadas: 7.3a (item 15, refactor estrutural seguindo Onda 6.1) e 7.3b (itens 16-18, consolidação de duplicações lógicas).

---

## Onda 7.4 — Decisões de Produto (PO decide)

**14 features dormentes — preciso da sua decisão.** Pra cada uma, 3 opções:

### A — Implementar/ativar (custo de produto)
### B — Dropar models + rotas + admin (custo de migração + perda de opção)
### C — Manter dormente (custo zero agora, pode reviver no futuro)

| # | Feature | Investimento atual | Sinal | Recomendação |
|---|---|---|---|---|
| 19 | **FAQ + FAQFeedback** | Schema completo (FTS, viewCount, feedback), `lib/search/full-text-search.ts` integra | 0 registros, sem rotas `/api/faq*`, sem `/faq` | **A** se planeja popular 30+ perguntas; **B** se virou irrelevante |
| 20 | **DocumentAnalysis** | Tabela só | Vinculada a Sistema D que foi deletado (PR #9) | **B** — droppar com segurança |
| 21 | **Quiz/QuizQuestion/QuizAttempt** | 4 models + admin editor + `QuizPlayer.tsx` + API | 0 quizzes em ~6 meses | **A** se ainda quer LMS gamificado; **B** se decidiu não focar em quiz |
| 22 | **LessonComment** | Model + `LessonDiscussion.tsx` | 0 comentários | **A** se quer comunidade entre alunos; **B** se prefere fórum externo |
| 23 | **CourseVideo/LessonVideo** | Pipeline admin pronto | 0 vídeos | **A** se planeja gravar curso; **B** se só YouTube external |
| 24 | **Publication** | Admin CRUD + página pública | 0 itens | **C** baixo custo manter |
| 25 | **Planning sub-system** | 17 rotas + 6 models + sessões + documentos + library snippets | **1 sessão real em 7 meses** | **B** se experiência ruim; **A** se vai dar onboarding |
| 26 | **LeiArticleNote** | Model só | 0 anotações | **C** manter — barato |
| 27 | **LeiArticleCrossRef** | Admin `CrossRefsEditor.tsx` existe | 0 entries apesar do admin | Pergunta: por que admin nunca usou? **B** se admin não tem interesse |
| 28 | **LeiArticleSuggestedReading** | Idem | 0 | Mesma pergunta. **B** se idem |
| 29 | **DOUSavedFilter** | Admin tem | 0 filtros salvos | **C** — barato manter |
| 30 | **Badge** | Gamificação | 2 registros | **A** se quer reativar gamificação; **B** se decidiu não focar |
| 31 | **UserStreak** | Streak diário | 3 registros, último mar/26 | Acompanha Badge. Mesma decisão. |
| 32 | **SocialMediaPost** | APIs `/api/admin/social/*` | 2 registros, último out/25 | **B** se decidiu não automatizar redes sociais |

**Custo de B (dropar):** ~3h por feature dropada (drop model, deletar rotas, deletar componentes, atualizar CLAUDE.md). 
**Custo de A (ativar):** depende — pode ir de horas (popular conteúdo manual) a dias (refinar UX).
**Custo de C (manter):** zero agora, mas confunde grep e mantém complexidade mental.

**Sugestão pragmática:**
- B agora: itens 20 (DocumentAnalysis), 32 (SocialMediaPost se já decidiu não fazer) — claros candidatos a deletar
- A se valor: 21 (Quiz), 23 (Videos), 25 (Planning) — features grandes que merecem decisão consciente
- C aceitável: 19, 22, 24, 26, 27, 28, 29, 30, 31 — manter dormente custa pouco

---

## Itens que NÃO recomendo atacar

Lista honesta de coisas onde **custo > benefício** ou risco > valor:

### 1. Reduzir `console.error` ratio abaixo de 5.8:1
- **Custo:** alto (99 chamadas em 50+ arquivos, cada uma precisa virar `apiLogger.error` com contexto)
- **Benefício:** marginal — ratio já melhorou 12x (era 67:1, agora 5.8:1)
- **Recomendação:** atacar caso-a-caso quando o arquivo for tocado por outro motivo

### 2. Migrar Server Components dos 60 candidates restantes
- **Análise honesta na Onda 6.2:** maioria tem motivos legítimos pra ser client (dynamic ssr:false, useTabFromUrl, useAuth, forms, hooks compostos)
- **Custo de uma migração real:** reescrever fetch→Prisma direto, redesenhar fluxo SSR
- **Benefício:** marginal (já temos `regions: gru1`)
- **Recomendação:** parar onde a Onda 6.2 parou (5 easy wins)

### 3. `Document.themes` população em massa
- Cron `enrich-themes` já existe e funciona. É só lento (TAKE_LIMIT=20/sem)
- **Recomendação:** aumentar TAKE_LIMIT pra 100 ou rodar manualmente uma vez

### 4. ScraperHealthLog em crons triviais
- `cleanup-orphaned-files`, `check-expiration`, `monitoring-alerts` — não escrevem em domain DB
- **Recomendação:** aplicar só em crons que processam dados (já listado no item 12)

### 5. Onda 4.5.6 (drop coluna leiArticles legada)
- **Status:** programado pra ~2026-06-01 após monitoramento dual-write
- Não é débito ativo, é trabalho cronograma
- **Recomendação:** seguir cronograma (mais 2 semanas)

### 6. P1.9 Memory leak risks (AdminLayout interval, QuizPlayer)
- AdminLayout: `setInterval(loadCounts, 60000)` com cleanup OK. Disparar 2-3 fetches/min é aceitável em admin
- QuizPlayer: feature dormente (0 quizzes); arrumar só se ativar feature
- **Recomendação:** ignorar — débito acadêmico

### 7. Modelos AI obsoletos em `scripts/.archived/`
- Por definição arquivado, não executado
- **Recomendação:** deletar pasta inteira `scripts/.archived/` ou ignorar (item 7 da 7.1 já endereça)

---

## Resumo de esforço total (cenário "atacar tudo")

| Sub-onda | PRs | Esforço | Risco | Recomendação |
|---|---|---|---|---|
| 7.1 Limpeza zero-risco | 1 | ~1h | Baixíssimo | ✅ Fazer |
| 7.2 Observabilidade incremental | 1-2 | ~4h | Baixo | ✅ Fazer |
| 7.3 Duplicação restante | 1-2 | ~1.5 dia | Médio | ✅ Fazer (com smoke test) |
| 7.4 Decisões de Produto | Variável | Variável | Variável | 🟡 Preciso da sua decisão item-a-item |

**Total estimado (sem 7.4):** ~2 dias de trabalho + 4-5 PRs.

**Cenário pragmático sugerido:**
1. Fazer 7.1 hoje (1h) — fecha 9 itens de higiene
2. Fazer 7.2 quando tiver 4h disponíveis — fecha gaps de observabilidade
3. 7.3 pode esperar — não é urgente, mas vale como sprint dedicado
4. 7.4 — pegar 30min agora pra você decidir os 14 dormentes (eu te ajudo com perguntas pra acelerar)

Quer que eu execute a 7.1 agora? É 1h de trabalho e fecha 9 itens.
