# Coming-soon de Pré-lançamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloquear rotas vitrine do site com uma página coming-soon enquanto o marketing aguarda o anúncio oficial, mantendo blog (`/blog/*`), operações (auth, /area-restrita, /admin, API, certificado, pagamento) e fluxos de alunos pagantes intactos. Bypass automático para qualquer usuário logado; bypass manual via `/preview?key=XXX` para o time de marketing.

**Architecture:** Lógica nova prepended ao `middleware.ts` existente, controlada por flag `COMING_SOON_ENABLED`. Funções puras (`isAllowlistedRoute`, `hasValidPreviewCookie`) extraídas para `lib/middleware/coming-soon.ts` com testes Vitest. Edge runtime preservado via Web Crypto API. Rewrite (não redirect) preserva URL para SEO. Cookie bypass = `sha256(key)` — trocar env var invalida todos.

**Tech Stack:** Next.js 15.5 App Router · Edge Runtime · Vitest · Prisma (db push) · NextResponse.rewrite · `crypto.subtle.digest` · cookie httpOnly

**Spec:** [`docs/superpowers/specs/2026-05-14-coming-soon-prelaunch-design.md`](../specs/2026-05-14-coming-soon-prelaunch-design.md)

---

## File Structure

**Novos arquivos:**
- `lib/middleware/coming-soon.ts` — funções puras: `isAllowlistedRoute()`, `hasValidPreviewCookie()`, constantes da allowlist
- `lib/middleware/__tests__/coming-soon.test.ts` — testes Vitest das funções puras
- `app/coming-soon/page.tsx` — server component com teaser + `NewsletterForm` + link para `/blog`
- `app/preview/route.ts` — Route Handler GET, valida key, seta cookie 60d, redirect para `/`
- `scripts/smoke-test-coming-soon.mjs` — script Node simples para validar respostas das rotas-chave pós-deploy

**Arquivos modificados:**
- `middleware.ts` — prepend coming-soon gate, expand matcher
- `app/robots.ts` — adicionar `/preview` ao disallow (3 blocos)
- `prisma/schema.prisma` — campo `source` + `@@index([source])` em `NewsletterSubscriber`
- `components/NewsletterForm.tsx` — prop opcional `source?: string`, enviar no fetch
- `app/api/newsletter/route.ts` — aceitar `source` no body, gravar no `create()`
- `app/(acervo)/blog/[slug]/page.tsx` — CTA newsletter condicional ao flag no fim do post
- `.env.example` — documentar `COMING_SOON_ENABLED` e `PREVIEW_BYPASS_KEY`

**Princípios de decomposição:**
- Funções puras antes (TDD em isolation) → integradas no middleware depois
- Backend antes (schema → API → componente) → UI consumidora depois
- Cada task é um commit isolado, reversível independentemente

---

## Task 1: Documentar env vars em `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Localizar lugar adequado no `.env.example`**

Run: `cat .env.example | head -30`
Procurar uma seção temática apropriada (ex.: "Feature Flags" ou similar). Se não houver, adicionar uma nova seção ao final.

- [ ] **Step 2: Adicionar bloco de env vars do coming-soon**

Adicionar ao final do `.env.example`:

```bash

# === Coming-soon de pré-lançamento ===
# Quando "true", todas as rotas vitrine (homepage, /sobre, /lei-14133, /cursos, etc.)
# são reescritas para /coming-soon para visitantes anônimos. Rotas operacionais
# (login, área-restrita, admin, api, blog, certificado) ficam intactas. Usuários
# logados (qualquer role) fazem bypass automaticamente.
COMING_SOON_ENABLED="false"

# Chave secreta para bypass via /preview?key=XXX. Cookie httpOnly de 60 dias.
# Gerar com: openssl rand -hex 32
# Trocar essa env var invalida todos os cookies preview-bypass emitidos.
PREVIEW_BYPASS_KEY=""
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs(env): adiciona COMING_SOON_ENABLED e PREVIEW_BYPASS_KEY no .env.example"
```

---

## Task 2: Schema Prisma — campo `source` em `NewsletterSubscriber`

**Files:**
- Modify: `prisma/schema.prisma:543-554`

- [ ] **Step 1: Editar o modelo `NewsletterSubscriber`**

Localizar bloco (linhas 543-554 do schema). Adicionar campo `source` e índice:

```prisma
model NewsletterSubscriber {
  id             String    @id @default(uuid())
  email          String    @unique
  name           String?
  interests      String? // JSON array com temas de interesse
  isActive       Boolean   @default(true)
  subscribedAt   DateTime  @default(now())
  unsubscribedAt DateTime?
  source         String?   // 'coming-soon' | 'blog-footer' | 'footer' | etc.

  @@index([isActive])
  @@index([subscribedAt])
  @@index([source])
}
```

- [ ] **Step 2: Aplicar schema no banco com `prisma db push`**

Run: `npx prisma db push`
Expected output: linhas como `🚀  Your database is now in sync with your Prisma schema. Done in <X>ms` e regeneração do client.

Se aparecer warning sobre data loss → revisar antes de prosseguir (não deve acontecer, apenas adicionando coluna nullable).

- [ ] **Step 3: Regenerar cliente Prisma (caso `db push` não tenha feito)**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Verificar tipo TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: 0 erros relacionados a `NewsletterSubscriber.source` (deve existir agora no tipo gerado).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): adiciona campo source em NewsletterSubscriber para rastrear origem de leads"
```

---

## Task 3: API `/api/newsletter` — aceitar e gravar `source`

**Files:**
- Modify: `app/api/newsletter/route.ts:14,81-87`
- Test: ad-hoc via curl/Postman (rota já tem rate limiting; testes formais são opcionais e fora do escopo do plano)

- [ ] **Step 1: Adicionar `source` ao destructuring do body**

Em `app/api/newsletter/route.ts:14`, alterar:

```typescript
// ANTES
const { email, name, interests } = await request.json();

// DEPOIS
const { email, name, interests, source } = await request.json();
```

- [ ] **Step 2: Gravar `source` na criação do novo subscriber**

Em `app/api/newsletter/route.ts:81-87`, alterar o `create`:

```typescript
// ANTES
const subscriber = await prisma.newsletterSubscriber.create({
  data: {
    email,
    name: name || null,
    interests: interests ? JSON.stringify(interests) : null,
  },
});

// DEPOIS
const subscriber = await prisma.newsletterSubscriber.create({
  data: {
    email,
    name: name || null,
    interests: interests ? JSON.stringify(interests) : null,
    source: source || null,
  },
});
```

- [ ] **Step 3: Atualizar reativação para gravar `source` se vier no body novo**

Em `app/api/newsletter/route.ts:41-49` (bloco `update` para reativar inativo), alterar:

```typescript
// ANTES
await prisma.newsletterSubscriber.update({
  where: { email },
  data: {
    isActive: true,
    name: name || existing.name,
    interests: interests ? JSON.stringify(interests) : existing.interests,
    unsubscribedAt: null
  }
});

// DEPOIS
await prisma.newsletterSubscriber.update({
  where: { email },
  data: {
    isActive: true,
    name: name || existing.name,
    interests: interests ? JSON.stringify(interests) : existing.interests,
    source: source || existing.source, // preserva original se body novo não trouxer
    unsubscribedAt: null
  }
});
```

- [ ] **Step 4: Verificar build sem erros TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(error|newsletter)" | head -10`
Expected: 0 erros.

- [ ] **Step 5: Commit**

```bash
git add app/api/newsletter/route.ts
git commit -m "feat(api/newsletter): aceita e grava campo source opcional"
```

---

## Task 4: `NewsletterForm` — prop opcional `source`

**Files:**
- Modify: `components/NewsletterForm.tsx:6-16,46-54`

- [ ] **Step 1: Adicionar `source` à interface de props**

Em `components/NewsletterForm.tsx:6-10`:

```typescript
// ANTES
interface NewsletterFormProps {
  className?: string;
  showInterests?: boolean;
  variant?: 'default' | 'inline';
}

// DEPOIS
interface NewsletterFormProps {
  className?: string;
  showInterests?: boolean;
  variant?: 'default' | 'inline';
  source?: string;
}
```

- [ ] **Step 2: Destructurar `source` na assinatura do componente**

Em `components/NewsletterForm.tsx:12-16`:

```typescript
// ANTES
export default function NewsletterForm({
  className = '',
  showInterests = false,
  variant = 'default'
}: NewsletterFormProps) {

// DEPOIS
export default function NewsletterForm({
  className = '',
  showInterests = false,
  variant = 'default',
  source,
}: NewsletterFormProps) {
```

- [ ] **Step 3: Incluir `source` no body do POST**

Em `components/NewsletterForm.tsx:46-54`:

```typescript
// ANTES
const response = await fetch('/api/newsletter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    name: name || null,
    interests: interests.length > 0 ? interests : null,
  }),
});

// DEPOIS
const response = await fetch('/api/newsletter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    name: name || null,
    interests: interests.length > 0 ? interests : null,
    source: source || null,
  }),
});
```

- [ ] **Step 4: Verificar build**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(error|NewsletterForm)" | head -10`
Expected: 0 erros.

- [ ] **Step 5: Commit**

```bash
git add components/NewsletterForm.tsx
git commit -m "feat(NewsletterForm): adiciona prop opcional source e propaga no fetch"
```

---

## Task 5: Função pura `isAllowlistedRoute()` — TDD

**Files:**
- Create: `lib/middleware/coming-soon.ts`
- Create: `lib/middleware/__tests__/coming-soon.test.ts`

- [ ] **Step 1: Criar pasta `lib/middleware/` se não existir**

Run: `mkdir -p lib/middleware/__tests__` (PowerShell: `New-Item -ItemType Directory -Force lib/middleware/__tests__`)
Expected: pasta criada ou já existente.

- [ ] **Step 2: Escrever testes que falham (TDD)**

Criar `lib/middleware/__tests__/coming-soon.test.ts`:

```typescript
import { describe, test, expect } from 'vitest';
import { isAllowlistedRoute } from '../coming-soon';

describe('isAllowlistedRoute', () => {
  test('permite assets internos do Next', () => {
    expect(isAllowlistedRoute('/_next/static/foo.js')).toBe(true);
    expect(isAllowlistedRoute('/api/newsletter')).toBe(true);
    expect(isAllowlistedRoute('/favicon.ico')).toBe(true);
    expect(isAllowlistedRoute('/manifest.webmanifest')).toBe(true);
    expect(isAllowlistedRoute('/robots.txt')).toBe(true);
    expect(isAllowlistedRoute('/sitemap.xml')).toBe(true);
    expect(isAllowlistedRoute('/sitemap-artigos.xml')).toBe(true);
  });

  test('permite rotas de auth e validação', () => {
    expect(isAllowlistedRoute('/login')).toBe(true);
    expect(isAllowlistedRoute('/registro')).toBe(true);
    expect(isAllowlistedRoute('/esqueci-senha')).toBe(true);
    expect(isAllowlistedRoute('/redefinir-senha')).toBe(true);
    expect(isAllowlistedRoute('/verificar-email')).toBe(true);
    expect(isAllowlistedRoute('/validar-acesso')).toBe(true);
    expect(isAllowlistedRoute('/cancelar-newsletter')).toBe(true);
  });

  test('permite áreas autenticadas', () => {
    expect(isAllowlistedRoute('/area-restrita')).toBe(false); // raiz precisa de slash
    expect(isAllowlistedRoute('/area-restrita/meu-progresso')).toBe(true);
    expect(isAllowlistedRoute('/admin/dashboard')).toBe(true);
  });

  test('permite certificado público', () => {
    expect(isAllowlistedRoute('/certificado/abc-123')).toBe(true);
  });

  test('permite blog (vitrine permitida)', () => {
    expect(isAllowlistedRoute('/blog')).toBe(true);
    expect(isAllowlistedRoute('/blog/meu-slug-de-artigo')).toBe(true);
  });

  test('permite páginas legais', () => {
    expect(isAllowlistedRoute('/privacidade')).toBe(true);
    expect(isAllowlistedRoute('/termos')).toBe(true);
  });

  test('permite funil de pagamento Stripe', () => {
    expect(isAllowlistedRoute('/planos')).toBe(true);
    expect(isAllowlistedRoute('/upgrade')).toBe(true);
    expect(isAllowlistedRoute('/upgrade/curso-id')).toBe(true);
    expect(isAllowlistedRoute('/assinatura/sucesso')).toBe(true);
    expect(isAllowlistedRoute('/assinatura/cancelado')).toBe(true);
    expect(isAllowlistedRoute('/assinatura/pendente')).toBe(true);
  });

  test('permite a própria coming-soon e preview', () => {
    expect(isAllowlistedRoute('/coming-soon')).toBe(true);
    expect(isAllowlistedRoute('/preview')).toBe(true);
  });

  test('bloqueia homepage e rotas de vitrine', () => {
    expect(isAllowlistedRoute('/')).toBe(false);
    expect(isAllowlistedRoute('/sobre')).toBe(false);
    expect(isAllowlistedRoute('/lei-14133')).toBe(false);
    expect(isAllowlistedRoute('/lei-14133/art-1')).toBe(false);
    expect(isAllowlistedRoute('/cursos')).toBe(false);
    expect(isAllowlistedRoute('/cursos/nova-lei')).toBe(false);
    expect(isAllowlistedRoute('/contato')).toBe(false);
    expect(isAllowlistedRoute('/clipping')).toBe(false);
    expect(isAllowlistedRoute('/glossario')).toBe(false);
    expect(isAllowlistedRoute('/legislacao')).toBe(false);
    expect(isAllowlistedRoute('/legislacao/123')).toBe(false);
    expect(isAllowlistedRoute('/publicacoes')).toBe(false);
    expect(isAllowlistedRoute('/base-conhecimento')).toBe(false);
    expect(isAllowlistedRoute('/busca')).toBe(false);
    expect(isAllowlistedRoute('/novidades')).toBe(false);
    expect(isAllowlistedRoute('/jurisprudencia')).toBe(false);
  });

  test('bloqueia /artigo/[numero] (redirect Lei 14.133, é vitrine)', () => {
    expect(isAllowlistedRoute('/artigo/1')).toBe(false);
    expect(isAllowlistedRoute('/artigo/184-A')).toBe(false);
  });

  test('normaliza trailing slash', () => {
    expect(isAllowlistedRoute('/login/')).toBe(true);
    expect(isAllowlistedRoute('/blog/')).toBe(true);
    expect(isAllowlistedRoute('/sobre/')).toBe(false);
  });

  test('não confunde prefixos parecidos', () => {
    expect(isAllowlistedRoute('/blogx')).toBe(false);
    expect(isAllowlistedRoute('/admin-fake')).toBe(false);
    expect(isAllowlistedRoute('/loginhack')).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar testes pra confirmar que falham**

Run: `npx vitest run lib/middleware/__tests__/coming-soon.test.ts`
Expected: FAIL — `Cannot find module '../coming-soon'` ou similar (módulo não existe ainda).

- [ ] **Step 4: Implementar `isAllowlistedRoute()`**

Criar `lib/middleware/coming-soon.ts`:

```typescript
/**
 * Lógica do coming-soon de pré-lançamento.
 * Funções puras testadas em isolation; consumidas pelo middleware.ts.
 */

const ALLOWLIST_EXACT = new Set([
  // Auth e validação de acesso
  '/login', '/registro', '/esqueci-senha', '/redefinir-senha',
  '/verificar-email', '/validar-acesso', '/cancelar-newsletter',
  // Páginas legais
  '/privacidade', '/termos',
  // Pagamento/upgrade
  '/upgrade', '/planos',
  // Blog (vitrine permitida)
  '/blog',
  // Próprias do gate
  '/coming-soon', '/preview',
  // Assets/infra
  '/favicon.ico', '/manifest.webmanifest', '/robots.txt',
  '/sitemap.xml', '/sitemap-artigos.xml',
]);

const ALLOWLIST_PREFIXES = [
  '/_next/',
  '/api/',
  '/blog/',
  '/area-restrita/',
  '/admin/',
  '/certificado/',
  '/assinatura/',
  '/upgrade/',
  '/icons/',
  '/images/',
];

/**
 * Decide se uma rota está permitida durante o modo coming-soon.
 * Tudo o que não estiver explicitamente listado é considerado vitrine
 * e cai no coming-soon para visitantes anônimos.
 */
export function isAllowlistedRoute(pathname: string): boolean {
  // Normaliza trailing slash (exceto raiz)
  const normalized = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;

  if (ALLOWLIST_EXACT.has(normalized)) return true;
  return ALLOWLIST_PREFIXES.some(p => normalized.startsWith(p));
}
```

- [ ] **Step 5: Rodar testes pra confirmar que passam**

Run: `npx vitest run lib/middleware/__tests__/coming-soon.test.ts`
Expected: PASS em todos os testes (12 testes, ~50 asserções).

- [ ] **Step 6: Commit**

```bash
git add lib/middleware/coming-soon.ts lib/middleware/__tests__/coming-soon.test.ts
git commit -m "feat(middleware): adiciona isAllowlistedRoute com allowlist explícita e testes"
```

---

## Task 6: Função pura `hasValidPreviewCookie()` — TDD com Web Crypto

**Files:**
- Modify: `lib/middleware/coming-soon.ts`
- Modify: `lib/middleware/__tests__/coming-soon.test.ts`

- [ ] **Step 1: Adicionar testes da função `hasValidPreviewCookie`**

Adicionar ao final de `lib/middleware/__tests__/coming-soon.test.ts`:

```typescript
import { hasValidPreviewCookie, hashPreviewKey } from '../coming-soon';

describe('hashPreviewKey', () => {
  test('retorna hash SHA-256 hex de 64 chars', async () => {
    const hash = await hashPreviewKey('abc123');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('retorna hash consistente para mesma input', async () => {
    const a = await hashPreviewKey('chave-secreta');
    const b = await hashPreviewKey('chave-secreta');
    expect(a).toBe(b);
  });

  test('hashes diferentes para inputs diferentes', async () => {
    const a = await hashPreviewKey('chave-a');
    const b = await hashPreviewKey('chave-b');
    expect(a).not.toBe(b);
  });
});

describe('hasValidPreviewCookie', () => {
  const KEY = 'chave-de-teste-com-entropia-suficiente';
  let validCookie: string;

  beforeAll(async () => {
    validCookie = await hashPreviewKey(KEY);
  });

  test('retorna true quando cookie é hash da chave esperada', async () => {
    const result = await hasValidPreviewCookie(validCookie, KEY);
    expect(result).toBe(true);
  });

  test('retorna false quando cookie é string aleatória', async () => {
    const result = await hasValidPreviewCookie('cookie-invalido', KEY);
    expect(result).toBe(false);
  });

  test('retorna false quando cookie é undefined', async () => {
    const result = await hasValidPreviewCookie(undefined, KEY);
    expect(result).toBe(false);
  });

  test('retorna false quando key esperada é undefined', async () => {
    const result = await hasValidPreviewCookie(validCookie, undefined);
    expect(result).toBe(false);
  });

  test('retorna false quando cookie é a chave em plaintext (deve ser hash)', async () => {
    const result = await hasValidPreviewCookie(KEY, KEY);
    expect(result).toBe(false);
  });
});
```

Adicionar `beforeAll` ao import se ainda não estiver:

```typescript
import { describe, test, expect, beforeAll } from 'vitest';
```

- [ ] **Step 2: Rodar testes pra confirmar que falham**

Run: `npx vitest run lib/middleware/__tests__/coming-soon.test.ts`
Expected: FAIL — `hasValidPreviewCookie` e `hashPreviewKey` não exportados.

- [ ] **Step 3: Implementar `hashPreviewKey()` e `hasValidPreviewCookie()`**

Adicionar ao final de `lib/middleware/coming-soon.ts`:

```typescript
/**
 * Hash SHA-256 hex de uma string usando Web Crypto API.
 * Compatível com Edge Runtime do Next.js (não usa node:crypto).
 */
export async function hashPreviewKey(key: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compara o cookie de preview com o hash esperado da chave.
 * Cookie deve conter o hash hex da chave (não a chave em plaintext).
 * Comparação string direta — em Edge runtime não há benefício real de
 * constant-time além do já oferecido por strings imutáveis em V8.
 */
export async function hasValidPreviewCookie(
  cookieValue: string | undefined,
  expectedKey: string | undefined,
): Promise<boolean> {
  if (!cookieValue || !expectedKey) return false;
  const expected = await hashPreviewKey(expectedKey);
  return cookieValue === expected;
}
```

- [ ] **Step 4: Rodar testes pra confirmar que passam**

Run: `npx vitest run lib/middleware/__tests__/coming-soon.test.ts`
Expected: PASS em todos os testes (testes anteriores + novos, ~60 asserções totais).

- [ ] **Step 5: Commit**

```bash
git add lib/middleware/coming-soon.ts lib/middleware/__tests__/coming-soon.test.ts
git commit -m "feat(middleware): adiciona hashPreviewKey e hasValidPreviewCookie com Web Crypto"
```

---

## Task 7: Página `/coming-soon`

**Files:**
- Create: `app/coming-soon/page.tsx`

- [ ] **Step 1: Criar pasta e arquivo da rota**

Run: `mkdir -p app/coming-soon` (PowerShell: `New-Item -ItemType Directory -Force app/coming-soon`)
Expected: pasta criada.

- [ ] **Step 2: Escrever a página coming-soon**

Criar `app/coming-soon/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import NewsletterForm from '@/components/NewsletterForm';

export const metadata: Metadata = {
  title: 'Em breve | Prof. Daniel Barral',
  description: 'Novidades chegando em breve. Cadastre seu email para ser avisado.',
  // Decisão consciente: NÃO setar noindex. Coming-soon é servida com HTTP 200
  // na URL real (rewrite), Google continua indexando a URL como sempre.
  // Ver spec: docs/superpowers/specs/2026-05-14-coming-soon-prelaunch-design.md
};

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
          Em breve
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          {/* Microcopy placeholder — Daniel revisa antes do deploy */}
          Algo novo está chegando para quem trabalha com licitações e contratos.
          Cadastre seu email para ser avisado primeiro.
        </p>
        <div className="mb-8">
          <NewsletterForm variant="inline" source="coming-soon" />
        </div>
        <Link
          href="/blog"
          className="inline-block text-slate-700 underline hover:text-slate-900 transition-colors"
        >
          Enquanto isso, leia nossos artigos →
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verificar build sem erros TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(error|coming-soon)" | head -10`
Expected: 0 erros.

- [ ] **Step 4: Smoke test manual local (opcional)**

Run: `npm run dev` (em outro terminal) e abrir `http://localhost:3000/coming-soon`.
Expected: página renderiza com headline "Em breve", form de email, link para `/blog`.

- [ ] **Step 5: Commit**

```bash
git add app/coming-soon/page.tsx
git commit -m "feat(coming-soon): adiciona página /coming-soon com NewsletterForm e link para blog"
```

---

## Task 8: Route Handler `/preview` — bypass via URL secreta

**Files:**
- Create: `app/preview/route.ts`

- [ ] **Step 1: Criar pasta e arquivo da rota**

Run: `mkdir -p app/preview` (PowerShell: `New-Item -ItemType Directory -Force app/preview`)
Expected: pasta criada.

- [ ] **Step 2: Escrever o Route Handler**

Criar `app/preview/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { hashPreviewKey } from '@/lib/middleware/coming-soon';

/**
 * GET /preview?key=XXX
 *
 * Bypass do coming-soon de pré-lançamento. Marketing recebe a URL
 * com a chave em env e clica → seta cookie httpOnly de 60 dias →
 * redirect para /. Chave inválida retorna 404 (anti-fuzz, não 401).
 *
 * Cookie value = sha256(PREVIEW_BYPASS_KEY) — trocar a env var
 * automaticamente invalida todos os cookies emitidos.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  const expected = process.env.PREVIEW_BYPASS_KEY;

  if (!key || !expected || key !== expected) {
    return new NextResponse(null, { status: 404 });
  }

  const cookieValue = await hashPreviewKey(expected);

  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set('preview-bypass', cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 60, // 60 dias
    path: '/',
  });
  return response;
}
```

**Decisão sobre comparação de `key`:** uso comparação string direta (`key !== expected`) porque o V8/Edge runtime já trata strings imutáveis. Constant-time matters mais em comparações de hash binário; aqui a entrada é uma query param vinda do attacker, comparada com um segredo conhecido, e o ganho real de timing-safe é marginal num runtime que faz GC e otimização JIT. Mantém o código legível.

- [ ] **Step 3: Verificar build sem erros TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(error|preview)" | head -10`
Expected: 0 erros.

- [ ] **Step 4: Smoke test manual local**

Setar `PREVIEW_BYPASS_KEY=teste123` em `.env.local`, rodar `npm run dev`.

- Abrir `http://localhost:3000/preview` (sem key) → expected: 404
- Abrir `http://localhost:3000/preview?key=invalida` → expected: 404
- Abrir `http://localhost:3000/preview?key=teste123` → expected: redirect 302 para `/`, cookie `preview-bypass` setado (verificar em DevTools → Application → Cookies)

- [ ] **Step 5: Commit**

```bash
git add app/preview/route.ts
git commit -m "feat(preview): adiciona /preview route handler para bypass via URL secreta"
```

---

## Task 9: Middleware — integrar coming-soon gate

**Files:**
- Modify: `middleware.ts` (substituição completa do conteúdo)

- [ ] **Step 1: Substituir conteúdo do `middleware.ts`**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { authLogger } from '@/lib/logger';
import { isAllowlistedRoute, hasValidPreviewCookie } from '@/lib/middleware/coming-soon';

// Rotas que requerem autenticação
const protectedRoutes = ['/area-restrita'];

// Rotas que só admin pode acessar
const adminRoutes = ['/admin'];

// Rotas públicas do admin (não requerem autenticação)
const publicAdminRoutes = ['/admin/login'];

async function verifyAuth(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    authLogger.debug({ err: error }, 'Falha ao verificar token JWT');
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const comingSoonEnabled = process.env.COMING_SOON_ENABLED === 'true';

  // ========== COMING-SOON GATE (só ativa quando flag ligada) ==========
  if (comingSoonEnabled && !isAllowlistedRoute(pathname)) {
    // Tenta bypass por JWT (qualquer role: admin OU aluno)
    const token = request.cookies.get('auth-token')?.value;
    let hasJWTBypass = false;
    if (token) {
      const payload = await verifyAuth(token);
      hasJWTBypass = !!payload;
    }

    // Tenta bypass por cookie de preview (URL secreta)
    let hasPreviewBypass = false;
    if (!hasJWTBypass) {
      const cookie = request.cookies.get('preview-bypass')?.value;
      hasPreviewBypass = await hasValidPreviewCookie(
        cookie,
        process.env.PREVIEW_BYPASS_KEY,
      );
    }

    if (!hasJWTBypass && !hasPreviewBypass) {
      const url = request.nextUrl.clone();
      url.pathname = '/coming-soon';
      const response = NextResponse.rewrite(url);
      // Anti-cache: evita Vercel CDN servir coming-soon depois que o
      // kill switch for desligado. Crítico para rollback rápido.
      response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      return response;
    }
  }

  // ========== LÓGICA EXISTENTE (preservada integralmente) ==========

  // Verifica se é rota pública de admin
  const isPublicAdminRoute = publicAdminRoutes.some(route =>
    pathname.startsWith(route)
  );

  if (isPublicAdminRoute) {
    return NextResponse.next();
  }

  // Redireciona /jurisprudencia → /area-restrita/jurisprudencia quando
  // o usuário está logado. Versão restrita tem TCU/STJ/STF + busca IA, e
  // o aluno espera consistência: clicar "Jurisprudência" no menu superior
  // deve abrir a versão completa, não a pública resumida.
  if (pathname === '/jurisprudencia') {
    const token = request.cookies.get('auth-token')?.value;
    if (token) {
      const payload = await verifyAuth(token);
      if (payload) {
        const url = new URL('/area-restrita/jurisprudencia', request.url);
        url.search = request.nextUrl.search;
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // Verifica rotas protegidas e admin
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  );

  const isAdminRoute = adminRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  );

  if (isProtectedRoute || isAdminRoute) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      if (isAdminRoute) {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
      return NextResponse.redirect(new URL('/validar-acesso', request.url));
    }

    const payload = await verifyAuth(token);

    if (!payload) {
      if (isAdminRoute) {
        return NextResponse.redirect(new URL('/admin/login?error=expired', request.url));
      }
      return NextResponse.redirect(new URL('/validar-acesso?error=expired', request.url));
    }

    if (isAdminRoute && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Cobre tudo, exceto assets estáticos servidos diretamente pelo Vercel
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|css|js|map)$).*)',
  ],
};
```

- [ ] **Step 2: Verificar build sem erros TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(error|middleware)" | head -10`
Expected: 0 erros.

- [ ] **Step 3: Smoke test manual local — flag OFF (comportamento atual preservado)**

Em `.env.local`: `COMING_SOON_ENABLED=false` (ou ausente).
Run: `npm run dev` (limpar `.next/` antes se necessário: `rm -rf .next` ou PowerShell `Remove-Item -Recurse -Force .next`).

- Abrir `http://localhost:3000/` → expected: homepage normal
- Abrir `http://localhost:3000/area-restrita` (anônimo) → expected: redirect para `/validar-acesso`
- Abrir `http://localhost:3000/admin` (anônimo) → expected: redirect para `/admin/login`

Confirma que lógica existente continua funcionando.

- [ ] **Step 4: Smoke test manual local — flag ON**

Em `.env.local`: `COMING_SOON_ENABLED=true` e `PREVIEW_BYPASS_KEY=teste123`.
Reiniciar `npm run dev`.

Em janela anônima (sem cookies):
- `http://localhost:3000/` → expected: coming-soon ("Em breve"), URL preservada
- `http://localhost:3000/sobre` → expected: coming-soon
- `http://localhost:3000/lei-14133` → expected: coming-soon
- `http://localhost:3000/cursos` → expected: coming-soon
- `http://localhost:3000/blog` → expected: listagem do blog normal
- `http://localhost:3000/login` → expected: tela de login normal
- `http://localhost:3000/planos` → expected: tela de planos normal
- `http://localhost:3000/preview?key=teste123` → expected: redirect para `/`, depois homepage normal

Login como admin (limpar cookie preview antes via DevTools):
- `http://localhost:3000/` → expected: homepage normal

- [ ] **Step 5: Commit**

```bash
git add middleware.ts
git commit -m "feat(middleware): adiciona coming-soon gate com allowlist e bypass JWT/preview cookie"
```

---

## Task 10: Robots — adicionar `/preview` aos disallow

**Files:**
- Modify: `app/robots.ts`

- [ ] **Step 1: Adicionar `/preview` aos 3 blocos disallow**

Em `app/robots.ts`, editar os 3 arrays `disallow` (User-Agent: `*`, `Googlebot`, `Bingbot`):

```typescript
// Bloco User-Agent: '*' (linha 11-22)
disallow: [
  '/admin',
  '/admin/*',
  '/area-restrita',
  '/area-restrita/*',
  '/api',
  '/api/*',
  '/login',
  '/registro',
  '/validar-acesso',
  '/preview',          // NOVO
  '/_next/static/*',
],
```

Aplicar a mesma adição (`'/preview'`) aos blocos Googlebot (linhas 27-37) e Bingbot (linhas 43-53).

- [ ] **Step 2: Verificar build**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(error|robots)" | head -10`
Expected: 0 erros.

- [ ] **Step 3: Smoke test local**

`http://localhost:3000/robots.txt` → verificar que `/preview` aparece em todos os 3 blocos.

- [ ] **Step 4: Commit**

```bash
git add app/robots.ts
git commit -m "feat(robots): adiciona /preview ao disallow para todos os bots"
```

---

## Task 11: CTA newsletter no fim do blog post

**Files:**
- Modify: `app/(acervo)/blog/[slug]/page.tsx`

- [ ] **Step 1: Inspecionar template atual do blog post**

Run: `cat "app/(acervo)/blog/[slug]/page.tsx" | head -120`
Identificar onde fica o final do conteúdo do post (depois do `MarkdownContent` e dos `ShareButtons`). Identificar se já existe algum CTA de newsletter — em caso afirmativo, ele deve ser condicionalizado para não duplicar quando o flag estiver ligado.

- [ ] **Step 2: Importar `NewsletterForm` no topo do arquivo**

Adicionar ao bloco de imports (ajustar caminho relativo se necessário):

```typescript
import NewsletterForm from '@/components/NewsletterForm';
```

- [ ] **Step 3: Adicionar CTA condicional no fim do conteúdo do post**

Localizar o JSX que renderiza o final do post (após `MarkdownContent`, antes de comentários ou seções relacionadas — se existirem). Adicionar:

```tsx
{process.env.COMING_SOON_ENABLED === 'true' && (
  <aside className="mt-12 border-t border-slate-200 pt-8">
    <h2 className="text-2xl font-bold text-slate-900 mb-2">
      Em breve, novidades
    </h2>
    <p className="text-slate-600 mb-6">
      {/* Microcopy placeholder — Daniel revisa antes do deploy */}
      Estamos preparando um lançamento. Cadastre seu email para ser avisado
      primeiro.
    </p>
    <NewsletterForm variant="default" source="blog-footer" />
  </aside>
)}
```

**Nota:** se já existir um CTA de newsletter pré-existente no template, envolver ele em `{process.env.COMING_SOON_ENABLED !== 'true' && (...)}` para que só apareça quando o flag estiver desligado. Caso contrário, dois CTAs aparecerão ao mesmo tempo durante o período.

- [ ] **Step 4: Verificar build**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(error|blog)" | head -10`
Expected: 0 erros.

- [ ] **Step 5: Smoke test local com flag ON**

Em `.env.local`: `COMING_SOON_ENABLED=true`. Reiniciar dev server.
Abrir um post real (ex.: `http://localhost:3000/blog/<algum-slug-existente>`) → verificar que CTA "Em breve, novidades" aparece no fim do post.

Em seguida, setar `COMING_SOON_ENABLED=false` e reiniciar. Abrir mesmo post → CTA deve sumir.

- [ ] **Step 6: Commit**

```bash
git add "app/(acervo)/blog/[slug]/page.tsx"
git commit -m "feat(blog): adiciona CTA newsletter condicional no fim do post durante coming-soon"
```

---

## Task 12: Smoke test script + checklist manual pós-deploy

**Files:**
- Create: `scripts/smoke-test-coming-soon.mjs`

- [ ] **Step 1: Criar script Node de smoke test**

Criar `scripts/smoke-test-coming-soon.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Smoke test do coming-soon de pré-lançamento.
 *
 * Uso:
 *   node scripts/smoke-test-coming-soon.mjs <base-url> [--key=<preview-key>]
 *
 * Exemplos:
 *   node scripts/smoke-test-coming-soon.mjs http://localhost:3000
 *   node scripts/smoke-test-coming-soon.mjs https://www.profdanielbarral.com --key=abc123
 *
 * Verifica:
 *  - Anônimo: rotas vitrine retornam "Em breve" (200 OK); operacionais e blog passam normal
 *  - Com cookie preview (se --key fornecida): tudo passa normal
 *  - /preview?key=invalida retorna 404
 */

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('Uso: node scripts/smoke-test-coming-soon.mjs <base-url> [--key=<chave>]');
  process.exit(1);
}

const keyArg = process.argv.find(a => a.startsWith('--key='));
const previewKey = keyArg ? keyArg.split('=')[1] : null;

const VITRINE = ['/', '/sobre', '/lei-14133', '/cursos', '/contato', '/clipping', '/glossario', '/legislacao', '/publicacoes'];
const OPERATIONAL = ['/login', '/registro', '/blog', '/privacidade', '/termos', '/upgrade', '/planos'];

let failures = 0;
const check = (label, ok, detail = '') => {
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function fetchText(path, opts = {}) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: 'manual', ...opts });
  const text = res.status >= 200 && res.status < 300 ? await res.text() : '';
  return { status: res.status, text, headers: res.headers };
}

console.log(`\n=== Anônimo (${baseUrl}) ===`);
for (const path of VITRINE) {
  const { status, text } = await fetchText(path);
  const isComingSoon = status === 200 && /Em breve/i.test(text);
  check(`${path} → coming-soon`, isComingSoon, `status=${status}, "Em breve" presente: ${/Em breve/i.test(text)}`);
}

for (const path of OPERATIONAL) {
  const { status, text } = await fetchText(path);
  const isNormal = status === 200 && !/Em breve/i.test(text);
  check(`${path} → conteúdo real`, isNormal, `status=${status}`);
}

console.log(`\n=== /preview ===`);
const invalid = await fetchText('/preview?key=chave-invalida-123');
check('/preview?key=invalida → 404', invalid.status === 404, `status=${invalid.status}`);

if (previewKey) {
  console.log(`\n=== Com chave válida ===`);
  const res = await fetch(`${baseUrl}/preview?key=${encodeURIComponent(previewKey)}`, { redirect: 'manual' });
  const cookieHeader = res.headers.get('set-cookie') || '';
  const hasCookie = cookieHeader.includes('preview-bypass=');
  check('/preview com key válida → 302 + cookie', res.status === 302 && hasCookie, `status=${res.status}, cookie: ${hasCookie}`);
}

console.log(`\n${failures === 0 ? '✓ Todos os smoke tests passaram' : `✗ ${failures} falha(s)`}`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Tornar script executável (Linux/Mac apenas)**

Run: `chmod +x scripts/smoke-test-coming-soon.mjs`
(Skip no Windows — `.mjs` é executado via `node`.)

- [ ] **Step 3: Smoke test local**

Em `.env.local`: `COMING_SOON_ENABLED=true`, `PREVIEW_BYPASS_KEY=teste123`. Reiniciar dev server.
Run: `node scripts/smoke-test-coming-soon.mjs http://localhost:3000 --key=teste123`
Expected: todos os checks com `✓`, exit 0.

- [ ] **Step 4: Adicionar entrada em `package.json` (opcional)**

Adicionar em `scripts`:

```json
"smoke:coming-soon": "node scripts/smoke-test-coming-soon.mjs"
```

Uso: `npm run smoke:coming-soon -- http://localhost:3000 --key=teste123`

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-test-coming-soon.mjs package.json
git commit -m "test(coming-soon): adiciona script de smoke test para validação pós-deploy"
```

---

## Task 13: Rollout para produção (manual, não-código)

Este task NÃO é código — é checklist operacional. NÃO marcar como completo via PR; é executado pelo Daniel.

**Checklist:**

- [ ] **Step 1: Rodar suite completa de testes Vitest**

Run: `npm run test:run`
Expected: 0 falhas (incluindo os novos testes de `lib/middleware/__tests__/coming-soon.test.ts`).

- [ ] **Step 2: Gerar chave de produção**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
Copiar o valor (64 chars hex). NÃO comitar.

- [ ] **Step 3: Setar env vars no Vercel — Production env APENAS**

No Vercel Dashboard → Project Settings → Environment Variables:
- `COMING_SOON_ENABLED` = `true` (Production)
- `PREVIEW_BYPASS_KEY` = `<hex gerado no step 2>` (Production)

NÃO setar em Preview nem Development.

- [ ] **Step 4: Deploy produção**

Run: `vercel --prod`
Aguardar deploy completar (~2-3 min).

- [ ] **Step 5: Smoke test em produção**

Run: `node scripts/smoke-test-coming-soon.mjs https://www.profdanielbarral.com --key=<chave-gerada>`
Expected: todos `✓`, exit 0.

Manual adicional (janela anônima):
- `https://www.profdanielbarral.com` → coming-soon
- `https://www.profdanielbarral.com/blog/<slug-real>` → artigo + CTA "Em breve, novidades"
- `https://www.profdanielbarral.com/login` → tela de login
- Login como admin → site completo

- [ ] **Step 6: Distribuir URL de preview para marketing**

Compartilhar `https://www.profdanielbarral.com/preview?key=<chave>` por canal privado (WhatsApp/Slack DM, NÃO em grupos públicos).

---

## Trade-off conhecido: ISR no blog vs flag

As páginas de blog (`/blog/[slug]`) usam ISR com revalidação periódica (~1h). O CTA "Em breve, novidades" aparece via `process.env.COMING_SOON_ENABLED === 'true'` lido **no momento da geração estática**, não a cada request. Implicações:

- **Ao ATIVAR a flag** (deploy com `COMING_SOON_ENABLED=true`): Vercel força rebuild ao detectar mudança em env var → ISR regenera com CTA. Sem lag perceptível.
- **Ao DESATIVAR a flag** (launch day): Vercel também força rebuild, mas páginas ISR antigas no edge cache podem servir o CTA por até ~60min para usuários que requisitarem antes da primeira revalidação pós-deploy.

**Mitigações no launch day:**
- Aguardar 1h após o deploy de `COMING_SOON_ENABLED=false` antes de divulgar amplamente (CTA já terá saído de páginas mais acessadas).
- OU: chamar manualmente `/api/revalidate` (se existir endpoint) para invalidar `/blog/*` imediatamente.
- OU: aceitar o lag — o CTA de "Em breve, novidades" depois do lançamento é um problema cosmético menor, não bug funcional.

A middleware-side gate (rewrite para coming-soon nas rotas vitrine) NÃO sofre desse problema — corre por-request e responde imediatamente a mudança da flag.

---

## Rollback procedures (referência)

**"Algo quebrou":**
1. Vercel Dashboard → Environment Variables → `COMING_SOON_ENABLED` = `false`
2. Redeploy do último deployment de produção (botão "Redeploy", sem rebuild — ~30s)
3. Header `Cache-Control: private, no-cache, no-store` no rewrite garante que CDN não serve coming-soon em cache.

**"Chave de preview vazou":**
1. Trocar `PREVIEW_BYPASS_KEY` na Vercel (gerar novo hex de 32 bytes)
2. Redeploy → todos os cookies emitidos com a chave antiga viram inválidos automaticamente
3. Compartilhar nova URL `/preview?key=<nova>` por canal privado

**"Coming-soon indexado como snippet da homepage":**
1. Desativar kill switch (volta o conteúdo real)
2. Google re-crawla em horas-dias → snippet atualiza naturalmente
3. Acelerar se necessário via Google Search Console → URL Inspection → "Request indexing"

---

## Critérios de pronto (validados pelo plano)

- [x] Spec corrigido (commit `853c85f`) e revisado
- [ ] Task 1: `.env.example` documenta as duas env vars
- [ ] Task 2: Schema com campo `source` aplicado no banco
- [ ] Task 3: API `/api/newsletter` grava `source`
- [ ] Task 4: `NewsletterForm` aceita prop `source`
- [ ] Task 5: `isAllowlistedRoute()` implementado com 12 testes Vitest passando
- [ ] Task 6: `hasValidPreviewCookie()` + `hashPreviewKey()` implementados com testes Vitest passando
- [ ] Task 7: `/coming-soon` renderiza com `NewsletterForm` e link para `/blog`
- [ ] Task 8: `/preview` route handler valida key, seta cookie 60d, redirect para `/`
- [ ] Task 9: `middleware.ts` integrado com kill switch, rotas existentes preservadas
- [ ] Task 10: `robots.ts` bloqueia `/preview` em todos os 3 user-agents
- [ ] Task 11: CTA newsletter aparece no fim dos posts do blog quando flag ON
- [ ] Task 12: Smoke test script funciona local
- [ ] Task 13: Rollout em produção concluído (checklist manual do Daniel)

---

## Open questions / decisões deferidas

1. **Microcopy final** da coming-soon (headline, parágrafo) e do CTA do blog. Marcado como placeholder; Daniel revisa antes do deploy de produção (Task 13).
2. **CTA pré-existente no blog post** (Task 11, Step 1) — se houver, condicionalizar para não duplicar quando flag estiver ON. Decisão tomada na inspeção do arquivo.
