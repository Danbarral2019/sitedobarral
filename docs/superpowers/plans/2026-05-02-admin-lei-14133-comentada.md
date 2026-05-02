# Admin editorial da Lei 14.133 Comentada — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir uma página admin única em `/admin/lei-14133/comentada` que dá controle editorial completo sobre a apresentação da Lei 14.133 Comentada, incluindo comentário do prof por artigo, leitura combinada (vinculações entre artigos), sugestões de leitura (internas e externas), curadoria de docs/atos vinculados e marcação de destaque editorial.

**Architecture:** Página client-side espelhando a sidebar pública da Lei 14.133, com main column que orquestra editores (modal markdown + inline com drag-and-drop). Schema Prisma estende `LeiArticle` com `professorComment` e adiciona dois models (`LeiArticleCrossRef`, `LeiArticleSuggestedReading`). Endpoints REST sob `/api/admin/lei-14133/articles/[numero]/...` com `verifyAdmin` e `CacheInvalidation`. Apresentação pública adiciona 3 cards (Comentário, Leitura combinada, Sugestões) entre o card do artigo e os destaques de regulamentação.

**Tech Stack:** Next.js 15 App Router · Prisma 7 (Neon Postgres) · React 19 · TypeScript · Tailwind 4 · @dnd-kit/sortable (já no projeto) · MarkdownContent (já no projeto) · vitest

**Spec:** `docs/superpowers/specs/2026-05-02-admin-lei-14133-comentada-design.md`

---

## File Structure

### Schema
- Modify: `prisma/schema.prisma` — adicionar `professorComment` em `LeiArticle` + 2 models novos

### Backend
- Modify: `lib/cache/redis-client.ts` — adicionar invalidação granular `leiArticle(numero)`
- Create: `lib/lei-14133/admin-validators.ts` — validators (zod) reutilizáveis pra comment/crossref/reading
- Create: `app/api/admin/lei-14133/articles/[numero]/route.ts` — GET enriquecido pro editor
- Create: `app/api/admin/lei-14133/articles/[numero]/comment/route.ts` — PUT comment
- Create: `app/api/admin/lei-14133/articles/[numero]/crossrefs/route.ts` — GET, POST
- Create: `app/api/admin/lei-14133/articles/[numero]/crossrefs/[id]/route.ts` — PUT, DELETE
- Create: `app/api/admin/lei-14133/articles/[numero]/crossrefs/reorder/route.ts` — POST
- Create: `app/api/admin/lei-14133/articles/[numero]/readings/route.ts` — GET, POST
- Create: `app/api/admin/lei-14133/articles/[numero]/readings/[id]/route.ts` — PUT, DELETE
- Create: `app/api/admin/lei-14133/articles/[numero]/readings/reorder/route.ts` — POST
- Create: `app/api/admin/lei-14133/articles/[numero]/link-document/route.ts` — POST
- Create: `app/api/admin/lei-14133/articles/[numero]/link-document/[documentId]/route.ts` — DELETE
- Create: `app/api/admin/lei-14133/articles/[numero]/link-act/route.ts` — POST
- Create: `app/api/admin/lei-14133/articles/[numero]/link-act/[actId]/route.ts` — DELETE
- Create: `app/api/admin/internal-search/route.ts` — GET unificado por tipo
- Modify: `app/api/lei-14133/articles/route.ts` — incluir `professorComment`, `crossRefs`, `suggestedReadings`

### UI compartilhada
- Create: `components/lei-14133/LeiSidebar.tsx` — sidebar Estrutura da Lei extraída pra reuso
- Modify: `app/lei-14133/LeiComentadaClient.tsx` — usar `<LeiSidebar>` extraído
- Modify: `app/area-restrita/lei-comentada/page.tsx` — usar `<LeiSidebar>` extraído

### UI admin
- Create: `app/admin/lei-14133/comentada/page.tsx` — Server wrapper
- Create: `app/admin/lei-14133/comentada/ComentadaAdminClient.tsx` — client root
- Create: `app/admin/lei-14133/comentada/ArticleEditorMain.tsx` — main column orquestrador
- Create: `app/admin/lei-14133/comentada/CommentEditor.tsx` — modal markdown
- Create: `app/admin/lei-14133/comentada/CrossRefsEditor.tsx` — inline list + DnD
- Create: `app/admin/lei-14133/comentada/ReadingsEditor.tsx` — inline list + DnD
- Create: `app/admin/lei-14133/comentada/LinkedDocsEditor.tsx` — lista + modal de busca
- Create: `app/admin/lei-14133/comentada/LinkedActsEditor.tsx` — lista + dropdown importance + modal
- Create: `app/admin/lei-14133/comentada/SearchBaseModal.tsx` — modal genérico de busca

### UI pública (3 cards novos)
- Modify: `app/lei-14133/LeiComentadaClient.tsx` — adicionar 3 cards
- Modify: `app/area-restrita/lei-comentada/page.tsx` — adicionar 3 cards

### Testes
- Create: `lib/lei-14133/__tests__/admin-validators.test.ts`
- Create: `app/api/admin/lei-14133/articles/[numero]/__tests__/route.test.ts`
- Create: `app/api/admin/lei-14133/articles/[numero]/__tests__/crud-flows.test.ts`

---

## Notas pra quem vai executar

- **TDD** se aplica a endpoints e validators (server-side). Pra componentes UI (modal, accordion, dnd), o overhead de testes não compensa — fazer **smoke test manual** seguindo checklist final.
- **Convenção Prisma do projeto:** rodar `npx prisma generate` após qualquer edição no schema. `vercel-build` faz `prisma db push --accept-data-loss && next build`.
- **Lint regra crítica:** o projeto usa `react/no-unescaped-entities` — caracteres `"` `'` em JSX precisam de `&quot;` `&apos;`.
- **Frequent commits:** cada Task termina com `git add` + `git commit`. Não acumular mudanças entre Tasks. Não pushar até a Task final (todas as validações OK).
- **`verifyAdmin`:** já existe em `lib/api-middleware.ts:138`. Usar em TODOS os endpoints admin.
- **`CacheInvalidation.leiArticles()`:** já existe em `lib/cache/redis-client.ts:781`. Chamar após qualquer PUT/POST/DELETE que afete artigos.
- **Reuso UI:** botão de favoritar e DocumentDetails permanecem na `lei-comentada` logada. O admin **não** tem favoritos (não faz sentido).

---

### Task 1: Schema Prisma + cache invalidation granular

**Files:**
- Modify: `prisma/schema.prisma:1043-1057` (model LeiArticle) + adicionar 2 models novos no fim do arquivo
- Modify: `lib/cache/redis-client.ts:178` (CacheKeys) + `:748` (CacheInvalidation)

- [ ] **Step 1:** Em `prisma/schema.prisma`, dentro de `model LeiArticle`, adicionar antes do bloco `@@index`:

```prisma
  professorComment String? @db.Text   // Markdown — bloco editorial do prof
  commentUpdatedAt DateTime?

  crossRefs         LeiArticleCrossRef[]
  suggestedReadings LeiArticleSuggestedReading[]
```

- [ ] **Step 2:** No final do arquivo `prisma/schema.prisma` (após o último model), adicionar:

```prisma
model LeiArticleCrossRef {
  id            String   @id @default(uuid())
  articleNumber String
  targetNumber  String
  note          String   @db.Text
  order         Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  article LeiArticle @relation(fields: [articleNumber], references: [numero], onDelete: Cascade)

  @@index([articleNumber, order])
  @@index([targetNumber])
}

model LeiArticleSuggestedReading {
  id            String   @id @default(uuid())
  articleNumber String

  // Discriminator: 'internal' (referência ao site) ou 'external' (URL livre)
  kind          String

  // kind='internal': referência por ID/slug
  // internalType: 'blog' | 'glossary' | 'legislative-act' | 'document'
  internalType  String?
  internalId    String?

  // kind='external': URL livre + categoria
  // externalType: 'video' | 'article' | 'book' | 'other'
  externalUrl   String?
  externalType  String?

  // Comum
  title         String?  // Override do título capturado da fonte interna
  description   String?  @db.Text
  author        String?
  order         Int      @default(0)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  article LeiArticle @relation(fields: [articleNumber], references: [numero], onDelete: Cascade)

  @@index([articleNumber, order])
}
```

- [ ] **Step 3:** Em `lib/cache/redis-client.ts`, dentro de `CacheKeys` (linha ~178), adicionar abaixo de `leiArticles`:

```typescript
  leiArticleEditor: (numero: string): string => `lei:article-editor:${numero}`,
```

- [ ] **Step 4:** Em `lib/cache/redis-client.ts`, dentro de `CacheInvalidation` (linha ~748), adicionar abaixo de `leiArticles`:

```typescript
  leiArticle: async (numero: string): Promise<number> => {
    if (!redis) return 0;
    const keys = await redis.keys(`*lei:article-editor:${numero}*`);
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  },
```

- [ ] **Step 5:** Regenerar Prisma client.

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [ ] **Step 6:** Aplicar schema no banco (dev local).

Run: `npx prisma db push --accept-data-loss`
Expected: schema sincronizado, 2 tabelas novas + 2 colunas em `LeiArticle`

- [ ] **Step 7:** Type-check global.

Run: `npx tsc --noEmit 2>&1 | grep -vE "__tests__|test\.ts|NODE_ENV|semantic-adapter" | head -10`
Expected: sem output (nenhum erro fora dos pré-existentes em tests)

- [ ] **Step 8:** Commit.

```bash
git add prisma/schema.prisma lib/cache/redis-client.ts
git commit -m "feat(schema): adiciona LeiArticle.professorComment + crossRefs + suggestedReadings

Schema do MVP do admin editorial da Lei 14.133. Vercel-build aplica
via prisma db push --accept-data-loss."
```

---

### Task 2: Validators (zod) compartilhados

**Files:**
- Create: `lib/lei-14133/admin-validators.ts`
- Create: `lib/lei-14133/__tests__/admin-validators.test.ts`

- [ ] **Step 1:** Criar o arquivo de testes primeiro.

Conteúdo de `lib/lei-14133/__tests__/admin-validators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  CommentSchema,
  CrossRefSchema,
  ReadingSchema,
  ReorderSchema,
} from '../admin-validators';

describe('CommentSchema', () => {
  it('aceita markdown válido', () => {
    expect(CommentSchema.safeParse({ markdown: '# Olá\n\nTexto' }).success).toBe(true);
  });
  it('aceita string vazia (limpar comentário)', () => {
    expect(CommentSchema.safeParse({ markdown: '' }).success).toBe(true);
  });
  it('rejeita > 50k chars', () => {
    expect(CommentSchema.safeParse({ markdown: 'x'.repeat(50_001) }).success).toBe(false);
  });
});

describe('CrossRefSchema', () => {
  it('aceita target válido + nota curta', () => {
    expect(
      CrossRefSchema.safeParse({ targetNumber: '44', note: 'Quando o ETP é dispensado' }).success,
    ).toBe(true);
  });
  it('rejeita target vazio', () => {
    expect(CrossRefSchema.safeParse({ targetNumber: '', note: 'foo' }).success).toBe(false);
  });
  it('rejeita target com letras inválidas (só dígitos + sufixo -X)', () => {
    expect(CrossRefSchema.safeParse({ targetNumber: 'abc', note: 'foo' }).success).toBe(false);
    expect(CrossRefSchema.safeParse({ targetNumber: '184-A', note: 'foo' }).success).toBe(true);
  });
  it('rejeita nota > 500 chars', () => {
    expect(CrossRefSchema.safeParse({ targetNumber: '44', note: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('ReadingSchema', () => {
  it('aceita kind=internal com tipo válido + id', () => {
    expect(
      ReadingSchema.safeParse({
        kind: 'internal',
        internalType: 'blog',
        internalId: 'meu-post',
        description: 'leitura essencial',
      }).success,
    ).toBe(true);
  });
  it('rejeita kind=internal sem internalId', () => {
    expect(
      ReadingSchema.safeParse({ kind: 'internal', internalType: 'blog' }).success,
    ).toBe(false);
  });
  it('aceita kind=external com URL https', () => {
    expect(
      ReadingSchema.safeParse({
        kind: 'external',
        externalUrl: 'https://youtube.com/watch?v=x',
        externalType: 'video',
        title: 'Aula sobre dispensa',
      }).success,
    ).toBe(true);
  });
  it('rejeita kind=external com URL sem protocolo', () => {
    expect(
      ReadingSchema.safeParse({
        kind: 'external',
        externalUrl: 'youtube.com',
        externalType: 'video',
        title: 'foo',
      }).success,
    ).toBe(false);
  });
  it('rejeita internalType inválido', () => {
    expect(
      ReadingSchema.safeParse({ kind: 'internal', internalType: 'foo', internalId: 'x' }).success,
    ).toBe(false);
  });
});

describe('ReorderSchema', () => {
  it('aceita array de IDs válidos', () => {
    expect(ReorderSchema.safeParse({ ids: ['a', 'b', 'c'] }).success).toBe(true);
  });
  it('rejeita array vazio', () => {
    expect(ReorderSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2:** Rodar pra ver falhar (módulo ainda não existe).

Run: `npx vitest run lib/lei-14133/__tests__/admin-validators.test.ts`
Expected: FAIL — `Cannot find module '../admin-validators'`

- [ ] **Step 3:** Criar `lib/lei-14133/admin-validators.ts`:

```typescript
import { z } from 'zod';

export const CommentSchema = z.object({
  markdown: z.string().max(50_000),
});

const ARTICLE_NUMBER_RE = /^\d+(-[A-Z])?$/;

export const CrossRefSchema = z.object({
  targetNumber: z.string().regex(ARTICLE_NUMBER_RE, 'Número de artigo inválido'),
  note: z.string().min(1).max(500),
  order: z.number().int().nonnegative().optional(),
});

export const CrossRefUpdateSchema = CrossRefSchema.partial();

const INTERNAL_TYPES = ['blog', 'glossary', 'legislative-act', 'document'] as const;
const EXTERNAL_TYPES = ['video', 'article', 'book', 'other'] as const;

export const ReadingSchema = z
  .object({
    kind: z.enum(['internal', 'external']),
    internalType: z.enum(INTERNAL_TYPES).optional(),
    internalId: z.string().min(1).optional(),
    externalUrl: z
      .string()
      .url('URL externa precisa começar com http:// ou https://')
      .optional(),
    externalType: z.enum(EXTERNAL_TYPES).optional(),
    title: z.string().max(300).optional(),
    description: z.string().max(1500).optional(),
    author: z.string().max(200).optional(),
    order: z.number().int().nonnegative().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === 'internal') {
      if (!val.internalType) {
        ctx.addIssue({ code: 'custom', message: 'internalType obrigatório quando kind=internal', path: ['internalType'] });
      }
      if (!val.internalId) {
        ctx.addIssue({ code: 'custom', message: 'internalId obrigatório quando kind=internal', path: ['internalId'] });
      }
    } else if (val.kind === 'external') {
      if (!val.externalUrl) {
        ctx.addIssue({ code: 'custom', message: 'externalUrl obrigatório quando kind=external', path: ['externalUrl'] });
      }
      if (!val.externalType) {
        ctx.addIssue({ code: 'custom', message: 'externalType obrigatório quando kind=external', path: ['externalType'] });
      }
      if (!val.title) {
        ctx.addIssue({ code: 'custom', message: 'title obrigatório quando kind=external', path: ['title'] });
      }
    }
  });

export const ReadingUpdateSchema = ReadingSchema;

export const ReorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'ids não pode ser vazio'),
});

export type CommentInput = z.infer<typeof CommentSchema>;
export type CrossRefInput = z.infer<typeof CrossRefSchema>;
export type ReadingInput = z.infer<typeof ReadingSchema>;
export type ReorderInput = z.infer<typeof ReorderSchema>;
```

- [ ] **Step 4:** Rodar e verificar PASS.

Run: `npx vitest run lib/lei-14133/__tests__/admin-validators.test.ts`
Expected: PASS — 14+ asserts

- [ ] **Step 5:** Commit.

```bash
git add lib/lei-14133/admin-validators.ts lib/lei-14133/__tests__/admin-validators.test.ts
git commit -m "feat(lei-14133): validators zod do admin editorial

CommentSchema, CrossRefSchema, ReadingSchema (com superRefine para
discriminator internal/external) e ReorderSchema. Cobertos por
14 testes unitários."
```

---

### Task 3: GET artigo enriquecido pro editor

**Files:**
- Create: `app/api/admin/lei-14133/articles/[numero]/route.ts`
- Create: `app/api/admin/lei-14133/articles/[numero]/__tests__/route.test.ts`

- [ ] **Step 1:** Criar testes em `app/api/admin/lei-14133/articles/[numero]/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/api-middleware', () => ({
  verifyAdmin: vi.fn(async () => ({ error: null })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    leiArticle: { findUnique: vi.fn() },
    document: { findMany: vi.fn() },
    legislativeAct: { findMany: vi.fn() },
  },
}));

const { prisma } = await import('@/lib/prisma');

describe('GET /api/admin/lei-14133/articles/[numero]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 404 quando artigo não existe', async () => {
    (prisma.leiArticle.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/admin/lei-14133/articles/999');
    const res = await GET(req, { params: Promise.resolve({ numero: '999' }) });
    expect(res.status).toBe(404);
  });

  it('retorna artigo enriquecido com docs e atos vinculados', async () => {
    (prisma.leiArticle.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a',
      numero: '18',
      titulo: 'TÍTULO I',
      capitulo: 'CAP I',
      capituloCompleto: 'CAPÍTULO I',
      ementa: 'Texto do art. 18',
      secao: null,
      professorComment: '# Comentário',
      commentUpdatedAt: new Date(),
      crossRefs: [{ id: 'c1', targetNumber: '44', note: 'foo', order: 0 }],
      suggestedReadings: [],
    });
    (prisma.document.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'd1', title: 'Doc A', leiArticles: '["18"]', category: 'parecer', isPublic: true },
    ]);
    (prisma.legislativeAct.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'l1', fullNumber: 'IN 67/2021', title: 'Dispensa eletrônica', leiArticles: '["18","75"]', importance: 'alta', type: 'in' },
    ]);
    const req = new NextRequest('http://localhost/api/admin/lei-14133/articles/18');
    const res = await GET(req, { params: Promise.resolve({ numero: '18' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.article.numero).toBe('18');
    expect(body.article.professorComment).toBe('# Comentário');
    expect(body.linkedDocuments).toHaveLength(1);
    expect(body.linkedActs).toHaveLength(1);
    expect(body.linkedActs[0].importance).toBe('alta');
  });
});
```

- [ ] **Step 2:** Rodar pra ver falhar.

Run: `npx vitest run app/api/admin/lei-14133/articles/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3:** Criar `app/api/admin/lei-14133/articles/[numero]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { safeParseArray } from '@/lib/utils';

/**
 * GET /api/admin/lei-14133/articles/[numero]
 * Retorna artigo + comentário + crossRefs + suggestedReadings
 * + Documents/LegislativeActs vinculados (filtrando por leiArticles JSON).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const article = await prisma.leiArticle.findUnique({
    where: { numero },
    include: {
      crossRefs: { orderBy: { order: 'asc' } },
      suggestedReadings: { orderBy: { order: 'asc' } },
    },
  });

  if (!article) {
    return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 });
  }

  // Documents que linkam este artigo
  const allDocs = await prisma.document.findMany({
    where: { leiArticles: { not: null } },
    select: { id: true, title: true, leiArticles: true, category: true, isPublic: true, notesImportance: true },
  });
  const linkedDocuments = allDocs.filter((d) =>
    safeParseArray(d.leiArticles).map(String).includes(numero),
  );

  // LegislativeActs que linkam este artigo
  const allActs = await prisma.legislativeAct.findMany({
    where: { leiArticles: { not: null } },
    select: {
      id: true,
      fullNumber: true,
      title: true,
      ementa: true,
      type: true,
      hierarchyLevel: true,
      esfera: true,
      importance: true,
      leiArticles: true,
    },
  });
  const linkedActs = allActs.filter((a) =>
    safeParseArray(a.leiArticles).map(String).includes(numero),
  );

  return NextResponse.json({ article, linkedDocuments, linkedActs });
}
```

- [ ] **Step 4:** Rodar e verificar PASS.

Run: `npx vitest run app/api/admin/lei-14133/articles/__tests__/route.test.ts`
Expected: PASS — 2 asserts

- [ ] **Step 5:** Commit.

```bash
git add app/api/admin/lei-14133/articles
git commit -m "feat(api): GET admin/lei-14133/articles/[numero] enriquecido

Retorna artigo + crossRefs + suggestedReadings + Documents/Acts
vinculados, pra alimentar o editor."
```

---

### Task 4: PUT comentário do professor

**Files:**
- Create: `app/api/admin/lei-14133/articles/[numero]/comment/route.ts`

- [ ] **Step 1:** Criar `app/api/admin/lei-14133/articles/[numero]/comment/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { CommentSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const body = await request.json();
  const parsed = CommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  const article = await prisma.leiArticle.findUnique({ where: { numero } });
  if (!article) {
    return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 });
  }

  const updated = await prisma.leiArticle.update({
    where: { numero },
    data: {
      professorComment: parsed.data.markdown || null,
      commentUpdatedAt: parsed.data.markdown ? new Date() : null,
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, article: updated });
}
```

- [ ] **Step 2:** Type-check.

Run: `npx tsc --noEmit 2>&1 | grep -E "comment/route" | head -5`
Expected: sem output

- [ ] **Step 3:** Commit.

```bash
git add app/api/admin/lei-14133/articles/[numero]/comment
git commit -m "feat(api): PUT comment do prof por artigo da Lei 14.133

Valida com CommentSchema, salva professorComment + commentUpdatedAt,
invalida caches leiArticles e leiArticle(numero)."
```

---

### Task 5: CRUD crossrefs

**Files:**
- Create: `app/api/admin/lei-14133/articles/[numero]/crossrefs/route.ts`
- Create: `app/api/admin/lei-14133/articles/[numero]/crossrefs/[id]/route.ts`
- Create: `app/api/admin/lei-14133/articles/[numero]/crossrefs/reorder/route.ts`

- [ ] **Step 1:** Criar `app/api/admin/lei-14133/articles/[numero]/crossrefs/route.ts` (GET + POST):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { CrossRefSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const list = await prisma.leiArticleCrossRef.findMany({
    where: { articleNumber: numero },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json({ crossRefs: list });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const body = await request.json();
  const parsed = CrossRefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  // Confirma que o artigo existe e o targetNumber também
  const [article, target] = await Promise.all([
    prisma.leiArticle.findUnique({ where: { numero }, select: { numero: true } }),
    prisma.leiArticle.findUnique({ where: { numero: parsed.data.targetNumber }, select: { numero: true } }),
  ]);
  if (!article) return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 });
  if (!target) {
    return NextResponse.json({ error: `Artigo destino ${parsed.data.targetNumber} não existe na Lei 14.133` }, { status: 422 });
  }
  if (parsed.data.targetNumber === numero) {
    return NextResponse.json({ error: 'Não é possível vincular um artigo a ele mesmo' }, { status: 422 });
  }

  // Calcula próximo order se não foi fornecido
  let order = parsed.data.order;
  if (order === undefined) {
    const last = await prisma.leiArticleCrossRef.findFirst({
      where: { articleNumber: numero },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    order = last ? last.order + 1 : 0;
  }

  const created = await prisma.leiArticleCrossRef.create({
    data: {
      articleNumber: numero,
      targetNumber: parsed.data.targetNumber,
      note: parsed.data.note,
      order,
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, crossRef: created });
}
```

- [ ] **Step 2:** Criar `app/api/admin/lei-14133/articles/[numero]/crossrefs/[id]/route.ts` (PUT + DELETE):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { CrossRefUpdateSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; id: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero, id } = await params;
  const body = await request.json();
  const parsed = CrossRefUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  const existing = await prisma.leiArticleCrossRef.findUnique({ where: { id } });
  if (!existing || existing.articleNumber !== numero) {
    return NextResponse.json({ error: 'CrossRef não encontrado' }, { status: 404 });
  }

  const updated = await prisma.leiArticleCrossRef.update({
    where: { id },
    data: {
      ...(parsed.data.targetNumber !== undefined && { targetNumber: parsed.data.targetNumber }),
      ...(parsed.data.note !== undefined && { note: parsed.data.note }),
      ...(parsed.data.order !== undefined && { order: parsed.data.order }),
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, crossRef: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; id: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero, id } = await params;
  const existing = await prisma.leiArticleCrossRef.findUnique({ where: { id } });
  if (!existing || existing.articleNumber !== numero) {
    return NextResponse.json({ error: 'CrossRef não encontrado' }, { status: 404 });
  }

  await prisma.leiArticleCrossRef.delete({ where: { id } });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3:** Criar `app/api/admin/lei-14133/articles/[numero]/crossrefs/reorder/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { ReorderSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const body = await request.json();
  const parsed = ReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  // Confirma que todos os IDs pertencem ao artigo
  const items = await prisma.leiArticleCrossRef.findMany({
    where: { id: { in: parsed.data.ids }, articleNumber: numero },
    select: { id: true },
  });
  if (items.length !== parsed.data.ids.length) {
    return NextResponse.json({ error: 'IDs inválidos' }, { status: 422 });
  }

  await prisma.$transaction(
    parsed.data.ids.map((id, idx) =>
      prisma.leiArticleCrossRef.update({ where: { id }, data: { order: idx } }),
    ),
  );

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4:** Type-check.

Run: `npx tsc --noEmit 2>&1 | grep crossrefs | head -5`
Expected: sem output

- [ ] **Step 5:** Commit.

```bash
git add app/api/admin/lei-14133/articles/[numero]/crossrefs
git commit -m "feat(api): CRUD de crossRefs (vinculações entre artigos)

GET, POST, PUT, DELETE e reorder. Valida que targetNumber existe na
Lei 14.133 e impede self-link."
```

---

### Task 6: CRUD readings

**Files:**
- Create: `app/api/admin/lei-14133/articles/[numero]/readings/route.ts`
- Create: `app/api/admin/lei-14133/articles/[numero]/readings/[id]/route.ts`
- Create: `app/api/admin/lei-14133/articles/[numero]/readings/reorder/route.ts`

- [ ] **Step 1:** Criar `app/api/admin/lei-14133/articles/[numero]/readings/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { ReadingSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const list = await prisma.leiArticleSuggestedReading.findMany({
    where: { articleNumber: numero },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json({ readings: list });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const body = await request.json();
  const parsed = ReadingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  const article = await prisma.leiArticle.findUnique({ where: { numero }, select: { numero: true } });
  if (!article) return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 });

  let order = parsed.data.order;
  if (order === undefined) {
    const last = await prisma.leiArticleSuggestedReading.findFirst({
      where: { articleNumber: numero },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    order = last ? last.order + 1 : 0;
  }

  const created = await prisma.leiArticleSuggestedReading.create({
    data: {
      articleNumber: numero,
      kind: parsed.data.kind,
      internalType: parsed.data.internalType,
      internalId: parsed.data.internalId,
      externalUrl: parsed.data.externalUrl,
      externalType: parsed.data.externalType,
      title: parsed.data.title,
      description: parsed.data.description,
      author: parsed.data.author,
      order,
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, reading: created });
}
```

- [ ] **Step 2:** Criar `app/api/admin/lei-14133/articles/[numero]/readings/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { ReadingUpdateSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; id: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero, id } = await params;
  const body = await request.json();
  const parsed = ReadingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  const existing = await prisma.leiArticleSuggestedReading.findUnique({ where: { id } });
  if (!existing || existing.articleNumber !== numero) {
    return NextResponse.json({ error: 'Reading não encontrado' }, { status: 404 });
  }

  const updated = await prisma.leiArticleSuggestedReading.update({
    where: { id },
    data: {
      kind: parsed.data.kind,
      internalType: parsed.data.internalType ?? null,
      internalId: parsed.data.internalId ?? null,
      externalUrl: parsed.data.externalUrl ?? null,
      externalType: parsed.data.externalType ?? null,
      title: parsed.data.title ?? null,
      description: parsed.data.description ?? null,
      author: parsed.data.author ?? null,
      ...(parsed.data.order !== undefined && { order: parsed.data.order }),
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, reading: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; id: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero, id } = await params;
  const existing = await prisma.leiArticleSuggestedReading.findUnique({ where: { id } });
  if (!existing || existing.articleNumber !== numero) {
    return NextResponse.json({ error: 'Reading não encontrado' }, { status: 404 });
  }

  await prisma.leiArticleSuggestedReading.delete({ where: { id } });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3:** Criar `app/api/admin/lei-14133/articles/[numero]/readings/reorder/route.ts` (idêntico ao crossrefs reorder mas pra readings):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { ReorderSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const body = await request.json();
  const parsed = ReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  const items = await prisma.leiArticleSuggestedReading.findMany({
    where: { id: { in: parsed.data.ids }, articleNumber: numero },
    select: { id: true },
  });
  if (items.length !== parsed.data.ids.length) {
    return NextResponse.json({ error: 'IDs inválidos' }, { status: 422 });
  }

  await prisma.$transaction(
    parsed.data.ids.map((id, idx) =>
      prisma.leiArticleSuggestedReading.update({ where: { id }, data: { order: idx } }),
    ),
  );

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4:** Commit.

```bash
git add app/api/admin/lei-14133/articles/[numero]/readings
git commit -m "feat(api): CRUD de suggestedReadings (leituras sugeridas)

GET, POST, PUT, DELETE e reorder. Aceita kind=internal (referência
a blog/glossary/legislative-act/document) e kind=external (URL livre)."
```

---

### Task 7: link-document e link-act

**Files:**
- Create: `app/api/admin/lei-14133/articles/[numero]/link-document/route.ts`
- Create: `app/api/admin/lei-14133/articles/[numero]/link-document/[documentId]/route.ts`
- Create: `app/api/admin/lei-14133/articles/[numero]/link-act/route.ts`
- Create: `app/api/admin/lei-14133/articles/[numero]/link-act/[actId]/route.ts`

- [ ] **Step 1:** Criar `app/api/admin/lei-14133/articles/[numero]/link-document/route.ts` (POST):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { safeParseArray } from '@/lib/utils';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const body = await request.json();
  const documentId = String(body?.documentId || '').trim();
  if (!documentId) {
    return NextResponse.json({ error: 'documentId obrigatório' }, { status: 422 });
  }

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, leiArticles: true },
  });
  if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

  const current = safeParseArray(doc.leiArticles).map(String);
  if (current.includes(numero)) {
    return NextResponse.json({ success: true, alreadyLinked: true });
  }
  const next = [...current, numero];

  await prisma.document.update({
    where: { id: documentId },
    data: { leiArticles: JSON.stringify(next) },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2:** Criar `app/api/admin/lei-14133/articles/[numero]/link-document/[documentId]/route.ts` (DELETE):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { safeParseArray } from '@/lib/utils';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; documentId: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero, documentId } = await params;
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, leiArticles: true },
  });
  if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

  const current = safeParseArray(doc.leiArticles).map(String);
  const next = current.filter((n) => n !== numero);

  await prisma.document.update({
    where: { id: documentId },
    data: { leiArticles: next.length > 0 ? JSON.stringify(next) : null },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3:** Criar `app/api/admin/lei-14133/articles/[numero]/link-act/route.ts` (POST — espelha link-document mas pra LegislativeAct):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { safeParseArray } from '@/lib/utils';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const body = await request.json();
  const actId = String(body?.actId || '').trim();
  if (!actId) {
    return NextResponse.json({ error: 'actId obrigatório' }, { status: 422 });
  }

  const act = await prisma.legislativeAct.findUnique({
    where: { id: actId },
    select: { id: true, leiArticles: true },
  });
  if (!act) return NextResponse.json({ error: 'Ato não encontrado' }, { status: 404 });

  const current = safeParseArray(act.leiArticles).map(String);
  if (current.includes(numero)) {
    return NextResponse.json({ success: true, alreadyLinked: true });
  }
  const next = [...current, numero];

  await prisma.legislativeAct.update({
    where: { id: actId },
    data: { leiArticles: JSON.stringify(next) },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4:** Criar `app/api/admin/lei-14133/articles/[numero]/link-act/[actId]/route.ts` (DELETE):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { safeParseArray } from '@/lib/utils';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; actId: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero, actId } = await params;
  const act = await prisma.legislativeAct.findUnique({
    where: { id: actId },
    select: { id: true, leiArticles: true },
  });
  if (!act) return NextResponse.json({ error: 'Ato não encontrado' }, { status: 404 });

  const current = safeParseArray(act.leiArticles).map(String);
  const next = current.filter((n) => n !== numero);

  await prisma.legislativeAct.update({
    where: { id: actId },
    data: { leiArticles: next.length > 0 ? JSON.stringify(next) : null },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5:** Type-check.

Run: `npx tsc --noEmit 2>&1 | grep -E "link-document|link-act" | head -5`
Expected: sem output

- [ ] **Step 6:** Commit.

```bash
git add app/api/admin/lei-14133/articles/[numero]/link-document app/api/admin/lei-14133/articles/[numero]/link-act
git commit -m "feat(api): vincular/desvincular Document e LegislativeAct ao artigo

POST adiciona o numero do artigo ao JSON de leiArticles. DELETE remove.
Idempotente — POST de doc já vinculado retorna alreadyLinked=true."
```

---

### Task 8: Endpoint unificado de busca interna

**Files:**
- Create: `app/api/admin/internal-search/route.ts`

- [ ] **Step 1:** Criar `app/api/admin/internal-search/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';

const VALID_TYPES = ['blog', 'glossary', 'legislative-act', 'document'] as const;
type InternalType = (typeof VALID_TYPES)[number];

interface Result {
  id: string;
  title: string;
  slug?: string;
  snippet?: string;
}

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as InternalType | null;
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '15', 10) || 15, 50);

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'type inválido', valid: VALID_TYPES }, { status: 422 });
  }

  let results: Result[] = [];

  if (type === 'blog') {
    const items = await prisma.blogPost.findMany({
      where: q
        ? { isPublished: true, OR: [{ title: { contains: q, mode: 'insensitive' } }, { excerpt: { contains: q, mode: 'insensitive' } }] }
        : { isPublished: true },
      select: { id: true, title: true, slug: true, excerpt: true },
      take: limit,
      orderBy: { publishedAt: 'desc' },
    });
    results = items.map((b) => ({ id: b.id, title: b.title, slug: b.slug, snippet: b.excerpt || undefined }));
  } else if (type === 'glossary') {
    const items = await prisma.glossaryTerm.findMany({
      where: q
        ? { OR: [{ term: { contains: q, mode: 'insensitive' } }, { definition: { contains: q, mode: 'insensitive' } }] }
        : {},
      select: { id: true, term: true, slug: true, definition: true },
      take: limit,
      orderBy: { term: 'asc' },
    });
    results = items.map((g) => ({
      id: g.id,
      title: g.term,
      slug: g.slug,
      snippet: g.definition?.substring(0, 120) || undefined,
    }));
  } else if (type === 'legislative-act') {
    const items = await prisma.legislativeAct.findMany({
      where: q
        ? { OR: [{ fullNumber: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }, { ementa: { contains: q, mode: 'insensitive' } }] }
        : {},
      select: { id: true, fullNumber: true, title: true, ementa: true },
      take: limit,
      orderBy: { publishDate: 'desc' },
    });
    results = items.map((a) => ({
      id: a.id,
      title: `${a.fullNumber} — ${a.title}`,
      snippet: a.ementa?.substring(0, 120) || undefined,
    }));
  } else if (type === 'document') {
    const items = await prisma.document.findMany({
      where: q
        ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }
        : {},
      select: { id: true, title: true, description: true, category: true },
      take: limit,
      orderBy: { uploadedAt: 'desc' },
    });
    results = items.map((d) => ({
      id: d.id,
      title: d.title,
      snippet: d.description?.substring(0, 120) || undefined,
    }));
  }

  return NextResponse.json({ type, query: q, results });
}
```

- [ ] **Step 2:** Type-check (atenção a `prisma.glossaryTerm` — ajustar se nome do modelo no Prisma for diferente).

Run: `npx tsc --noEmit 2>&1 | grep internal-search | head -5`
Expected: sem output. Se acusar `glossaryTerm` ausente, conferir nome real do model em `prisma/schema.prisma` e ajustar o caso para `prisma.<nome>`.

- [ ] **Step 3:** Commit.

```bash
git add app/api/admin/internal-search
git commit -m "feat(api): /admin/internal-search unificado por tipo

Aceita type=blog|glossary|legislative-act|document + q (opcional).
Alimenta a modal de seleção de leitura interna no editor da Lei 14.133."
```

---

### Task 9: Estender API pública pra expor comentário, crossRefs e readings

**Files:**
- Modify: `app/api/lei-14133/articles/route.ts`

- [ ] **Step 1:** Em `app/api/lei-14133/articles/route.ts`, adicionar imports do Prisma client (se ainda não tem) e enriquecer cada artigo com os novos campos. Localizar o trecho onde `enrichedArticles` é construído (linha ~167) e ajustar o select do `findMany` da linha ~44:

Trocar o select inicial:

```typescript
        const allArticles = await prisma.leiArticle.findMany({
          select: {
            id: true,
            numero: true,
            titulo: true,
            capituloCompleto: true,
            ementa: true,
            capitulo: true,
            secao: true,
            createdAt: true,
            updatedAt: true,
            professorComment: true,
            commentUpdatedAt: true,
            crossRefs: {
              select: { id: true, targetNumber: true, note: true, order: true },
              orderBy: { order: 'asc' },
            },
            suggestedReadings: {
              select: {
                id: true,
                kind: true,
                internalType: true,
                internalId: true,
                externalUrl: true,
                externalType: true,
                title: true,
                description: true,
                author: true,
                order: true,
              },
              orderBy: { order: 'asc' },
            },
          },
        });
```

- [ ] **Step 2:** O `enrichedArticles.map()` (linha ~167) agora propaga esses campos automaticamente via `...art`. Confirmar que o spread já passa os campos novos.

- [ ] **Step 3:** Type-check.

Run: `npx tsc --noEmit 2>&1 | grep "lei-14133/articles/route" | head -5`
Expected: sem output

- [ ] **Step 4:** Commit.

```bash
git add app/api/lei-14133/articles/route.ts
git commit -m "feat(api): /api/lei-14133/articles expõe comment, crossRefs e readings

Cada artigo enriquecido agora carrega professorComment,
crossRefs[] e suggestedReadings[] (ordenados por order asc).
Cache TTL existente continua valendo."
```

---

### Task 10: Refator — extrair `<LeiSidebar>` compartilhada

**Files:**
- Create: `components/lei-14133/LeiSidebar.tsx`
- Modify: `app/lei-14133/LeiComentadaClient.tsx` (substitui inline pelo componente)
- Modify: `app/area-restrita/lei-comentada/page.tsx` (substitui inline pelo componente)

- [ ] **Step 1:** Criar `components/lei-14133/LeiSidebar.tsx`:

```typescript
'use client';

import { ChevronRight, ChevronDown } from 'lucide-react';
import type { RefObject } from 'react';

export interface LeiArticleListItem {
  numero: string;
  titulo: string | null;
  capitulo: string;
  capituloCompleto: string | null;
  ementa: string;
  documentCount: number;
}

export interface LeiHierarchyCapitulo {
  capituloCompleto: string;
  artigos: LeiArticleListItem[];
}

export interface LeiHierarchyTitulo {
  titulo: string;
  capitulos: Record<string, LeiHierarchyCapitulo>;
}

export type LeiHierarchy = Record<string, LeiHierarchyTitulo>;

interface LeiSidebarProps {
  hierarchy: LeiHierarchy | null;
  selectedNumero: string | null;
  expandedTitulos: Set<string>;
  expandedCapitulos: Set<string>;
  onToggleTitulo: (titulo: string) => void;
  onToggleCapitulo: (tituloKey: string, capituloKey: string) => void;
  onSelectArticle: (article: LeiArticleListItem) => void;
  articleRefs?: RefObject<Record<string, HTMLElement | null>>;
}

export function LeiSidebar({
  hierarchy,
  selectedNumero,
  expandedTitulos,
  expandedCapitulos,
  onToggleTitulo,
  onToggleCapitulo,
  onSelectArticle,
  articleRefs,
}: LeiSidebarProps) {
  if (!hierarchy) return null;

  return (
    <div className="p-2">
      {Object.entries(hierarchy).map(([tk, td]) => {
        const open = expandedTitulos.has(tk);
        return (
          <div key={tk} className="mb-2">
            <button
              onClick={() => onToggleTitulo(tk)}
              className="w-full flex items-center gap-2 p-3 hover:bg-blue-50 rounded-lg transition-colors text-left"
            >
              {open ? (
                <ChevronDown className="w-5 h-5 text-blue-600 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{td.titulo}</p>
                <p className="text-xs text-gray-500">
                  {Object.values(td.capitulos).reduce((sum, c) => sum + c.artigos.length, 0)} artigos
                </p>
              </div>
            </button>

            {open && (
              <div className="ml-4 mt-1 space-y-1">
                {Object.entries(td.capitulos).map(([ck, cd]) => {
                  const cId = `${tk}::${ck}`;
                  const cOpen = expandedCapitulos.has(cId);
                  return (
                    <div key={ck}>
                      <button
                        onClick={() => onToggleCapitulo(tk, ck)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-indigo-50 rounded-lg transition-colors text-left"
                      >
                        {cOpen ? (
                          <ChevronDown className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{cd.capituloCompleto}</p>
                          <p className="text-xs text-gray-500">{cd.artigos.length} artigos</p>
                        </div>
                      </button>

                      {cOpen && (
                        <div className="ml-4 mt-1 space-y-1">
                          {cd.artigos.map((art) => {
                            const sel = selectedNumero === art.numero;
                            return (
                              <button
                                key={art.numero}
                                ref={(el) => {
                                  if (articleRefs?.current) articleRefs.current[art.numero] = el;
                                }}
                                onClick={() => onSelectArticle(art)}
                                className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left ${
                                  sel ? 'bg-blue-100 border-2 border-blue-500' : 'hover:bg-gray-100'
                                }`}
                              >
                                <span
                                  className={`px-2 py-1 rounded text-xs font-bold ${
                                    sel ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                                  }`}
                                >
                                  Art. {art.numero}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-700 truncate">
                                    {art.ementa.substring(0, 40)}…
                                  </p>
                                </div>
                                {art.documentCount > 0 && (
                                  <span className="flex-shrink-0 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                    {art.documentCount}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2:** Em `app/lei-14133/LeiComentadaClient.tsx`, importar `<LeiSidebar>` e substituir o `renderSidebar()` (linha ~330 procurar). Adicionar import:

```typescript
import { LeiSidebar } from '@/components/lei-14133/LeiSidebar';
```

E trocar o conteúdo do `renderSidebar` por:

```typescript
  const renderSidebar = () => (
    <LeiSidebar
      hierarchy={filteredHierarchy}
      selectedNumero={selectedArticle?.numero || null}
      expandedTitulos={expandedTitulos}
      expandedCapitulos={expandedCapitulos}
      onToggleTitulo={toggleTitulo}
      onToggleCapitulo={toggleCapitulo}
      onSelectArticle={(art) => {
        const fullArt = apiData?.articles.find((a) => a.numero === art.numero);
        if (fullArt) handleSelectArticle(fullArt);
      }}
      articleRefs={articleRefs as React.RefObject<Record<string, HTMLElement | null>>}
    />
  );
```

- [ ] **Step 3:** Em `app/area-restrita/lei-comentada/page.tsx`, fazer o equivalente: importar `LeiSidebar` e substituir `renderSidebarContent()`.

Adicionar import:
```typescript
import { LeiSidebar } from '@/components/lei-14133/LeiSidebar';
```

Substituir a função `renderSidebarContent` por:
```typescript
  const renderSidebarContent = () => (
    <LeiSidebar
      hierarchy={filteredHierarchy}
      selectedNumero={selectedArticle?.numero || null}
      expandedTitulos={expandedTitulos}
      expandedCapitulos={expandedCapitulos}
      onToggleTitulo={toggleTitulo}
      onToggleCapitulo={toggleCapitulo}
      onSelectArticle={(art) => {
        const fullArt = apiData?.articles.find((a) => a.numero === art.numero);
        if (fullArt) handleSelectArticle(fullArt);
      }}
      articleRefs={articleRefs as React.RefObject<Record<string, HTMLElement | null>>}
    />
  );
```

- [ ] **Step 4:** Type-check + lint.

Run: `npx tsc --noEmit 2>&1 | grep -E "LeiComentadaClient|lei-comentada/page|LeiSidebar" | head -5`
Run: `npx eslint app/lei-14133/LeiComentadaClient.tsx app/area-restrita/lei-comentada/page.tsx components/lei-14133/LeiSidebar.tsx 2>&1 | tail -5`
Expected: sem erros

- [ ] **Step 5:** Smoke test manual: rodar `npm run dev`, abrir `/lei-14133` e `/area-restrita/lei-comentada` — sidebar deve funcionar igual a antes (expandir/colapsar, selecionar artigo, scroll automático com `?artigo=N`).

- [ ] **Step 6:** Commit.

```bash
git add components/lei-14133/LeiSidebar.tsx app/lei-14133/LeiComentadaClient.tsx app/area-restrita/lei-comentada/page.tsx
git commit -m "refactor(lei-14133): extrai <LeiSidebar> compartilhada

Mesma sidebar Estrutura da Lei reusada na pública, na área restrita
e (próxima task) no admin. Comportamento idêntico — só remove
duplicação."
```

---

### Task 11: UI admin — shell + sidebar + estado base

**Files:**
- Create: `app/admin/lei-14133/comentada/page.tsx`
- Create: `app/admin/lei-14133/comentada/ComentadaAdminClient.tsx`

- [ ] **Step 1:** Criar `app/admin/lei-14133/comentada/page.tsx`:

```typescript
import { Metadata } from 'next';
import ComentadaAdminClient from './ComentadaAdminClient';

export const metadata: Metadata = {
  title: 'Lei 14.133 Comentada — Admin Editorial',
};

export default function Page() {
  return <ComentadaAdminClient />;
}
```

- [ ] **Step 2:** Criar `app/admin/lei-14133/comentada/ComentadaAdminClient.tsx`. Esse arquivo é grande mas estruturalmente espelha a `LeiComentadaClient` pública. Conteúdo:

```typescript
'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle, BookOpen, Search, X } from 'lucide-react';
import { LeiSidebar, type LeiHierarchy, type LeiHierarchyTitulo, type LeiHierarchyCapitulo } from '@/components/lei-14133/LeiSidebar';
import { ArticleEditorMain } from './ArticleEditorMain';

interface LeiArticle {
  id: string;
  numero: string;
  titulo: string | null;
  capituloCompleto: string | null;
  ementa: string;
  capitulo: string;
  secao: string | null;
  documentCount: number;
}

interface ApiResponse {
  articles: LeiArticle[];
  hierarchy: LeiHierarchy;
  total: number;
  totalWithDocuments: number;
}

function AdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<LeiArticle | null>(null);
  const [expandedTitulos, setExpandedTitulos] = useState<Set<string>>(new Set());
  const [expandedCapitulos, setExpandedCapitulos] = useState<Set<string>>(new Set());

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const articleRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/lei-14133/articles');
        if (!response.ok) throw new Error('Erro ao carregar artigos');
        const data: ApiResponse = await response.json();
        setApiData(data);
        const firstTitulo = Object.keys(data.hierarchy)[0];
        if (firstTitulo) {
          setExpandedTitulos(new Set([firstTitulo]));
          const firstCap = Object.keys(data.hierarchy[firstTitulo].capitulos)[0];
          if (firstCap) setExpandedCapitulos(new Set([`${firstTitulo}::${firstCap}`]));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  // Auto-select artigo da URL
  useEffect(() => {
    const articleParam = searchParams?.get('artigo');
    if (articleParam && apiData && !loading) {
      const article = apiData.articles.find((a) => a.numero === articleParam);
      if (article) {
        setSelectedArticle(article);
        if (article.titulo) setExpandedTitulos((prev) => new Set([...prev, article.titulo!]));
        const key = `${article.titulo}::${article.capitulo}`;
        setExpandedCapitulos((prev) => new Set([...prev, key]));
      }
    }
  }, [searchParams, apiData, loading]);

  // Filtrar
  const filteredHierarchy = useMemo<LeiHierarchy | null>(() => {
    if (!apiData) return null;
    if (!searchQuery) return apiData.hierarchy;
    const filtered: Record<string, LeiHierarchyTitulo> = {};
    Object.entries(apiData.hierarchy).forEach(([tk, td]) => {
      const fc: Record<string, LeiHierarchyCapitulo> = {};
      Object.entries(td.capitulos).forEach(([ck, cd]) => {
        const fa = cd.artigos.filter((art) => {
          const q = searchQuery.toLowerCase();
          return art.numero.includes(q) || art.ementa.toLowerCase().includes(q);
        });
        if (fa.length > 0) fc[ck] = { ...cd, artigos: fa };
      });
      if (Object.keys(fc).length > 0) filtered[tk] = { ...td, capitulos: fc };
    });
    return filtered;
  }, [apiData, searchQuery]);

  const toggleTitulo = (t: string) => {
    setExpandedTitulos((prev) => {
      const s = new Set(prev);
      if (s.has(t)) s.delete(t);
      else s.add(t);
      return s;
    });
  };
  const toggleCapitulo = (tk: string, ck: string) => {
    const key = `${tk}::${ck}`;
    setExpandedCapitulos((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  };

  const handleSelectArticle = (art: LeiArticle) => {
    setSelectedArticle(art);
    setMobileDrawerOpen(false);
    router.push(`/admin/lei-14133/comentada?artigo=${art.numero}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }
  if (error || !apiData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-700 text-center">{error || 'Erro desconhecido'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/admin" className="flex items-center gap-2 text-white/80 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
            <Link href="/lei-14133" className="bg-white/20 px-3 py-1.5 rounded-lg hover:bg-white/30 text-sm">
              Ver no site público →
            </Link>
          </div>

          <div className="mb-4">
            <h1 className="text-3xl font-bold">Lei 14.133 Comentada — Editor</h1>
            <p className="text-purple-100">Controle editorial completo: comentário, leituras, vinculações e destaques</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar artigo por número ou texto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="hidden lg:block lg:col-span-4">
            <div className="bg-white rounded-lg shadow-md sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Estrutura da Lei</h2>
                <p className="text-sm text-gray-600">{Object.keys(filteredHierarchy || {}).length} títulos</p>
              </div>
              <LeiSidebar
                hierarchy={filteredHierarchy}
                selectedNumero={selectedArticle?.numero || null}
                expandedTitulos={expandedTitulos}
                expandedCapitulos={expandedCapitulos}
                onToggleTitulo={toggleTitulo}
                onToggleCapitulo={toggleCapitulo}
                onSelectArticle={handleSelectArticle}
                articleRefs={articleRefs as React.RefObject<Record<string, HTMLElement | null>>}
              />
            </div>
          </div>

          <div className="lg:col-span-8">
            {selectedArticle ? (
              <ArticleEditorMain numero={selectedArticle.numero} />
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">Selecione um artigo</p>
                <p className="text-gray-500 text-sm">Escolha um artigo na sidebar para começar a editar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => setMobileDrawerOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center"
      >
        <BookOpen className="w-6 h-6" />
      </button>

      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileDrawerOpen(false)} />
          <div className="absolute top-0 left-0 h-full w-[80vw] max-w-sm bg-white shadow-2xl overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">Estrutura</h2>
              <button onClick={() => setMobileDrawerOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <LeiSidebar
              hierarchy={filteredHierarchy}
              selectedNumero={selectedArticle?.numero || null}
              expandedTitulos={expandedTitulos}
              expandedCapitulos={expandedCapitulos}
              onToggleTitulo={toggleTitulo}
              onToggleCapitulo={toggleCapitulo}
              onSelectArticle={handleSelectArticle}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComentadaAdminClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
```

- [ ] **Step 3:** Como `ArticleEditorMain` ainda não existe, criar stub temporário em `app/admin/lei-14133/comentada/ArticleEditorMain.tsx`:

```typescript
'use client';

interface Props {
  numero: string;
}

export function ArticleEditorMain({ numero }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <p className="text-gray-600">Editor do artigo {numero} (em construção)</p>
    </div>
  );
}
```

- [ ] **Step 4:** Type-check + smoke test.

Run: `npx tsc --noEmit 2>&1 | grep "admin/lei-14133/comentada" | head -5`
Expected: sem output

Smoke test: `npm run dev`, login como admin, abrir `/admin/lei-14133/comentada` — deve mostrar sidebar funcional + main column com placeholder.

- [ ] **Step 5:** Commit.

```bash
git add app/admin/lei-14133/comentada
git commit -m "feat(admin): página /admin/lei-14133/comentada — shell + sidebar

Espelha a estrutura da pública (sidebar Estrutura da Lei + main column).
ArticleEditorMain é stub temporário — preenchido nas próximas tasks."
```

---

### Task 12: ArticleEditorMain — orquestrador + carregamento de dados

**Files:**
- Modify: `app/admin/lei-14133/comentada/ArticleEditorMain.tsx` (substitui stub)
- Create: `hooks/use-toast-quick.ts` (helper se ainda não existir; senão usar `useToast` existente)

- [ ] **Step 1:** Substituir o stub de `ArticleEditorMain.tsx` por:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Pencil, FileText, BookOpen, Link as LinkIcon, ScrollText, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CommentEditor } from './CommentEditor';
import { CrossRefsEditor } from './CrossRefsEditor';
import { ReadingsEditor } from './ReadingsEditor';
import { LinkedDocsEditor } from './LinkedDocsEditor';
import { LinkedActsEditor } from './LinkedActsEditor';

interface CrossRef {
  id: string;
  targetNumber: string;
  note: string;
  order: number;
}
interface Reading {
  id: string;
  kind: 'internal' | 'external';
  internalType?: string | null;
  internalId?: string | null;
  externalUrl?: string | null;
  externalType?: string | null;
  title?: string | null;
  description?: string | null;
  author?: string | null;
  order: number;
}
interface LinkedDoc {
  id: string;
  title: string;
  category: string | null;
  isPublic: boolean;
  notesImportance: string | null;
}
interface LinkedAct {
  id: string;
  fullNumber: string;
  title: string;
  ementa: string;
  type: string;
  hierarchyLevel: number;
  esfera: string;
  importance: string | null;
}
interface Article {
  numero: string;
  titulo: string | null;
  capitulo: string;
  capituloCompleto: string | null;
  ementa: string;
  professorComment: string | null;
  commentUpdatedAt: string | null;
  crossRefs: CrossRef[];
  suggestedReadings: Reading[];
}

interface Props {
  numero: string;
}

export function ArticleEditorMain({ numero }: Props) {
  const { errorToast, successToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<Article | null>(null);
  const [linkedDocs, setLinkedDocs] = useState<LinkedDoc[]>([]);
  const [linkedActs, setLinkedActs] = useState<LinkedAct[]>([]);
  const [showCommentEditor, setShowCommentEditor] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/lei-14133/articles/${numero}`);
      if (!r.ok) throw new Error('Erro ao carregar artigo');
      const data = await r.json();
      setArticle(data.article);
      setLinkedDocs(data.linkedDocuments);
      setLinkedActs(data.linkedActs);
    } catch (err) {
      errorToast('Erro', err instanceof Error ? err.message : 'desconhecido');
    } finally {
      setLoading(false);
    }
  }, [numero, errorToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSaveComment = async (markdown: string) => {
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/comment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || 'Erro ao salvar');
    }
    successToast('Comentário salvo');
    setShowCommentEditor(false);
    fetchAll();
  };

  if (loading || !article) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Texto da lei (read-only) */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg">Art. {article.numero}</span>
          {article.titulo && <span className="text-sm text-gray-600">{article.titulo}</span>}
        </div>
        {article.capituloCompleto && <p className="text-sm text-gray-500 mb-3">{article.capituloCompleto}</p>}
        <div className="prose max-w-none text-gray-800 whitespace-pre-line">{article.ementa}</div>
      </div>

      {/* Comentário do prof */}
      <section className="bg-white rounded-lg shadow-md p-6">
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Comentário do Prof.
          </h2>
          <button
            onClick={() => setShowCommentEditor(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Pencil className="w-4 h-4" /> Editar
          </button>
        </header>
        {article.professorComment ? (
          <div className="prose prose-sm max-w-none whitespace-pre-line bg-amber-50/30 border-l-4 border-amber-300 p-3 rounded-r">
            {article.professorComment}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Nenhum comentário ainda. Clique em Editar para começar.</p>
        )}
      </section>

      {/* Leitura combinada */}
      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          Leitura combinada (vínculos com outros artigos)
        </h2>
        <CrossRefsEditor numero={numero} initial={article.crossRefs} onChanged={fetchAll} />
      </section>

      {/* Sugestões de leitura */}
      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-emerald-600" />
          Sugestões de leitura
        </h2>
        <ReadingsEditor numero={numero} initial={article.suggestedReadings} onChanged={fetchAll} />
      </section>

      {/* Documentos vinculados */}
      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Documentos vinculados ({linkedDocs.length})
        </h2>
        <LinkedDocsEditor numero={numero} linked={linkedDocs} onChanged={fetchAll} />
      </section>

      {/* Atos normativos vinculados */}
      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-violet-600" />
          Atos normativos vinculados ({linkedActs.length})
        </h2>
        <LinkedActsEditor numero={numero} linked={linkedActs} onChanged={fetchAll} />
      </section>

      {showCommentEditor && (
        <CommentEditor
          initial={article.professorComment || ''}
          onSave={handleSaveComment}
          onCancel={() => setShowCommentEditor(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2:** Como os 5 sub-editores ainda não existem, criar **stubs temporários** (cada um num arquivo) pra que esse arquivo compile. Em cada um:

`app/admin/lei-14133/comentada/CommentEditor.tsx`:
```typescript
'use client';
interface Props {
  initial: string;
  onSave: (markdown: string) => Promise<void>;
  onCancel: () => void;
}
export function CommentEditor({ onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <p>CommentEditor stub</p>
        <button onClick={onCancel} className="mt-4 px-4 py-2 bg-gray-200 rounded">Fechar</button>
      </div>
    </div>
  );
}
```

`app/admin/lei-14133/comentada/CrossRefsEditor.tsx`:
```typescript
'use client';
interface CrossRef { id: string; targetNumber: string; note: string; order: number }
interface Props { numero: string; initial: CrossRef[]; onChanged: () => void }
export function CrossRefsEditor({ initial }: Props) {
  return <p className="text-sm text-gray-500">CrossRefsEditor stub ({initial.length} itens)</p>;
}
```

`app/admin/lei-14133/comentada/ReadingsEditor.tsx`:
```typescript
'use client';
interface Reading { id: string; kind: string; title?: string | null; order: number }
interface Props { numero: string; initial: Reading[]; onChanged: () => void }
export function ReadingsEditor({ initial }: Props) {
  return <p className="text-sm text-gray-500">ReadingsEditor stub ({initial.length} itens)</p>;
}
```

`app/admin/lei-14133/comentada/LinkedDocsEditor.tsx`:
```typescript
'use client';
interface LinkedDoc { id: string; title: string; category: string | null; isPublic: boolean; notesImportance: string | null }
interface Props { numero: string; linked: LinkedDoc[]; onChanged: () => void }
export function LinkedDocsEditor({ linked }: Props) {
  return <p className="text-sm text-gray-500">LinkedDocsEditor stub ({linked.length} itens)</p>;
}
```

`app/admin/lei-14133/comentada/LinkedActsEditor.tsx`:
```typescript
'use client';
interface LinkedAct { id: string; fullNumber: string; title: string; importance: string | null }
interface Props { numero: string; linked: LinkedAct[]; onChanged: () => void }
export function LinkedActsEditor({ linked }: Props) {
  return <p className="text-sm text-gray-500">LinkedActsEditor stub ({linked.length} itens)</p>;
}
```

- [ ] **Step 3:** Type-check + smoke test.

Run: `npx tsc --noEmit 2>&1 | grep comentada | head -5`
Expected: sem output

Smoke test: abrir `/admin/lei-14133/comentada?artigo=18` — deve renderizar todas as seções com stubs e o card de comentário do prof (botão Editar abre modal stub).

- [ ] **Step 4:** Commit.

```bash
git add app/admin/lei-14133/comentada
git commit -m "feat(admin): ArticleEditorMain orquestrador + stubs dos sub-editores

Carrega artigo enriquecido via GET, renderiza 5 seções (texto da lei,
comentário, leitura combinada, sugestões, docs e atos vinculados).
Sub-editores são stubs neste commit, preenchidos nas próximas tasks."
```

---

### Task 13: CommentEditor — modal markdown com preview

**Files:**
- Modify: `app/admin/lei-14133/comentada/CommentEditor.tsx` (substitui stub)

- [ ] **Step 1:** Conferir se `MarkdownContent` existe no projeto.

Run: `cd "C:\Projeto de site do Barral\sitedobarral-stripe" && grep -l "MarkdownContent" components/MarkdownContent.tsx 2>/dev/null && echo OK`
Expected: `OK`

- [ ] **Step 2:** Substituir o stub por:

```typescript
'use client';

import { useState } from 'react';
import { X, Save, Eye, Edit3 } from 'lucide-react';
import MarkdownContent from '@/components/MarkdownContent';

interface Props {
  initial: string;
  onSave: (markdown: string) => Promise<void>;
  onCancel: () => void;
}

export function CommentEditor({ initial, onSave, onCancel }: Props) {
  const [markdown, setMarkdown] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'edit' | 'preview' | 'split'>('split');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(markdown);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col">
        <header className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-lg text-gray-900">Comentário do Prof. (Markdown)</h3>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1 text-sm">
              <button
                onClick={() => setTab('edit')}
                className={`px-3 py-1 rounded ${tab === 'edit' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                <Edit3 className="w-4 h-4 inline mr-1" /> Editar
              </button>
              <button
                onClick={() => setTab('split')}
                className={`px-3 py-1 rounded ${tab === 'split' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                Lado-a-lado
              </button>
              <button
                onClick={() => setTab('preview')}
                className={`px-3 py-1 rounded ${tab === 'preview' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                <Eye className="w-4 h-4 inline mr-1" /> Preview
              </button>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
          {(tab === 'edit' || tab === 'split') && (
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="# Sobre este artigo&#10;&#10;Use markdown — headings, listas, **negrito**, _itálico_, links..."
              className={`p-6 font-mono text-sm focus:outline-none resize-none ${
                tab === 'edit' ? 'col-span-2' : ''
              } border-r border-gray-200`}
              autoFocus
            />
          )}
          {(tab === 'preview' || tab === 'split') && (
            <div className={`overflow-y-auto p-6 prose prose-sm max-w-none ${tab === 'preview' ? 'col-span-2' : ''}`}>
              {markdown.trim() ? (
                <MarkdownContent content={markdown} />
              ) : (
                <p className="text-gray-400 italic">Preview aparecerá aqui</p>
              )}
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-gray-500">{markdown.length} / 50.000 caracteres</p>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || markdown.length > 50_000}
              className="flex items-center gap-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3:** Type-check + smoke.

Run: `npx tsc --noEmit 2>&1 | grep CommentEditor | head -5`
Expected: sem output

Smoke test: na rota admin, clicar Editar no comentário, escrever `# Olá\n\nTexto **bold**`, alternar tabs, salvar. Resposta OK + comment renderizado na seção.

- [ ] **Step 4:** Commit.

```bash
git add app/admin/lei-14133/comentada/CommentEditor.tsx
git commit -m "feat(admin): CommentEditor — modal markdown com preview lado-a-lado"
```

---

### Task 14: CrossRefsEditor — inline list + DnD

**Files:**
- Modify: `app/admin/lei-14133/comentada/CrossRefsEditor.tsx` (substitui stub)

- [ ] **Step 1:** Substituir o stub por:

```typescript
'use client';

import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CrossRef {
  id: string;
  targetNumber: string;
  note: string;
  order: number;
}

interface Props {
  numero: string;
  initial: CrossRef[];
  onChanged: () => void;
}

export function CrossRefsEditor({ numero, initial, onChanged }: Props) {
  const { errorToast, successToast } = useToast();
  const [items, setItems] = useState<CrossRef[]>(initial);
  const [adding, setAdding] = useState(false);
  const [draftTarget, setDraftTarget] = useState('');
  const [draftNote, setDraftNote] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleAdd = async () => {
    if (!draftTarget.trim() || !draftNote.trim()) {
      errorToast('Preencha artigo destino e nota');
      return;
    }
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/crossrefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetNumber: draftTarget.trim(), note: draftNote.trim() }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      errorToast('Erro', e.error || 'Falha');
      return;
    }
    const data = await r.json();
    setItems((prev) => [...prev, data.crossRef]);
    setAdding(false);
    setDraftTarget('');
    setDraftNote('');
    successToast('Vínculo adicionado');
    onChanged();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este vínculo?')) return;
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/crossrefs/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      errorToast('Erro ao remover');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    onChanged();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/crossrefs/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map((i) => i.id) }),
    });
    if (!r.ok) {
      errorToast('Erro ao reordenar — revertendo');
      setItems(items);
    } else {
      onChanged();
    }
  };

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {items.map((item) => (
              <SortableCrossRef
                key={item.id}
                item={item}
                onDelete={() => handleDelete(item.id)}
                onSaveEdit={async (target, note) => {
                  const r = await fetch(`/api/admin/lei-14133/articles/${numero}/crossrefs/${item.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetNumber: target, note }),
                  });
                  if (!r.ok) {
                    errorToast('Erro ao salvar');
                    return false;
                  }
                  const data = await r.json();
                  setItems((prev) => prev.map((p) => (p.id === item.id ? data.crossRef : p)));
                  successToast('Vínculo atualizado');
                  onChanged();
                  return true;
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {adding ? (
        <div className="border border-dashed border-purple-300 rounded-lg p-3 bg-purple-50/30">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr_auto] gap-2 items-start">
            <input
              type="text"
              value={draftTarget}
              onChange={(e) => setDraftTarget(e.target.value)}
              placeholder="Art. nº (ex: 44)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="text"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="Nota explicando a conexão (até 500 chars)"
              maxLength={500}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <div className="flex gap-1">
              <button
                onClick={handleAdd}
                className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setDraftTarget('');
                  setDraftNote('');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-sm text-purple-700 hover:text-purple-900"
        >
          <Plus className="w-4 h-4" /> Adicionar vínculo
        </button>
      )}

      {items.length === 0 && !adding && (
        <p className="text-sm text-gray-500 italic">Nenhuma vinculação ainda.</p>
      )}
    </div>
  );
}

function SortableCrossRef({
  item,
  onDelete,
  onSaveEdit,
}: {
  item: CrossRef;
  onDelete: () => void;
  onSaveEdit: (target: string, note: string) => Promise<boolean>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(item.targetNumber);
  const [note, setNote] = useState(item.note);

  return (
    <li ref={setNodeRef} style={style} className="border border-gray-200 rounded-lg p-3 bg-white">
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="cursor-grab text-gray-400 mt-1" aria-label="Arrastar">
          <GripVertical className="w-4 h-4" />
        </button>
        {editing ? (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_3fr_auto] gap-2">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            />
            <div className="flex gap-1">
              <button
                onClick={async () => {
                  const ok = await onSaveEdit(target, note);
                  if (ok) setEditing(false);
                }}
                className="px-3 py-1 bg-purple-600 text-white rounded text-sm"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setTarget(item.targetNumber);
                  setNote(item.note);
                }}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">Art. {item.targetNumber}</span>
              <p className="text-sm text-gray-800 flex-1">{item.note}</p>
            </div>
          </div>
        )}
        {!editing && (
          <div className="flex gap-1">
            <button onClick={() => setEditing(true)} className="text-gray-500 hover:text-gray-800 text-xs">
              Editar
            </button>
            <button onClick={onDelete} className="text-red-500 hover:text-red-700 ml-2" aria-label="Remover">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
```

- [ ] **Step 2:** Smoke test: adicionar vínculo Art. 44 com nota, editar, arrastar pra reordenar (com ≥2 itens), remover. Confirmar persistência via refresh.

- [ ] **Step 3:** Commit.

```bash
git add app/admin/lei-14133/comentada/CrossRefsEditor.tsx
git commit -m "feat(admin): CrossRefsEditor — list inline + drag-and-drop"
```

---

### Task 15: ReadingsEditor + SearchBaseModal

**Files:**
- Create: `app/admin/lei-14133/comentada/SearchBaseModal.tsx`
- Modify: `app/admin/lei-14133/comentada/ReadingsEditor.tsx` (substitui stub)

- [ ] **Step 1:** Criar `app/admin/lei-14133/comentada/SearchBaseModal.tsx`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  slug?: string;
  snippet?: string;
}

type SearchKind =
  | { source: 'internal'; type: 'blog' | 'glossary' | 'legislative-act' | 'document' }
  | { source: 'admin-document' }
  | { source: 'admin-act' };

interface Props {
  kind: SearchKind;
  onSelect: (result: SearchResult) => void;
  onClose: () => void;
  title?: string;
}

export function SearchBaseModal({ kind, onSelect, onClose, title }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        let url = '';
        if (kind.source === 'internal') {
          url = `/api/admin/internal-search?type=${encodeURIComponent(kind.type)}&q=${encodeURIComponent(q)}`;
        } else if (kind.source === 'admin-document') {
          url = `/api/admin/internal-search?type=document&q=${encodeURIComponent(q)}`;
        } else {
          url = `/api/admin/internal-search?type=legislative-act&q=${encodeURIComponent(q)}`;
        }
        const r = await fetch(url);
        if (!r.ok) throw new Error('Falha');
        const data = await r.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const heading = title || (() => {
    if (kind.source === 'admin-document') return 'Vincular documento';
    if (kind.source === 'admin-act') return 'Vincular ato normativo';
    const labels = { blog: 'Buscar post do blog', glossary: 'Buscar termo do glossário', 'legislative-act': 'Buscar ato normativo', document: 'Buscar documento' } as const;
    return labels[kind.type];
  })();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-20">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col">
        <header className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-lg">{heading}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-6 py-3 border-b flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite pra buscar…"
              autoFocus
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">{query ? 'Nenhum resultado' : 'Comece a digitar pra buscar'}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => onSelect(r)}
                    className="w-full text-left px-6 py-3 hover:bg-blue-50"
                  >
                    <p className="font-medium text-sm text-gray-900">{r.title}</p>
                    {r.snippet && <p className="text-xs text-gray-600 line-clamp-2 mt-1">{r.snippet}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Substituir `ReadingsEditor.tsx` por (com 2-pass: tipo de referência → busca / external form):

```typescript
'use client';

import { useState } from 'react';
import { Plus, Trash2, X, Save, ExternalLink, FileText, BookOpen, Scale } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SearchBaseModal } from './SearchBaseModal';

interface Reading {
  id: string;
  kind: 'internal' | 'external';
  internalType?: string | null;
  internalId?: string | null;
  externalUrl?: string | null;
  externalType?: string | null;
  title?: string | null;
  description?: string | null;
  author?: string | null;
  order: number;
}

interface Props {
  numero: string;
  initial: Reading[];
  onChanged: () => void;
}

const INTERNAL_LABELS: Record<string, string> = {
  blog: 'Post do blog',
  glossary: 'Glossário',
  'legislative-act': 'Ato normativo',
  document: 'Documento',
};

const EXTERNAL_LABELS: Record<string, string> = {
  video: 'Vídeo',
  article: 'Artigo doutrinário',
  book: 'Livro',
  other: 'Outro',
};

export function ReadingsEditor({ numero, initial, onChanged }: Props) {
  const { errorToast, successToast } = useToast();
  const [items, setItems] = useState<Reading[]>(initial);

  // Estado do form de adição
  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState<'choose' | 'internal-pick-type' | 'internal-search' | 'external-form'>('choose');
  const [internalType, setInternalType] = useState<'blog' | 'glossary' | 'legislative-act' | 'document'>('blog');
  const [externalForm, setExternalForm] = useState({
    url: '',
    type: 'video' as 'video' | 'article' | 'book' | 'other',
    title: '',
    author: '',
    description: '',
  });
  const [showSearch, setShowSearch] = useState(false);

  const resetAdd = () => {
    setAdding(false);
    setStep('choose');
    setInternalType('blog');
    setExternalForm({ url: '', type: 'video', title: '', author: '', description: '' });
    setShowSearch(false);
  };

  const createReading = async (payload: Partial<Reading>) => {
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      errorToast('Erro', e.error || 'Falha');
      return;
    }
    const data = await r.json();
    setItems((prev) => [...prev, data.reading]);
    resetAdd();
    successToast('Sugestão adicionada');
    onChanged();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta sugestão?')) return;
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/readings/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      errorToast('Erro');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    onChanged();
  };

  const handleInternalPicked = async (result: { id: string; title: string }) => {
    await createReading({
      kind: 'internal',
      internalType,
      internalId: result.id,
      title: result.title,
    });
  };

  const handleExternalSave = async () => {
    if (!externalForm.url || !externalForm.title) {
      errorToast('URL e título são obrigatórios');
      return;
    }
    await createReading({
      kind: 'external',
      externalUrl: externalForm.url,
      externalType: externalForm.type,
      title: externalForm.title,
      author: externalForm.author || undefined,
      description: externalForm.description || undefined,
    });
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="border border-gray-200 rounded-lg p-3 bg-white flex items-start gap-3">
            <ItemIcon item={item} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] font-medium rounded">
                  {item.kind === 'internal'
                    ? INTERNAL_LABELS[item.internalType || ''] || 'Interno'
                    : EXTERNAL_LABELS[item.externalType || ''] || 'Externo'}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900 truncate">{item.title || (item.kind === 'external' ? item.externalUrl : 'Sem título')}</p>
              {item.author && <p className="text-xs text-gray-600">por {item.author}</p>}
              {item.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.description}</p>}
            </div>
            <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700">
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="border border-dashed border-emerald-300 rounded-lg p-3 bg-emerald-50/30 space-y-3">
          {step === 'choose' && (
            <div>
              <p className="text-sm font-medium mb-2">Tipo de referência:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('internal-pick-type')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  📚 Conteúdo do site
                </button>
                <button
                  onClick={() => setStep('external-form')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                >
                  🔗 Link externo
                </button>
                <button onClick={resetAdd} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {step === 'internal-pick-type' && (
            <div>
              <p className="text-sm font-medium mb-2">Tipo de conteúdo:</p>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(INTERNAL_LABELS) as Array<keyof typeof INTERNAL_LABELS>).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setInternalType(t as typeof internalType);
                      setShowSearch(true);
                      setStep('internal-search');
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-blue-50"
                  >
                    {INTERNAL_LABELS[t]}
                  </button>
                ))}
                <button onClick={resetAdd} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {step === 'external-form' && (
            <div className="space-y-2">
              <input
                type="url"
                placeholder="https://… (URL do conteúdo externo)"
                value={externalForm.url}
                onChange={(e) => setExternalForm({ ...externalForm, url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Título"
                  value={externalForm.title}
                  onChange={(e) => setExternalForm({ ...externalForm, title: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <select
                  value={externalForm.type}
                  onChange={(e) => setExternalForm({ ...externalForm, type: e.target.value as typeof externalForm.type })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  {Object.entries(EXTERNAL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                placeholder="Autor (opcional)"
                value={externalForm.author}
                onChange={(e) => setExternalForm({ ...externalForm, author: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <textarea
                placeholder="Nota curta (opcional)"
                rows={2}
                value={externalForm.description}
                onChange={(e) => setExternalForm({ ...externalForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleExternalSave}
                  className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                >
                  <Save className="w-4 h-4" /> Adicionar
                </button>
                <button onClick={resetAdd} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900">
          <Plus className="w-4 h-4" /> Adicionar sugestão
        </button>
      )}

      {items.length === 0 && !adding && (
        <p className="text-sm text-gray-500 italic">Nenhuma sugestão ainda.</p>
      )}

      {showSearch && (
        <SearchBaseModal
          kind={{ source: 'internal', type: internalType }}
          onSelect={handleInternalPicked}
          onClose={() => {
            setShowSearch(false);
            resetAdd();
          }}
        />
      )}
    </div>
  );
}

function ItemIcon({ item }: { item: Reading }) {
  if (item.kind === 'internal') {
    if (item.internalType === 'blog') return <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />;
    if (item.internalType === 'glossary') return <BookOpen className="w-5 h-5 text-amber-600 flex-shrink-0" />;
    if (item.internalType === 'legislative-act') return <Scale className="w-5 h-5 text-violet-600 flex-shrink-0" />;
    return <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />;
  }
  return <ExternalLink className="w-5 h-5 text-purple-600 flex-shrink-0" />;
}
```

- [ ] **Step 3:** Smoke test: adicionar reading interno (blog), adicionar reading externo (vídeo YouTube), remover. Refresh, confirmar persistência.

- [ ] **Step 4:** Commit.

```bash
git add app/admin/lei-14133/comentada/SearchBaseModal.tsx app/admin/lei-14133/comentada/ReadingsEditor.tsx
git commit -m "feat(admin): ReadingsEditor com fluxo internal/external + SearchBaseModal

Modal de busca unificado por tipo (blog/glossário/ato/documento) usando
endpoint /admin/internal-search. Form externo coleta URL+título+tipo+autor."
```

---

### Task 16: LinkedDocsEditor + LinkedActsEditor

**Files:**
- Modify: `app/admin/lei-14133/comentada/LinkedDocsEditor.tsx` (substitui stub)
- Modify: `app/admin/lei-14133/comentada/LinkedActsEditor.tsx` (substitui stub)

- [ ] **Step 1:** Substituir `LinkedDocsEditor.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SearchBaseModal } from './SearchBaseModal';

interface LinkedDoc {
  id: string;
  title: string;
  category: string | null;
  isPublic: boolean;
  notesImportance: string | null;
}

interface Props {
  numero: string;
  linked: LinkedDoc[];
  onChanged: () => void;
}

export function LinkedDocsEditor({ numero, linked, onChanged }: Props) {
  const { errorToast, successToast } = useToast();
  const [showSearch, setShowSearch] = useState(false);

  const handleLink = async (result: { id: string; title: string }) => {
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/link-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: result.id }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      errorToast('Erro', e.error || 'Falha');
      return;
    }
    setShowSearch(false);
    successToast('Documento vinculado');
    onChanged();
  };

  const handleUnlink = async (id: string) => {
    if (!confirm('Desvincular este documento do artigo?')) return;
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/link-document/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      errorToast('Erro');
      return;
    }
    onChanged();
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {linked.map((doc) => (
          <li key={doc.id} className="border border-gray-200 rounded-lg p-3 bg-white flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {doc.category && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-medium rounded">{doc.category}</span>
                )}
                {doc.isPublic && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">Público</span>
                )}
                {doc.notesImportance && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-medium rounded">{doc.notesImportance}</span>
                )}
              </div>
            </div>
            <button onClick={() => handleUnlink(doc.id)} className="text-red-500 hover:text-red-700">
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>

      <button onClick={() => setShowSearch(true)} className="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900">
        <Plus className="w-4 h-4" /> Vincular documento da base
      </button>

      {linked.length === 0 && (
        <p className="text-sm text-gray-500 italic">Nenhum documento vinculado.</p>
      )}

      {showSearch && (
        <SearchBaseModal kind={{ source: 'admin-document' }} onSelect={handleLink} onClose={() => setShowSearch(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2:** Substituir `LinkedActsEditor.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Plus, Trash2, Scale } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SearchBaseModal } from './SearchBaseModal';

interface LinkedAct {
  id: string;
  fullNumber: string;
  title: string;
  ementa: string;
  type: string;
  hierarchyLevel: number;
  esfera: string;
  importance: string | null;
}

interface Props {
  numero: string;
  linked: LinkedAct[];
  onChanged: () => void;
}

const IMPORTANCE_LABELS: Record<string, string> = {
  '': 'Sem marcação',
  baixa: 'Baixa',
  media: 'Média',
  alta: '⭐ Alta',
  critica: '🔴 Crítica',
};

export function LinkedActsEditor({ numero, linked, onChanged }: Props) {
  const { errorToast, successToast } = useToast();
  const [showSearch, setShowSearch] = useState(false);

  const handleLink = async (result: { id: string }) => {
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/link-act`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actId: result.id }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      errorToast('Erro', e.error || 'Falha');
      return;
    }
    setShowSearch(false);
    successToast('Ato vinculado');
    onChanged();
  };

  const handleUnlink = async (id: string) => {
    if (!confirm('Desvincular este ato do artigo?')) return;
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/link-act/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      errorToast('Erro');
      return;
    }
    onChanged();
  };

  const handleImportanceChange = async (actId: string, importance: string) => {
    const r = await fetch(`/api/admin/legislative-acts/${actId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importance: importance || null }),
    });
    if (!r.ok) {
      errorToast('Erro ao atualizar destaque');
      return;
    }
    successToast('Destaque atualizado');
    onChanged();
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {linked.map((act) => (
          <li key={act.id} className="border border-gray-200 rounded-lg p-3 bg-white">
            <div className="flex items-start gap-3">
              <Scale className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  <span className="font-bold">{act.fullNumber}</span> — {act.title}
                </p>
                <p className="text-xs text-gray-600 line-clamp-2 mt-1">{act.ementa}</p>
                <div className="flex items-center gap-2 mt-2">
                  <label className="text-xs text-gray-600">Destaque:</label>
                  <select
                    value={act.importance || ''}
                    onChange={(e) => handleImportanceChange(act.id, e.target.value)}
                    className="text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                  >
                    {Object.entries(IMPORTANCE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={() => handleUnlink(act.id)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button onClick={() => setShowSearch(true)} className="flex items-center gap-1 text-sm text-violet-700 hover:text-violet-900">
        <Plus className="w-4 h-4" /> Vincular ato normativo
      </button>

      {linked.length === 0 && (
        <p className="text-sm text-gray-500 italic">Nenhum ato vinculado.</p>
      )}

      {showSearch && (
        <SearchBaseModal kind={{ source: 'admin-act' }} onSelect={handleLink} onClose={() => setShowSearch(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3:** Smoke test: vincular ato (IN 67/2021), mudar destaque pra "Alta", desvincular. Confirmar via refresh.

- [ ] **Step 4:** Commit.

```bash
git add app/admin/lei-14133/comentada/LinkedDocsEditor.tsx app/admin/lei-14133/comentada/LinkedActsEditor.tsx
git commit -m "feat(admin): LinkedDocsEditor + LinkedActsEditor

LinkedActsEditor inclui dropdown inline pra LegislativeAct.importance
(reusa o endpoint PUT existente em /api/admin/legislative-acts/[id])."
```

---

### Task 17: Apresentação pública — 3 cards novos

**Files:**
- Modify: `app/lei-14133/LeiComentadaClient.tsx`
- Modify: `app/area-restrita/lei-comentada/page.tsx`

- [ ] **Step 1:** Em `LeiComentadaClient.tsx`, adicionar import:

```typescript
import MarkdownContent from '@/components/MarkdownContent';
```

E estender o tipo `LeiArticle` (procurar `interface LeiArticle`) com:

```typescript
  professorComment?: string | null;
  commentUpdatedAt?: string | null;
  crossRefs?: Array<{ id: string; targetNumber: string; note: string; order: number }>;
  suggestedReadings?: Array<{
    id: string;
    kind: 'internal' | 'external';
    internalType?: string | null;
    internalId?: string | null;
    externalUrl?: string | null;
    externalType?: string | null;
    title?: string | null;
    description?: string | null;
    author?: string | null;
    order: number;
  }>;
```

- [ ] **Step 2:** Localizar a seção de Cross-references (procurar `relatedTopics.length > 0`) e logo APÓS o card do artigo (antes desse bloco), inserir as 3 seções novas:

```typescript
                {/* Comentário do prof */}
                {selectedArticle.professorComment && (
                  <div className="bg-amber-50/40 border-2 border-amber-200 rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-amber-500">✦</span> Comentário do Prof. Daniel Barral
                    </h3>
                    <div className="prose prose-sm max-w-none">
                      <MarkdownContent content={selectedArticle.professorComment} />
                    </div>
                  </div>
                )}

                {/* Leitura combinada de artigos */}
                {selectedArticle.crossRefs && selectedArticle.crossRefs.length > 0 && (
                  <div className="bg-indigo-50/30 border-2 border-indigo-200 rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      📚 Leitura combinada
                    </h3>
                    <p className="text-xs text-indigo-700 mb-3 italic">Vínculos curados entre artigos da Lei 14.133.</p>
                    <ul className="space-y-2">
                      {selectedArticle.crossRefs.map((ref) => {
                        const target = apiData.articles.find((a) => a.numero === ref.targetNumber);
                        return (
                          <li key={ref.id} className="flex items-start gap-3">
                            <button
                              onClick={() => target && handleSelectArticle(target)}
                              className="flex-shrink-0 px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700"
                            >
                              Art. {ref.targetNumber}
                            </button>
                            <p className="text-sm text-gray-800">{ref.note}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Sugestões de leitura */}
                {selectedArticle.suggestedReadings && selectedArticle.suggestedReadings.length > 0 && (
                  <div className="bg-emerald-50/30 border-2 border-emerald-200 rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      🔗 Sugestões de leitura
                    </h3>
                    <ul className="space-y-2">
                      {selectedArticle.suggestedReadings.map((r) => {
                        let href = '#';
                        if (r.kind === 'internal') {
                          if (r.internalType === 'blog') href = `/blog/${r.internalId}`;
                          else if (r.internalType === 'glossary') href = `/glossario/${r.internalId}`;
                          else if (r.internalType === 'legislative-act') href = `/atos-normativos/${r.internalId}`;
                          else if (r.internalType === 'document') href = `/documento/${r.internalId}`;
                        } else if (r.kind === 'external' && r.externalUrl) {
                          href = r.externalUrl;
                        }
                        const isExternal = r.kind === 'external';
                        return (
                          <li key={r.id}>
                            <a
                              href={href}
                              target={isExternal ? '_blank' : undefined}
                              rel={isExternal ? 'noopener noreferrer' : undefined}
                              className="block bg-white border border-emerald-200 rounded-lg p-3 hover:border-emerald-400 hover:shadow-sm transition-all"
                            >
                              <p className="text-sm font-medium text-gray-900">{r.title || r.externalUrl}</p>
                              {r.author && <p className="text-xs text-gray-600 mt-0.5">por {r.author}</p>}
                              {r.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{r.description}</p>}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
```

- [ ] **Step 3:** Aplicar as MESMAS três seções (idênticas em estrutura) em `app/area-restrita/lei-comentada/page.tsx`. A localização: logo APÓS o card do artigo, ANTES da seção "Documentos: Destaques + lista por categoria". O tipo `LeiArticle` daquela página já vai herdar `professorComment` etc. via API — adicionar no `interface LeiArticle` os mesmos campos da Step 1.

- [ ] **Step 4:** Adicionar import de `MarkdownContent` em `app/area-restrita/lei-comentada/page.tsx`.

- [ ] **Step 5:** Type-check + lint.

Run: `npx tsc --noEmit 2>&1 | grep -E "LeiComentadaClient|lei-comentada/page" | head -5`
Run: `npx eslint app/lei-14133/LeiComentadaClient.tsx app/area-restrita/lei-comentada/page.tsx 2>&1 | tail -5`
Expected: sem erros (warnings de exhaustive-deps preexistentes ok)

- [ ] **Step 6:** Smoke test: criar comment + crossref + reading num artigo via admin; abrir `/lei-14133?artigo=N` e `/area-restrita/lei-comentada?artigo=N` e ver os 3 cards.

- [ ] **Step 7:** Commit.

```bash
git add app/lei-14133/LeiComentadaClient.tsx app/area-restrita/lei-comentada/page.tsx
git commit -m "feat(lei-14133): apresenta comentário, leitura combinada e sugestões na pública/logada

Três cards novos abaixo do card do artigo (só aparecem se preenchidos):
- Comentário do Prof. — markdown renderizado
- Leitura combinada — lista de Art. N + nota explicativa, linkada
  pra navegação interna na lei
- Sugestões de leitura — internas (blog/glossário/ato/documento)
  e externas (vídeo/artigo/livro/outro) com link direto"
```

---

### Task 18: Atualizar memória do projeto + push

**Files:**
- Update: `C:\Users\Administrador\.claude\projects\C--Users-Administrador\memory\MEMORY.md`
- Create: novo arquivo de memória do feature

- [ ] **Step 1:** Criar memory file `C:\Users\Administrador\.claude\projects\C--Users-Administrador\memory\project_site_barral_lei14133_admin_editorial.md`:

```markdown
---
name: Site do Barral - Admin editorial Lei 14.133
description: Página /admin/lei-14133/comentada permite curadoria editorial completa da Lei 14.133 (comentário, leitura combinada, sugestões, vincular docs/atos, marcar destaque). Lançada em 2026-05-XX.
type: project
---

Frente concluída: admin editorial da Lei 14.133 Comentada.

**Schema novo:**
- `LeiArticle.professorComment` (markdown) + `commentUpdatedAt`
- `LeiArticleCrossRef`: vinculações entre artigos (targetNumber + nota editorial)
- `LeiArticleSuggestedReading`: sugestões de leitura — internas (blog/glossary/legislative-act/document por ID) ou externas (URL + tipo)
- `LegislativeAct.importance` já existia (curadoria de destaques)

**Apresentação pública** (/lei-14133 e /area-restrita/lei-comentada): 3 cards novos abaixo do card do artigo — Comentário do Prof., Leitura combinada, Sugestões de leitura.

**Endpoints:** `/api/admin/lei-14133/articles/[numero]/...` (GET enriquecido + comment + crossrefs CRUD + readings CRUD + reorder + link-document + link-act). Endpoint unificado `/api/admin/internal-search?type=...&q=...`.

**UI admin:** sidebar Estrutura da Lei (extraída como `<LeiSidebar>` compartilhada). Main column orquestra 5 sub-editores. Edição híbrida: modal full-width pro markdown, inline pro resto. Drag-and-drop com @dnd-kit pra crossrefs/readings.

**Spec:** docs/superpowers/specs/2026-05-02-admin-lei-14133-comentada-design.md
**Plano:** docs/superpowers/plans/2026-05-02-admin-lei-14133-comentada.md

**Como usar:** `/admin/lei-14133/comentada`, escolher artigo na sidebar, editar cada seção. Mudanças refletem na pública após próximo refresh (cache invalidado automaticamente).
```

- [ ] **Step 2:** Adicionar entry no `MEMORY.md`:

```markdown
- [Admin editorial Lei 14.133 (2026-05-XX)](project_site_barral_lei14133_admin_editorial.md) — /admin/lei-14133/comentada com comentário, leitura combinada, sugestões, vincular/desvincular docs/atos, marcar destaque
```

- [ ] **Step 3:** Push de todos os commits da implementação.

Run: `git push origin main`

- [ ] **Step 4:** Smoke test final em produção (após deploy):
  1. Login admin → `/admin/lei-14133/comentada`
  2. Selecionar Art. 18, criar comentário "# ETP é fundamental\n\nVer também o art. 44."
  3. Adicionar crossref Art. 44 com nota "Quando o ETP é dispensado"
  4. Adicionar reading externo: vídeo do YouTube (URL + tipo=video + título)
  5. Vincular IN 67/2021 ao art. 18, marcar como Alta
  6. Abrir `/lei-14133?artigo=18` em janela anônima
  7. Confirmar: comentário com markdown renderizado, card de leitura combinada com Art. 44, card de sugestões com vídeo, IN 67 nos destaques de regulamentação

---

## Self-Review

**Spec coverage:**
- Goal (controle editorial completo) ✓ Tasks 1-17
- Schema changes ✓ Task 1
- 5 áreas editáveis (comment, crossrefs, readings, link-doc, link-act) ✓ Tasks 4-7
- Internal-search ✓ Task 8
- API pública estendida ✓ Task 9
- Refator LeiSidebar ✓ Task 10
- UI admin completa ✓ Tasks 11-16
- Apresentação pública (3 cards) ✓ Task 17
- Memória + push ✓ Task 18

**Placeholder scan:** sem TBD/TODO. Todos os steps têm comandos exatos ou código completo.

**Type consistency:** `EnrichedDoc` não é usado (só no spec) — aqui o tipo é `LinkedDoc/LinkedAct` na UI. Endpoints usam `safeParseArray` consistente. Nomes de funções (`fetchAll`, `handleLink`) consistentes nos chamados. CrossRef e Reading types repetidos entre stub→implementação batem.

**Riscos não cobertos no plano:**
- Task 1 step 6 `prisma db push --accept-data-loss` em ambiente sem env DB: o engenheiro precisa ter `.env.local` com DATABASE_URL apontando pro Neon dev. Se não tiver, pular Step 6 (vercel-build aplica em produção).
- Task 8 step 2: `prisma.glossaryTerm` — confirmar nome real do model no schema. Se for `prisma.glossary`, ajustar.
