# CLAUDE.md

Guia rápido para Claude Code ao trabalhar neste repositório.

## ⚠️ CRITICAL REMINDERS

1. **Working Directory:** SEMPRE rodar comandos de `projeto do site no claude/site-prof-barral/`
2. **Course IDs:** Database usa IDs numéricos (`'1'`, `'2'`), URLs usam slugs. Ver `COURSE_IDS_REFERENCE.md`
3. **Documents:** NUNCA acessar `course.restrictedDocuments` - buscar via `/api/documents`
4. **React Hooks:** Todos hooks ANTES de early returns
5. **Prisma Engine:** Se der erro, matar Node.js e rodar `npx prisma generate`

## Project Overview

Site profissional do Prof. Daniel Barral especializado em Direito Administrativo, Licitações e Contratos. Repositório de materiais jurídicos com acesso público e área restrita via QR code.

**Tech Stack:** Next.js 15.5.2 (App Router) • TypeScript 5 • Prisma ORM • PostgreSQL (Neon) • Tailwind CSS 4 • Radix UI • JWT Auth • Resend Email • MailChimp • Playwright/PostgreSQL/GitHub MCP

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
claude mcp list                # List MCPs (playwright, postgresql, github)

# AGU/TCU Scrapers
npx tsx scripts/test-versioning.ts
npx tsx scripts/import-pareceres-vinculantes.ts
npm run convert-tcu            # Convert TCU Excel files
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
- `prisma/schema.prisma` - Database schema (16 models)
- `scripts/` - Admin/import/scraping scripts

**Key Models:**
- `User` - Admin/student accounts
- `Enrollment` - Course access (1 year expiration, lifetime upgrade)
- `QRCode` - Enrollment codes
- `Document` - PDFs/links/videos with versioning
- `DocumentVersion` - Change tracking (⭐ NOVO!)
- `BlogPost`, `Publication`, `Testimonial`
- `AccessLog` - Audit trail

**Auth Flows:**
1. QR Code → Registration → Enrollment (1 year)
2. Email/Password → Login → JWT cookie

**Document Access:**
- Public: `isPublic=true`
- Private: requires valid enrollment
- Bibliography: SEMPRE público

## Recent Features (2025-11-02)

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

**✅ Completed:** Auth, QR codes, document management, Excel import, blog, publications, newsletter, social media, TCU/AGU scrapers, versioning system, AI summaries

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
cd "projeto do site no claude/site-prof-barral"
npm install
cp .env.example .env.local  # Edit with your values
npx prisma generate && npx prisma db push
node scripts/create-admin.js admin@email.com password123 "Admin Name"
npm run dev
```

**Mais detalhes:** Ver arquivos de documentação listados acima.
