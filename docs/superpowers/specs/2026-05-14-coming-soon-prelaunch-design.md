# Coming-soon de pré-lançamento — design

**Data:** 2026-05-14
**Status:** Draft (aprovado em brainstorming, aguardando review escrita)
**Rotas afetadas:** raiz do site (`/`) + todas as rotas vitrine; nova rota `/coming-soon`; nova rota `/preview`; `middleware.ts`
**Motivação:** Marketing solicitou que o site não seja divulgado publicamente antes do anúncio oficial. Em paralelo, é necessário começar a divulgar artigos do blog. Solução: bloquear rotas vitrine com página "em breve", mantendo blog (`/artigo/*` + `/artigos`) acessível por link direto, e operações intactas para alunos/admin existentes.

## Goal

Construir um modo "pré-lançamento" do site que:

1. Substitua a homepage e todas as rotas vitrine por uma página coming-soon para visitantes anônimos.
2. Mantenha o blog 100% público (`/artigos` + `/artigo/*`) para que artigos possam ser divulgados livremente.
3. Mantenha todas as rotas operacionais (auth, área-restrita, admin, API, certificado público, pagamento) funcionando para que alunos pagantes e admins não sejam afetados.
4. Permita bypass por (a) qualquer usuário logado e (b) URL secreta `/preview?key=XXX` para o time de marketing.
5. Seja ativável/desativável via kill switch sem deploy, e rollback em ≤ 2 minutos.

## Non-goals

- **Não alterar `robots.ts` nem `sitemap.ts`.** Indexação fica intacta. Decisão consciente baseada no trade-off SEO discutido no brainstorming (cenário B: coming-soon servido com HTTP 200 mantém a URL no índice; o custo é o snippet da homepage possivelmente trocar para "Em breve" se a janela passar de ~3 semanas). Único noindex novo: a rota `/preview`.
- **Não construir UI de gestão** (sem painel admin para criar múltiplas chaves nomeadas). Uma única chave em env var; trocar a chave revoga todos os cookies emitidos.
- **Não tratar `/cursos/[slug]` (página de venda do curso individual) como operacional.** Continua na vitrine (bloqueada para anônimos). Aluno logado bypassa naturalmente.
- **Não criar componente de design novo** para a coming-soon. Reusar `NewsletterSignup` existente, logo do header e tokens de `globals.css`.
- **Não migrar para `runtime: 'nodejs'`** no middleware. Mantém Edge runtime — usar Web Crypto (`crypto.subtle`) para hash.
- **Não persistir métricas em DB.** Tráfego e conversões serão acompanhados via Vercel Analytics + logs estruturados existentes (pino).

## Decisões-chave (resumo do brainstorming)

| Decisão | Valor |
|---|---|
| Comportamento padrão para anônimos | Coming-soon na homepage + rotas vitrine |
| Escopo de bloqueio | Toda rota de vitrine; rotas operacionais e blog intactos |
| Indexação Google | Manter (cenário B) — snippet pode trocar se janela > 3 semanas, aceito |
| Janela esperada | > 3 semanas (sem data definida pelo marketing) |
| `/artigos` (listagem do blog) | Pública — visitante pode explorar todos os artigos |
| CTA no fim dos artigos | Reusa `NewsletterSignup`, só visível com kill switch ligado |
| Coming-soon contém | Teaser + captura email + link para `/artigos` |
| Bypass automático | Qualquer JWT válido (admin OU aluno) |
| Bypass manual | URL `/preview?key=XXX`, chave em env var, cookie httpOnly 60d |
| Cookie de preview | Valor = `sha256(key)`, troca de env var invalida todos |
| Crypto no middleware | Web Crypto API (`crypto.subtle.digest`) — mantém Edge runtime |
| Middleware allowlist | Denyall por padrão; sete grupos explícitos |
| Microcopy da coming-soon | Placeholder — Daniel revisa antes do deploy |

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│  Request → middleware.ts (Edge)                             │
│                                                             │
│  1. kill switch off? → comportamento atual (sem mudanças)   │
│  2. /_next/* ou /api/* → next()                             │
│  3. isAllowlistedRoute(pathname)? → next()                  │
│  4. JWT válido (qualquer role)? → next()                    │
│  5. cookie preview-bypass válido? → next()                  │
│  6. else → NextResponse.rewrite("/coming-soon")             │
└─────────────────────────────────────────────────────────────┘
       │                                              │
       ▼                                              ▼
  Lógica atual                                  /coming-soon
  (jurisprudencia redirect,                     (server component,
   /area-restrita, /admin)                       reuses NewsletterSignup)

  ┌──────────────────────────────────────────────────────────┐
  │  /preview?key=XXX → Route Handler                        │
  │    1. valida key (timingSafeEqual via Web Crypto)        │
  │    2. set cookie preview-bypass = sha256(key), 60d       │
  │    3. redirect 302 → /                                   │
  │    4. key inválida → 404 (não 401, anti-fuzz)            │
  └──────────────────────────────────────────────────────────┘
```

**Princípios de design:**

1. **Aditivo, não destrutivo.** A lógica nova vem ANTES da existente no middleware. Sem kill switch, o middleware se comporta exatamente como hoje.
2. **Rewrite, não redirect.** `NextResponse.rewrite("/coming-soon")` preserva a URL na barra do browser. Links compartilhados continuam válidos pós-lançamento; Google indexa as URLs vitrine reais (não `/coming-soon`).
3. **Hash do segredo no cookie.** Cookie nunca contém a chave em plaintext. Trocar a env var invalida todos os cookies automaticamente.
4. **Edge runtime preservado.** Web Crypto async é trivial e o middleware atual já é async (faz `jwtVerify`).
5. **Componentes existentes reusados** (`NewsletterSignup`, logo, tokens CSS). Único trabalho de design real: layout da `/coming-soon`.

## Allowlist (sete grupos)

Implementada em `isAllowlistedRoute(pathname: string): boolean`. Match exato OU prefixo.

**Grupo A — Assets e infra**
- Já filtrados no `matcher` do middleware (regex no `config.matcher`), mas tratamento defensivo:
- Prefixos: `/_next/`, `/api/`, `/icons/`, `/images/`
- Exatos: `/favicon.ico`, `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml`, `/sitemap-artigos.xml`

**Grupo B — Auth e validação de acesso**
- Exatos: `/login`, `/registro`, `/esqueci-senha`, `/redefinir-senha`, `/verificar-email`, `/validar-acesso`, `/cancelar-newsletter`

**Grupo C — Áreas autenticadas (já protegidas)**
- Prefixos: `/area-restrita/`, `/admin/`
- Continuam passando pela lógica atual de JWT/role (sem mudança)

**Grupo D — Validação pública de certificado**
- Prefixo: `/certificado/` (caso de uso: alguém recebe link de certificado por email e precisa validar sem login)

**Grupo E — Blog (vitrine permitida)**
- Exato: `/artigos`
- Prefixo: `/artigo/`

**Grupo F — Páginas legais**
- Exatos: `/privacidade`, `/termos` (exigidos por LGPD; links em emails transacionais não podem cair em coming-soon)

**Grupo G — Pagamento/upgrade**
- Exato: `/upgrade`
- Prefixo: `/assinatura/` (fluxo de checkout Stripe; alunos com link de upgrade não podem cair em coming-soon)

**Bloqueado (resto):** `/`, `/sobre`, `/lei-14133` e subpaths, `(acervo)/*` (busca pública), `/busca`, `/contato`, `/novidades`, `/clipping` (listagem pública), `/cursos` raiz e `/cursos/[slug]`.

**Normalização de pathname antes do match:** remover trailing slash (`/login/` → `/login`) para evitar miss de exact match.

## Implementação por arquivo

### 1. `app/coming-soon/page.tsx` (NOVO)

Server component, sem `'use client'`. Layout enxuto reusando tokens do `globals.css`.

```tsx
// Esboço estrutural — microcopy é placeholder
import { Metadata } from 'next';
import { NewsletterSignup } from '@/components/NewsletterSignup';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Em breve | Prof. Daniel Barral',
  description: 'Novidades chegando em breve. Cadastre seu email para ser avisado.',
  // Indexável (cenário B do brainstorming) — não setar noindex aqui
};

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-xl text-center">
        {/* Logo SVG */}
        <h1 className="text-4xl font-serif text-navy-900 mb-4">Em breve</h1>
        <p className="text-lg text-slate-600 mb-8">
          {/* Placeholder — Daniel revisa antes do deploy */}
          Algo novo está chegando para quem trabalha com licitações e contratos.
        </p>
        <NewsletterSignup
          source="coming-soon"
          successMessage="Avisamos você no lançamento."
        />
        <Link
          href="/artigos"
          className="inline-block mt-8 text-navy-700 underline"
        >
          Enquanto isso, leia nossos artigos →
        </Link>
      </div>
    </main>
  );
}
```

**Observações:**
- Verificar no código existente se `NewsletterSignup` aceita prop `source`. Se não, adicionar (passada para `POST /api/newsletter` para gravar em `NewsletterSubscriber`).
- Microcopy é placeholder. Daniel revisa antes do deploy de produção.

### 2. `app/preview/route.ts` (NOVO)

Route Handler GET. Valida chave, seta cookie, redireciona.

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  const expected = process.env.PREVIEW_BYPASS_KEY;

  if (!key || !expected) {
    return new NextResponse(null, { status: 404 });
  }

  // Comparação constant-time via hash
  const encoder = new TextEncoder();
  const [keyHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(key)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);

  if (!buffersEqual(keyHash, expectedHash)) {
    return new NextResponse(null, { status: 404 });
  }

  const cookieValue = bufferToHex(expectedHash);

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

function buffersEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**Decisões:**
- **404, não 401** em chave inválida ou ausente — anti-fuzz, não confirma existência do endpoint.
- **Comparação constant-time** (`buffersEqual`) — fecha timing attack hipotético.
- **Cookie value = hash da chave** — vazamento do cookie não revela a chave.
- **`sameSite: 'lax'`** — necessário para cookie sobreviver a clique em link externo (WhatsApp/Slack/email).
- **60 dias** — cobre janela esperada (> 3 semanas) com folga.

### 3. `app/robots.ts` (MODIFICADO) — bloquear `/preview` de bots

Adicionar `Disallow: /preview` à configuração existente. Não criar `app/preview/page.tsx` (conflita com `route.ts` no mesmo segmento — Next.js App Router não permite ambos). O Route Handler já retorna 404 sem chave válida, então não há conteúdo indexável; o `Disallow` é apenas higiene defensiva contra fuzz de bots.

Edição esperada (verificar conteúdo atual antes):

```typescript
// app/robots.ts (esboço da edição — manter regras existentes)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/area-restrita/', '/preview'], // adicionar /preview
      },
    ],
    sitemap: 'https://www.profdanielbarral.com/sitemap.xml',
  };
}
```

### 4. `middleware.ts` (MODIFICADO)

Lógica nova prepended à existente. Comportamento atual (jurisprudencia redirect, proteção `/area-restrita` e `/admin`) preservado integralmente.

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { authLogger } from '@/lib/logger';

// ========== ALLOWLIST ==========

const ALLOWLIST_EXACT = new Set([
  '/login', '/registro', '/esqueci-senha', '/redefinir-senha',
  '/verificar-email', '/validar-acesso', '/cancelar-newsletter',
  '/privacidade', '/termos', '/upgrade',
  '/artigos', '/coming-soon', '/preview',
  '/favicon.ico', '/manifest.webmanifest', '/robots.txt',
  '/sitemap.xml', '/sitemap-artigos.xml',
]);

const ALLOWLIST_PREFIXES = [
  '/_next/', '/api/',
  '/artigo/', '/area-restrita/', '/admin/', '/certificado/',
  '/assinatura/', '/icons/', '/images/',
];

function isAllowlistedRoute(pathname: string): boolean {
  const normalized = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
  if (ALLOWLIST_EXACT.has(normalized)) return true;
  return ALLOWLIST_PREFIXES.some(p => normalized.startsWith(p));
}

// ========== PREVIEW COOKIE ==========

async function hasValidPreviewCookie(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get('preview-bypass')?.value;
  const key = process.env.PREVIEW_BYPASS_KEY;
  if (!cookie || !key) return false;

  const encoder = new TextEncoder();
  const expectedBuf = await crypto.subtle.digest('SHA-256', encoder.encode(key));
  const expected = Array.from(new Uint8Array(expectedBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return cookie === expected;
}

// ========== JWT (existente) ==========

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

// ========== MIDDLEWARE ==========

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const comingSoonEnabled = process.env.COMING_SOON_ENABLED === 'true';

  // Coming-soon gate (só ativa quando flag ligada)
  if (comingSoonEnabled && !isAllowlistedRoute(pathname)) {
    // Tenta bypass por JWT
    const token = request.cookies.get('auth-token')?.value;
    let hasJWTBypass = false;
    if (token) {
      const payload = await verifyAuth(token);
      hasJWTBypass = !!payload;
    }

    // Tenta bypass por cookie de preview
    const hasPreviewBypass = !hasJWTBypass && await hasValidPreviewCookie(request);

    if (!hasJWTBypass && !hasPreviewBypass) {
      const url = request.nextUrl.clone();
      url.pathname = '/coming-soon';
      const response = NextResponse.rewrite(url);
      // Anti-cache: evita Vercel CDN servir coming-soon após desligar kill switch
      response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      return response;
    }
  }

  // ========== LÓGICA EXISTENTE (preservada integralmente) ==========

  const publicAdminRoutes = ['/admin/login'];
  const isPublicAdminRoute = publicAdminRoutes.some(route => pathname.startsWith(route));
  if (isPublicAdminRoute) return NextResponse.next();

  // /jurisprudencia → /area-restrita/jurisprudencia se logado
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

  // Rotas protegidas e admin (lógica existente preservada)
  const protectedRoutes = ['/area-restrita'];
  const adminRoutes = ['/admin'];

  const isProtectedRoute = protectedRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/'));
  const isAdminRoute = adminRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/'));

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
    // Cobre tudo, exceto assets estáticos
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|css|js)$).*)',
  ],
};
```

**Mudanças vs. middleware atual:**
1. Matcher expandido (antes cobria 3 rotas; agora cobre quase tudo).
2. Bloco "Coming-soon gate" inserido no início, controlado por `COMING_SOON_ENABLED`.
3. Funções auxiliares `isAllowlistedRoute()` e `hasValidPreviewCookie()` adicionadas.
4. Lógica existente (jurisprudencia, área-restrita, admin) **integralmente preservada**.
5. Header `Cache-Control: private, no-cache, no-store, must-revalidate` no response do rewrite (crítico para rollback).

### 5. CTA dos artigos — `app/artigo/[slug]/page.tsx` (MODIFICADO)

Adicionar bloco de CTA newsletter no fim do artigo, visível **só quando `COMING_SOON_ENABLED=true`**. Some automaticamente após o lançamento.

```tsx
// No fim do template do artigo, após o conteúdo
{process.env.COMING_SOON_ENABLED === 'true' && (
  <aside className="mt-12 border-t pt-8">
    <h2 className="text-xl font-serif mb-2">Em breve, novidades</h2>
    <p className="text-slate-600 mb-4">
      {/* Placeholder — Daniel revisa antes do deploy */}
      Estamos preparando um lançamento. Cadastre seu email para ser avisado primeiro.
    </p>
    <NewsletterSignup source="article-footer" />
  </aside>
)}
```

**Atenção:** se o artigo já tem CTA de newsletter no fim, substituir/condicionalizar para não ter dois CTAs idênticos.

### 6. Schema — adicionar campo `source` em `NewsletterSubscriber`

Migração Prisma (opcional, mas recomendada para diferenciar leads):

```prisma
model NewsletterSubscriber {
  // ... campos existentes ...
  source         String?   // 'coming-soon' | 'article-footer' | 'footer' | etc.

  @@index([source])
}
```

API `POST /api/newsletter` aceita campo `source` opcional no body e grava no modelo.

### 7. `.env.example` (MODIFICADO)

```bash
# Pré-lançamento — quando "true", todas as rotas vitrine
# (homepage, /sobre, /lei-14133, /cursos, etc.) são reescritas para /coming-soon
# para visitantes anônimos. Rotas operacionais (login, área-restrita, admin,
# api, blog, certificado) ficam intactas. Usuários logados (qualquer role)
# fazem bypass automaticamente.
COMING_SOON_ENABLED="false"

# Chave secreta para bypass via /preview?key=XXX
# Gerar com: openssl rand -hex 32
# Trocar essa env var invalida todos os cookies preview-bypass emitidos.
PREVIEW_BYPASS_KEY=""
```

## Testes

### Unitários — `lib/__tests__/coming-soon-allowlist.test.ts` (NOVO)

Testa `isAllowlistedRoute()` puro (sem servidor):

```typescript
describe('isAllowlistedRoute', () => {
  test('permite assets', () => {
    expect(isAllowlistedRoute('/_next/static/foo.js')).toBe(true);
    expect(isAllowlistedRoute('/api/newsletter')).toBe(true);
    expect(isAllowlistedRoute('/favicon.ico')).toBe(true);
  });

  test('permite rotas operacionais', () => {
    expect(isAllowlistedRoute('/login')).toBe(true);
    expect(isAllowlistedRoute('/area-restrita/meu-progresso')).toBe(true);
    expect(isAllowlistedRoute('/admin/dashboard')).toBe(true);
    expect(isAllowlistedRoute('/upgrade')).toBe(true);
    expect(isAllowlistedRoute('/assinatura/sucesso')).toBe(true);
  });

  test('permite blog', () => {
    expect(isAllowlistedRoute('/artigos')).toBe(true);
    expect(isAllowlistedRoute('/artigo/meu-slug')).toBe(true);
  });

  test('bloqueia vitrine', () => {
    expect(isAllowlistedRoute('/')).toBe(false);
    expect(isAllowlistedRoute('/sobre')).toBe(false);
    expect(isAllowlistedRoute('/lei-14133')).toBe(false);
    expect(isAllowlistedRoute('/lei-14133/art-1')).toBe(false);
    expect(isAllowlistedRoute('/cursos')).toBe(false);
    expect(isAllowlistedRoute('/cursos/nova-lei')).toBe(false);
    expect(isAllowlistedRoute('/contato')).toBe(false);
    expect(isAllowlistedRoute('/clipping')).toBe(false);
  });

  test('normaliza trailing slash', () => {
    expect(isAllowlistedRoute('/login/')).toBe(true);
  });

  test('edge cases', () => {
    expect(isAllowlistedRoute('/artigo')).toBe(false); // sem slash final, não casa prefixo
    expect(isAllowlistedRoute('/artigosx')).toBe(false); // não confunde com /artigos
  });
});
```

### Integração — `__tests__/coming-soon.spec.ts` (Playwright, NOVO)

Roda contra `localhost:3000` com `COMING_SOON_ENABLED=true`. Três personas:

**1. Anônimo (sem cookies):**
- `GET /` → 200, h1 contém "Em breve", URL preservada (`/`)
- `GET /sobre`, `/lei-14133`, `/cursos`, `/clipping`, `/contato` → todos coming-soon
- `GET /login`, `/registro`, `/artigos`, `/privacidade`, `/termos`, `/upgrade` → 200, sem "Em breve"
- `GET /artigo/<slug-real>` → renderiza artigo + CTA newsletter visível
- `GET /api/newsletter` (POST) → funciona normal

**2. Admin logado** (helper `loginAsAdmin` existente):
- `GET /` → conteúdo real, sem "Em breve"
- `GET /admin/dashboard` → funciona

**3. Cookie preview** (set via `/preview?key=...`):
- `GET /preview?key=<chave>` → redirect 302 para `/`, cookie setado
- `GET /` (com cookie) → conteúdo real
- `GET /preview?key=invalida` → 404
- `GET /preview` (sem key) → 404

### Smoke test em produção (manual, ~5min)

Checklist a executar após cada deploy enquanto `COMING_SOON_ENABLED=true`:

- [ ] Janela anônima → `https://www.profdanielbarral.com` → coming-soon
- [ ] Janela anônima → `/artigo/<slug-conhecido>` → artigo + CTA
- [ ] Janela anônima → `/login` → tela de login normal
- [ ] `https://www.profdanielbarral.com/preview?key=<chave>` → libera site
- [ ] Login como admin (limpando cookie preview antes) → site completo
- [ ] DevTools: `Cache-Control: private, no-cache` no response da homepage anônima

## Rollout

1. **Local:** rodar com `COMING_SOON_ENABLED=true` no `.env.local`. Validar visualmente os fluxos do smoke test.
2. **Testes:** `npm test` (Vitest) + `npx playwright test coming-soon.spec.ts`
3. **Vercel — Production env apenas:**
   - `COMING_SOON_ENABLED=true`
   - `PREVIEW_BYPASS_KEY=<openssl rand -hex 32>`
4. **Deploy:** `vercel --prod`
5. **Smoke test em produção** (checklist acima).
6. **Compartilhar** `https://www.profdanielbarral.com/preview?key=<chave>` com time de marketing (canal seguro: WhatsApp privado, não em grupos).

## Rollback (≤ 2 minutos)

**"Algo quebrou":**
- Vercel Dashboard → Environment Variables → `COMING_SOON_ENABLED` → `false`
- Botão "Redeploy" no último deployment de produção (~30s, sem rebuild)
- O header `Cache-Control: private, no-cache` no rewrite garante que clientes não recebam coming-soon em cache.

**"Chave de preview vazou":**
- Trocar `PREVIEW_BYPASS_KEY` na Vercel + redeploy → todos os cookies emitidos com a chave antiga viram inválidos (cookie value = hash da chave atual).
- Compartilhar nova URL `/preview?key=<nova>` com marketing.

**"Coming-soon indexado como snippet da homepage":**
- Desativar kill switch (volta o conteúdo real).
- Google re-crawla em horas-dias; snippet atualiza naturalmente.
- Acelerar se necessário via Google Search Console (URL Inspection → "Request indexing").

## Métricas durante o período

Acompanhar via canais existentes (sem novo dashboard):

| Métrica | Onde | Como |
|---|---|---|
| Coming-soon impressions | Logs Vercel | `apiLogger.info({ pathname }, 'coming-soon rewrite')` no middleware |
| Email captures | Banco — `NewsletterSubscriber` agrupado por `source` | Query Prisma manual ou em `/admin/newsletter` |
| Tráfego de artigos | Vercel Analytics em `/artigo/*` | Dashboard Vercel |
| Bypass uses | Logs Vercel | `apiLogger.info` no Route Handler `/preview` em sucesso |

## Open questions / decisões deferidas

1. **Microcopy final** da coming-soon (headline, parágrafo) e dos CTAs nos artigos. Marcado como placeholder; Daniel revisa antes do deploy de produção.
2. **Se `NewsletterSignup` aceita prop `source`** — verificar no código existente; se não, adicionar (decisão trivial).
3. **Conteúdo atual de `app/robots.ts`** — verificar formato real antes da edição para preservar regras existentes (o esboço acima é ilustrativo).

## Critérios de pronto

- [ ] `middleware.ts` modificado, allowlist em função pura testada
- [ ] `app/coming-soon/page.tsx` criada, reusa `NewsletterSignup`, metadata indexável
- [ ] `app/preview/route.ts` criada, valida chave com constant-time, seta cookie hash 60d, retorna 404 em inválido
- [ ] CTA newsletter em `app/artigo/[slug]/page.tsx` condicional ao flag
- [ ] Schema — campo `source` em `NewsletterSubscriber` (migração + API atualizada)
- [ ] Env vars documentadas em `.env.example` (não comitar valores reais)
- [ ] Testes unitários da allowlist (≥ 10 casos)
- [ ] Testes Playwright das 3 personas (anônimo, admin logado, com cookie preview)
- [ ] Smoke test em produção passa
- [ ] Link `/preview?key=...` compartilhado com marketing
- [ ] Microcopy revisada por Daniel
