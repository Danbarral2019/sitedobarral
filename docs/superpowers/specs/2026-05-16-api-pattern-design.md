# Padrão API — Helper canônico para rotas Next.js (PR 4.1)

> **Status:** design aprovado, pendente implementação
> **Onda:** 4 — Padronização ([plano completo](../../plans/2026-05-saneamento.md))
> **Escopo:** documento de design. Zero código de implementação nesta PR.
> **Próximos passos:** PR 4.2 (codemod e migração de ~196 rotas em ~12 PRs subsequentes).

---

## 1. Contexto e problema

O repositório tem **278 rotas** em `app/api/**` distribuídas entre 4 padrões inconsistentes:

| Padrão | Rotas | Observação |
|---|---|---|
| `withAdminAuth`/`withAuth` **+** `handleApiError` | ~50 | Fase 8 completa, mas exige `try/catch` em cada handler |
| Só `withAdminAuth`/`withAuth` | ~52 | Vulneráveis a 500 cru — qualquer throw não tratado vaza para o cliente |
| Só `handleApiError` (rotas públicas) | ~26 | Sem rate limit, sem Sentry user |
| Legado puro: `NextResponse.json({error}, {status})` | ~150 | Maior fonte de inconsistência de formato |

### Problemas concretos observados

1. **Formato de resposta de erro inconsistente.** Middleware (`api-middleware.ts`) retorna `{error: "string"}` simples para 401/403/429; `handleApiError` retorna `{error, code, details, timestamp}`. Mesma rota emite formatos diferentes dependendo de onde o erro nasce.
2. **Strings hardcoded** no middleware ignoram as exception classes existentes (`AuthenticationError`, `AuthorizationError`, `RateLimitError`).
3. **Boilerplate `try/catch + handleApiError`** repetido em ~50 rotas. Esquecível — quando esquecido, vira o caso 2 (500 cru).
4. **Logger verboso** no middleware: 7 linhas de `apiLogger.error` por falha de auth.
5. **Sem correlation-id** entre logs/Sentry/cliente. Suporte não consegue rastrear "deu erro X" do usuário até o stack trace do Sentry.

### Auditoria pré-codemod

Grep em `app/api/**` confirma superfície limpa para migração:

| Chave em `NextResponse.json` | Ocorrências |
|---|---|
| `error` (em 4xx/5xx) | 187 |
| `message` | 4 (todas em **respostas de sucesso** — favorito/vídeo removido) |
| `erro`, `msg`, `detail`, `errors` | 0 |

**Implicação:** o codemod pode converter `NextResponse.json({error}, {status})` → `throw new XError()` sem casos especiais de schema. Risco de quebra de contrato para o frontend = **zero** (campo `error: string` preservado em todo formato unificado).

---

## 2. Solução proposta

Criar **3 helpers HOF** em `lib/api/handler.ts` que substituem o par `withAdminAuth/withAuth` + `try/catch + handleApiError`. Cada helper combina, internamente, auth + rate limit + Sentry user + `handleApiError` + telemetria por request.

```typescript
// Padrão único após migração
export const POST = withAdminApi(async (request, ctx) => {
  const body = await request.json();
  if (!body.slug) throw new ValidationError('slug obrigatório');
  // ... lógica do handler ...
  return NextResponse.json({ data });
});
```

---

## 3. Arquitetura e arquivos

### Novos arquivos

```
lib/api/
├── handler.ts          ← createApiHandler (interno) + 3 helpers públicos
├── types.ts            ← ApiContext, ApiHandler, ApiHandlerOptions
└── __tests__/
    └── handler.test.ts
```

`lib/api/` segue a convenção já usada em `lib/ai/` (módulos coesos com `index.ts` ou nome canônico).

### Arquivos modificados ou depreciados

- **`lib/api-middleware.ts`** — ganha `@deprecated` no topo durante a migração. Mantém re-exports para retrocompat (`export { withAdminApi as withAdminAuth }`). Removido na última PR da Onda 4, quando `grep -rl "api-middleware"` retornar 0 resultados.

### Arquivos NÃO tocados

- `lib/errors/api-error.ts`, `lib/errors/error-handler.ts` — helper consome `handleApiError` internamente
- `lib/cron-auth.ts` — cron permanece com helper próprio (header secret tem semântica diferente)
- `lib/auth.ts` — helper chama `getCurrentUser()`
- `lib/cache/rate-limit-helper.ts` — helper chama `enforceRateLimit()`

---

## 4. Assinatura pública e tipos

### `lib/api/types.ts`

```typescript
import type { NextRequest, NextResponse } from 'next/server';
import type { AuthPayload } from '@/lib/auth';
import type { Logger } from 'pino';

export type ApiRole = 'admin' | 'user' | 'public';

export interface ApiContext<Params = unknown> {
  user: AuthPayload;          // sempre presente em admin/user
  params: Params;             // já desempacotado (await aplicado pelo helper)
  requestId: string;          // 8 chars do uuid v4
  logger: Logger;             // apiLogger.child({ requestId, route, method, role })
}

export interface PublicApiContext<Params = unknown> {
  user: null;                 // explícito: rota pública não tem user
  params: Params;
  requestId: string;
  logger: Logger;
}

export type ApiHandler<Ctx, Params = unknown> = (
  request: NextRequest,
  context: Ctx & { params: Params }
) => Promise<NextResponse>;

export interface ApiHandlerOptions {
  rateLimit?: { max: number; windowSec: number };  // override de defaults
  telemetry?: boolean;        // default: true (correlation-id + breadcrumb Sentry)
}
```

### `lib/api/handler.ts` — superfície pública

```typescript
export function withAdminApi<P = unknown>(
  handler: ApiHandler<ApiContext<P>, P>,
  options?: ApiHandlerOptions
): (request: NextRequest, nextCtx: { params: Promise<P> }) => Promise<NextResponse>;

export function withUserApi<P = unknown>(
  handler: ApiHandler<ApiContext<P>, P>,
  options?: ApiHandlerOptions
): (request: NextRequest, nextCtx: { params: Promise<P> }) => Promise<NextResponse>;

export function withPublicApi<P = unknown>(
  handler: ApiHandler<PublicApiContext<P>, P>,
  options?: ApiHandlerOptions
): (request: NextRequest, nextCtx: { params: Promise<P> }) => Promise<NextResponse>;
```

### Defaults por helper

| Helper | Auth check | Rate limit padrão | Tipo de `ctx.user` |
|---|---|---|---|
| `withAdminApi` | `user.role === 'admin'` | 30/60s | `AuthPayload` (não-null) |
| `withUserApi` | `user != null` | 60/60s | `AuthPayload` (não-null) |
| `withPublicApi` | nenhum | 30/60s por IP | `null` (literal) |

### Decisões de tipagem

1. **`ctx.user` não-null em admin/user** — TypeScript narrowing automático. Elimina o cast feio atual: `(context!.user as { userId: string }).userId` → `ctx.user.userId`.
2. **`params` desempacotado** — Next.js 15 entrega `params: Promise<P>`. O helper aplica `await` uma vez e passa resolvido. Elimina `await ctx.params` repetido.
3. **`requestId` na request** — UUID v4 truncado para 8 chars (ex.: `a3f2b1c4`). Anexado ao log via `apiLogger.child()` e a Sentry como tag e breadcrumb. Também viaja no header de resposta `X-Request-Id`.

---

## 5. Fluxo interno (ordem de execução)

`createApiHandler(role, handler, options)` executa **6 estágios em ordem fixa** dentro de um único `try/catch`:

```
1. Gerar requestId (crypto.randomUUID().slice(0, 8))
2. Resolver params: await nextCtx.params

try {
  3. Rate limit
     - chave: `api:{role}:{ip}` (via getClientIp)
     - max/window: opts.rateLimit || defaults da role
     - falha → throw RateLimitError (sobe ao handleApiError)

  4. Auth (skip se role === 'public')
     - user = await getCurrentUser()
     - !user → throw AuthenticationError (401)
     - role === 'admin' && user.role !== 'admin'
          → throw AuthorizationError (403)
     - Sentry.setUser({ id, email, role })

  5. Telemetria (opcional, default ON)
     - Sentry.addBreadcrumb({ category: 'api', data: { method, path, requestId } })
     - Sentry.setTag('requestId', requestId)
     - logger = apiLogger.child({ requestId, route, method, role })

  6. response = await handler(request, { user, params, requestId, logger })
     - injeta header: response.headers.set('X-Request-Id', requestId)
     - return response

} catch (error) {
  - response = handleApiError(error)
  - injeta header: response.headers.set('X-Request-Id', requestId)
  - return response
}
```

### Por que essa ordem importa

- **Rate-limit antes de auth** — impede atacante de queimar Redis com tentativas de login. Comportamento já estabelecido hoje.
- **`Sentry.setUser` dentro do try, depois do auth** — se auth falhar, não vinculamos usuário (não há).
- **`handleApiError` faz `Sentry.captureException` só para 500+** — comportamento atual mantido. 401/403/404/409/429 logam como `warn`, não viram issue.
- **Header `X-Request-Id` em sucesso E em erro** — rastreabilidade trivial. Usuário relata "erro com requestId Y" → grep no Sentry.

---

## 6. Telemetria opcional

Default-ON; desligável via `options.telemetry: false` (não esperamos uso, mas mantém escape hatch).

### O que entra

1. **`requestId`** — sempre, mesmo com telemetria off. Header `X-Request-Id` + `ctx.requestId`.
2. **`ctx.logger`** — `apiLogger.child({ requestId, route, method, role })`. Handler usa `ctx.logger.info(...)` e todo log do request carrega requestId. **Importante:** não substitui `apiLogger` global; é uma instância filha com contexto.
3. **Breadcrumb Sentry** — `Sentry.addBreadcrumb({ category: 'api', message: '${method} ${route}', data: { requestId, role, userId } })`. Aparece automaticamente em qualquer issue capturado.
4. **Tag Sentry `requestId`** — indexada, busca rápida no painel.

### O que NÃO entra (YAGNI explícito)

- ❌ Métrica de duração (latência) — Vercel Analytics + Sentry Performance já cobrem
- ❌ Audit log persistido em DB — `AuditLog` model é decisão de produto separada
- ❌ Tracing OpenTelemetry — fora de escopo desta onda
- ❌ Log automático `info` no início/fim — Vercel já loga acessos; ruído extra

### Sobre `ctx.logger` (decisão tomada)

Helper expõe `ctx.logger` para que handlers logem com requestId automaticamente. Handler **legado** que importa `apiLogger` direto continua funcionando — apenas perde o requestId nesses logs específicos. **Codemod não força adoção de `ctx.logger`** (opt-in, sem deadline).

---

## 7. Estratégia de migração (regras do codemod)

> **Princípio de segurança:** o codemod só faz transformações mecânicas determinísticas. Tudo que exige julgamento (escolha de exception class, mudança de status code) vira **TODO comentado** para revisão humana — nunca decisão automática.

### Transformações automáticas (seguras)

**T1 — Trocar import + wrapper name**
```diff
- import { withAdminAuth } from '@/lib/api-middleware';
+ import { withAdminApi } from '@/lib/api/handler';
- export const GET = withAdminAuth(async (req) => { ... });
+ export const GET = withAdminApi(async (req, ctx) => { ... });
```
Idem para `withAuth` → `withUserApi`.

**T2 — Remover `try/catch + handleApiError` redundante**
```diff
- export const GET = withAdminAuth(async (req) => {
-   try {
-     const data = await prisma.x.findMany();
-     return NextResponse.json({ data });
-   } catch (error) {
-     return handleApiError(error);
-   }
- });
+ export const GET = withAdminApi(async (req, ctx) => {
+   const data = await prisma.x.findMany();
+   return NextResponse.json({ data });
+ });
```
**Regra precisa:** codemod só remove o try/catch se o **único** statement dentro do catch é `return handleApiError(error)` (ou variação trivial). Catches que fazem cleanup/log custom permanecem intocados.

**T3 — Resolver `await ctx.params`**
```diff
- export const GET = withAuth(async (req, { params }: { params: Promise<{ id: string }> }) => {
-   const { id } = await params;
+ export const GET = withUserApi<{ id: string }>(async (req, ctx) => {
+   const { id } = ctx.params;
```

**T4 — Limpar cast de `ctx.user`**
```diff
- const userId = (context!.user as { userId: string }).userId;
+ const userId = ctx.user.userId;
```

### Transformação semi-automática

**T5 — Substituir `NextResponse.json({error}, {status})` por `throw`**

Codemod **identifica** mas **não substitui** — insere comentário de sugestão:

```typescript
// CODEMOD-SUGGEST: throw new ValidationError('slug obrigatório')
if (!slug) {
  return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });
}
```

Razão de não automatizar: a escolha entre `ValidationError`/`NotFoundError`/`ConflictError`/`AuthorizationError` exige leitura semântica. Errar = mudar status code para o cliente.

**Mapa de referência** (humano aplica, codemod sugere baseado no status):

| Status | Exception sugerida |
|---|---|
| 400 | `ValidationError(message)` |
| 401 | `AuthenticationError(message)` ou remover (helper trata) |
| 403 | `AuthorizationError(message)` |
| 404 | `NotFoundError(resource)` |
| 409 | `ConflictError(message)` |
| 422 | `ValidationError(message, { issues })` |
| 429 | `RateLimitError(message, retryAfter)` |
| 500/503 | `InternalServerError` / `ServiceUnavailableError` |

### O que o codemod NÃO toca

- **Rotas em `app/api/cron/**`** — escopo separado (`lib/cron-auth.ts`)
- **Rotas em `app/api/**/webhook(s)/**`** — assinaturas criptográficas próprias (Stripe, Svix)
- **Handlers com `enforceRateLimit` interno** — provavelmente querem override; vira TODO manual
- **Handlers que retornam `Response` raw** (streaming, redirect bruto) — incompatível com formato unificado de erro; vira TODO manual
- **Catches que fazem mais que `handleApiError`** — preservar comportamento

### Ordem de migração (~12 PRs no total)

| Fase | PRs | Rotas/PR | Transformações | Risco |
|---|---|---|---|---|
| Fase 1 — Automáticas | 4.2.1 – 4.2.4 | **30** | T1+T2+T3+T4 | Mínimo — diff legível, comportamento idêntico |
| Fase 2 — Manuais | 4.2.5 – 4.2.12 | **10** | T1+T3+T4 automáticos + T5 humano | Médio — exige decisão por throw |

Total: ~120 rotas em 4 PRs grandes automáticas + ~80 rotas em 8 PRs menores manuais ≈ **~200 rotas em ~12 PRs**. A contagem exata de rotas a migrar (≈196) será firmada após auditoria final excluir cron (`app/api/cron/**`) e webhook (Stripe, Resend).

### Por que ordenar por risco e não por tipo (admin → user → public)

Objetivo das primeiras PRs é **validar o helper em produção**. T1+T2+T4 são troca mecânica — comportamento idêntico. Se Sentry continuar limpo após 3 PRs assim, o helper está validado. Aí T5 (que mudam status code/formato) podem ir com confiança. Mistura admin/user/public dentro das primeiras PRs é aceitável; coerência temática vale menos que confiança no helper.

### Métricas de progresso

Script `scripts/api-migration-status.ts` (criado junto ao helper) reporta:
- N rotas usando `lib/api-middleware` (deve ir a 0)
- N rotas usando `lib/api/handler` (deve subir até ~196)
- N rotas com `NextResponse.json({error}` em rotas já migradas (deve cair a 0)

Comparado entre PRs para medir avanço objetivamente.

---

## 8. Exemplos antes/depois

### Exemplo A — caso "automático puro" (T1+T2+T4)

**Antes** — `app/api/admin/pareceres/list/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { handleApiError } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/prisma';

export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const sp = request.nextUrl.searchParams;
    const filter = sp.get('filter') || 'irrelevantes';
    // ... 90 linhas de lógica ...
    return NextResponse.json({ items, total, page, pageSize, totalPages });
  } catch (error) {
    return handleApiError(error);
  }
});
```

**Depois**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';

export const GET = withAdminApi(async (request: NextRequest, ctx) => {
  const sp = request.nextUrl.searchParams;
  const filter = sp.get('filter') || 'irrelevantes';
  // ... 90 linhas de lógica ...
  return NextResponse.json({ items, total, page, pageSize, totalPages });
});
```

Diff: −4 linhas, −1 import, +1 import. **Codemod 100% automático.**

### Exemplo B — caso "manual T5" (legado puro)

**Antes** — `app/api/planejamento/admin/trails/route.ts` (POST):
```typescript
export const POST = withAdminAuth(async (request: NextRequest, context) => {
  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug : "";

  if (!slug) {
    return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });
  }
  const trail = getTrailBySlug(slug);
  if (!trail) {
    return NextResponse.json({ error: "trilha não encontrada" }, { status: 404 });
  }
  const validated = zTrailDefinition.safeParse(trail);
  if (!validated.success) {
    return NextResponse.json(
      { error: "trilha inválida", issues: validated.error.issues },
      { status: 422 },
    );
  }
  const userId = (context!.user as { userId: string }).userId;
  // ...
});
```

**Após codemod (T1+T3+T4 automáticos + sugestões T5)**:
```typescript
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError, NotFoundError } from '@/lib/errors/api-error';

export const POST = withAdminApi(async (request: NextRequest, ctx) => {
  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug : "";

  if (!slug) {
    // CODEMOD-SUGGEST: throw new ValidationError("slug obrigatório")
    return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });
  }
  // ... resto idêntico, com sugestões T5 inline ...
  const userId = ctx.user.userId;
});
```

**Após revisão humana**:
```typescript
export const POST = withAdminApi(async (request: NextRequest, ctx) => {
  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug : "";

  if (!slug) {
    throw new ValidationError("slug obrigatório");
  }
  const trail = getTrailBySlug(slug);
  if (!trail) {
    throw new NotFoundError("Trilha");
  }
  const validated = zTrailDefinition.safeParse(trail);
  if (!validated.success) {
    throw new ValidationError("trilha inválida", { issues: validated.error.issues });
  }
  const userId = ctx.user.userId;
  // ...
});
```

Diff: −5 linhas, +2 imports, mudança semântica controlada.

### Exemplo C — rota dinâmica com params (T3)

**Antes** — `app/api/admin/recommended-sites/[id]/route.ts` (DELETE):
```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const verification = await verifyAdmin(request);
  if (verification.error) return verification.response;

  try {
    const { id } = await params;
    await prisma.recommendedSite.delete({ where: { id } });
    return NextResponse.json({ message: 'Site removido com sucesso' });
  } catch (error) {
    return handleApiError(error);
  }
}
```

**Depois**:
```typescript
export const DELETE = withAdminApi<{ id: string }>(async (request, ctx) => {
  await prisma.recommendedSite.delete({ where: { id: ctx.params.id } });
  return NextResponse.json({ message: 'Site removido com sucesso' });
});
```

Diff: −8 linhas. `verifyAdmin`, `await params` e `try/catch` desaparecem. `ctx.params.id` tipado automaticamente.

---

## 9. Critérios de pronto

### Critério de pronto da **PR 4.1** (esta)

- ✅ Spec `docs/superpowers/specs/2026-05-16-api-pattern-design.md` commitado em `main`
- ✅ Zero código de implementação (helper, codemod, migração) — vem nas PRs seguintes
- ✅ Spec referenciado em `docs/plans/2026-05-saneamento.md` como blueprint da Onda 4

### Critério de pronto da **Onda 4 inteira**

- ✅ 0 importações de `lib/api-middleware` no repo (`grep -rl "api-middleware" app/ lib/`)
- ✅ 0 ocorrências de `NextResponse.json({error},` em `app/api/**` (exceto cron/webhook documentados)
- ✅ 196 rotas usando `withAdminApi`/`withUserApi`/`withPublicApi`
- ✅ Sentry mostra `X-Request-Id` correlacionado em ≥1 issue de produção (validação manual)
- ✅ Plano de saneamento marca Onda 4 como concluída

---

## 10. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Codemod transforma incorretamente uma rota crítica | Fase 1 (automática) só toca rotas com `try/catch + handleApiError` — diff inspeccionável. Smoke test manual nas 5 rotas de login/checkout/webhook **antes** de mergear cada PR |
| Frontend depende de schema exato `{error: string}` | Auditoria confirma: campo `error: string` preservado em todo formato unificado (187/187 rotas). Adição de `code`/`details`/`timestamp` é puramente aditiva |
| Throw dentro de handler sobe e Sentry captura algo que era `warn` | `handleApiError` distingue `isOperational` — exception class operacional vira `warn`, não `error`. Comportamento atual mantido |
| Rate limit nova lógica diverge da antiga | Defaults idênticos (30/60 admin, 60/60 user); override é opt-in. Comportamento padrão 100% preservado |
| Logger novo (`ctx.logger`) confunde quem importa `apiLogger` | `ctx.logger` é opcional — handler legado que usa `apiLogger` continua funcionando, só perde requestId em logs específicos |

---

## 11. Decisões registradas

Sumário das decisões tomadas durante o brainstorm (todas com o owner do site, sessão 2026-05-16):

| # | Decisão | Razão |
|---|---|---|
| 1 | Ambição: consolidação + padronização de erros + telemetria opcional | Aproveitar o codemod para resolver os 3 gaps de uma vez, alinhado com Onda 1 |
| 2 | Formato resposta unificado, sem feature flag | Auditoria mostra 187/187 já usam `error: string` — não há quebra real |
| 3 | Ergonomia HOF nomeada por role (`withAdminApi` etc.), não `defineApiRoute` config | Codemod fica mecânico (rename); leitura permanece familiar |
| 4 | Escopo: admin/user/public; cron e webhook **fora** | Cron tem `cron-auth.ts` próprio; webhook valida assinatura criptográfica — incompatível com helper |
| 5 | Rate limit: defaults atuais + override opcional via 2º arg | Preserva comportamento, abre porta para rotas que precisam limites custom |
| 6 | Wrapper monolítico interno (`createApiHandler`) — não pipeline declarativo | Stack traces limpos, tipagem TypeScript mais simples |
| 7 | `params` desempacotado pelo helper (não `Promise`) | Elimina `await ctx.params` repetido em rotas dinâmicas |
| 8 | `requestId` 8 chars, header `X-Request-Id` em toda resposta | Rastreabilidade trivial sem custo |
| 9 | `ctx.logger` exposto (não obrigatório) | Permite correlation de logs sem forçar refactor de handlers legados |
| 10 | Codemod NÃO substitui T5 automaticamente, só sugere via comentário | Escolha de exception class é semântica — risco de erro > ganho de velocidade |
| 11 | Ordem de migração por risco (T1+T2+T4 → T5), não por tipo de rota | Valida helper em produção antes de mudanças semânticas |
| 12 | 30 rotas/PR para automáticas, 10/PR para manuais | Equilibra revisão skim (automáticas) com leitura cuidadosa (manuais) |

---

## 12. Próximo passo

Esta PR fecha quando o spec é mergeado em `main`. As etapas seguintes:

- **PR 4.2.0** — implementação isolada do helper: `lib/api/handler.ts` + `lib/api/types.ts` + suíte de testes em `lib/api/__tests__/handler.test.ts`. Sem migrar nenhuma rota; helper coexiste com `lib/api-middleware.ts` deprecado. Garante que o código novo esteja em produção e validado **antes** das migrações.
- **PRs 4.2.1 a 4.2.4** — migração automática (T1+T2+T3+T4), até 30 rotas por PR.
- **PRs 4.2.5 a 4.2.12** — migração com transformação manual T5, até 10 rotas por PR.
- **PR 4.2.final** — remoção de `lib/api-middleware.ts` quando `grep -rl "api-middleware"` retornar 0.

Plano de implementação detalhado será produzido pela skill `writing-plans` numa sessão separada, usando este spec como insumo.
