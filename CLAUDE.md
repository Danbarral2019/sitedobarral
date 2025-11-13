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

**Tech Stack:** Next.js 15.5.2 (App Router) • React 19.1.0 • TypeScript 5 • Prisma ORM • PostgreSQL (Neon) • Tailwind CSS 4 • Radix UI • JWT Auth • Resend Email • MailChimp • Playwright/PostgreSQL/GitHub/Gemini MCP

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
- `prisma/schema.prisma` - Database schema (24 models)
- `scripts/` - Admin/import/scraping scripts

**Key Models (24 total):**


- `User` - Admin/student accounts
- `Enrollment` - Course access (1 year expiration, lifetime upgrade)
- `QRCode` - Enrollment codes
- `Document` - PDFs/links/videos with versioning
- `DocumentVersion` - Change tracking
- `BlogPost`, `Publication`, `Testimonial`, `ContactForm`
- `FAQ`, `FAQFeedback`, `GlossaryTerm`, `LegislativeAct`
- `CourseVideo`, `SocialMediaPost`, `RecommendedSite`, `SiteToCourse`
- `AccessLog` - Audit trail
- `NewsletterSubscriber`, `Favorite`, `ArticleQuestion`
- `DocumentAnalysis`, `DOUStagingDocument`, `DOUSavedFilter`

**Auth Flows:**


1. QR Code → Registration → Enrollment (1 year)
2. Email/Password → Login → JWT cookie

**Document Access:**

- Public: `isPublic=true`
- Private: requires valid enrollment
- Bibliography: SEMPRE público


## Recent Features

**🤖 Chat RAG com Busca Semântica (2025-11-12):**
- ✅ Interface de chat com busca semântica via Google Gemini
- ✅ Endpoint `/api/documents/query` com caching inteligente
- ✅ Componente `ChatInterface` reutilizável
- ✅ Página `/area-restrita/assistente` para alunos
- ✅ Banner promocional destacado na área restrita
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

**Chat RAG Issues:**

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

**Admin:** `/api/admin/*` (QR codes, documents, blog, publications, analytics)

**Cron:** `/api/enrollment/check-expiration`, `/api/cron/import-documents`, `/api/cron/monthly-newsletter`

Ver código para endpoints completos.

## Development Status

**✅ Completed:**
- Auth (JWT, QR codes, enrollment system)
- Document management (versioning, Excel import, safe parsing)
- Blog, publications, newsletter, social media
- TCU/AGU scrapers with AI summaries
- Error handling system (Fase 8 - 97% audit complete)
- Chat RAG with semantic search (Gemini)

**🚧 In Progress:**
- DOU classifier
- Complete AGU extraction (205 Pareceres + 1,627 DECOR)
- Admin versioning UI

**📋 Planned (Fases 9-11):**
- Fase 9: Automated testing (Vitest, 80%+ coverage)
- Fase 10: Redis caching (+70% performance)
- Fase 11: Monitoring (Sentry, Vercel Analytics)
- Payment integration, full-text search, PWA

## Important Architecture Patterns

### Chat RAG Flow
1. User query → `/api/documents/query` POST
2. API calls Gemini with user query + document context
3. Gemini returns structured response with relevance scores
4. Response cached with query hash (60s TTL)
5. Frontend displays sources with citations

### Error Handling Flow (Established in Fase 8)
1. Route handler throws semantic error (`NotFoundError`, `ValidationError`, etc.)
2. `handleApiError()` catches and classifies error type
3. Prisma/Zod/JWT errors automatically mapped to correct HTTP status
4. Structured logging with context (apiLogger, authLogger)
5. Client receives standardized JSON response

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