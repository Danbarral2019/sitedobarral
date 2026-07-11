# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL REMINDERS

1. **Working Directory:** `C:\Users\User\projetos\sitedobarral\` (Windows — ambiente atual). Shell primário: PowerShell; Bash (Git Bash) também disponível.
2. **Course IDs:** Database usa IDs numéricos (`'1'`, `'2'`), URLs usam slugs. Ver `COURSE_IDS_REFERENCE.md`
3. **Documents:** NUNCA acessar `course.restrictedDocuments` - buscar via `/api/documents`
4. **React Hooks:** Todos hooks ANTES de early returns
5. **Prisma Engine:** Se der erro, matar Node.js e rodar `npx prisma generate`
6. **Lei 14.133 Data:** 195 artigos (193 editados MANUALMENTE + Art. 184-A + Art. 194) - SEMPRE executar `node scripts/backup-lei-14133.js` antes de mudanças no model LeiArticle
7. **Pagamentos:** Stack atual é **Stripe** (cartão + PIX), não Mercado Pago. A rota mantém o path `/api/pagamento/*` mas o backend é `lib/stripe.ts`. MP foi removido na branch `stripe-migration` (mergeada na main em abr/2026).

## Project Overview

Site profissional do Prof. Daniel Barral especializado em Direito Administrativo, Licitações e Contratos. Repositório de materiais jurídicos com acesso público e área restrita via QR code.

**Tech Stack:** Next.js 15.5.15 (App Router) • React 19.1.2 • TypeScript 5 • Prisma ORM 7.4 (PrismaNeon) • PostgreSQL (Neon) + pgvector • Tailwind CSS 4 • Radix UI • JWT Auth • **Stripe** (cartão + PIX) • Resend Email • Sentry • Upstash Redis • IA multi-provider (`lib/ai/` — Anthropic Claude 4.5/4.6 + Google Gemini 2.5 + Cohere) • Playwright/PostgreSQL/GitHub/Gemini MCP

## Quick Commands

```bash
# Dev
npm run dev                    # Dev server (localhost:3000)
npm run build                  # Production build
npx prisma generate            # After schema changes
npx prisma studio              # Database GUI

# Admin
node scripts/create-admin.js email@example.com senha "Nome"

# MCP
claude mcp list                # List MCPs (playwright, postgresql, github, gemini)

# AGU/TCU Scrapers
npx tsx scripts/test-versioning.ts
npx tsx scripts/import-pareceres-vinculantes.ts
npm run convert-tcu            # Convert TCU Excel files

# Full-Text Search
npx tsx scripts/setup-full-text-search.ts             # Setup DDL + backfill
npx tsx scripts/setup-full-text-search.ts --verify    # Verificar status
npx tsx scripts/setup-full-text-search.ts --dry-run   # Simular sem alterar

# Embeddings/pgvector
npx tsx scripts/migrate-to-embeddings.ts              # Indexar docs pendentes
npx tsx scripts/migrate-to-embeddings.ts --dry-run    # Simular sem alterar
npx tsx scripts/migrate-to-embeddings.ts --force      # Reprocessar todos
npx tsx scripts/index-legislative-acts.ts             # Indexar atos legislativos
npx tsx scripts/index-legislative-acts.ts --dry-run   # Simular sem alterar
npx tsx scripts/index-legislative-acts.ts --force     # Reprocessar todos

# Migration Scripts
export DATABASE_URL="<your-db-url>" && npx tsx scripts/fix-csv-tags.ts  # Convert CSV tags to JSON
```

**Test Credentials:**

- Student: `aluno@teste.com` / `aluno123` (Nova Lei de Licitações)
- Admin: criar via `node scripts/create-admin.js`


## Architecture Quick Reference

**Structure:**

- `app/` - Next.js routes (public, `/area-restrita`, `/admin`)
- `lib/` - Core utilities (auth, email, scrapers, versioning)
- `lib/agu-modules/` - AGU scrapers (ONs, Pareceres, DECOR, Súmulas)
- `lib/lms/` - Helpers LMS analytics (query-timing, analytics-queries, progress-aggregation) — criado na Onda 4.6
- `components/` - React components
- `prisma/schema.prisma` - Database schema (70 models)
- `scripts/` - Admin/import/scraping scripts
- `lib/email-templates/` - Templates HTML de newsletter

**Key Models** (fonte de verdade: `prisma/schema.prisma` — ~70 models; ver o schema para o conjunto completo e campos). Por área:
- **Auth/Acesso:** `User`, `Enrollment` (trial 1 mês via QR ou Subscription), `Subscription` (Stripe), `QRCode`, `AccessLog`, `ProcessedWebhookEvent`.
- **Conteúdo:** `Document` (+ `DocumentChunk` p/ embeddings, `DocumentVersion`, `DocumentMetaTcu/Dou`), `LegislativeAct` (+ `LegislativeActChunk`, `LegislativeActRelation`), `LeiArticle` (Lei 14.133, 195 arts. + embeddings/cross-refs), `BlogPost`, `FAQ`, `GlossaryTerm`, `DOUStagingDocument`.
- **LMS:** `Module`, `Lesson` (+ progress/comments), `Quiz*`, `Certificate`, `Badge`, `UserStreak`, `CourseStatus`.
- **Jurisprudência:** `TribunalDecision` (+ `TribunalDecisionChunk`), `ScraperHealthLog`.
- **Clipping/Newsletter:** `DailyClippingSend`, `NewsletterSubscriber/Send`, `PushSubscription`.
- **Planejamento:** `Planning*` (Session, Document, Templates, DecisionRun…).
- **Busca:** `SearchHistory`, `IndexJob`.

**Auth Flows:**

1. QR Code → Registration → Enrollment (1 mês trial)
2. Registro aberto (sem QR) → Verificação email → Login → Planos → Pagamento
3. Email/Password → Login → JWT cookie
4. Stripe Checkout (cartão) ou PIX → Webhook → Subscription + Enrollments

**Document Access:**

- Public: `isPublic=true`
- Private: requires valid enrollment OR active subscription
- Bibliography: SEMPRE público

**Subscription Plans:**
- **Básico** (R$ 49,90/mês): acesso a 1 curso específico + Assistente IA
- **Premium** (R$ 89,90/mês): acesso a todos os cursos (ver `data/courses.ts`) + Assistente IA


## Histórico / Changelog

As features concluídas e o changelog detalhado foram movidos para `docs/PROJECT_HISTORY.md`
(e permanecem no git). Este arquivo mantém apenas o que está ativo: regras, arquitetura e status atual.

## Critical Technical Rules

### Course IDs

| Database ID | URL Slug | Title |
|---|---|---|
| `'1'` | `nova-lei-licitacoes` | Nova Lei de Licitações |
| `'2'` | `planejamento-contratacoes` | Planejamento das Contratações |
| `'3'` | `gestao-fiscalizacao-contratos` | Gestão e Fiscalização |
| ... | ... | (ver `COURSE_IDS_REFERENCE.md`) |

**Rule:** Numeric IDs para database, slugs para URLs.

### React Hooks Order

```typescript
// ✅ CORRECT
function MyComponent() {
  const [state, setState] = useState(initial);      // 1. useState
  const computed = useMemo(() => {...}, [deps]);    // 2. useMemo/useCallback
  useEffect(() => {...}, [deps]);                   // 3. useEffect

  if (loading) return <Loading />;                  // 4. Early returns
  return <Component />;                             // 5. Render
}
```

### Document Fetching

```typescript
// ❌ WRONG
const docs = course.restrictedDocuments; // Empty!

// ✅ CORRECT
const response = await fetch(`/api/documents?courseId=${courseId}`);
const { documents } = await response.json();
```

### Error Handling Pattern (Fase 8)

```typescript
// ✅ CORRECT - New standardized pattern
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError, ConflictError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const resource = await prisma.resource.findUnique({ where: { id } });

    if (!resource) {
      apiLogger.warn({ resourceId: id }, 'Resource not found');
      throw new NotFoundError('Resource');
    }

    apiLogger.info({ resourceId: id }, 'Resource fetched successfully');
    return NextResponse.json({ resource });
  } catch (error) {
    return handleApiError(error);
  }
}
```

**Key points:**
- Throw semantic errors (`NotFoundError`, `ValidationError`, etc.) instead of returning `NextResponse.json`
- Use `apiLogger` for structured logging with context
- Single `catch` block with `handleApiError()` for all routes
- Status codes are automatic (404, 400, 401, 403, 409, 429, 500, 503)

## Environment Variables

**Required:**

- `DATABASE_URL` - PostgreSQL connection (Neon)
- `JWT_SECRET` - Token signing (`openssl rand -base64 32`)
- `NEXT_PUBLIC_BASE_URL` - Site URL

**Email:**


- `RESEND_API_KEY`, `EMAIL_FROM`

**Stripe (Pagamentos):**

- `STRIPE_SECRET_KEY` - Secret key (production: `sk_live_...`, teste: `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` - Secret usado pelo webhook handler para verificar assinatura (`whsec_...`)
- `NEXT_PUBLIC_PRICE_BASICO` - Valor exibido no frontend (ex: `49,90`)
- `NEXT_PUBLIC_PRICE_PREMIUM` - Valor exibido no frontend (ex: `89,90`)

**Optional:**

- `ANTHROPIC_API_KEY` - AI summaries
- `GEMINI_API_KEY` - Chat RAG e busca semântica
- `GEMINI_API_KEY_BACKUP` - chave Gemini de backup (opcional). Quando a primária retorna 429/RESOURCE_EXHAUSTED, sistema tenta a backup antes de degradar para FTS-only. Recomendado em produção. Implementação: `lib/gemini/api-key-fallback.ts`.
- `MAILCHIMP_*` - Newsletter
- `INSTAGRAM_*`, `LINKEDIN_*` - Social media
- `CRON_SECRET` - Cron job protection

Ver `.env.example` e `SETUP.md`.

**Chat RAG:**
- Gemini API key configurada via MCP server global (`~/.claude-mcp-servers/gemini/`)
- Verificar: `claude mcp list` deve mostrar "gemini: ✓ Connected"


## Common Issues & Solutions

**Database:**

```bash
# Prisma engine error
taskkill /F /IM node.exe
npx prisma generate
```

**MCP Issues:**

```bash
# Verify MCPs
claude mcp list

# Playwright not working
claude mcp add playwright
```

**Versionamento:**

```typescript
// Use correct unique identifiers
// ONs: onNumber + onYear
// Pareceres: title (numeroCompleto)
const existing = await prisma.document.findFirst({
  where: { onNumber: 1, onYear: 2024 }
});
```

**Build Errors:**

```bash
rm -rf .next node_modules
npm install
npx prisma generate
npm run build
```

**Tags Parse Errors:**

```typescript
// Se encontrar erros de JSON.parse() em tags/leiArticles
// Use a função safeParseArray() que suporta CSV e JSON
import { safeParseArray } from './safe-parse';

// Antes (pode falhar com CSV)
const tags = JSON.parse(doc.tags);

// Depois (funciona com CSV e JSON)
const tags = safeParseArray(doc.tags);

// Para migrar dados existentes CSV→JSON:
export DATABASE_URL="..." && npx tsx scripts/fix-csv-tags.ts
```

**Chat RAG / Gemini Issues:**

```bash
# Gemini API não conectada
claude mcp list  # Verificar se "gemini: ✓ Connected"

# Se não conectado, verificar API key
echo $GEMINI_API_KEY  # Linux/Mac
echo %GEMINI_API_KEY%  # Windows

# Reinstalar MCP Gemini se necessário
cd ~/.claude-mcp-servers/gemini
./setup-global.bat  # Windows
./setup-global.sh   # Linux/Mac
```

**Modelo Gemini:** usar `gemini-2.5-flash` (`PRIMARY_GEMINI_MODEL` em `lib/gemini/config.ts`). Em tarefas curtas (resumo/classificação) passar `thinkingBudget: 0` — senão o thinking mode do 2.5 consome ~95% do `maxOutputTokens` e trunca. (Os `gemini-2.0-flash*` foram desligados pela Google em 2026; histórico em `docs/ROADMAP_GEMINI_MODELO_25.md`.)

**React Hydration Errors:**

```typescript
// ❌ WRONG - Causes hydration mismatch
function Header() {
  return <div>{new Date().toISOString()}</div>;
}

// ✅ CORRECT - Use client-side mounting flag
function Header() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;
  return <div>{new Date().toISOString()}</div>;
}
```

## Documentation Files

**Setup:**

- `SETUP.md` - Initial setup completo
- `RESEND_SETUP_COMPLETO.md` - Resend email config
- `MCP_SETUP.md` - MCPs instalação

**Features:**


- `AGU_SCRAPER_V4.md` - AGU scraping platform
- `IMPORTACAO_EXCEL.md` - Excel import guide
- `AUTOMACAO_CRON_JOBS.md` - Cron jobs

**Scripts:**


- `scripts/fix-csv-tags.ts` - Migração CSV→JSON para tags/leiArticles
- `scripts/migrate-to-embeddings.ts` - Indexar documentos no pgvector (embeddings)
- `scripts/create-admin.js` - Criar usuário admin
- `scripts/convert-tcu-excel.js` - Converter TCU Excel→JSON

**Deploy:**


- `DEPLOY_VERCEL.md` - Vercel deployment

**Reference:**

- `COURSE_IDS_REFERENCE.md` - Course IDs vs slugs
- `prisma/schema.prisma` - Complete database schema

**Planejamento:**

- `FUTURE_TASKS.md` - Backlog centralizado de tarefas futuras, pendências e melhorias


## API Routes Summary

- **Public:** `/api/auth/*`, `/api/documents` (+ `/query` = busca semântica/RAG Gemini), `/api/newsletter` (+ `/track`), `/api/contact`.
- **Pagamentos (Stripe):** `/api/pagamento/{checkout,status,webhook}` (path histórico após reversão MP→Stripe). Checkout Zod-validado `{plan,billingCycle,method,courseId?}` → `{url}`; webhook sem auth, verifica `STRIPE_WEBHOOK_SECRET`, idempotência via `ProcessedWebhookEvent`.
- **Área Restrita:** `/api/area-restrita/*` (certificates, progress, global-search, global-search/hybrid). **Admin:** `/api/admin/*`. **Jurisprudência:** `/api/jurisprudencia[/id]`. **Webhooks:** `/api/webhooks/resend`.
- **Crons:** lista completa + schedules em `vercel.json`. Demais endpoints: ver o código.

Ver código para endpoints completos.

## Development Status

**Estado atual (jul/2026):** produto em produção. Assistente de IA usa **Claude Sonnet 5 + Citations API**; síntese (BIA-1) e cobertura de dados (BIA-5) melhoradas. **Trilha de tuning de retrieval FECHADA com evidência** — recall@5 ~65% é o teto do dataset; próximos ganhos de busca vêm de answer-quality ou mais dados, não tuning (ver `docs/ROADMAP_BUSCA_QUALIDADE.md`).
- **Pendente (depende do PO):** Stripe TEST→LIVE (`docs/ROADMAP_STRIPE_FASE3.md`) + PIX; coming-soon flag.
- **Backlog:** `FUTURE_TASKS.md` · **Changelog:** `docs/PROJECT_HISTORY.md` + git.

## Important Architecture Patterns

### Stripe Subscription Flow
1. User → `/planos` → escolhe plano + ciclo (mensal/anual) + método (Cartão/PIX)
2. `POST /api/pagamento/checkout` (Zod-validado: `{ plan, billingCycle, method, courseId? }`) → cria Checkout Session Stripe → retorna `{ url }` para redirect
3. Stripe processa pagamento → callback em `/assinatura/sucesso|cancelado|pendente`
4. Stripe envia evento webhook → `POST /api/pagamento/webhook` → verifica assinatura via `STRIPE_WEBHOOK_SECRET` (registra em `ProcessedWebhookEvent` para idempotência)
5. `checkout.session.completed` / `invoice.paid` → cria/renova `Subscription` + `Enrollment(s)` (1 mês ou 1 ano)
6. `customer.subscription.deleted` / `invoice.payment_failed` → cancela Subscription → remove enrollments sem `qrCodeId` (preserva presenciais)
7. Acesso: `hasActiveAccess()` verifica enrollment válido OU subscription `active`
- 📖 Ver `lib/stripe.ts` (lazy init via `getStripe()`), `lib/enrollment-utils.ts` (`checkSubscriptionAccess`)

### Busca Global com IA (Composição no Frontend)
1. Usuário digita no campo de busca
2. 300ms debounce → `GET /api/area-restrita/global-search` → resultados tradicionais imediatos
3. 1500ms debounce (ou Enter) → `POST /api/documents/query` → card "Análise IA" acima dos resultados
4. Hook `useGlobalSearch` gerencia ambas as buscas em paralelo com AbortController
5. Toggle IA no `GlobalSearchBar` permite desativar busca semântica
6. `AIAnswerCard` no `SearchResultsList` exibe loading/erro/resposta com fontes

### Chat RAG Flow (Página Assistente)
1. User query → `/api/documents/query` POST
2. API calls Gemini (`gemini-2.5-flash`, via `PRIMARY_GEMINI_MODEL`) with user query + document context
3. Gemini returns structured response with relevance scores
4. Response cached with query hash (60s TTL)
5. Frontend displays sources with citations

### Error Handling Flow (Established in Fase 8)
1. Route handler throws semantic error (`NotFoundError`, `ValidationError`, etc.)
2. `handleApiError()` catches and classifies error type
3. Prisma/Zod/JWT errors automatically mapped to correct HTTP status
4. Structured logging with context (apiLogger, authLogger)
5. Client receives standardized JSON response

### Embeddings/pgvector Pipeline
1. `processDocument()` busca doc no banco com `r2Key`, `content`, `description`
2. Se tem `r2Key`: download R2 → extração de texto → normalização
3. Se não tem `r2Key`: usa `content` ou `description` como fallback (mín. 50 chars)
4. Texto é dividido em chunks (chunker legal para decor/parecer/on, genérico para outros)
5. Embeddings gerados via Gemini `gemini-embedding-001` (768 dimensões, batch de 100)
6. Chunks + embeddings salvos na tabela `DocumentChunk` com `vector(768)`
7. Script: `npx tsx scripts/migrate-to-embeddings.ts` (flags: `--dry-run`, `--limit N`, `--category X`, `--force`, `--concurrency N`; sem `--force` indexa só `pending`/`failed`)
- 📖 Ver `lib/embeddings/document-processor.ts`, `lib/embeddings/gemini-embeddings.ts`, `lib/embeddings/text-chunker.ts`

### Outros padrões (detalhes no código)
- **Vídeo LMS híbrido YouTube/R2** (branch `feat/video-r2-selfhosted`, 2026-07-10): `CourseVideo.storageType` (`'youtube'|'r2'`) discrimina a origem; youtube fields são nuláveis. Vídeo R2 = upload direto-pro-R2 via presigned PUT (`/api/admin/videos/{presigned-url,confirm}`, admin) e playback protegido por matrícula com URL assinada 2h (`GET /api/area-restrita/videos/[id]/url` — checa enrollment/subscription antes de `getSignedR2Url`). `LessonVideo` referencia o `CourseVideo` mestre via `courseVideoId`. `sizeBytes` é `String?` (evita BigInt na serialização). Superfícies públicas de embed (novidades/newsletter) filtram `storageType:'youtube'`.
- **Single-flight em `withCache`** (`lib/cache/redis-client.ts`): promises concorrentes p/ a mesma key são compartilhadas (`inFlight` Map + try/finally) — default-on, sem cache poisoning.
- **Atos Legislativos — embeddings separados** (`lib/embeddings/legislative-act-processor.ts`, `scripts/index-legislative-acts.ts`): `LegislativeActChunk` é separada de `DocumentChunk`; a busca semântica faz UNION ALL entre as duas e `sourceType` ('document' | 'legislative-act' | 'tribunal-decision') diferencia a origem.
- **Document Versioning** (`DocumentVersion`): cada update cria uma versão; significance scoring (0-100) prioriza a notificação; admin revisa antes de publicar aos alunos.
- **Informativos TCU** (`lib/tcu-informativo-scraper.ts`, cron `sync-tcu-informativos`): fonte canônica = **CSV de dados abertos do TCU** (`sites.tcu.gov.br/dados-abertos/.../boletim-informativo-lc.csv`), NÃO o portal SPA. Dedup por número.

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
| `search` | gemini | `gemini-2.5-flash` |
| `chat` | gemini | `gemini-2.5-flash` |
| `extraction` | gemini | `gemini-2.5-flash` |
| `classification` | anthropic | `claude-haiku-4-5-20251001` |
| `summarization` | anthropic | `claude-haiku-4-5-20251001` |
| `enhancement` | anthropic | `claude-sonnet-4-20250514` |

Override por env: `AI_<TASK>_PROVIDER` e `AI_<TASK>_MODEL`. Ex.:
```
AI_SEARCH_PROVIDER=gemini
AI_SEARCH_MODEL=gemini-2.5-pro
```

Embeddings continuam fora desta camada (interface diferente, controlado por `EMBEDDING_MODEL`).

Esta camada inclui retry com backoff exponencial em erros transitórios (429/5xx/rede) e logging estruturado via pino. Persistência de auditoria em DB ainda não implementada (aguarda criação do modelo `AuditLog`).

## Eval framework (`eval/`)

Framework de avaliação da busca jurídica. Golden set em `eval/golden-set.json`; reports versionados em `eval/reports/`.

- **Retrieval:** `npm run eval:run` (recall@5/@10, recall@5-primário, MRR, nDCG@10) · `npm run eval:sweep` (varredura alpha×RRF_K) · `npm run eval:annotate` (interativo). R$0 (embeddings/FTS).
- **Síntese (régua LLM-as-judge):** `npm run eval:synthesis` (faithfulness/citações/completude/overall via juiz Claude). ⚠️ **CARO** (Claude por query) — estimar custo e autorizar antes de N grande.

Ver `eval/README.md`. ⚠️ **Trilha de tuning de retrieval FECHADA** (`docs/ROADMAP_BUSCA_QUALIDADE.md`) — não reabrir experimentos de retrieval sem dado novo.

## Notes for Future Claude Instances

- Este é um site em PRODUÇÃO - cuidado com mudanças
- Sempre testar fluxos de autenticação após alterações
- Usar padrão de error handling estabelecido (Fase 8) em todas novas rotas
- Atualizar este CLAUDE.md quando adicionar features
- Manter tom formal e profissional (contexto jurídico)
- **Campanha de saneamento 2026-05:** 60 PRs em 6 ondas. Padrões consolidados: `withAdminApi`/`withUserApi`/`withPublicApi` em rotas (Onda 4), `lib/ai/index.ts` `generate()` como porta única para LLM (Onda 4.4), `lib/lms/` helpers (Onda 4.6), single-flight em `withCache` (Onda 4.7), `leiArticlesArr` array nativo (Onda 4.5). Antes de adicionar nova rota/feature, verificar se existe helper consolidado.

**Business Rules:**

- Bibliografia SEMPRE pública
- QR Code trial: 1 mês (antes era 1 ano) — enrollments existentes mantêm expiração original
- Registro funciona com e sem QR Code (qrCodeId é opcional)
- Subscription ativa → enrollments sem `expiresAt` (gerenciado pelo Stripe)
- Subscription cancelada → remove enrollments sem `qrCodeId` (preserva presenciais)
- Acesso = enrollment válido OU subscription ativa (verificar ambos)
- Stripe lazy init: `getStripe()` evita erro no build — NUNCA instanciar Stripe client no top-level
- Webhook Stripe é idempotente via tabela `ProcessedWebhookEvent` — não reprocessar `event.id` já visto
- Enrollment expiration: lógica crítica (notificações, renovações)
- Excel import: manter compatibilidade com templates
- Multi-course docs: um documento pode pertencer a vários cursos
- Chat queries limitadas a documentos do curso ativo do usuário


---

**First Time Setup (Windows — ambiente atual):**

```bash
cd "C:/Users/User/projetos/sitedobarral"
npm install
cp .env.example .env.local  # Editar com seus valores
npx prisma generate && npx prisma db push
node scripts/create-admin.js admin@email.com password123 "Admin Name"
npm run dev
```

**Workflow git:** trunk-based em `main` (branch `develop` deletada em abr/2026). Ritmo atual: ~13 commits/dia. **Auto-deploy ATIVO** (GitHub conectado ao projeto Vercel, ~4min build/deploy típico). PRs aprovadas e merged em main disparam deploy automaticamente.

