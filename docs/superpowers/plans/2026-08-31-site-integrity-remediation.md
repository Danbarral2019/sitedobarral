# Site Integrity Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir as falhas de autorização e integridade identificadas na auditoria de 31 de agosto de 2026, reduzir riscos de dependências e implantação e estabelecer controles verificáveis para impedir regressões.

**Architecture:** A execução será feita em três ondas independentes. A Onda A contém correções urgentes e de baixo acoplamento, a Onda B trata endurecimento e observabilidade, e a Onda C cuida de banco, desempenho, SEO e documentação. Regras de acesso devem ser centralizadas nos helpers existentes, APIs administrativas devem usar `withAdminApi`, e nenhuma alteração de banco será combinada com o primeiro deploy de segurança.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 7, PostgreSQL/Neon, Vitest, Playwright, Upstash Redis, Vercel e GitHub Actions.

**Spec:** Auditoria técnica de 31 de agosto de 2026, incorporada na seção "Baseline e escopo" deste arquivo, e regras operacionais de `CLAUDE.md`.

## Global Constraints

- Não executar `npm audit fix --force`.
- Não executar `prisma db push`, `prisma migrate deploy` ou SQL contra produção durante as Ondas A e B.
- Não testar Stripe, e-mail, IA paga ou webhooks reais.
- Não imprimir nem copiar valores de `.env.local`, tokens, senhas ou chaves.
- Escrever primeiro o teste de regressão, confirmar a falha, implementar a menor correção e repetir o teste.
- Cada deploy deve ter rollback independente; a migração Prisma terá janela e plano próprios.
- O domínio canônico será lido de `NEXT_PUBLIC_BASE_URL`; nenhum domínio novo será fixado no código.
- Preservar o comportamento público atual, salvo quando ele for a própria falha de segurança.

## Baseline e escopo

- `npm run test:run`: 199 arquivos aprovados, 1 ignorado, 2.812 testes aprovados e 2 ignorados.
- `npx tsc --noEmit --incremental false`: código de saída 0.
- Lint do produto com `--quiet`: código de saída 0; lint global falha por arquivos auxiliares fora do produto.
- `npm run build`: código de saída 0, 304 páginas geradas, 71 avisos.
- `npm audit --omit=dev`: 33 vulnerabilidades, sendo 20 altas, 12 moderadas e 1 baixa.
- Navegador local: página inicial, Base de Conhecimento, Jurisprudência, Glossário e Login carregam sem erro; página inicial em 390 px não apresenta overflow horizontal.
- O escopo não inclui auditoria referencial dos dados de produção, pagamentos reais, contas reais ou carga.

## Ordem de entrega

1. Onda A, deploy de contenção: Tasks 1 a 3.
2. Onda B, deploy de endurecimento: Tasks 4 a 6.
3. Onda C, mudanças estruturais: Tasks 7 a 10.
4. Gate de publicação: Task 11.

---

### Task 1: Proteger todas as APIs administrativas descobertas sem guarda

**Files:**
- Modify: `app/api/admin/depoimentos/route.ts`
- Modify: `app/api/admin/analytics/document-analysis/route.ts`
- Modify: `app/api/admin/legislative-acts/import/template/route.ts`
- Create: `app/api/admin/depoimentos/__tests__/authorization.test.ts`
- Create: `app/api/admin/analytics/document-analysis/__tests__/authorization.test.ts`
- Create: `app/api/admin/legislative-acts/import/template/__tests__/authorization.test.ts`
- Modify: `middleware.ts`
- Create: `lib/middleware/__tests__/admin-api.test.ts`

**Interfaces:**
- Consumes: `withAdminApi<P>(handler, options?)` de `lib/api/handler.ts`.
- Produces: todas as rotas sob `app/api/admin/**/route.ts` com uma guarda reconhecida; rotas novas devem usar `withAdminApi`.

- [x] **Step 1: Escrever testes de autorização que falham no estado atual**

O teste de cada rota deve usar o wrapper real, mockar `getCurrentUser` como `null`, mockar `enforceRateLimit` como resolvido e confirmar que o Prisma não é chamado:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { findMany, count, getCurrentUser } = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { testimonial: { findMany, count } },
}));

import { GET } from '../route';

describe('GET /api/admin/depoimentos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(null);
  });

  it('nega acesso sem autenticação antes de consultar dados pessoais', async () => {
    const request = new NextRequest('http://localhost/api/admin/depoimentos');
    const response = await GET(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Executar os novos testes e confirmar a regressão**

Run: `npx vitest run app/api/admin/depoimentos/__tests__/authorization.test.ts app/api/admin/analytics/document-analysis/__tests__/authorization.test.ts`

Expected: FAIL porque os handlers atuais alcançam o Prisma sem autenticação.

- [x] **Step 3: Envolver cada método administrativo com `withAdminApi`**

Em `depoimentos/route.ts`, renomear os handlers atuais para `getTestimonials`, `createTestimonial`, `updateTestimonialStatus` e `deleteTestimonial`, sem alterar seus corpos. Depois, importar o wrapper e exportar os métodos protegidos:

```ts
import { withAdminApi } from '@/lib/api/handler';

export const GET = withAdminApi(getTestimonials);
export const POST = withAdminApi(createTestimonial);
export const PATCH = withAdminApi(updateTestimonialStatus);
export const DELETE = withAdminApi(deleteTestimonial);
```

Aplicar a mesma forma ao `GET` de `analytics/document-analysis` e ao `GET` do template de importação. O template permanecerá administrativo porque está sob `/api/admin`.

- [x] **Step 4: Adicionar defesa comportamental no middleware**

O teste `lib/middleware/__tests__/admin-api.test.ts` deve exercer requisições reais à função `middleware`: sem token retorna 401 em JSON, token inválido retorna 401, usuário autenticado sem papel administrativo retorna 403 e administrador prossegue. A implementação deve reconhecer `/api/admin` e `/api/admin/**` antes da lógica de páginas administrativas. Essa camada é defesa adicional; cada route handler continua obrigado a usar `withAdminApi`.

- [x] **Step 5: Executar testes e verificações da Task 1**

Run: `npx vitest run lib/middleware/__tests__/admin-api.test.ts app/api/admin/depoimentos/__tests__/authorization.test.ts app/api/admin/analytics/document-analysis/__tests__/authorization.test.ts app/api/admin/legislative-acts/import/template/__tests__/authorization.test.ts`

Expected: PASS, com 401 sem usuário, 403 para usuário não administrador e nenhuma consulta ao Prisma antes da autorização nos handlers.

Run: `npx eslint app/api/admin/depoimentos app/api/admin/analytics/document-analysis app/api/admin/legislative-acts/import/template lib/middleware/__tests__/admin-api.test.ts middleware.ts`

Expected: código de saída 0.

- [x] **Step 6: Commit da contenção administrativa**

```bash
git add app/api/admin/depoimentos app/api/admin/analytics/document-analysis app/api/admin/legislative-acts/import/template lib/middleware/__tests__/admin-api.test.ts middleware.ts docs/superpowers/plans/2026-08-31-site-integrity-remediation.md
git commit -m "fix: protect all administrative api routes"
```

---

### Task 2: Unificar validade de matrícula e acesso a documentos

**Files:**
- Modify: `app/api/area-restrita/lessons/[lessonId]/route.ts`
- Modify: `app/api/area-restrita/courses/[courseId]/modules/route.ts`
- Modify: `app/api/area-restrita/courses/[courseId]/progress/route.ts`
- Modify: `app/api/documents/[id]/download/route.ts`
- Create: `app/api/area-restrita/lessons/[lessonId]/__tests__/access.test.ts`
- Create: `app/api/area-restrita/courses/[courseId]/modules/__tests__/access.test.ts`
- Create: `app/api/area-restrita/courses/[courseId]/progress/__tests__/access.test.ts`
- Create: `app/api/documents/[id]/download/__tests__/access.test.ts`

**Interfaces:**
- Consumes: `hasAccessToCourse(courseId): Promise<boolean>` e `hasAccessToDocument(doc): Promise<boolean>` de `lib/auth.ts`.
- Produces: a mesma decisão de autorização para tela, API e download; matrícula vencida nunca autoriza conteúdo.

- [x] **Step 1: Escrever testes para matrícula vencida e acesso por assinatura**

Cada rota de curso deve cobrir três casos: matrícula vencida retorna 403, matrícula vitalícia retorna 200 e assinatura Premium ativa retorna 200. O teste do download deve cobrir documento `isCommon: true` com `courseId` de origem diferente do curso do usuário.

```ts
it('permite documento comum a usuário com qualquer acesso ativo', async () => {
  hasAccessToDocument.mockResolvedValue(true);
  documentFindUnique.mockResolvedValue({
    id: 'doc-common',
    title: 'Documento comum',
    url: 'https://example.com/doc.pdf',
    isPublic: false,
    isCommon: true,
    courseId: 'curso-origem',
    metaDou: null,
  });

  const response = await GET(makeAuthenticatedRequest(), {
    params: Promise.resolve({ id: 'doc-common' }),
  });

  expect(response.status).toBe(307);
  expect(hasAccessToDocument).toHaveBeenCalledWith(expect.objectContaining({
    isPublic: false,
    isCommon: true,
    courseId: 'curso-origem',
  }));
});
```

- [x] **Step 2: Executar os quatro arquivos de teste e confirmar falhas**

Run: `npx vitest run app/api/area-restrita/lessons/[lessonId]/__tests__/access.test.ts app/api/area-restrita/courses/[courseId]/modules/__tests__/access.test.ts app/api/area-restrita/courses/[courseId]/progress/__tests__/access.test.ts app/api/documents/[id]/download/__tests__/access.test.ts`

Expected: FAIL para matrícula vencida e para documento comum com `courseId` de origem.

- [x] **Step 3: Substituir consultas locais por `hasAccessToCourse`**

Nas três rotas de curso, manter o bypass administrativo e substituir a consulta simples a `enrollment.findFirst` por:

```ts
if (user.role !== 'admin') {
  const hasCourseAccess = await hasAccessToCourse(courseId);
  if (!hasCourseAccess) {
    throw new AuthorizationError('Acesso expirado ou inexistente para este curso.');
  }
}
```

Isso preserva acesso por matrícula válida, assinatura Básico vinculada e assinatura Premium.

- [x] **Step 4: Fazer o download consumir `hasAccessToDocument`**

Depois de autenticar o token e localizar o usuário, remover `enrollmentWhere`, a seleção local da matrícula e `checkAccessStatus`. Autorizar com o helper central:

```ts
const canDownload = await hasAccessToDocument({
  isPublic: document.isPublic,
  isCommon: document.isCommon,
  courseId: document.courseId,
});

if (!canDownload) {
  throw new AuthorizationError('Você não possui acesso a este documento.');
}
```

Preservar o log de acesso e permitir `courseId: null` em telemetria sem coerção `as string`.

- [x] **Step 5: Executar testes de acesso e suíte de autenticação**

Run: `npx vitest run lib/__tests__/auth.test.ts lib/__tests__/document-access.test.ts lib/__tests__/enrollment-utils.test.ts app/api/area-restrita/lessons/[lessonId]/__tests__/access.test.ts app/api/area-restrita/courses/[courseId]/modules/__tests__/access.test.ts app/api/area-restrita/courses/[courseId]/progress/__tests__/access.test.ts app/api/documents/[id]/download/__tests__/access.test.ts`

Expected: PASS.

- [x] **Step 6: Commit da autorização centralizada**

```bash
git add app/api/area-restrita app/api/documents/[id]/download
git commit -m "fix: centralize course and document access checks"
```

---

### Task 3: Atualizar dependências corrigíveis e conter o risco de planilhas

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `lib/excel-processor.ts`
- Modify: `app/api/admin/analyze-tcu-file/route.ts`
- Modify: `app/api/admin/convert-tcu/route.ts`
- Modify: `app/api/admin/tcu-manager/validate/route.ts`
- Modify: `app/api/admin/tcu-manager/convert/route.ts`
- Modify: `app/api/admin/import-excel/validate/route.ts`
- Modify: `app/api/admin/import-excel/import/route.ts`
- Create: `lib/__tests__/excel-processor-security.test.ts`
- Create: `app/api/admin/__tests__/workbook-upload-validation.test.ts`
- Create: `docs/security/dependency-exceptions.md`

**Interfaces:**
- Consumes: formato atual dos uploads administrativos de `.xlsx` e `.xls`.
- Produces: Next.js corrigido, lockfile reproduzível e limites explícitos para arquivos processados por `xlsx` enquanto a substituição é validada.

- [x] **Step 1: Atualizar Next.js dentro da linha 15.5 e aplicar correções não disruptivas**

Run: `npm install next@15.5.25`

Expected: `package.json` fixa `next` em `15.5.25`; nenhuma atualização major ou correção automática adicional é introduzida.

- [x] **Step 2: Registrar baseline do audit após a atualização**

Run: `npm audit --omit=dev`

Expected: os advisories corrigidos por Next.js 15.5.25 deixam de aparecer. Registrar em `docs/security/dependency-exceptions.md` somente vulnerabilidades remanescentes, pacote, superfície usada, mitigação e data de revisão.

- [x] **Step 3: Escrever testes de contenção para planilhas**

Os testes devem rejeitar arquivos acima de 5 MiB, extensões diferentes de `.xlsx` e `.xls`, MIME incompatível e workbooks acima de 25 abas ou 100.000 células somadas.

```ts
expect(() => validateWorkbookUpload({
  filename: 'entrada.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  size: 5 * 1024 * 1024 + 1,
})).toThrow('A planilha excede o limite de 5 MiB.');
```

- [x] **Step 4: Implementar validação única antes de `XLSX.read`**

Exportar de `lib/excel-processor.ts`:

```ts
export const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;
export const MAX_WORKBOOK_SHEETS = 25;
export const MAX_WORKBOOK_CELLS = 100_000;

export function validateWorkbookUpload(input: {
  filename: string;
  mimeType: string;
  size: number;
}): void;

export function validateWorkbookShape(workbook: XLSX.WorkBook): void;
```

As quatro rotas TCU e as duas rotas `import-excel` descobertas no inventário devem validar o upload antes de `arrayBuffer()`. As rotas TCU chamam também a validação dimensional logo após `XLSX.read`; as rotas `import-excel` recebem essa proteção dentro de `processExcelFile`. Scripts locais permanecem fora da superfície HTTP, mas devem ser listados na exceção documental.

- [x] **Step 5: Abrir mudança separada para retirar `xlsx`**

A decisão é objetiva: se todos os fixtures atuais forem lidos e escritos por `exceljs`, substituir `xlsx` por `exceljs`; se houver fixture `.xls` incompatível, manter o parser legado apenas em script administrativo offline e fazer as APIs aceitarem exclusivamente `.xlsx`. A aprovação exige testes de equivalência com todos os fixtures existentes e `npm audit` sem o advisory de `xlsx` na aplicação web.

- [x] **Step 6: Executar gate da Onda A**

Run: `npm run test:run`

Run: `npx tsc --noEmit --incremental false`

Run: `npx eslint app components hooks lib types middleware.ts instrumentation.ts instrumentation-client.ts next.config.ts --quiet`

Run: `npm run build`

Expected: todos os comandos com código de saída 0.

- [x] **Step 7: Commit de dependências e contenção**

```bash
git add package.json package-lock.json lib/excel-processor.ts app/api/admin docs/security/dependency-exceptions.md
git commit -m "fix: update framework and constrain spreadsheet imports"
```

---

### Task 4: Fazer controles de cron, rate limit e quota falharem conforme a criticidade

**Files:**
- Modify: `lib/cache/redis-client.ts`
- Modify: `lib/cache/rate-limit-helper.ts`
- Modify: `lib/cache/ai-quota.ts`
- Modify: `lib/cron-telemetry.ts`
- Modify: cron routes que usam `withCronRoute`
- Modify: `lib/cache/__tests__/redis-client.test.ts`
- Modify: `lib/cache/__tests__/ai-quota.test.ts`
- Modify: `lib/__tests__/cron-telemetry.test.ts`

**Interfaces:**
- Produces: `FailureMode = 'open' | 'closed'`; endpoints de autenticação, administração e IA usarão `closed`; cache de conteúdo não sensível poderá usar `open`.
- Consumes: `verifyCronAuth(request)` de `lib/cron-auth.ts`.

- [x] **Step 1: Escrever testes de indisponibilidade de Redis e ausência de segredo**

```ts
it('bloqueia rota sensível quando Redis está indisponível', async () => {
  const result = await checkRateLimit('login:ip', 5, 60, { failureMode: 'closed' });
  expect(result.allowed).toBe(false);
});

it('retorna erro de configuração quando CRON_SECRET não existe', async () => {
  delete process.env.CRON_SECRET;
  const response = await wrappedCron(new NextRequest('http://localhost/api/cron/x'));
  expect(response.status).toBe(500);
});
```

- [x] **Step 2: Estender as interfaces sem mudar o padrão de cache comum**

```ts
export type FailureMode = 'open' | 'closed';

export async function checkRateLimit(
  identifier: string,
  limit = 10,
  window = 60,
  options: { failureMode?: FailureMode } = {},
): Promise<RateLimitResult>;
```

No helper, `failureMode: 'closed'` deve converter Redis ausente ou erro em `allowed: false`; o padrão permanece `open` para não derrubar leituras públicas durante a migração.

- [x] **Step 3: Aplicar modo fechado às superfícies sensíveis**

Atualizar `enforceRateLimit` para receber o mesmo `options`. Usar `failureMode: 'closed'` em login, redefinição de senha, wrappers administrativos e rotas públicas de IA. O kill switch global de IA deve retornar `degrade-search` quando o contador não puder ser incrementado.

- [x] **Step 4: Substituir autenticação opcional do cron pelo helper central**

Dentro de `withCronRoute`, chamar `verifyCronAuth(req)` antes do handler. Remover o bloco que ignora autenticação quando `CRON_SECRET` não existe.

- [x] **Step 5: Executar testes focalizados**

Run: `npx vitest run lib/cache/__tests__/redis-client.test.ts lib/cache/__tests__/redis-client-disabled.test.ts lib/cache/__tests__/ai-quota.test.ts lib/__tests__/cron-telemetry.test.ts`

Expected: PASS; falhas de infraestrutura não liberam endpoints sensíveis.

- [x] **Step 6: Commit do endurecimento de infraestrutura**

```bash
git add lib/cache lib/cron-telemetry.ts lib/__tests__/cron-telemetry.test.ts app/api
git commit -m "fix: fail closed on sensitive infrastructure controls"
```

---

### Task 5: Validar buscas e proteger conversas públicas de IA

**Files:**
- Modify: `data/lei-14133-artigos.ts`
- Modify: `lib/search-utils.ts`
- Modify: `app/api/artigos/[numero]/chat/route.ts`
- Modify: `app/api/lei-14133/search/route.ts`
- Modify: `app/api/busca-integrada/route.ts`
- Create: `lib/search/escape-regexp.ts`
- Create: `lib/search/__tests__/escape-regexp.test.ts`
- Create: `app/api/artigos/[numero]/chat/__tests__/validation.test.ts`
- Create: `app/api/lei-14133/search/__tests__/validation.test.ts`

**Interfaces:**
- Produces: `escapeRegExp(value: string): string`; perguntas limitadas a 1.000 caracteres; consultas de busca limitadas a 300 caracteres; chat público usa somente `Document.isPublic = true`.

- [x] **Step 1: Criar testes para metacaracteres e entradas longas**

```ts
it.each(['(', '[', 'a+b', '.*', '\\'])('trata %s como texto literal', (query) => {
  expect(() => searchLeiArticlesWithExcerpts(query)).not.toThrow();
});

it('rejeita pergunta acima de 1.000 caracteres', async () => {
  const response = await POST(makeRequest({ question: 'a'.repeat(1001) }), makeContext('75'));
  expect(response.status).toBe(400);
});
```

- [x] **Step 2: Implementar escape compartilhado**

```ts
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

Usar `escapeRegExp` em todos os `new RegExp` que recebem `searchTerm` ou `normalizedTerm`.

- [x] **Step 3: Adotar Zod nas três APIs públicas**

```ts
const ChatBodySchema = z.object({
  question: z.string().trim().min(1).max(1000),
  conversationId: z.string().uuid().optional(),
});

const AiSearchBodySchema = z.object({
  query: z.string().trim().min(3).max(300),
});
```

Para `/api/busca-integrada`, validar `q` com comprimento entre 2 e 300 e aplicar rate limit antes de `hybridSearch`.

- [x] **Step 4: Impedir uso público de resumos privados**

Nas duas consultas de documentos de `artigos/[numero]/chat`, substituir o bloco `OR: [{ isPublic: true }, { summary: { not: null } }]` por `isPublic: true`. O resumo privado não deve entrar no prompt nem nas fontes retornadas.

- [x] **Step 5: Proteger histórico por token assinado**

Criar token JWT de curta duração com `conversationId` no `sub`, `audience: 'article-chat'` e expiração de 24 horas, usando `JWT_SECRET`. POST retorna `conversationToken`; follow-up e GET exigem token válido cujo `sub` coincida com o `conversationId`. ID isolado deixa de ser credencial suficiente.

- [x] **Step 6: Executar testes de busca, chat e quota**

Run: `npx vitest run lib/__tests__/search-utils.test.ts lib/search/__tests__/escape-regexp.test.ts app/api/artigos/[numero]/chat/__tests__ app/api/lei-14133/search/__tests__`

Expected: PASS, sem chamada de IA nos casos inválidos.

- [x] **Step 7: Commit da proteção de entradas e conversas**

```bash
git add data/lei-14133-artigos.ts lib/search-utils.ts lib/search app/api/artigos/[numero]/chat app/api/lei-14133/search app/api/busca-integrada
git commit -m "fix: validate public search and ai conversation inputs"
```

---

### Task 6: Corrigir SEO, domínio canônico e apresentação dos resumos

**Files:**
- Create: `lib/site-url.ts`
- Create: `lib/__tests__/site-url.test.ts`
- Modify: `app/layout.tsx`
- Modify: `app/(acervo)/base-conhecimento/page.tsx`
- Modify: `app/(acervo)/jurisprudencia/page.tsx`
- Modify: `app/artigo/[numero]/layout.tsx`
- Modify: `app/robots.ts`
- Modify: `app/(acervo)/blog/[slug]/page.tsx`
- Modify: `app/artigos/layout.tsx`
- Modify: `app/(acervo)/publicacoes/page.tsx`
- Modify: `app/(acervo)/blog/page.tsx`
- Modify: `app/cursos/[slug]/page.tsx`
- Modify: `app/cursos/page.tsx`
- Modify: `app/contato/layout.tsx`
- Modify: `app/sobre/page.tsx`
- Modify: `app/sitemap.ts`
- Modify: `app/sitemap-artigos.xml/route.ts`
- Modify: `app/certificado/[numero]/page.tsx`
- Modify: `app/privacidade/page.tsx`
- Modify: `app/novidades/page.tsx`
- Modify: `app/api/export-pdf/route.ts`
- Modify: `app/api/pagamento/webhook/route.ts`
- Modify: `app/__tests__/portal-route.test.ts`
- Modify: `components/HomeNovidadesSection.tsx`

**Interfaces:**
- Produces: `getSiteUrl(): URL`, derivada de `NEXT_PUBLIC_BASE_URL`; títulos filhos sem sufixo duplicado; resumo de blog convertido em texto simples.

- [ ] **Step 1: Confirmar o valor canônico no ambiente da Vercel**

O proprietário define `NEXT_PUBLIC_BASE_URL` com o domínio público definitivo. O código não escolhe entre os domínios históricos; apenas valida que o valor é URL HTTPS em produção.

- [ ] **Step 2: Escrever testes do helper de URL**

```ts
it('normaliza a origem como URL absoluta', () => {
  vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://www.exemplo.com/');
  expect(getSiteUrl().toString()).toBe('https://www.exemplo.com/');
});

it('rejeita protocolo não HTTPS em produção', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'http://www.exemplo.com');
  expect(() => getSiteUrl()).toThrow('NEXT_PUBLIC_BASE_URL deve usar HTTPS em produção.');
});
```

- [ ] **Step 3: Definir `metadataBase` e remover sufixos duplicados**

```ts
export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    template: '%s | Prof. Daniel Barral',
    default: 'Prof. Daniel Barral - Especialista em Licitações e Contratos',
  },
};
```

Títulos filhos passam a conter somente `Base de Conhecimento`, `Jurisprudência sobre Licitações e Contratos` e equivalentes. URLs absolutas de Open Graph, canonical, sitemap e robots devem usar `getSiteUrl()`.

- [ ] **Step 4: Normalizar o resumo do blog na home**

Adicionar uma função pura que retire heading, links, ênfase e espaços repetidos antes do truncamento:

```ts
export function markdownToPlainExcerpt(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 5: Verificar metadados e navegador**

Run: `npm run build`

Expected: nenhum aviso de `metadataBase` e nenhum título com `| Prof. Daniel Barral | Prof. Daniel Barral`.

Run: `npx --yes --package @playwright/cli playwright-cli -s=seo open http://localhost:3000 && npx --yes --package @playwright/cli playwright-cli -s=seo snapshot && npx --yes --package @playwright/cli playwright-cli -s=seo close`

Expected: home com resumo sem `## Resumo`.

- [ ] **Step 6: Commit de SEO e apresentação**

```bash
git add lib/site-url.ts lib/__tests__/site-url.test.ts app components/HomeNovidadesSection.tsx
git commit -m "fix: unify canonical urls and page metadata"
```

---

### Task 7: Tornar lint e cobertura sinais confiáveis no CI

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `.github/workflows/test.yml`
- Modify: `vitest.config.ts`
- Modify: arquivos do produto responsáveis pelos 71 avisos

**Interfaces:**
- Produces: `npm run lint` com código de saída 0; cobertura mede `app/api` e `lib`, não apenas arquivos importados.

- [ ] **Step 1: Excluir ferramentas e artefatos do lint global**

Acrescentar ao bloco global de `ignores`:

```js
".claude/**",
".superpowers/**",
"coverage/**",
"docs/**",
```

- [ ] **Step 2: Corrigir os avisos do produto por lotes**

Remover imports e variáveis não usados; corrigir a dependência `SNAPSHOT_TTL_MS` do hook em `app/area-restrita/page.tsx`; substituir o `<img>` do certificado por `next/image` somente se o comportamento de impressão continuar idêntico.

- [ ] **Step 3: Tornar lint obrigatório no CI**

Remover `continue-on-error: true` do passo `Run linter` em `.github/workflows/test.yml`.

- [ ] **Step 4: Medir cobertura real**

```ts
coverage: {
  include: ['lib/**/*.{ts,tsx}', 'app/api/**/*.{ts,tsx}'],
  exclude: ['**/*.d.ts', '**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
  thresholds: {
    lines: 20,
    functions: 15,
    branches: 15,
    statements: 20,
  },
}
```

Os thresholds iniciais refletem o denominador real e devem subir, nunca descer, em incrementos de pelo menos 1 ponto após cada lote de testes.

- [ ] **Step 5: Executar gates locais**

Run: `npm run lint`

Run: `npm run test:coverage`

Expected: ambos com código de saída 0; relatório inclui arquivos antes ausentes.

- [ ] **Step 6: Commit dos gates de qualidade**

```bash
git add eslint.config.mjs .github/workflows/test.yml vitest.config.ts app components lib
git commit -m "ci: enforce product lint and honest coverage"
```

---

### Task 8: Adicionar testes E2E dos fluxos de maior risco

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/public-smoke.spec.ts`
- Create: `e2e/admin-authorization.spec.ts`
- Create: `e2e/course-expiration.spec.ts`
- Create: `e2e/document-download.spec.ts`
- Create: `e2e/fixtures/database.ts`
- Create: `scripts/e2e-seed.ts`
- Modify: `package.json`
- Modify: `.github/workflows/test.yml`

**Interfaces:**
- Produces: scripts `test:e2e` e `test:e2e:smoke`; nenhum teste usa produção ou credenciais reais.

- [ ] **Step 1: Configurar servidor e navegador**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 2: Criar smoke público**

Verificar `/`, `/base-conhecimento`, `/jurisprudencia`, `/glossario` e `/login`: status sem erro, heading principal visível, ausência de overlay do Next.js e ausência de erro de console.

- [ ] **Step 3: Criar cenários de autorização com banco isolado**

O CI deve usar um banco Neon de teste descartável. Seeds criam um admin, um aluno ativo, um aluno expirado, um documento comum e um documento privado. Os testes confirmam 401 em `/api/admin/depoimentos`, 403 para aluno expirado e sucesso para documento comum com acesso ativo.

- [ ] **Step 4: Adicionar scripts**

```json
{
  "test:e2e": "playwright test",
  "test:e2e:smoke": "playwright test e2e/public-smoke.spec.ts"
}
```

- [ ] **Step 5: Integrar primeiro o smoke ao CI**

Executar `test:e2e:smoke` em todo pull request. Executar os cenários com banco apenas quando `TEST_DATABASE_URL` estiver configurada, falhando explicitamente no branch principal se a variável estiver ausente.

- [ ] **Step 6: Commit dos testes E2E**

```bash
git add playwright.config.ts e2e package.json package-lock.json .github/workflows/test.yml
git commit -m "test: add browser coverage for critical access flows"
```

---

### Task 9: Adotar Prisma Migrate com baseline controlada

**Files:**
- Create: `docs/database/migration-runbook.md`
- Create: `prisma/migrations/0_init/migration.sql`
- Modify: `package.json`
- Modify: deployment configuration if it overrides `vercel-build`

**Interfaces:**
- Produces: deploy executa `prisma migrate deploy`; schema atual de produção é marcado como baseline sem reaplicar tabelas existentes.

- [ ] **Step 1: Congelar mudanças de schema durante a baseline**

Registrar no runbook a janela, responsável, backup Neon, branch de staging, consultas de verificação e rollback. Nenhuma outra alteração de `schema.prisma` entra na mesma janela.

- [ ] **Step 2: Gerar a migration inicial a partir do schema**

Run: `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output prisma/migrations/0_init/migration.sql`

Expected: arquivo SQL cria a estrutura completa e não contém `DROP DATABASE`, `DROP SCHEMA` ou instrução dirigida a banco existente.

- [ ] **Step 3: Comparar staging com o schema sem escrever**

Run: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`

Expected: código 0 quando o banco de staging está sincronizado; código 2 significa deriva e interrompe a janela.

- [ ] **Step 4: Marcar baseline somente após backup e ensaio em staging**

Run em staging: `npx prisma migrate resolve --applied 0_init`

Run em staging: `npx prisma migrate status`

Expected: baseline aplicada e nenhuma migration pendente. Repetir em produção somente com aprovação expressa e backup confirmado.

- [ ] **Step 5: Trocar o comando de deploy**

```json
{
  "vercel-build": "NODE_OPTIONS=--max-old-space-size=7168 sh -c 'prisma generate && prisma migrate deploy && next build'"
}
```

- [ ] **Step 6: Ensaiar rollback operacional**

Como Prisma Migrate não faz rollback automático de dados, o runbook deve definir: interromper deploy, restaurar branch/backup Neon, voltar ao build anterior e somente depois reabrir tráfego.

- [ ] **Step 7: Commit da baseline**

```bash
git add docs/database/migration-runbook.md prisma/migrations/0_init/migration.sql package.json
git commit -m "chore: baseline database migrations for deploy"
```

---

### Task 10: Reduzir carga inicial e documentar operação

**Files:**
- Modify: `app/(acervo)/glossario/page.tsx`
- Modify: `app/api/glossary/route.ts`
- Modify: componentes do glossário identificados pelo bundle analyzer
- Modify: `README.md`
- Modify: `.env.example`
- Create: `docs/operations/deploy-checklist.md`

**Interfaces:**
- Produces: glossário paginado com `page`, `pageSize`, `letter` e `category`; README operacional; orçamento de First Load JS.

- [ ] **Step 1: Registrar baseline com bundle analyzer**

Adicionar `@next/bundle-analyzer` apenas como dependência de desenvolvimento e script `analyze`. Registrar no PR os valores atuais: compartilhado 185 kB e `/glossario` 433 kB.

- [ ] **Step 2: Paginar o glossário no servidor**

`GET /api/glossary` deve aceitar `pageSize` máximo 30 e retornar `{ terms, categories, pagination }`. Busca, letra e categoria devem ser aplicadas no banco antes de `take` e `skip`.

- [ ] **Step 3: Atualizar a interface sem carregar 95 registros de uma vez**

A página começa com 30 termos, solicita página seguinte por botão “Carregar mais” e reinicia a paginação ao mudar busca, letra ou categoria. Não implementar rolagem infinita.

- [ ] **Step 4: Definir orçamento de bundle**

Critério da task: `/glossario` abaixo de 300 kB de First Load JS e nenhuma rota pública nova acima de 300 kB. Rotas administrativas com editores pesados devem usar `dynamic()` para carregar o editor somente quando a área correspondente for aberta.

- [ ] **Step 5: Substituir o README padrão**

Documentar arquitetura, pré-requisitos, comandos, variáveis apenas por nome, banco, autenticação, Stripe, Redis, IA, crons, testes, deploy, rollback, política de migrations e links para os runbooks. `.env.example` deve conter placeholders, nunca valores reais.

- [ ] **Step 6: Verificar desempenho e documentação**

Run: `npm run build`

Expected: `/glossario` abaixo de 300 kB e build com código 0.

Run: `npm run test:e2e:smoke`

Expected: PASS em desktop e viewport móvel de 390 px.

- [ ] **Step 7: Commit de desempenho e operação**

```bash
git add 'app/(acervo)/glossario' app/api/glossary components package.json package-lock.json README.md .env.example docs/operations/deploy-checklist.md
git commit -m "perf: paginate glossary and document operations"
```

---

### Task 11: Gate final e publicação progressiva

**Files:**
- Modify: `docs/operations/deploy-checklist.md`
- Modify: `docs/security/dependency-exceptions.md`

**Interfaces:**
- Consumes: entregas das Tasks 1 a 10.
- Produces: evidência reproduzível de liberação ou decisão explícita de não publicar.

- [ ] **Step 1: Executar a verificação completa**

Run: `npm ci`

Run: `npx prisma generate`

Run: `npm run lint`

Run: `npx tsc --noEmit --incremental false`

Run: `npm run test:run`

Run: `npm run test:coverage`

Run: `npm run build`

Run: `npm run test:e2e:smoke`

Expected: todos os comandos com código de saída 0. Qualquer falha interrompe a publicação.

- [ ] **Step 2: Confirmar invariantes de segurança**

- Requisição não autenticada a toda rota `/api/admin/**` retorna 401.
- Usuário não administrador autenticado recebe 403 em toda rota `/api/admin/**`.
- Matrícula expirada não recebe aula, módulo, progresso nem download.
- Documento comum é baixável por qualquer usuário com acesso ativo.
- Redis ausente bloqueia IA e autenticação sensível sem chamar provedor pago.
- Cron sem `CRON_SECRET` retorna erro de configuração.
- Nenhum resumo de documento privado entra no chat público.

- [ ] **Step 3: Publicar primeiro em preview/staging**

Executar smoke, autorização e download contra o preview com dados sintéticos. Não usar contas ou documentos reais. Manter observação de erros, latência, 401, 403, 429 e custo de IA por pelo menos 30 minutos.

- [ ] **Step 4: Publicar a Onda A isoladamente**

O primeiro deploy contém apenas Tasks 1 a 3. Se houver aumento inesperado de 401/403 ou falha de download, reverter ao deployment anterior e preservar logs para diagnóstico.

- [ ] **Step 5: Publicar Ondas B e C em janelas distintas**

Tasks 4 a 8 formam o segundo deploy. Task 9 tem janela própria de banco. Task 10 só entra depois que os fluxos críticos estiverem estáveis.

- [ ] **Step 6: Registrar resultado final**

No checklist, registrar commit, deployment, horário, executor, comandos, contagens de testes, vulnerabilidades remanescentes, métricas de bundle, resultado dos smokes e eventual rollback.

---

## Critérios globais de conclusão

- Nenhuma API administrativa sem guarda reconhecida; novas APIs usam obrigatoriamente `withAdminApi`.
- Regra única de acesso aplicada à visualização e ao download.
- Nenhum acesso de matrícula vencida por chamada direta à API.
- Next.js fora das faixas corrigidas pelo audit vigente na data do deploy.
- Risco de `xlsx` eliminado da aplicação web ou formalmente isolado com limites e exceção temporária.
- `prisma db push` removido do deploy somente depois da baseline aprovada.
- `npm run lint`, tipagem, testes, cobertura, build e smoke E2E bloqueiam o CI quando falham.
- Domínio canônico único, `metadataBase` definido e títulos sem duplicação.
- `/glossario` abaixo de 300 kB de First Load JS.
- README e runbooks permitem operação e rollback sem depender de conhecimento tácito.

## Auto-revisão do plano

- Cobertura da auditoria: autorização administrativa, matrículas, downloads, dependências, Redis, cron, IA pública, regex, SEO, CI, cobertura, E2E, Prisma, desempenho e documentação possuem task própria.
- Dependências entre tasks: Tasks 1 e 2 não dependem de banco novo; Task 9 fica isolada; Task 11 consome todas as entregas.
- Consistência de tipos: `withAdminApi`, `hasAccessToCourse`, `hasAccessToDocument`, `FailureMode`, `escapeRegExp` e `getSiteUrl` têm assinatura única e uso declarado.
- Não há alteração de produção, segredo, pagamento real ou chamada paga prevista nos testes.
