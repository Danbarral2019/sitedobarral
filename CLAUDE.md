# CLAUDE.md

Guia rápido para Claude Code ao trabalhar neste repositório.

## ⚠️ CRITICAL REMINDERS

1. **Working Directory:** SEMPRE rodar comandos de `C:\Projeto de site do Barral\projeto do site no claude\site-prof-barral\`
2. **Course IDs:** Database usa IDs numéricos (`'1'`, `'2'`), URLs usam slugs. Ver `COURSE_IDS_REFERENCE.md`
3. **Documents:** NUNCA acessar `course.restrictedDocuments` - buscar via `/api/documents`
4. **React Hooks:** Todos hooks ANTES de early returns
5. **Prisma Engine:** Se der erro, matar Node.js e rodar `npx prisma generate`
6. **Lei 14.133 Data:** 193 artigos editados MANUALMENTE - SEMPRE executar `node scripts/backup-lei-14133.js` antes de mudanças no model LeiArticle

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


## Recent Features (2025-11-03)

**🚀 AGU Scraper v4:**

- ✅ Sistema de versionamento automático com detecção de mudanças
- ✅ 97 Orientações Normativas com análise de relevância
- ✅ 10/215 Pareceres Vinculantes (Playwright MCP)
- ✅ 10/1,637 DECOR/CONUNI (Playwright MCP)
- ✅ Significance scoring (0-100) para mudanças
- 📖 Ver `AGU_SCRAPER_V4.md` e `RESUMO_FINAL_AGU_SCRAPER_COMPLETO.md`

**TCU Manager:**


- ✅ Interface admin unificada
- ✅ Web scraping + AI summaries
- ✅ Excel converter (`npm run convert-tcu`)

**Parse Seguro de Tags (2025-11-03):**


- ✅ Função `safeParseArray()` suporta CSV e JSON
- ✅ Aplicado em `lib/documents.ts`, `app/admin/documentos-pendentes/page.tsx`, `app/api/admin/documents/[id]/route.ts`
- ✅ Script de migração `scripts/fix-csv-tags.ts` para conversão CSV→JSON
- ✅ Fix: campo `notes` → `adminNotes` no schema
- ✅ Fix: hydration mismatch no Header com `isMounted`

**MCP Gemini (2025-11-05) - v2.0.0:**


- ✅ MCP server customizado para integração Claude ↔ Gemini
- ✅ Usa SDK oficial `@google/generative-ai`
- ✅ 5 tools: query, code_review, compare_approaches, brainstorm, collaborate
- ✅ Permite colaboração entre IAs (segunda opinião, revisão, comparação)
- 🌐 **Configuração Global** - Funciona em QUALQUER diretório (scope: user)
- 📂 **Localização:** `~/.claude-mcp-servers/gemini/` (permanente)
- 📖 Ver `~/.claude-mcp-servers/gemini/README.md` e `MIGRATION-GUIDE.md`
- 🔑 Requer `GEMINI_API_KEY` configurada (<https://aistudio.google.com/app/apikey>)
- ⚙️ Setup: `cd ~/.claude-mcp-servers/gemini && ./setup-global.bat` (Win) ou `./setup-global.sh` (Linux/Mac)


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

## Environment Variables

**Required:**

- `DATABASE_URL` - PostgreSQL connection (Neon)
- `JWT_SECRET` - Token signing (`openssl rand -base64 32`)
- `NEXT_PUBLIC_BASE_URL` - Site URL

**Email:**


- `RESEND_API_KEY`, `EMAIL_FROM`

**Optional:**

- `ANTHROPIC_API_KEY` - AI summaries
- `MAILCHIMP_*` - Newsletter
- `INSTAGRAM_*`, `LINKEDIN_*` - Social media
- `CRON_SECRET` - Cron job protection

Ver `.env.example` e `SETUP.md`.


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


## API Routes Summary

**Public:** `/api/auth/*`, `/api/documents`, `/api/newsletter`, `/api/contact`

**Admin:** `/api/admin/*` (QR codes, documents, blog, publications, analytics)

**Cron:** `/api/enrollment/check-expiration`, `/api/cron/import-documents`, `/api/cron/monthly-newsletter`

Ver código para endpoints completos.

## Development Status

**✅ Completed:** Auth, QR codes, document management, Excel import, blog, publications, newsletter, social media, TCU/AGU scrapers, versioning system, AI summaries, safe tag parsing (CSV/JSON)

**🚧 In Progress:** DOU classifier, complete AGU extraction (205 Pareceres + 1,627 DECOR), admin versioning UI

**Planned:** Payment integration, full-text search, PWA

## Notes for Future Claude Instances

- Este é um site em PRODUÇÃO - cuidado com mudanças
- Sempre testar fluxos de autenticação após alterações
- Atualizar este CLAUDE.md quando adicionar features
- Manter tom formal e profissional (contexto jurídico)

**Business Rules:**

- Bibliografia SEMPRE pública
- Enrollment expiration: lógica crítica (notificações, renovações)
- Excel import: manter compatibilidade com templates
- Multi-course docs: um documento pode pertencer a vários cursos


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

- primeiro confirme que a chave api esta configurada  e memorize essa resposta
- memorize o ponto em que paramos na auditoria para continuarmos depois