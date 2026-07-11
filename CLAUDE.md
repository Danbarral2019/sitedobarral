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

# Full-Text Search / Embeddings (flags: --verify, --dry-run, --force)
npx tsx scripts/setup-full-text-search.ts
npx tsx scripts/migrate-to-embeddings.ts               # indexa docs pendentes no pgvector
npx tsx scripts/index-legislative-acts.ts              # indexa atos legislativos
```

**Test Credentials:** Student `aluno@teste.com` / `aluno123` (Nova Lei de Licitações) · Admin: criar via `node scripts/create-admin.js`.

## Architecture Quick Reference

**Structure:**

- `app/` - Next.js routes (public, `/area-restrita`, `/admin`)
- `lib/` - Core utilities (auth, email, scrapers, versioning)
- `lib/agu-modules/` - AGU scrapers (ONs, Pareceres, DECOR, Súmulas)
- `lib/lms/` - Helpers LMS analytics (query-timing, analytics-queries, progress-aggregation) — criado na Onda 4.6
- `components/` - React components
- `prisma/schema.prisma` - Database schema (~70 models)
- `scripts/` - Admin/import/scraping scripts
- `lib/email-templates/` - Templates HTML de newsletter

**Key Models** (fonte de verdade: `prisma/schema.prisma` — ~70 models; ver o schema para o conjunto completo e campos). Por área:
- **Auth/Acesso:** `User`, `Enrollment` (trial 1 mês via QR ou Subscription), `Subscription` (Stripe), `QRCode`, `AccessLog`, `ProcessedWebhookEvent`.
- **Conteúdo:** `Document` (+ `DocumentChunk` p/ embeddings, `DocumentVersion`, `DocumentMetaTcu/Dou`), `LegislativeAct` (+ `LegislativeActChunk`, `LegislativeActRelation`), `LeiArticle` (Lei 14.133, 195 arts. + embeddings/cross-refs), `BlogPost`, `FAQ`, `GlossaryTerm`, `DOUStagingDocument`.
- **LMS:** `Module`, `Lesson` (+ progress/comments), `Quiz*`, `Certificate`, `Badge`, `UserStreak`, `CourseStatus`.
- **Jurisprudência:** `TribunalDecision` (+ `TribunalDecisionChunk`), `ScraperHealthLog`.
- **Clipping/Newsletter:** `DailyClippingSend`, `NewsletterSubscriber/Send`, `PushSubscription`.
- **Planejamento:** `Planning*` (Session, Document, Templates, DecisionRun…). **Busca:** `SearchHistory`, `IndexJob`.

**Auth Flows:** (1) QR Code → Registration → Enrollment (1 mês trial); (2) Registro aberto → Verificação email → Login → Planos → Pagamento; (3) Email/Password → Login → JWT cookie; (4) Stripe Checkout (cartão) ou PIX → Webhook → Subscription + Enrollments.

**Document Access:** Public = `isPublic=true`; Private = enrollment válido OU subscription ativa; Bibliografia = SEMPRE pública.

**Subscription Plans:** Básico (R$ 49,90/mês) = 1 curso + Assistente IA · Premium (R$ 89,90/mês) = todos os cursos (ver `data/courses.ts`) + Assistente IA.

## Histórico / Changelog

Features concluídas + changelog detalhado em `docs/PROJECT_HISTORY.md` (e no git). Este arquivo mantém só o ativo: regras, arquitetura e status atual.

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
// ❌ WRONG — course.restrictedDocuments vem vazio
const docs = course.restrictedDocuments;
// ✅ CORRECT
const response = await fetch(`/api/documents?courseId=${courseId}`);
const { documents } = await response.json();
```

### Error Handling Pattern (Fase 8)

```typescript
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const resource = await prisma.resource.findUnique({ where: { id } });
    if (!resource) {
      apiLogger.warn({ resourceId: id }, 'Resource not found');
      throw new NotFoundError('Resource');   // erro semântico, NÃO NextResponse.json cru
    }
    return NextResponse.json({ resource });
  } catch (error) {
    return handleApiError(error);            // catch único; status HTTP automático
  }
}
```

**Key points:** lançar erros semânticos (`NotFoundError`, `ValidationError`, …); `apiLogger` com contexto; um só `catch` com `handleApiError()`; status codes automáticos (404/400/401/403/409/429/500/503). Nas rotas novas, preferir os wrappers `withAdminApi`/`withUserApi`/`withPublicApi` (Onda 4).

### Gotchas específicos do projeto

- **Versionamento — identificadores únicos:** ONs = `onNumber + onYear`; Pareceres = `title` (numeroCompleto). Usar no `findFirst`, não o id.
- **Modelo Gemini:** usar `gemini-2.5-flash` (`PRIMARY_GEMINI_MODEL` em `lib/gemini/config.ts`). Em tarefas curtas (resumo/classificação) passar `thinkingBudget: 0` — senão o thinking do 2.5 consome ~95% do `maxOutputTokens` e trunca. (Os `gemini-2.0-flash*` foram desligados pela Google em 2026; histórico em `docs/ROADMAP_GEMINI_MODELO_25.md`.)

➡️ **Problemas comuns de ambiente/dev** (Prisma engine, MCP, build limpo, tags parse, hydration): ver `docs/TROUBLESHOOTING.md`.

## Environment Variables

**Required:** `DATABASE_URL` (Neon), `JWT_SECRET` (`openssl rand -base64 32`), `NEXT_PUBLIC_BASE_URL`.
**Email:** `RESEND_API_KEY`, `EMAIL_FROM`.
**Stripe:** `STRIPE_SECRET_KEY` (`sk_live_`/`sk_test_`), `STRIPE_WEBHOOK_SECRET` (`whsec_`), `NEXT_PUBLIC_PRICE_BASICO`, `NEXT_PUBLIC_PRICE_PREMIUM`.
**Optional:** `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GEMINI_API_KEY_BACKUP` (fallback em 429/RESOURCE_EXHAUSTED antes de degradar p/ FTS — ver `lib/gemini/api-key-fallback.ts`), `MAILCHIMP_*`, `INSTAGRAM_*`/`LINKEDIN_*`, `CRON_SECRET`.

Ver `.env.example` e `SETUP.md`. Chat RAG: Gemini key via MCP global (`~/.claude-mcp-servers/gemini/`); `claude mcp list` deve mostrar "gemini: ✓ Connected".

## API Routes Summary

- **Public:** `/api/auth/*`, `/api/documents` (+ `/query` = busca semântica/RAG), `/api/newsletter` (+ `/track`), `/api/contact`.
- **Pagamentos (Stripe):** `/api/pagamento/{checkout,status,webhook}` (path histórico após reversão MP→Stripe). Checkout Zod-validado `{plan,billingCycle,method,courseId?}` → `{url}`; webhook sem auth, verifica `STRIPE_WEBHOOK_SECRET`, idempotência via `ProcessedWebhookEvent`.
- **Área Restrita:** `/api/area-restrita/*` (certificates, progress, global-search, global-search/hybrid). **Admin:** `/api/admin/*`. **Jurisprudência:** `/api/jurisprudencia[/id]`. **Webhooks:** `/api/webhooks/resend`.
- **Crons:** lista + schedules em `vercel.json`. Demais endpoints: ver o código.

## Development Status

**Estado atual (jul/2026):** produto em produção. Assistente de IA usa **Claude Sonnet 5 + Citations API**; síntese (BIA-1) e cobertura de dados (BIA-5) melhoradas. **Trilha de tuning de retrieval FECHADA com evidência** — recall@5 ~65% é o teto do dataset; próximos ganhos vêm de answer-quality ou mais dados, não tuning (ver `docs/ROADMAP_BUSCA_QUALIDADE.md`).
- **Pagamentos:** Stripe **LIVE e cobrando por cartão** (smoke E2E validado jul/2026). Único gap = **PIX** (Pix Automático é "invite only"; código pronto atrás de `NEXT_PUBLIC_PIX_ENABLED`, aguarda convite da Stripe).
- **Pré-lançamento:** coming-soon **ativado** (`COMING_SOON_ENABLED`). 
- **Backlog:** `FUTURE_TASKS.md` · **Changelog:** `docs/PROJECT_HISTORY.md` + git.

## Important Architecture Patterns

Padrões não-óbvios; o passo-a-passo completo se deriva do código apontado.

- **Stripe Subscription Flow** (`lib/stripe.ts` lazy init `getStripe()`, `lib/enrollment-utils.ts`): `/planos` → `POST /api/pagamento/checkout` (Zod) → Checkout Session → callbacks `/assinatura/*` → webhook `/api/pagamento/webhook`. `checkout.session.completed`/`invoice.paid` cria/renova `Subscription`+`Enrollment`; `subscription.deleted`/`payment_failed` cancela e remove enrollments **sem `qrCodeId`** (preserva presenciais). Acesso via `hasActiveAccess()`. Webhook **idempotente** (`ProcessedWebhookEvent`).
- **Busca Global com IA** (composição no frontend, hook `useGlobalSearch` c/ AbortController): 300ms debounce → `GET /api/area-restrita/global-search` (resultados tradicionais) · 1500ms/Enter → `POST /api/documents/query` (card "Análise IA"). Toggle IA no `GlobalSearchBar`; `AIAnswerCard` renderiza no `SearchResultsList`.
- **Chat RAG** (`/api/documents/query`): Gemini (`gemini-2.5-flash`) com query + contexto → resposta estruturada com relevance scores → cache por query-hash (60s TTL) → fontes citadas.
- **Error Handling** (Fase 8): rota lança erro semântico → `handleApiError()` classifica (Prisma/Zod/JWT → HTTP) → log estruturado → JSON padronizado.
- **Embeddings/pgvector** (`lib/embeddings/document-processor.ts`, `gemini-embeddings.ts`, `text-chunker.ts`): doc c/ `r2Key` → download R2 + extração; senão `content`/`description` (mín. 50 chars). Chunker legal (decor/parecer/on) vs genérico. Gemini `gemini-embedding-001` (768d, batch 100) → `DocumentChunk` `vector(768)`. Script `scripts/migrate-to-embeddings.ts` (`--dry-run`/`--limit`/`--category`/`--force`/`--concurrency`; sem `--force` só `pending`/`failed`).
- **Vídeo LMS híbrido YouTube/R2** (2026-07): `CourseVideo.storageType` (`'youtube'|'r2'`) discrimina origem (youtube fields nuláveis). R2 = upload direto via presigned PUT (`/api/admin/videos/{presigned-url,confirm}`, admin) + playback com URL assinada 2h (`GET /api/area-restrita/videos/[id]/url` checa enrollment antes de `getSignedR2Url`). `LessonVideo.courseVideoId` referencia o mestre. `sizeBytes` é `String?` (evita BigInt na serialização). Superfícies públicas de embed filtram `storageType:'youtube'`.
- **Single-flight em `withCache`** (`lib/cache/redis-client.ts`): promises concorrentes p/ a mesma key compartilhadas (`inFlight` Map + try/finally), default-on.
- **Atos Legislativos — embeddings separados** (`lib/embeddings/legislative-act-processor.ts`): `LegislativeActChunk` separada de `DocumentChunk`; busca faz UNION ALL e `sourceType` (`document`|`legislative-act`|`tribunal-decision`) diferencia a origem.
- **Document Versioning** (`DocumentVersion`): cada update cria versão; significance scoring (0-100); admin revisa antes de publicar.
- **Informativos TCU** (`lib/tcu-informativo-scraper.ts`, cron `sync-tcu-informativos`): fonte canônica = **CSV de dados abertos do TCU**, NÃO o portal SPA. Dedup por número.

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

Tasks e defaults:

| Task | Provider | Modelo default |
|---|---|---|
| `search` / `chat` / `extraction` | gemini | `gemini-2.5-flash` |
| `classification` / `summarization` | anthropic | `claude-haiku-4-5-20251001` |
| `enhancement` | anthropic | `claude-sonnet-4-20250514` |

Override por env: `AI_<TASK>_PROVIDER` / `AI_<TASK>_MODEL` (ex.: `AI_SEARCH_MODEL=gemini-2.5-pro`). Embeddings ficam fora desta camada (`EMBEDDING_MODEL`). Inclui retry com backoff (429/5xx/rede) + logging pino. Auditoria em DB ainda não implementada (aguarda model `AuditLog`).

## Eval framework (`eval/`)

Golden set em `eval/golden-set.json`; reports em `eval/reports/`.
- **Retrieval:** `npm run eval:run` (recall@5/@10, recall@5-primário, MRR, nDCG@10) · `npm run eval:sweep` (alpha×RRF_K) · `npm run eval:annotate`. R$0 (embeddings/FTS).
- **Síntese (LLM-as-judge):** `npm run eval:synthesis` (faithfulness/citações/completude/overall). ⚠️ **CARO** (Claude por query) — estimar custo e autorizar antes de N grande.

Ver `eval/README.md`. ⚠️ **Trilha de tuning de retrieval FECHADA** (`docs/ROADMAP_BUSCA_QUALIDADE.md`) — não reabrir sem dado novo.

## Notes for Future Claude Instances

- Este é um site em PRODUÇÃO — cuidado com mudanças; sempre testar fluxos de autenticação após alterações.
- Usar o error handling da Fase 8 + wrappers `withAdminApi`/`withUserApi`/`withPublicApi` em rotas novas.
- Atualizar este CLAUDE.md ao adicionar features; manter tom formal (contexto jurídico).
- **Campanha de saneamento 2026-05:** 60 PRs em 6 ondas. Padrões consolidados: wrappers de rota (Onda 4), `lib/ai` `generate()` como porta única de LLM (Onda 4.4), `lib/lms/` helpers (Onda 4.6), single-flight em `withCache` (Onda 4.7), `leiArticlesArr` array nativo (Onda 4.5). Antes de nova rota/feature, verificar se há helper consolidado.

**Business Rules:**

- Bibliografia SEMPRE pública. QR Code trial: 1 mês (enrollments antigos mantêm expiração original). Registro funciona com/sem QR (`qrCodeId` opcional).
- Subscription ativa → enrollments sem `expiresAt` (Stripe gerencia). Cancelada → remove enrollments sem `qrCodeId` (preserva presenciais). Acesso = enrollment válido OU subscription ativa (verificar ambos).
- Stripe lazy init: `getStripe()` — NUNCA instanciar client no top-level. Webhook idempotente (`ProcessedWebhookEvent`, não reprocessar `event.id`).
- Multi-course docs: um documento pode pertencer a vários cursos. Chat queries limitadas aos documentos do curso ativo.

---

**First Time Setup (Windows):**

```bash
cd "C:/Users/User/projetos/sitedobarral"
npm install
cp .env.example .env.local  # editar com seus valores
npx prisma generate && npx prisma db push
node scripts/create-admin.js admin@email.com password123 "Admin Name"
npm run dev
```

**Workflow git:** trunk-based em `main` (`develop` deletada em abr/2026). **Auto-deploy ATIVO** (GitHub↔Vercel, ~4min); PRs merged em `main` disparam deploy automaticamente.
