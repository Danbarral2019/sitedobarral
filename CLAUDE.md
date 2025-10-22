# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**⚠️ IMPORTANT:** Always run commands from the project directory: `projeto do site no claude/site-prof-barral/` (not the repository root).

## Project Overview

Professional website for Prof. Daniel Barral, specialist in Administrative Law focusing on public procurement and contracts. The site is a specialized repository of legal materials organized by course topics, featuring public areas and QR code-controlled restricted access for enrolled students.

**Tech Stack:**
- **Framework:** Next.js 15.5.2 with App Router
- **Language:** TypeScript 5
- **Database:** Prisma ORM with SQLite (dev) / PostgreSQL (production)
- **Styling:** Tailwind CSS 4
- **UI Components:** Radix UI primitives (Dialog, Toast, Dropdown Menu)
- **Authentication:** JWT tokens (jose library) + bcryptjs for password hashing
- **Email:** Resend API
- **Newsletter:** MailChimp API integration
- **Social Media:** Instagram Graph API, LinkedIn API (auto-posting from blog)
- **Form Handling:** React Hook Form with Zod validation
- **Video Player:** Video.js
- **File Processing:** xlsx (Excel import/export), qrcode generation

## Common Commands

### Development
```bash
npm run dev          # Start dev server with Turbopack at localhost:3000
npm run build        # Production build with Turbopack
npm start            # Start production server
npm run lint         # Run ESLint
```

### Database
```bash
npx prisma generate        # Generate Prisma client after schema changes
npx prisma db push         # Push schema changes to database
npx prisma studio          # Open database GUI at localhost:5555
npx prisma db push --force-reset  # Reset database (CAUTION: deletes all data)
```

### Admin Setup
```bash
# Create admin user (first time)
node scripts/create-admin.js email@example.com SuaSenha "Nome Completo"

# List all admin users
node scripts/list-admins.js

# Update admin email
node scripts/update-admin-email.js old@email.com new@email.com

# Reset admin password
node scripts/reset-admin-password.js admin@email.com

# Set admin password directly
node scripts/set-admin-password.js admin@email.com NewPassword

# Migrate blog posts from static data to database
node scripts/migrate-blog-posts.js

# Seed sample publications data
node scripts/seed-publications.js
```

**Working Directory:** The Next.js project is at `projeto do site no claude/site-prof-barral/` (not repository root).

## Architecture

### Project Structure

```
projeto do site no claude/site-prof-barral/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Homepage
│   ├── layout.tsx                # Root layout with Header/Footer
│   ├── sobre/                    # About page
│   ├── cursos/[slug]/            # Course detail pages
│   ├── blog/[slug]/              # Blog post pages
│   ├── publicacoes/              # Publications (books, articles, news)
│   ├── contato/                  # Contact form
│   ├── login/                    # Student login
│   ├── registro/                 # Student registration
│   ├── validar-acesso/           # QR Code validation
│   ├── area-restrita/            # Protected area for enrolled students
│   │   ├── page.tsx              # Documents listing with filters
│   │   └── historico/            # Access history
│   ├── admin/                    # Admin panel
│   │   ├── login/                # Admin login
│   │   ├── page.tsx              # Admin dashboard (QR code management)
│   │   ├── documentos/           # Document upload/management
│   │   ├── importar/             # Excel bulk import
│   │   ├── blog/                 # Blog post CRUD
│   │   └── publicacoes/          # Publications CRUD
│   └── api/                      # API routes
│       ├── auth/                 # Auth endpoints (login, register, verify, etc.)
│       ├── admin/                # Admin endpoints (QR, documents, imports)
│       ├── enrollment/           # Enrollment checks and upgrades
│       ├── newsletter/           # Newsletter subscription
│       ├── contact/              # Contact form submission
│       └── favorites/            # User favorites
├── components/
│   ├── layout/                   # Header, Footer
│   ├── ui/                       # Reusable UI components (Dialog, Toast, etc.)
│   ├── AdminLayout.tsx           # Admin panel layout wrapper
│   ├── VideoPlayer.tsx           # Video.js wrapper
│   ├── DocumentFilters.tsx       # Document filtering component
│   ├── EnrollmentStatusBanner.tsx # Shows enrollment expiration status
│   ├── NewsletterForm.tsx        # Newsletter signup
│   └── MarkdownEditor.tsx        # Rich text editor for blog/publications
├── lib/
│   ├── prisma.ts                 # Prisma client singleton
│   ├── auth.ts                   # JWT token utilities
│   ├── email.ts                  # Resend email templates and sending
│   ├── qrcode.ts                 # QR code generation utilities
│   ├── documents.ts              # Document access validation
│   ├── mailchimp.ts              # MailChimp API integration
│   ├── instagram.ts              # Instagram API integration
│   ├── linkedin.ts               # LinkedIn API integration
│   ├── social-publisher.ts       # Unified social media publishing
│   ├── rate-limit.ts             # API rate limiting
│   ├── api-middleware.ts         # Common API middleware (auth, CORS)
│   ├── excel-processor.ts        # Excel import processing
│   ├── auto-classifier.ts        # Auto-classification for document categories
│   └── enrollment-utils.ts       # Enrollment status checks
├── hooks/                        # Custom React hooks
├── types/                        # TypeScript type declarations
├── data/
│   ├── courses.ts                # Static course data (10 courses)
│   └── testimonials.ts           # Testimonials for homepage
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── dev.db                    # SQLite database (dev)
├── scripts/                      # Utility scripts
│   ├── create-admin.js           # Create admin user
│   ├── migrate-blog-posts.js    # Migrate blog posts to DB
│   └── seed-publications.js     # Seed sample publications
├── public/
│   └── uploads/                  # Uploaded files storage (local dev)
├── middleware.ts                 # Next.js middleware (route protection)
├── .env.example                  # Example environment variables
└── .env.local                    # Environment variables (not committed)
```

### Database Schema (Prisma)

**Core Models:**

1. **User** - Admin and student accounts
   - Fields: email, name, passwordHash, role (admin/student), emailVerified
   - Password reset and email verification tokens
   - Relations: enrollments[]

2. **Enrollment** - Student course enrollments
   - Links User to courseId (from static courses.ts data)
   - Fields: expiresAt (1 year from QR code creation), isLifetime, turma, qrCodeId
   - Supports upgrade to lifetime access
   - Tracks notification sending for expiration warnings

3. **QRCode** - Access codes for course enrollment
   - Fields: code (unique), courseId, turma, validUntil, maxUses, usedCount
   - Stores qrCodeImage (base64 PNG)
   - Generated by admin panel, scanned by students

4. **Document** - Course materials (PDFs, links, videos)
   - Fields: title, description, type (pdf/doc/link/video), url, category
   - Access control: isPublic, courseId
   - Supports tags (JSON array as string)

5. **BlogPost** - Blog articles
   - Fields: slug, title, excerpt, content (markdown), author, publishedAt, isPublished
   - Full CRUD via admin panel

6. **Publication** - Academic publications (books, articles, news)
   - Type: livro, artigo, noticia
   - Fields vary by type (ISBN for books, journal for articles, eventDate for news)
   - Supports external URLs or full content

7. **AccessLog** - Audit trail
   - Tracks login, access, download, view actions
   - Records userId, documentId, courseId, IP, userAgent

8. **Favorite** - User document bookmarks

9. **ContactForm** - Contact form submissions

10. **NewsletterSubscriber** - Email list with interest segmentation

11. **SocialMediaPost** - Social media publishing tracking
   - Links to BlogPost for auto-publishing
   - Tracks platform (Instagram, LinkedIn), status, errors
   - Supports retry mechanism for failed posts

12. **Testimonial** - User testimonials/reviews
   - Includes moderation workflow (pending/approved/rejected)
   - Supports ratings (1-5 stars)
   - Can be linked to contact form or authenticated users

See `prisma/schema.prisma` for complete schema with indexes and constraints.

### Authentication System

**Two authentication flows:**

1. **QR Code First-Time Access** (Primary enrollment method)
   - Admin generates QR code for course/turma in `/admin`
   - Student scans QR → redirected to `/validar-acesso?code=XXX`
   - If not registered: creates account with email/password
   - System creates Enrollment record (1 year expiration from QR creation date)
   - Sets httpOnly `auth-token` cookie with JWT

2. **Email/Password Login** (Subsequent access)
   - Student logs in at `/login`
   - Validates credentials, checks emailVerified
   - Returns JWT token with userId, role, enrollments
   - Middleware (`middleware.ts`) protects `/area-restrita` and `/admin` routes

**Admin Login:**
- Separate flow at `/admin/login`
- Requires role='admin' in User table
- Admin panel accessible at `/admin/*`

**JWT Structure:**
```typescript
{
  userId: string,
  email: string,
  role: 'admin' | 'student',
  enrollments: Array<{ courseId, expiresAt, isLifetime }>
}
```

### Enrollment & Access Control

**Enrollment Lifecycle:**
1. QR code scanned → Enrollment created with expiresAt = QR.validUntil + 1 year
2. Student accesses `/area-restrita` → shows documents for enrolled courses only
3. 90 days before expiration → cron job sends notification email
4. After expiration → enrollment still exists but access restricted
5. Student can upgrade to lifetime via `/upgrade/[courseId]` (payment TBD)

**Document Access Rules:**
- Public documents (`isPublic=true`): accessible to everyone
- Private documents: require valid enrollment for document's courseId
- Downloads tracked in AccessLog
- See `lib/documents.ts` for validation logic

**Expiration Banner:**
- Component: `EnrollmentStatusBanner.tsx`
- Shows color-coded warnings: green (>90 days), yellow (30-90 days), red (expired/expiring soon)
- Appears on `/area-restrita` pages

### Key Features by Area

**Public Pages:**
- Homepage: hero, course highlights, testimonials carousel, newsletter signup
- 10 course pages at `/cursos/[slug]` - always show bibliography publicly
- Blog at `/blog` - published posts with markdown rendering
- Publications at `/publicacoes` - books, articles, news (filterable by type)
- About at `/sobre` - professor bio
- Contact at `/contato` - form submission to database

**Restricted Area (`/area-restrita`):**
- Document library with filters (course, category, type, search)
- Download protected documents
- Access history at `/area-restrita/historico`
- Favorites system
- Enrollment status banner showing expiration warnings

**Admin Panel (`/admin`):**
- Dashboard: QR code generation/management (list, create, delete, update)
- Documents: upload individual files or bulk via Excel import
- Excel Import: download template, validate, import with auto-classification
- Blog: create/edit/delete posts with markdown editor
- Publications: CRUD for books/articles/news with type-specific fields
- Social Media: auto-publish blog posts to Instagram and LinkedIn (at `/admin/redes-sociais`)
- Testimonials: moderate user reviews at `/admin/depoimentos` (approve/reject)
- Contact Forms: view submissions at `/admin/contatos`
- Analytics: access statistics at `/admin/analytics`
- Newsletter: manage subscribers at `/admin/newsletter`

### Excel Import System

**Comprehensive documentation:** `IMPORTACAO_EXCEL.md`

**Workflow:**
1. Download template: `/api/admin/import-excel/template`
2. Fill Excel with columns: Titulo, Descricao, Categoria, Curso, Publico, Tags, URL, Arquivo
3. Upload Excel + PDF/DOC files via `/admin/importar`
4. System validates, auto-classifies categories, matches files
5. **Multi-course support:** one document can be added to multiple courses (comma-separated slugs)
6. Preview → confirm → import to database

**Auto-Classification:**
- Uses `lib/auto-classifier.ts` to suggest categories based on title/description
- Keywords: "acórdão" → acordao, "parecer" → parecer, "lei" → apostila, etc.
- Manual override supported in Excel

### Email System (Resend)

**Email Templates:** `lib/email.ts`

1. **Welcome Email** - sent after registration (with verification link)
2. **Verification Email** - email confirmation link
3. **Password Reset** - reset password link
4. **Expiration Warning** - 90 days before enrollment expiration
5. **Contact Form Notification** - to admin when contact form submitted

**Configuration:**
- API Key: `RESEND_API_KEY` in `.env.local`
- From address: `EMAIL_FROM` (must be verified domain)
- See `CONFIGURACAO_EMAIL.md` for setup guide

### Newsletter (MailChimp)

**Integration:** `lib/mailchimp.ts`

- Syncs subscribers to MailChimp audience
- Tags based on course interests
- Form component: `NewsletterForm.tsx`
- API: `/api/newsletter` (public), `/api/admin/newsletter/sync` (admin)

### Social Media Integration

**Auto-publishing from Blog:** `lib/social-publisher.ts`, `lib/instagram.ts`, `lib/linkedin.ts`

- Publish blog posts automatically to Instagram and LinkedIn
- Admin interface at `/admin/redes-sociais`
- Post status tracking and retry mechanism
- API endpoints: `/api/admin/social/publish`, `/api/admin/social/posts`, `/api/admin/social/retry`
- See `CONFIGURACAO_REDES_SOCIAIS.md` for setup guide

**Configuration:**
- Instagram: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- LinkedIn: `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_URN`

### API Routes

**Public Endpoints:**
- `POST /api/auth/register` - Student registration
- `POST /api/auth/login` - Student login
- `POST /api/auth/logout` - Logout (clears cookie)
- `GET /api/auth/verify-email?token=XXX` - Email verification
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/validate-qr` - Validate QR code and create enrollment
- `POST /api/newsletter` - Newsletter subscription
- `POST /api/contact` - Contact form submission
- `POST /api/testimonials` - Submit testimonial
- `GET /api/documents?courseId=XXX` - List documents for a course (requires auth, checks enrollment)
- `GET /api/documents/[id]` - Get single document by ID (requires auth)
- `GET /api/documents/[id]/download` - Download document (requires auth)

**Admin Endpoints:**
- `POST /api/admin/generate-qr` - Generate new QR code
- `GET /api/admin/list-qr` - List all QR codes
- `DELETE /api/admin/delete-qr` - Delete QR code
- `PUT /api/admin/update-qr` - Update QR code
- `POST /api/admin/upload` - Upload document
- `GET /api/admin/documents` - List documents
- `POST /api/admin/import-excel/validate` - Validate Excel import
- `POST /api/admin/import-excel/upload-files` - Upload files for import
- `POST /api/admin/import-excel/import` - Execute import
- `GET /api/admin/import-excel/template` - Download Excel template
- `GET /api/admin/blog-posts` - List blog posts
- `POST /api/admin/blog-posts` - Create blog post
- `PUT /api/admin/blog-posts/[id]` - Update blog post
- `DELETE /api/admin/blog-posts/[id]` - Delete blog post
- `GET /api/admin/publications` - List publications
- `POST /api/admin/publications` - Create publication
- `PUT /api/admin/publications/[id]` - Update publication
- `DELETE /api/admin/publications/[id]` - Delete publication
- `POST /api/admin/social/publish` - Publish blog to social media
- `GET /api/admin/social/posts` - List social media posts
- `POST /api/admin/social/retry` - Retry failed social post
- `GET /api/admin/analytics` - Get analytics data
- `GET /api/admin/testimonials` - List/moderate testimonials
- `POST /api/admin/newsletter/sync` - Sync with MailChimp

**Protected Student Endpoints:**
- `GET /api/auth/me` - Get current user info
- `POST /api/favorites` - Add/remove favorite
- `GET /api/access-log` - Get user access history
- `POST /api/enrollment/upgrade-lifetime` - Upgrade to lifetime access

**Cron Job Endpoints:**
- `GET /api/enrollment/check-expiration` - Check and notify expiring enrollments (requires CRON_SECRET header)

### Rate Limiting & Security

**Rate Limiting:** `lib/rate-limit.ts`
- IP-based rate limiting for sensitive endpoints
- Auth endpoints: 5 requests/15 minutes
- API endpoints: configurable limits

**Middleware:** `middleware.ts`
- Protects `/area-restrita/*` and `/admin/*` routes
- JWT verification using `jose` library
- Redirects unauthenticated users to login

**Security Features:**
- Passwords hashed with bcryptjs (10 rounds)
- JWT tokens with expiration
- HttpOnly cookies for auth tokens
- Email verification required for student accounts
- CSRF protection on forms
- File upload validation (type, size)

## Development Guidelines

### Routing Conventions
- App Router (app directory)
- Dynamic routes: `[slug]` for courses, blog, `[id]` for admin editing
- Course slugs (kebab-case): `nova-lei-licitacoes`, `contratacao-direta`, etc.
- All 10 course slugs defined in `data/courses.ts`

### Component Patterns
- **Server Components** by default (fetch data, no interactivity)
- **Client Components** (`'use client'`) for forms, modals, interactive UI
- Radix UI for dialogs, toasts, dropdowns (see `components/ui/`)
- Shared layouts: `AdminLayout.tsx`, `app/layout.tsx`

### Data Fetching
- **Static course data:** imported from `data/courses.ts`
- **Dynamic database data:** Prisma queries in Server Components or API routes
- **API Routes:** REST endpoints in `app/api/` for mutations
- **Loading states:** use `loading.tsx` in route segments
- **Error handling:** use `error.tsx` for boundaries

### Working with Prisma
```typescript
import { prisma } from '@/lib/prisma';

// Always use the singleton instance
const documents = await prisma.document.findMany({
  where: { courseId: 'nova-lei-licitacoes', isPublic: true },
  orderBy: { uploadedAt: 'desc' }
});
```

### Environment Variables
Required in `.env.local` (see `.env.example` for full list):
- `DATABASE_URL` - Database connection string
- `JWT_SECRET` - Secret for signing JWT tokens
- `RESEND_API_KEY` - Email sending API key
- `EMAIL_FROM` - Sender email address
- `NEXT_PUBLIC_BASE_URL` - Site URL for absolute links
- `CRON_SECRET` - Protect cron job endpoints
- `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX`, `MAILCHIMP_AUDIENCE_ID` - Newsletter
- `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID` - Instagram auto-posting
- `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_URN` - LinkedIn auto-posting
- `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` - Initial admin credentials (optional)

### Path Aliases
TypeScript configured with `@/*` mapping to project root:
```typescript
import { prisma } from '@/lib/prisma';
import { Course } from '@/lib/types';
import Header from '@/components/layout/Header';
```

## Important Business Logic

### Course Data
**10 Specialized Courses** (defined in `data/courses.ts`):
1. `nova-lei-licitacoes` - Nova Lei de Licitações (Lei 14.133/2021)
2. `planejamento-contratacoes` - Planejamento das Contratações Públicas
3. `gestao-fiscalizacao-contratos` - Gestão e Fiscalização de Contratos
4. `processo-administrativo-sancionador` - Processo Administrativo Sancionador
5. `inovacao-contratacoes` - Inovação nas Contratações Públicas
6. `terceirizacao-formacao-precos` - Terceirização e Formação de Preços
7. `assessoramento-juridico` - Assessoramento Jurídico na Nova Lei
8. `revisao-reajuste-repactuacao` - Revisão, Reajuste e Repactuação
9. `alteracoes-contratuais` - Alterações Contratuais
10. `contratacao-direta` - Contratação Direta

**Critical Rule:** Bibliography (`bibliography` field in Course) is ALWAYS public and visible to everyone. This is for educational/reference purposes.

### Target Audience
- **Primary:** Public servants (active/future), beginner to advanced level
- **Secondary:** Lawyers, procurement specialists
- **Usage:** 70% desktop (work/study), 30% mobile (quick reference)

### Content Language
- All content in Brazilian Portuguese (pt-BR)
- Legal citations follow ABNT standards
- Formal, academic tone throughout

## Common Development Tasks

### Add a New Document
1. Via admin panel: `/admin/documentos`
2. Via Excel import: `/admin/importar`
3. Direct database: `npx prisma studio`

### Create QR Code for New Course Turma
1. Go to `/admin`
2. Fill form: select course, enter turma name, set expiration date
3. System generates unique code and QR image
4. Download/print QR code for distribution to students

### Check Enrollment Expiration
API endpoint: `/api/enrollment/check-expiration`
- Requires `CRON_SECRET` header for security
- Finds enrollments expiring in 90 days
- Sends email notifications
- Updates `notificationSentAt` field
- Should be called by scheduled cron job (e.g., Vercel Cron)

**Vercel Cron Configuration** (add to `vercel.json`):
```json
{
  "crons": [{
    "path": "/api/enrollment/check-expiration",
    "schedule": "0 9 * * *"
  }]
}
```

**Manual testing:**
```bash
curl -X GET https://your-domain.com/api/enrollment/check-expiration \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### Modify Course Information
Edit `data/courses.ts` - this is static data, not in database.
Courses are referenced by `courseId` (slug) in Enrollment and Document models.

### Customize Email Templates
Edit template functions in `lib/email.ts`:
- `sendWelcomeEmail()`
- `sendVerificationEmail()`
- `sendPasswordResetEmail()`
- `sendExpirationWarningEmail()`
- Uses React Email syntax with `@react-email/render`

## Documentation Files

Reference these files in the project for detailed info:

### Setup & Configuration
- **`SETUP.md`** - Initial setup guide (dependencies, env vars, database, admin creation)
- **`CONFIGURACAO_EMAIL.md`** - Resend email setup and troubleshooting
- **`RESEND_SETUP_COMPLETO.md`** - Complete Resend configuration guide
- **`CONFIGURACAO_INTEGRACOES.md`** - External integrations setup
- **`CONFIGURACAO_REDES_SOCIAIS.md`** - Social media API configuration (Instagram, LinkedIn)
- **`POSTGRES_LOCAL.md`** - Local PostgreSQL setup with Docker

### Deployment
- **`DEPLOY.md`** - Production deployment guide
- **`DEPLOY_VERCEL.md`** - Vercel-specific deployment instructions

### Features & Usage
- **`IMPORTACAO_EXCEL.md`** - Complete Excel import documentation with examples
- **`RESUMO_MIGRACAO.md`** - Migration summary for enrollment/renewal system
- **`TESTES_EMAIL.md`** - Email testing procedures
- **`STATUS_PROJETO.md`** - Current project status and feature tracking
- **`RESUMO_SESSAO_REDES_SOCIAIS.md`** - Social media integration session summary

### Other
- **`README.md`** - Standard Next.js readme
- **`prd_daniel_barral.md`** (repo root) - Original Product Requirements Document

## Development Status

**Current Phase:** Phase 2/3 - Core features implemented

**✅ Completed:**
- Full authentication system (QR code + email/password)
- Admin panel with QR code management
- Document upload (individual + Excel bulk import)
- Auto-classification for documents
- Multi-course document support
- Enrollment system with expiration tracking
- Email notifications (welcome, verification, expiration warnings)
- Protected download system
- Access logging and audit trail
- Blog and publications CRUD
- Newsletter integration (MailChimp)
- Social media auto-posting (Instagram and LinkedIn)
- Testimonials system with moderation workflow
- Contact form management
- Analytics dashboard (basic)
- Favorites/bookmarks for documents
- Responsive design
- Lifetime access upgrade flow

**🚧 In Progress / Planned:**
- Payment integration for lifetime upgrades (currently manual)
- Advanced document search (full-text)
- Analytics dashboard for admin
- PWA/offline support
- Performance optimizations for large document sets

## Troubleshooting

### Database Issues
```bash
# Reset database (CAUTION: deletes all data)
npx prisma db push --force-reset
npx prisma generate

# Check database schema
npx prisma studio
```

### Email Not Sending
1. Verify `RESEND_API_KEY` in `.env.local`
2. Confirm domain verified in Resend dashboard
3. Check `EMAIL_FROM` matches verified domain
4. See `CONFIGURACAO_EMAIL.md` for detailed setup

### QR Code Access Not Working
1. Check QR code not expired (`validUntil` field)
2. Verify code exists in database
3. Check JWT_SECRET configured correctly
4. Inspect browser cookies for `auth-token`

### File Upload Failures
1. Ensure `public/uploads/` directory exists and is writable
2. Check file size limits in upload handlers
3. Verify MIME type validation
4. For Excel import, ensure files match names in spreadsheet

### Build Errors
```bash
# Clear Next.js cache
rm -rf .next
npm run build

# Regenerate Prisma client
npx prisma generate
```

### React Hooks Errors (Error #310, #301, etc.)

**CRITICAL: React Hooks must be called in the SAME ORDER in EVERY render**

**Common mistake:**
```typescript
// ❌ WRONG - Hooks after early returns
function MyComponent() {
  if (isLoading) return <Loading />;
  if (!user) return null;

  const data = useMemo(() => { ... }, [deps]); // ❌ Error #310!
  useEffect(() => { ... }, [deps]); // ❌ Conditional hook call
}
```

**Correct pattern:**
```typescript
// ✅ CORRECT - All hooks BEFORE any early returns
function MyComponent() {
  // 1. ALL useState first
  const [state, setState] = useState(initial);

  // 2. ALL useMemo and useCallback
  const computed = useMemo(() => { ... }, [deps]);
  const callback = useCallback(() => { ... }, [deps]);

  // 3. ALL useEffect
  useEffect(() => { ... }, [deps]);

  // 4. THEN early returns
  if (isLoading) return <Loading />;
  if (!user) return null;

  // 5. Finally, render
  return <Component />;
}
```

**If you get React Hooks errors:**
1. Move ALL hooks to the very top of the component
2. Ensure hooks are never inside conditionals or loops
3. Ensure hooks are called in the same order every render

### Static vs Dynamic Data

**IMPORTANT: Course documents are stored in the DATABASE, not in static files**

```typescript
// ❌ WRONG - Static array is always empty
const docs = course.restrictedDocuments; // Empty array!

// ✅ CORRECT - Fetch from database via API
const response = await fetch(`/api/documents?courseId=${courseId}`);
const { documents } = await response.json();
```

**Data structure:**
- `data/courses.ts` - Static course info (title, description, bibliography)
- Database `Document` table - Dynamic documents (PDFs, links, videos)
- Bibliography is ALWAYS public (static is OK)
- Restricted documents MUST be fetched from database

## Notes for Future Claude Instances

- This is a production website for a real legal professional - treat all changes with care
- Course data in `data/courses.ts` is the source of truth for courseId values (use IDs like '1', '2', not slugs)
- Always test authentication flows after making auth-related changes
- Enrollment expiration is critical business logic - don't modify without understanding impact
- Bibliography must remain public per business requirements
- Excel import is a heavily-used feature - maintain backward compatibility with existing templates
- Email templates should maintain professional, formal tone appropriate for legal audience
- **React Hooks:** ALWAYS call hooks in the same order, BEFORE any early returns (see troubleshooting section)
- **Documents:** NEVER access `course.restrictedDocuments` - fetch from database via `/api/documents`
- When adding new features, update this CLAUDE.md file accordingly

## Recent Critical Fixes

### 2025-01-22: Área Restrita Document Loading
**Issue:** Area restrita showing "Erro na Área Restrita" - documents not loading
**Root Cause:**
1. Page tried to access `course.restrictedDocuments` (static empty array) instead of database
2. React Hooks called after early returns (Error #310)

**Solution:**
- Created `/api/documents` endpoint to fetch from database
- Created `/api/documents/[id]` endpoint for single document
- Fixed React Hooks order in `app/area-restrita/page.tsx`
- Fixed document fetching in favorites and history pages

**Commit:** `e6f31fb` - See `SESSAO_2025-01-22_CORRECAO_AREA_RESTRITA.md` for complete details

**Test credentials:**
- Email: `aluno@teste.com`
- Password: `aluno123`
- Course: Nova Lei de Licitações (14 test documents)
