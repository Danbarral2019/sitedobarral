# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL REMINDERS

1. **Working Directory:** SEMPRE rodar comandos de `C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral\`
2. **Course IDs:** Database usa IDs numéricos (`'1'`, `'2'`), URLs usam slugs. Ver `COURSE_IDS_REFERENCE.md`
3. **Documents:** NUNCA acessar `course.restrictedDocuments` - buscar via `/api/documents`
4. **React Hooks:** Todos hooks ANTES de early returns
5. **Prisma Engine:** Se der erro, matar Node.js e rodar `npx prisma generate`
6. **Lei 14.133 Data:** 195 artigos (193 editados MANUALMENTE + Art. 184-A + Art. 194) - SEMPRE executar `node scripts/backup-lei-14133.js` antes de mudanças no model LeiArticle

## Project Overview

Site profissional do Prof. Daniel Barral especializado em Direito Administrativo, Licitações e Contratos. Repositório de materiais jurídicos com acesso público e área restrita via QR code.

**Tech Stack:** Next.js 15.5.2 (App Router) • React 19.1.0 • TypeScript 5 • Prisma ORM • PostgreSQL (Neon) • Tailwind CSS 4 • Radix UI • JWT Auth • Stripe Subscriptions • Resend Email • MailChimp • Playwright/PostgreSQL/GitHub/Gemini MCP

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
- `components/` - React components
- `prisma/schema.prisma` - Database schema (26 models)
- `scripts/` - Admin/import/scraping scripts
- `lib/email-templates/` - Templates HTML de newsletter

**Key Models (26 total):**


- `User` - Admin/student accounts (+ `stripeCustomerId`)
- `Enrollment` - Course access (1 mês trial via QR, ou gerenciado por Subscription)
- `Subscription` - Assinaturas Stripe (planos basico/premium, status, período)
- `QRCode` - Enrollment codes
- `Document` - PDFs/links/videos with versioning
- `DocumentVersion` - Change tracking
- `BlogPost`, `Publication`, `Testimonial`, `ContactForm`
- `FAQ`, `FAQFeedback`, `GlossaryTerm`, `LegislativeAct`
- `CourseVideo`, `SocialMediaPost`, `RecommendedSite`, `SiteToCourse`
- `AccessLog` - Audit trail
- `NewsletterSubscriber`, `NewsletterSend`, `Favorite`, `ArticleQuestion`
- `DocumentAnalysis`, `DOUStagingDocument`, `DOUSavedFilter`

**Auth Flows:**


1. QR Code → Registration → Enrollment (1 mês trial)
2. Email/Password → Login → JWT cookie
3. Stripe Checkout → Subscription → Enrollments (sem expiração, gerenciado pela subscription)

**Document Access:**

- Public: `isPublic=true`
- Private: requires valid enrollment OR active subscription
- Bibliography: SEMPRE público

**Subscription Plans:**
- **Básico** (R$ 49,90/mês): acesso a 1 curso específico + Assistente IA
- **Premium** (R$ 89,90/mês): acesso a todos os cursos (ver `data/courses.ts`) + Assistente IA


## Recent Features

**📧 Newsletter Analytics + Templates (2026-02-17):**
- ✅ Model `NewsletterSend` — tracking de envios (type, totalSent, opens, clicks)
- ✅ Templates HTML reutilizáveis em `lib/email-templates/newsletter.ts` (weekly + monthly)
- ✅ Tracking pixel (open) + redirect (click) em `/api/newsletter/track`
- ✅ Webhooks Resend (bounce/open/click) em `/api/webhooks/resend`
- ✅ Dashboard analytics no `/admin/newsletter` (stat cards, gráfico barras, tabela últimos envios)
- ✅ Crons `monthly-newsletter` e `newsletter-new-content` atualizados com templates + `NewsletterSend`
- 📖 Ver `lib/email-templates/newsletter.ts`, `app/admin/newsletter/analytics.tsx`

**🎓 Certificados LinkedIn + Galeria (2026-02-17):**
- ✅ Botão "Compartilhar no LinkedIn" no `CertificateCard` (URL LinkedIn Certification)
- ✅ Galeria `/area-restrita/meus-certificados` — lista todos certificados do aluno
- ✅ API `GET /api/area-restrita/certificates` — retorna certificados do usuário
- ✅ Links na navegação (AreaRestritaHeader + MobileBottomNav)
- 📖 Ver `components/lms/CertificateCard.tsx`, `app/area-restrita/meus-certificados/page.tsx`

**⚡ Performance — Dynamic Imports + Image Optimization (2026-02-17):**
- ✅ Dynamic imports (`next/dynamic` + `ssr: false`) em 5 páginas admin pesadas
- ✅ Componentes extraídos: `TCUManagerClient`, `ScraperAGUClient`, `AnalyticsClient`, `SearchAnalyticsClient`, `DOUFiltrosClient`
- ✅ `<img>` → `next/image` em `SiteResultCard`, `sites/config`, `depoimentos/config`
- ⚠️ `ssr: false` requer `'use client'` na page.tsx wrapper (Next.js 15)

**📊 LMS — Dashboard Progresso + Notificações (2026-02-17):**
- ✅ Dashboard `/area-restrita/meu-progresso` — XP, streaks, badges, progresso por curso, atividades recentes
- ✅ API `GET /api/area-restrita/progress` — dados agregados do aluno
- ✅ Push notification em `awardBadge()` (gamification.ts) e `issueCertificate()` (certificate.ts)
- ✅ Push notification no cron de inatividade LMS (`lms-inactivity`)
- 📖 Ver `app/area-restrita/meu-progresso/page.tsx`, `lib/gamification.ts`, `lib/certificate.ts`

**⚖️ Embeddings Semânticos para Atos Legislativos (2026-02-15):**
- ✅ Modelo `LegislativeActChunk` (espelha `DocumentChunk`, FK para `LegislativeAct`)
- ✅ 53 atos legislativos indexados com embeddings (801 chunks) na tabela separada
- ✅ Busca semântica UNION ALL: `DocumentChunk` + `LegislativeActChunk` em `performSearch()`
- ✅ Campo `sourceType` ('document' | 'legislative-act') no `SearchResult`
- ✅ Atos semânticos integrados no contexto do query route (legal sources + prompt)
- ✅ Cap de 3 resultados por tipo de ato para evitar flooding
- ✅ Processador dedicado: `lib/embeddings/legislative-act-processor.ts`
- ✅ Script: `npx tsx scripts/index-legislative-acts.ts` (flags: `--dry-run`, `--force`, `--limit N`)
- 📖 Ver `lib/embeddings/vector-search.ts`, `lib/embeddings/legislative-act-processor.ts`

**💳 Stripe Subscriptions — Pagamento e Assinaturas (2026-02-15):**
- ✅ Integração Stripe com Checkout Sessions (hosted page) e Customer Portal
- ✅ 2 planos: Básico (1 curso + IA, R$ 49,90/mês) e Premium (todos cursos + IA, R$ 89,90/mês)
- ✅ Webhook handler: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
- ✅ Enrollment automático via subscription (Básico: 1 curso, Premium: todos os 10)
- ✅ QR Code alterado de 1 ano → 1 mês de trial
- ✅ `hasActiveAccess()` verifica enrollment OU subscription ativa
- ✅ Badge de plano (Básico/Premium) + "Gerenciar Assinatura" no header da área restrita
- ✅ Página `/planos` com cards, seletor de curso, FAQ
- ✅ Páginas callback `/assinatura/sucesso` e `/assinatura/cancelado`
- ✅ Upgrade page redireciona para `/planos`
- ✅ CSP atualizado para `checkout.stripe.com`
- ✅ Lazy initialization do Stripe client (build-safe)
- 📖 Ver `lib/stripe.ts`, `app/api/stripe/`, `app/planos/page.tsx`
- 🔑 Requer: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASICO`, `STRIPE_PRICE_PREMIUM`
- 🚀 Setup: criar Products/Prices no Stripe Dashboard → configurar webhook → `npx prisma db push`

**🔤 Full-Text Search — PostgreSQL tsvector (2026-02-15):**
- ✅ PostgreSQL FTS com stemming português (`portuguese_unaccent`) + `unaccent` extension
- ✅ `search_vector tsvector` + GIN index + triggers em 7 tabelas (Document, GlossaryTerm, LegislativeAct, CourseVideo, RecommendedSite, BlogPost, FAQ)
- ✅ Pesos A/B/C (título/descrição/conteúdo) para ranking por relevância via `ts_rank`
- ✅ `websearch_to_tsquery` — suporta AND, OR, frases entre aspas, negação com `-`
- ✅ FAQ e BlogPost adicionados à busca global (novos tipos `faq` e `blog`)
- ✅ ILIKE substituído por FTS na rota `/api/area-restrita/global-search`
- ✅ Error handling migrado para `handleApiError()` (padrão Fase 8)
- 📖 Ver `lib/search/full-text-search.ts`, `scripts/setup-full-text-search.ts`
- 🚀 Setup: `npx tsx scripts/setup-full-text-search.ts` | Verificar: `--verify`

**📊 Fase 11 — Monitoring e Observability (2026-02-15):**
- ✅ `Sentry.captureException()` no `handleApiError()` para erros 500+ (Prisma conexão, validação, genérico)
- ✅ `Sentry.setUser({ id, email, role })` no middleware após auth (`withAuth`, `withAdminAuth`)
- ✅ `trackServerEvent()` via Sentry breadcrumbs em 8 rotas (login, register, download, upgrade, ai_search, qr_scan, contact, newsletter)
- ✅ `trackClientEvent()` via Vercel Analytics em 2 componentes (GlobalSearchBar, ChatInterface)
- 📖 Ver `lib/monitoring/events.ts`, `lib/monitoring/track-client.ts`

**📦 Indexação Completa de Documentos no pgvector (2026-02-07):**
- ✅ 428/429 documentos indexados com embeddings no pgvector (1.598 chunks)
- ✅ Pipeline adaptado para documentos sem R2 (usa `content`/`description` como fallback)
- ✅ DECOR (171), Enunciados (129), ONs (96), Pareceres Vinculantes (20), Acórdãos (8) indexados
- ✅ Categoria `decor` adicionada ao chunker de documentos legais
- ⚠️ 1 doc não indexável: ON AGU nº 41/2014 (descrição < 50 chars)
- 📖 Ver `lib/embeddings/document-processor.ts`, `scripts/migrate-to-embeddings.ts`

**🔍 Busca Global com IA Integrada (2026-02-07):**
- ✅ Busca textual (300ms) + busca semântica IA (1.5s) em paralelo no campo de busca global
- ✅ Card "Análise IA" com resposta sintetizada aparece acima dos resultados tradicionais
- ✅ Toggle para ativar/desativar busca IA (botão Sparkles roxo/cinza)
- ✅ Enter dispara busca IA imediatamente (cancela debounce de 1.5s)
- ✅ Tratamento de rate limit (429) com mensagem amigável
- ✅ Fontes com badges de relevância percentual no card IA
- 📖 Ver `hooks/use-global-search.ts`, `components/area-restrita/GlobalSearchBar.tsx`, `components/area-restrita/SearchResultsList.tsx`

**🤖 Chat RAG com Busca Semântica (2025-11-12):**
- ✅ Interface de chat com busca semântica via Google Gemini
- ✅ Endpoint `/api/documents/query` com caching inteligente
- ✅ Componente `ChatInterface` reutilizável
- ✅ Página `/area-restrita/assistente` para alunos (chat completo)
- ✅ Histórico de conversas com localStorage
- ✅ Sugestões de perguntas contextuais
- ✅ Citações de fontes com relevância percentual
- 📖 Ver `components/ChatInterface.tsx` e `app/area-restrita/assistente/page.tsx`

**Sistema de Tratamento de Erros (2025-11-04) - Fase 8:**
- ✅ 9 classes de erro customizadas (`ApiError`, `ValidationError`, `AuthenticationError`, etc.)
- ✅ Handler centralizado com tratamento de Prisma, Zod, JWT
- ✅ `ErrorBoundary` React component para erros de renderização
- ✅ Status HTTP semânticos (400, 401, 403, 404, 409, 429, 500, 503)
- ✅ Logging estruturado com Pino (apiLogger, authLogger)
- ✅ 8+ rotas refatoradas com novo padrão
- 📖 Ver `lib/errors/api-error.ts`, `lib/errors/error-handler.ts`, `components/ErrorBoundary.tsx`

**MCP Gemini (2025-11-05) - v2.0.0:**
- ✅ MCP server customizado para integração Claude ↔ Gemini
- ✅ 5 tools: query, code_review, compare_approaches, brainstorm, collaborate
- ✅ Configuração global em `~/.claude-mcp-servers/gemini/`
- 🔑 Requer `GEMINI_API_KEY` (<https://aistudio.google.com/app/apikey>)
- 📖 Ver `~/.claude-mcp-servers/gemini/README.md`

**🚀 AGU Scraper v4:**
- ✅ Sistema de versionamento automático com detecção de mudanças
- ✅ 97 Orientações Normativas com análise de relevância
- ✅ Significance scoring (0-100) para mudanças
- 📖 Ver `AGU_SCRAPER_V4.md` e `RESUMO_FINAL_AGU_SCRAPER_COMPLETO.md`

**TCU Manager:**
- ✅ Interface admin unificada
- ✅ Web scraping + AI summaries
- ✅ Excel converter (`npm run convert-tcu`)

**Parse Seguro de Tags:**
- ✅ Função `safeParseArray()` suporta CSV e JSON
- ✅ Script de migração `scripts/fix-csv-tags.ts` para conversão CSV→JSON


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

**Stripe (Subscriptions):**

- `STRIPE_SECRET_KEY` - Chave secreta (`sk_test_...` ou `sk_live_...`)
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (`whsec_...`)
- `STRIPE_PRICE_BASICO` - Price ID do plano Básico (`price_...`)
- `STRIPE_PRICE_PREMIUM` - Price ID do plano Premium (`price_...`)
- `NEXT_PUBLIC_PRICE_BASICO` - Valor exibido no frontend (ex: `49,90`)
- `NEXT_PUBLIC_PRICE_PREMIUM` - Valor exibido no frontend (ex: `89,90`)

**Optional:**

- `ANTHROPIC_API_KEY` - AI summaries
- `GEMINI_API_KEY` - Chat RAG e busca semântica
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

**Modelo Gemini descontinuado:**
- ⚠️ `gemini-2.0-flash-exp` foi removido pela Google (404 Not Found)
- ✅ Usar `gemini-2.0-flash` (modelo estável de produção)
- Arquivos afetados: `lib/gemini/cached-client.ts`, `lib/gemini-helper.js`, `lib/text-extractor.ts`, `lib/embeddings/document-processor.ts`, `app/api/artigos/[numero]/chat/route.ts`, `app/api/lei-14133/search/route.ts`

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
- `CONFIGURACAO_EMAIL.md` - Resend config
- `MCP_SETUP.md` - MCPs instalação

**Features:**


- `AGU_SCRAPER_V4.md` - AGU scraping platform
- `RESUMO_FINAL_AGU_SCRAPER_COMPLETO.md` - AGU resumo técnico
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

**Auditoria:**

- `AUDITORIA_CHECKPOINT_FASE_8_FINAL.md` - Status Fase 8 (Error Handling)
- `AUDITORIA_FASES_8-11_PLANO.md` - Roadmap Fases 8-11


## API Routes Summary

**Public:**
- `/api/auth/*` - Login, register, logout
- `/api/documents` - Document queries (requires auth)
- `/api/documents/query` - Semantic search with Gemini (NEW)
- `/api/newsletter` - Newsletter subscription
- `/api/contact` - Contact form

**Stripe:** `/api/stripe/*`
- `POST /api/stripe/checkout` - Cria Checkout Session (withAuth, recebe `{ plan, courseId? }`)
- `POST /api/stripe/webhook` - Webhook handler (sem auth, verificação via signature)
- `POST /api/stripe/portal` - Cria Customer Portal session (withAuth)

**Newsletter:** `/api/newsletter/*`
- `GET /api/newsletter/track` - Pixel tracking (opens) + redirect tracking (clicks)

**Webhooks:**
- `POST /api/webhooks/resend` - Resend webhooks (bounce, open, click)

**Área Restrita:** `/api/area-restrita/*`
- `GET /api/area-restrita/certificates` - Certificados do aluno
- `GET /api/area-restrita/progress` - Dados agregados de progresso LMS

**Admin:** `/api/admin/*` (QR codes, documents, blog, publications, analytics)

**Cron:** `/api/enrollment/check-expiration`, `/api/cron/import-documents`, `/api/cron/monthly-newsletter`, `/api/cron/lms-inactivity`

Ver código para endpoints completos.

## Development Status

**✅ Completed:**
- Auth (JWT, QR codes, enrollment system)
- Document management (versioning, Excel import, safe parsing)
- Blog, publications, newsletter, social media
- TCU/AGU scrapers with AI summaries
- Error handling system (Fase 8 - 97% audit complete)
- Chat RAG with semantic search (Gemini)
- Busca global com IA integrada (busca textual + semântica em paralelo)
- Indexação pgvector completa: 428/429 docs, 1.598 chunks (DECOR, ONs, enunciados, pareceres vinculantes, acórdãos)
- Fase 9: Automated testing (Vitest, 577 tests, 84%+ coverage)
- Fase 10: Redis caching extensão e padronização (+50 rotas)
- Fase 11: Monitoring (Sentry captureException em erros 500+, setUser após auth, tracking events server/client via Vercel Analytics)
- Admin Versioning UI: histórico de versões (timeline), diff viewer, seção collapsible na página de edição
- Full-Text Search: PostgreSQL tsvector + GIN + stemming português em 7 tabelas, FAQ e Blog na busca global
- Stripe Subscriptions: Checkout, Webhook, Portal, 2 planos (Básico/Premium), QR Code trial 1 mês
- Newsletter Analytics: templates HTML, tracking pixel/redirect, webhooks Resend, dashboard admin
- Certificados: botão LinkedIn, galeria `/area-restrita/meus-certificados`
- Performance: dynamic imports em 5 admin pages, `<img>` → `next/image`
- LMS Progresso: dashboard `/area-restrita/meu-progresso`, push em badge/certificado, cron inatividade
- DOU Classifier: pipeline classificação (keyword + IA), admin UI, cron diário, 7 endpoints, 3 suítes de teste
- Melhorias na Busca IA: reclassificação de artigos (4 categorias, 482 docs), consciência temporal, fidelidade ao texto, re-indexação embeddings

**🚧 In Progress:**
- (nenhum)

## Important Architecture Patterns

### Stripe Subscription Flow
1. User → `/planos` → escolhe plano → `POST /api/stripe/checkout` → redirect para Stripe Checkout
2. Stripe Checkout → pagamento → redirect para `/assinatura/sucesso`
3. Stripe envia webhook `checkout.session.completed` → cria `Subscription` + `Enrollment(s)` no banco
4. Renovação: `invoice.paid` → atualiza `currentPeriodEnd`
5. Falha: `invoice.payment_failed` → status `past_due`
6. Cancelamento: `customer.subscription.deleted` → status `canceled` → remove enrollments (não-presenciais)
7. Portal: `POST /api/stripe/portal` → redirect para Stripe Customer Portal (cancelar, trocar cartão)
8. Acesso: `hasActiveAccess()` verifica enrollment válido OU subscription `active`
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
2. API calls Gemini (`gemini-2.0-flash`) with user query + document context
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
7. Script: `npx tsx scripts/migrate-to-embeddings.ts` (flags: `--dry-run`, `--limit N`, `--force`, `--concurrency N`)
8. Stats: 428/429 docs indexados, 1.598 chunks, 1 falha (ON 41/2014 — texto insuficiente)
- 📖 Ver `lib/embeddings/document-processor.ts`, `lib/embeddings/gemini-embeddings.ts`, `lib/embeddings/text-chunker.ts`

### Atos Legislativos — Embeddings Separados
1. `processLegislativeAct()` busca ato, monta texto (fullNumber + ementa + content)
2. Chunka com `chunkLegalDocument()` (1200 chars, overlap 200)
3. Embeddings gerados via Gemini `gemini-embedding-001` (768 dimensões)
4. Chunks salvos na tabela `LegislativeActChunk` (separada de `DocumentChunk`)
5. Busca semântica usa UNION ALL entre `DocumentChunk` e `LegislativeActChunk`
6. Campo `sourceType` ('document' | 'legislative-act') diferencia a origem
7. Script: `npx tsx scripts/index-legislative-acts.ts` (flags: `--dry-run`, `--force`, `--limit N`)
8. Stats: 53 atos indexados, 801 chunks
- 📖 Ver `lib/embeddings/legislative-act-processor.ts`, `scripts/index-legislative-acts.ts`

### Document Versioning
- Each document update creates a `DocumentVersion` record
- Significance scoring (0-100) determines notification priority
- Change detection compares fields (title, content, url, etc.)
- Admin can review changes before publishing to students

## Notes for Future Claude Instances

- Este é um site em PRODUÇÃO - cuidado com mudanças
- Sempre testar fluxos de autenticação após alterações
- Usar padrão de error handling estabelecido (Fase 8) em todas novas rotas
- Atualizar este CLAUDE.md quando adicionar features
- Manter tom formal e profissional (contexto jurídico)

**Business Rules:**

- Bibliografia SEMPRE pública
- QR Code trial: 1 mês (antes era 1 ano) — enrollments existentes mantêm expiração original
- Subscription ativa → enrollments sem `expiresAt` (gerenciado pelo Stripe)
- Subscription cancelada → remove enrollments sem `qrCodeId` (preserva presenciais)
- Acesso = enrollment válido OU subscription ativa (verificar ambos)
- Stripe lazy init: `getStripe()` evita erro no build — NUNCA instanciar Stripe no top-level
- Enrollment expiration: lógica crítica (notificações, renovações)
- Excel import: manter compatibilidade com templates
- Multi-course docs: um documento pode pertencer a vários cursos
- Chat queries limitadas a documentos do curso ativo do usuário


---

**First Time Setup:**

```bash
cd "C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral"
npm install
cp .env.example .env.local  # Edit with your values
npx prisma generate && npx prisma db push
node scripts/create-admin.js admin@email.com password123 "Admin Name"
npm run dev
```

**Mais detalhes:** Ver arquivos de documentação listados acima.