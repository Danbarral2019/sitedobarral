# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a professional website for Prof. Daniel Barral, a specialist in Administrative Law focusing on public procurement and contracts. The site serves as a specialized repository of legal materials organized by course topics, with public and restricted access areas controlled via QR codes.

**Tech Stack:**
- **Framework:** Next.js 15.5.2 with App Router
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **UI Components:** Radix UI primitives
- **Authentication:** JWT tokens via QR codes (bcryptjs, jsonwebtoken)
- **Form Handling:** React Hook Form with Zod validation
- **Video:** Video.js

## Common Commands

### Development
```bash
npm run dev          # Start dev server with Turbopack at localhost:3000
npm run build        # Production build with Turbopack
npm start            # Start production server
npm run lint         # Run ESLint
```

**Working Directory:** The Next.js project is located at `projeto do site no claude/site-prof-barral/` (not at the repository root).

## Architecture

### Project Structure

```
projeto do site no claude/site-prof-barral/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Homepage with hero, features, courses
│   ├── layout.tsx         # Root layout with Header/Footer
│   ├── sobre/             # About page
│   ├── cursos/            # Courses listing and individual course pages
│   ├── blog/              # Blog listing and individual posts
│   ├── area-restrita/     # Restricted area (QR Code access)
│   └── contato/           # Contact form
├── components/
│   └── layout/            # Header and Footer components
├── lib/
│   └── types.ts           # Core TypeScript interfaces
├── data/
│   ├── courses.ts         # Course data (10 courses)
│   └── blog-posts.ts      # Blog post data
├── hooks/                 # (empty, for custom React hooks)
├── public/                # Static assets
└── styles/                # Global styles
```

### Data Architecture

All data is currently **mock/hardcoded** in TypeScript files (`data/courses.ts`, `data/blog-posts.ts`). There is no database or backend API yet - this is planned for future phases.

**Core Data Models** (see `lib/types.ts`):

1. **Course** - 10 specialized courses on Administrative Law topics
   - Each has: title, slug, description, bibliography (always public), public/restricted documents
   - Slug-based routing: `/cursos/[slug]`

2. **Document** - Course materials
   - Types: pdf, doc, link, video
   - Categories: apostila, acordao, parecer, edital, artigo, outro
   - Access control: `isPublic` boolean

3. **BlogPost** - Articles with slug-based routing

4. **QRCodeAccess** - Temporary access codes for restricted areas
   - Links to specific course
   - Has expiration dates and usage limits
   - Currently not fully implemented

5. **User** - Admin or student roles

6. **NewsletterSubscriber** - Email subscriptions with interest segmentation

7. **ContactForm** - Contact form submissions

### Key Features by Area

**Public Area:**
- Homepage with hero section, course highlights, testimonials
- 10 course pages (each shows bibliography publicly, some "teaser" documents)
- Blog with articles on legal topics
- About page (professor bio)
- Contact form
- Newsletter signup

**Restricted Area (Future):**
- QR Code authentication for course students
- Access to full course materials (apostilas, acórdãos, pareceres, editais)
- Advanced search and filtering
- Download functionality
- Access history tracking

### Design System

**Colors** (see `tailwind.config.ts`):
- **Primary:** Blue scale (`primary-600` = #2563eb) - corporate/legal trust
- **Secondary:** White
- **Accent:** Gray scale for secondary elements

**Typography:**
- Primary font: Inter (Google Font)
- Serif font: Merriweather (for special text)

**Design Philosophy:**
- Corporate/professional tone (inspired by legal professionals like Jacoby Fernandes, Marçal Justen Filho)
- Minimalist with focus on content
- Clean typography and generous spacing
- Fully responsive (70% desktop, 30% mobile usage)

## Development Guidelines

### Routing Conventions
- All routes use Next.js App Router (app directory)
- Dynamic routes: `[slug]` for courses and blog posts
- Course slugs follow kebab-case: `nova-lei-licitacoes`, `planejamento-contratacoes`, etc.

### Component Patterns
- Server Components by default (Next.js 15)
- Client Components only when needed (forms, interactivity)
- Layout components in `components/layout/`
- Shared UI components should use Radix UI primitives

### Data Fetching
- Currently static data imports from `data/` folder
- When implementing API/database:
  - Use Next.js Server Actions for mutations
  - Use Server Components for data fetching
  - Implement proper loading and error states

### Authentication (Future Implementation)
- QR Code generates JWT token
- Token includes: courseId, validUntil, turma
- Validate on restricted pages
- Store in httpOnly cookies

### Content Management (Future)
- File upload system for PDFs, DOCs, videos
- Categorization by course and document type
- Tag system for advanced search
- Version control for document updates

## Important Context from PRD

**Target Audience:**
- Primary: Public servants (active/future), beginner to advanced
- Secondary: Lawyers, procurement specialists, public sector legal counsel

**10 Specialized Courses:**
1. Nova Lei de Licitações e Contratos (Lei 14.133/2021)
2. Planejamento das Contratações Públicas
3. Gestão e Fiscalização de Contratos Administrativos
4. Processo Administrativo Sancionador
5. Inovação nas Contratações Públicas
6. Terceirização e Formação de Preços
7. Assessoramento Jurídico na Nova Lei de Licitações
8. Revisão, Reajuste e Repactuação
9. Alterações Contratuais
10. Contratação Direta

**Key Business Logic:**
- Bibliography is ALWAYS public (educational/reference)
- Some sample documents are public ("degustação")
- Full materials require QR Code access (given in physical classes)
- QR Codes are course-specific and time-limited
- Future: subscription model for extended access

**Integration Points (Future):**
- Newsletter: MailChimp or ConvertKit API
- Social media: Auto-posting to Instagram/LinkedIn from blog
- Analytics: Google Analytics
- Payment gateway: For future subscription model

## Development Phases

**Current Status:** Phase 1 (MVP) - Basic structure complete

**Phase 1 - MVP** ✓
- Basic site structure
- Public pages
- Static content
- Responsive design

**Phase 2 - QR System** (Next)
- JWT authentication
- QR Code generation
- Restricted area access
- Advanced file upload

**Phase 3 - Advanced Features**
- Full-text search
- Social media integration
- Automated newsletter
- Admin dashboard

**Phase 4 - Optimizations**
- Performance tuning
- SEO optimization
- Production deployment

## File Locations Reference

- **Homepage content:** `app/page.tsx`
- **Course data:** `data/courses.ts` (10 courses with full bibliography)
- **Blog posts:** `data/blog-posts.ts`
- **Type definitions:** `lib/types.ts`
- **Global layout:** `app/layout.tsx`
- **Navigation:** `components/layout/Header.tsx`
- **Styling config:** `tailwind.config.ts`

## Notes

- The repository root contains the PRD (`prd_daniel_barral.md`) and current content documentation (`CONTEUDO_ATUAL.md`) for reference
- When making content changes, consult these documents for professor's specifications
- The site uses Brazilian Portuguese (pt-BR) for all content
- Legal citations follow ABNT standards for Brazilian legal documentation
