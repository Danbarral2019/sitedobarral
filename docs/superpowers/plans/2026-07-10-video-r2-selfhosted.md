# Vídeo auto-hospedado no R2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que videoaulas do LMS sejam hospedadas de forma privada no Cloudflare R2, protegidas por matrícula, com upload direto do navegador e playback via URL assinada com expiração.

**Architecture:** Modelo híbrido — `CourseVideo` é o asset mestre e ganha `storageType` (`youtube`|`r2`). Upload direto do navegador pro R2 via presigned PUT (nunca pela função serverless). Playback só entrega uma URL assinada (`getSignedR2Url`, GET, 2h) depois de checar enrollment/subscription. Player `<video>` HTML5 progressivo (sem HLS/transcodificação no MVP).

**Tech Stack:** Next.js 15.5 (App Router) · React 19 · TypeScript · Prisma 7 (PrismaNeon) · Cloudflare R2 (`@aws-sdk/client-s3`, já instalado) · Vitest · handlers `withAdminApi`/`withUserApi`.

**Spec:** `docs/superpowers/specs/2026-07-10-video-r2-selfhosted-design.md`

## Global Constraints

- **Upload direto-pro-R2 obrigatório** (serverless Vercel: limite de body ~4.5MB) — arquivo nunca passa pela função.
- **Handlers padronizados:** rotas novas usam `withAdminApi`/`withUserApi` de `@/lib/api/handler` (auth + rate-limit + `handleApiError` automáticos). NÃO reimplementar checagem de cookie manual.
- **Erros semânticos (Fase 8):** lançar `NotFoundError`/`AuthorizationError`/`ValidationError` de `@/lib/errors/api-error`; nunca `NextResponse.json({error})` para erro.
- **`sizeBytes` é `String?`** (não BigInt) — a lista admin genérica serializa `CourseVideo` via `NextResponse.json`, e BigInt não serializa. Guardar bytes como string decimal.
- **YouTube continua intacto:** nada do fluxo YouTube existente pode quebrar; R2 é caminho adicional, `storageType` default `'youtube'`.
- **Expiração da URL assinada de playback: 7200s (2h).** Presigned de upload: 900s (15min).
- **Teto de upload: 5 GB.** MIME aceitos: `video/mp4`, `video/webm`, `video/quicktime`.
- **Chave R2 de vídeo:** `videos/<courseId>/<uuid>-<nome-sanitizado>`.
- **Verificação E2E na produção** (preview tem SSO que bloqueia curl; "pronto" ≠ funciona).

---

## File Structure

**Criar:**
- `lib/videos/upload-validation.ts` — helpers puros de validação/chave (testável)
- `lib/videos/__tests__/upload-validation.test.ts` — unit tests
- `app/api/admin/videos/presigned-url/route.ts` — gera presigned PUT (admin)
- `app/api/admin/videos/presigned-url/__tests__/route.test.ts`
- `app/api/admin/videos/confirm/route.ts` — grava CourseVideo R2 (admin)
- `app/api/area-restrita/videos/[id]/url/route.ts` — playback protegido (user)
- `app/api/area-restrita/videos/[id]/url/__tests__/route.test.ts`
- `components/lms/HostedVideoPlayer.tsx` — player `<video>` + fetch de URL assinada
- `app/admin/videos/upload/page.tsx` — server wrapper da página de upload
- `app/admin/videos/upload/UploadVideoClient.tsx` — form de upload (client)

**Modificar:**
- `prisma/schema.prisma` — `CourseVideo` (+R2, youtube opcional), `LessonVideo` (youtube opcional)
- `lib/videos.ts` — interface `CourseVideo` (+ campos R2)
- `app/api/admin/videos/confirm` usa `CacheInvalidation.courseVideos()`
- `app/admin/videos/Header.tsx` — botão "Upload de vídeo (R2)"
- `components/lms/LessonVideos.tsx` — branch `storageType`
- `components/CourseVideos.tsx` — branch `storageType`
- `app/api/area-restrita/lessons/[lessonId]/route.ts` — select de vídeos inclui storageType/courseVideoId
- `app/api/area-restrita/batch-data/route.ts` — select de courseVideo inclui storageType

---

## Task 1: Schema — suporte R2 híbrido

**Files:**
- Modify: `prisma/schema.prisma` (model `CourseVideo` ~L640, `LessonVideo` ~L1240)

**Interfaces:**
- Produces: campos `CourseVideo.storageType: string`, `CourseVideo.r2Key: string?`, `CourseVideo.contentType: string?`, `CourseVideo.sizeBytes: string?`, `CourseVideo.durationSeconds: int?`; `CourseVideo.youtubeUrl/youtubeId` e `LessonVideo.youtubeUrl/youtubeId` passam a `String?`.

- [ ] **Step 1: Snapshot do banco antes da migração**

Puxar env de produção e exportar as tabelas de vídeo como backup JSON (prudência — regra do projeto para models sensíveis):

```bash
vercel env pull .env.prod.local --environment production
npx dotenv -e .env.prod.local -- npx tsx -e "import{PrismaClient}from'@prisma/client';import{PrismaNeon}from'@prisma/adapter-neon';import{writeFileSync}from'fs';const p=new PrismaClient({adapter:new PrismaNeon({connectionString:process.env.DATABASE_URL})});(async()=>{const cv=await p.courseVideo.findMany();const lv=await p.lessonVideo.findMany();writeFileSync('backup-videos-2026-07-10.json',JSON.stringify({cv,lv},null,2));console.log('backup:',cv.length,'courseVideos,',lv.length,'lessonVideos');process.exit(0)})()"
rm .env.prod.local
```

Expected: imprime a contagem e cria `backup-videos-2026-07-10.json`.

- [ ] **Step 2: Editar `CourseVideo` no schema**

Substituir as linhas de `youtubeUrl`/`youtubeId` e adicionar os campos R2:

```prisma
model CourseVideo {
  id           String   @id @default(uuid())
  courseId     String
  title        String
  description  String?
  storageType  String   @default("youtube") // 'youtube' | 'r2'
  youtubeUrl   String?  // opcional: só para storageType='youtube'
  youtubeId    String?
  r2Key        String?  // só para storageType='r2'
  contentType  String?  // MIME do vídeo R2
  sizeBytes    String?  // bytes como string (evita BigInt na serialização)
  durationSeconds Int?
  thumbnailUrl String?
  displayOrder Int      @default(0)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  lessonVideos LessonVideo[]

  search_vector Unsupported("tsvector")?

  @@index([courseId])
  @@index([isActive])
  @@index([courseId, isActive, displayOrder])
}
```

- [ ] **Step 3: Editar `LessonVideo` (youtube opcional)**

Trocar as duas linhas:

```prisma
  youtubeUrl    String?
  youtubeId     String?
```

- [ ] **Step 4: Aplicar schema e regenerar client**

Run:
```bash
npx prisma validate && npx prisma db push && npx prisma generate
```
Expected: `The database is now in sync with your Prisma schema.` e `Generated Prisma Client`. Se der erro de engine no Windows: `taskkill //F //IM node.exe` e repetir `npx prisma generate`.

- [ ] **Step 5: Verificar que dados existentes ficaram intactos**

Run:
```bash
npx tsx -e "import{prisma}from'./lib/prisma';(async()=>{const n=await prisma.courseVideo.count({where:{storageType:'youtube'}});const t=await prisma.courseVideo.count();console.log('youtube:',n,'/ total:',t);process.exit(0)})()"
```
Expected: `youtube: N / total: N` (todos os existentes com `storageType='youtube'`).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): CourseVideo/LessonVideo suportam R2 (híbrido)"
```

---

## Task 2: Helpers de validação de upload (TDD)

**Files:**
- Create: `lib/videos/upload-validation.ts`
- Test: `lib/videos/__tests__/upload-validation.test.ts`

**Interfaces:**
- Produces:
  - `ALLOWED_VIDEO_MIME_TYPES: readonly string[]`
  - `MAX_VIDEO_SIZE_BYTES: number`
  - `validateVideoUpload(input: { fileName: string; fileSize: number; fileType: string }): { valid: true } | { valid: false; error: string }`
  - `generateVideoKey(courseId: string, fileName: string, fileId: string): string`

- [ ] **Step 1: Escrever os testes que falham**

```typescript
// lib/videos/__tests__/upload-validation.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateVideoUpload,
  generateVideoKey,
  MAX_VIDEO_SIZE_BYTES,
} from '../upload-validation';

describe('validateVideoUpload', () => {
  const ok = { fileName: 'aula-01.mp4', fileSize: 1_000_000, fileType: 'video/mp4' };

  it('aceita mp4 dentro do limite', () => {
    expect(validateVideoUpload(ok)).toEqual({ valid: true });
  });

  it('rejeita MIME não-vídeo', () => {
    const r = validateVideoUpload({ ...ok, fileType: 'application/pdf' });
    expect(r.valid).toBe(false);
  });

  it('rejeita arquivo acima do teto', () => {
    const r = validateVideoUpload({ ...ok, fileSize: MAX_VIDEO_SIZE_BYTES + 1 });
    expect(r.valid).toBe(false);
  });

  it('rejeita nome vazio', () => {
    const r = validateVideoUpload({ ...ok, fileName: '   ' });
    expect(r.valid).toBe(false);
  });

  it('rejeita tamanho zero/negativo', () => {
    expect(validateVideoUpload({ ...ok, fileSize: 0 }).valid).toBe(false);
  });
});

describe('generateVideoKey', () => {
  it('gera chave sob videos/<courseId>/ com nome sanitizado', () => {
    const key = generateVideoKey('3', 'Aula 01 — Introdução.mp4', 'abc-123');
    expect(key).toBe('videos/3/abc-123-aula-01-introducao.mp4');
  });

  it('remove caracteres especiais e acentos', () => {
    const key = generateVideoKey('2', 'Gestão & Fiscalização!.mov', 'uid');
    expect(key).toMatch(/^videos\/2\/uid-gestao-fiscalizacao-\.mov$/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:run -- lib/videos/__tests__/upload-validation.test.ts`
Expected: FAIL (`Cannot find module '../upload-validation'`).

- [ ] **Step 3: Implementar os helpers**

```typescript
// lib/videos/upload-validation.ts

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const MAX_VIDEO_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

export function validateVideoUpload(input: {
  fileName: string;
  fileSize: number;
  fileType: string;
}): { valid: true } | { valid: false; error: string } {
  if (!input.fileName || input.fileName.trim().length === 0) {
    return { valid: false, error: 'Nome do arquivo é obrigatório' };
  }
  if (!input.fileSize || input.fileSize <= 0) {
    return { valid: false, error: 'Tamanho do arquivo inválido' };
  }
  if (input.fileSize > MAX_VIDEO_SIZE_BYTES) {
    return { valid: false, error: 'Arquivo muito grande (máximo: 5GB)' };
  }
  if (!input.fileType || !ALLOWED_VIDEO_MIME_TYPES.includes(input.fileType as never)) {
    return {
      valid: false,
      error: 'Tipo de arquivo não permitido (aceitos: MP4, WebM, MOV)',
    };
  }
  return { valid: true };
}

export function generateVideoKey(
  courseId: string,
  fileName: string,
  fileId: string
): string {
  const sanitized = fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `videos/${courseId}/${fileId}-${sanitized}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:run -- lib/videos/__tests__/upload-validation.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add lib/videos/upload-validation.ts lib/videos/__tests__/upload-validation.test.ts
git commit -m "feat(videos): helpers de validação de upload de vídeo (TDD)"
```

---

## Task 3: Rota presigned-url (admin) + teste de gate

**Files:**
- Create: `app/api/admin/videos/presigned-url/route.ts`
- Test: `app/api/admin/videos/presigned-url/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `validateVideoUpload`, `generateVideoKey` (Task 2); `generatePresignedUploadUrl` de `@/lib/storage/r2-client`; `withAdminApi`.
- Produces: `POST` handler. Resposta 200: `{ presignedUrl: string, r2Key: string, fileId: string, expiresIn: 900 }`.

- [ ] **Step 1: Escrever o teste que falha (gate admin + validação)**

```typescript
// app/api/admin/videos/presigned-url/__tests__/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetCurrentUser, mockPresign, mockRateLimit } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockPresign: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: (...a: any[]) => mockGetCurrentUser(...a) }));
vi.mock('@/lib/storage/r2-client', () => ({
  generatePresignedUploadUrl: (...a: any[]) => mockPresign(...a),
}));
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...a: any[]) => mockRateLimit(...a),
  getClientIp: () => '127.0.0.1',
}));

import { POST } from '@/app/api/admin/videos/presigned-url/route';

function req(body: unknown) {
  return new Request('http://localhost/api/admin/videos/presigned-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

beforeEach(() => {
  mockGetCurrentUser.mockReset();
  mockPresign.mockReset().mockResolvedValue('https://r2.example/put?sig=1');
  mockRateLimit.mockReset().mockResolvedValue(undefined);
});

const okBody = { courseId: '3', fileName: 'aula.mp4', fileSize: 1000, fileType: 'video/mp4' };

describe('POST /api/admin/videos/presigned-url', () => {
  it('403 para não-admin', async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: 'u1', role: 'student', email: 'a@b.c' });
    const res = await POST(req(okBody), { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(403);
    expect(mockPresign).not.toHaveBeenCalled();
  });

  it('400 para MIME inválido', async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: 'a1', role: 'admin', email: 'a@b.c' });
    const res = await POST(req({ ...okBody, fileType: 'application/pdf' }), { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
    expect(mockPresign).not.toHaveBeenCalled();
  });

  it('200 + presignedUrl para admin com payload válido', async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: 'a1', role: 'admin', email: 'a@b.c' });
    const res = await POST(req(okBody), { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.presignedUrl).toBe('https://r2.example/put?sig=1');
    expect(json.r2Key).toMatch(/^videos\/3\/.*-aula\.mp4$/);
    expect(json.expiresIn).toBe(900);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:run -- app/api/admin/videos/presigned-url`
Expected: FAIL (rota não existe).

- [ ] **Step 3: Implementar a rota**

```typescript
// app/api/admin/videos/presigned-url/route.ts
import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import { generatePresignedUploadUrl } from '@/lib/storage/r2-client';
import { validateVideoUpload, generateVideoKey } from '@/lib/videos/upload-validation';
import { randomUUID } from 'crypto';

const PRESIGNED_EXPIRATION = 900; // 15 min

interface Body {
  courseId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export const POST = withAdminApi(async (request) => {
  const body = (await request.json()) as Body;

  if (!body.courseId || typeof body.courseId !== 'string') {
    throw new ValidationError('courseId é obrigatório');
  }

  const validation = validateVideoUpload({
    fileName: body.fileName,
    fileSize: body.fileSize,
    fileType: body.fileType,
  });
  if (!validation.valid) {
    throw new ValidationError(validation.error);
  }

  const fileId = randomUUID();
  const r2Key = generateVideoKey(body.courseId, body.fileName, fileId);
  const presignedUrl = await generatePresignedUploadUrl(
    r2Key,
    PRESIGNED_EXPIRATION,
    body.fileType
  );

  return NextResponse.json({
    presignedUrl,
    r2Key,
    fileId,
    expiresIn: PRESIGNED_EXPIRATION,
  });
});
```

> Nota: `withAdminApi` já resolve 401 (sem sessão) e 403 (não-admin); `ValidationError` vira 400 via `handleApiError`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:run -- app/api/admin/videos/presigned-url`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/videos/presigned-url
git commit -m "feat(videos): rota presigned-url de upload de vídeo (admin)"
```

---

## Task 4: Rota confirm (admin) — grava CourseVideo R2

**Files:**
- Create: `app/api/admin/videos/confirm/route.ts`

**Interfaces:**
- Consumes: `fileExistsInR2` de `@/lib/storage/r2-client`; `prisma`; `withAdminApi`; `CacheInvalidation` de `@/lib/cache/redis-client`.
- Produces: `POST` handler. Body: `{ courseId, title, description?, r2Key, contentType, sizeBytes, durationSeconds? }`. Resposta 201: `{ video: {...} }`.

- [ ] **Step 1: Implementar a rota**

```typescript
// app/api/admin/videos/confirm/route.ts
import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError, ValidationError } from '@/lib/errors/api-error';
import { fileExistsInR2 } from '@/lib/storage/r2-client';
import { prisma } from '@/lib/prisma';
import { CacheInvalidation } from '@/lib/cache/redis-client';

interface Body {
  courseId: string;
  title: string;
  description?: string;
  r2Key: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds?: number;
}

export const POST = withAdminApi(async (request) => {
  const body = (await request.json()) as Body;

  if (!body.courseId || !body.title || !body.r2Key || !body.contentType) {
    throw new ValidationError('Campos obrigatórios faltando (courseId, title, r2Key, contentType)');
  }
  if (!body.r2Key.startsWith('videos/')) {
    throw new ValidationError('r2Key inválida');
  }

  // Garante que o upload chegou ao R2 antes de gravar o registro
  const exists = await fileExistsInR2(body.r2Key);
  if (!exists) {
    throw new NotFoundError('Arquivo de vídeo no R2');
  }

  const last = await prisma.courseVideo.findFirst({
    where: { courseId: body.courseId },
    orderBy: { displayOrder: 'desc' },
    select: { displayOrder: true },
  });

  const video = await prisma.courseVideo.create({
    data: {
      courseId: body.courseId,
      title: body.title,
      description: body.description || null,
      storageType: 'r2',
      r2Key: body.r2Key,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes != null ? String(body.sizeBytes) : null,
      durationSeconds: body.durationSeconds ?? null,
      youtubeUrl: null,
      youtubeId: null,
      thumbnailUrl: null,
      displayOrder: last ? last.displayOrder + 1 : 0,
      isActive: true,
    },
  });

  CacheInvalidation.courseVideos().catch(() => {});

  return NextResponse.json({ video }, { status: 201 });
});
```

- [ ] **Step 2: Verificar typecheck/lint**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint -- app/api/admin/videos/confirm/route.ts`
Expected: sem erros. (Confirmar que `CacheInvalidation.courseVideos` existe — já usado em `app/api/admin/course-videos/route.ts:59`.)

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/videos/confirm/route.ts
git commit -m "feat(videos): rota confirm grava CourseVideo hospedado no R2 (admin)"
```

---

## Task 5: Rota de playback protegida (user) + teste de gate

**Files:**
- Create: `app/api/area-restrita/videos/[id]/url/route.ts`
- Test: `app/api/area-restrita/videos/[id]/url/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `withUserApi`; `prisma`; `getSignedR2Url` de `@/lib/storage/r2-client`; `NotFoundError`/`AuthorizationError`.
- Produces: `GET` handler. Resposta 200: `{ url: string, expiresIn: 7200 }`. 403 sem acesso, 404 se vídeo/r2Key ausente.

- [ ] **Step 1: Escrever o teste que falha (gate de matrícula)**

```typescript
// app/api/area-restrita/videos/[id]/url/__tests__/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetCurrentUser, mockFindVideo, mockFindEnrollment, mockSign, mockRateLimit } =
  vi.hoisted(() => ({
    mockGetCurrentUser: vi.fn(),
    mockFindVideo: vi.fn(),
    mockFindEnrollment: vi.fn(),
    mockSign: vi.fn(),
    mockRateLimit: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({ getCurrentUser: (...a: any[]) => mockGetCurrentUser(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    courseVideo: { findUnique: (...a: any[]) => mockFindVideo(...a) },
    enrollment: { findFirst: (...a: any[]) => mockFindEnrollment(...a) },
  },
}));
vi.mock('@/lib/storage/r2-client', () => ({ getSignedR2Url: (...a: any[]) => mockSign(...a) }));
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...a: any[]) => mockRateLimit(...a),
  getClientIp: () => '127.0.0.1',
}));

import { GET } from '@/app/api/area-restrita/videos/[id]/url/route';

const call = (id: string) =>
  GET(new Request('http://localhost/api/area-restrita/videos/' + id + '/url') as any, {
    params: Promise.resolve({ id }),
  } as any);

beforeEach(() => {
  mockGetCurrentUser.mockReset().mockResolvedValue({ userId: 'u1', role: 'student', email: 'a@b.c' });
  mockFindVideo.mockReset();
  mockFindEnrollment.mockReset();
  mockSign.mockReset().mockResolvedValue('https://r2.example/get?sig=1');
  mockRateLimit.mockReset().mockResolvedValue(undefined);
});

describe('GET /api/area-restrita/videos/[id]/url', () => {
  it('404 se vídeo não existe', async () => {
    mockFindVideo.mockResolvedValue(null);
    const res = await call('v1');
    expect(res.status).toBe(404);
  });

  it('404 se vídeo não é R2 (sem r2Key)', async () => {
    mockFindVideo.mockResolvedValue({ id: 'v1', courseId: '3', storageType: 'youtube', r2Key: null });
    const res = await call('v1');
    expect(res.status).toBe(404);
  });

  it('403 se aluno não tem matrícula válida', async () => {
    mockFindVideo.mockResolvedValue({ id: 'v1', courseId: '3', storageType: 'r2', r2Key: 'videos/3/x.mp4' });
    mockFindEnrollment.mockResolvedValue(null);
    const res = await call('v1');
    expect(res.status).toBe(403);
    expect(mockSign).not.toHaveBeenCalled();
  });

  it('200 + url assinada com matrícula válida', async () => {
    mockFindVideo.mockResolvedValue({ id: 'v1', courseId: '3', storageType: 'r2', r2Key: 'videos/3/x.mp4' });
    mockFindEnrollment.mockResolvedValue({ id: 'e1' });
    const res = await call('v1');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe('https://r2.example/get?sig=1');
    expect(json.expiresIn).toBe(7200);
    expect(mockSign).toHaveBeenCalledWith('videos/3/x.mp4', 7200, 'GET');
  });

  it('admin acessa sem matrícula', async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: 'a1', role: 'admin', email: 'a@b.c' });
    mockFindVideo.mockResolvedValue({ id: 'v1', courseId: '3', storageType: 'r2', r2Key: 'videos/3/x.mp4' });
    const res = await call('v1');
    expect(res.status).toBe(200);
    expect(mockFindEnrollment).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:run -- app/api/area-restrita/videos/[id]/url`
Expected: FAIL (rota não existe).

- [ ] **Step 3: Implementar a rota**

```typescript
// app/api/area-restrita/videos/[id]/url/route.ts
import { NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { NotFoundError, AuthorizationError } from '@/lib/errors/api-error';
import { getSignedR2Url } from '@/lib/storage/r2-client';

const PLAYBACK_EXPIRATION = 7200; // 2h

export const GET = withUserApi<{ id: string }>(async (_request, ctx) => {
  const { id } = ctx.params;

  const video = await prisma.courseVideo.findUnique({
    where: { id },
    select: { id: true, courseId: true, storageType: true, r2Key: true },
  });

  if (!video || video.storageType !== 'r2' || !video.r2Key) {
    throw new NotFoundError('Vídeo hospedado');
  }

  // Gate de acesso: mesmo padrão do quiz/submit (enrollment válido).
  // Subscription ativa gera enrollment sem expiresAt → coberto pelo OR.
  if (ctx.user.role !== 'admin') {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: ctx.user.userId,
        courseId: video.courseId,
        OR: [
          { isLifetime: true },
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: { id: true },
    });
    if (!enrollment) {
      throw new AuthorizationError('Acesso expirado ou inexistente para este curso.');
    }
  }

  const url = await getSignedR2Url(video.r2Key, PLAYBACK_EXPIRATION, 'GET');
  return NextResponse.json({ url, expiresIn: PLAYBACK_EXPIRATION });
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:run -- app/api/area-restrita/videos/[id]/url`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add app/api/area-restrita/videos
git commit -m "feat(videos): rota de playback protegida por matrícula (URL assinada R2)"
```

---

## Task 6: Componente HostedVideoPlayer

**Files:**
- Create: `components/lms/HostedVideoPlayer.tsx`

**Interfaces:**
- Consumes: `GET /api/area-restrita/videos/[id]/url` → `{ url, expiresIn }`.
- Produces: `export default function HostedVideoPlayer({ videoId, title }: { videoId: string; title: string })`.

- [ ] **Step 1: Implementar o player**

```tsx
// components/lms/HostedVideoPlayer.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface Props {
  videoId: string; // id do CourseVideo (asset mestre R2)
  title: string;
}

export default function HostedVideoPlayer({ videoId, title }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retriedRef = useRef(false);

  const fetchUrl = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/area-restrita/videos/${videoId}/url`);
      if (res.status === 403) {
        setError('Você não tem acesso a este vídeo.');
        return;
      }
      if (!res.ok) {
        setError('Não foi possível carregar o vídeo.');
        return;
      }
      const data = (await res.json()) as { url: string };
      setUrl(data.url);
    } catch {
      setError('Não foi possível carregar o vídeo.');
    }
  }, [videoId]);

  useEffect(() => {
    fetchUrl();
  }, [fetchUrl]);

  // URL assinada pode expirar após pausa longa → re-buscar uma vez no erro do <video>
  const handleVideoError = useCallback(() => {
    if (retriedRef.current) {
      setError('O vídeo expirou. Recarregue a página.');
      return;
    }
    retriedRef.current = true;
    setUrl(null);
    fetchUrl();
  }, [fetchUrl]);

  if (error) {
    return (
      <div className="aspect-video bg-gray-900 rounded-xl flex flex-col items-center justify-center text-white gap-2">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <video
      key={url}
      controls
      preload="metadata"
      controlsList="nodownload"
      onContextMenu={(e) => e.preventDefault()}
      onError={handleVideoError}
      className="w-full aspect-video bg-black rounded-xl"
      title={title}
    >
      <source src={url} />
      Seu navegador não suporta a reprodução de vídeo.
    </video>
  );
}
```

> `controlsList="nodownload"` + bloqueio de menu de contexto reduzem download casual (não é DRM — trade-off aceito no spec).

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/lms/HostedVideoPlayer.tsx
git commit -m "feat(videos): HostedVideoPlayer (video HTML5 + URL assinada)"
```

---

## Task 7: Branch de render por storageType (queries + componentes)

**Files:**
- Modify: `app/api/area-restrita/lessons/[lessonId]/route.ts` (select de vídeos da lição)
- Modify: `app/api/area-restrita/batch-data/route.ts` (~L141-156, select de courseVideo)
- Modify: `components/lms/LessonVideos.tsx`
- Modify: `components/CourseVideos.tsx`

**Interfaces:**
- Consumes: `HostedVideoPlayer` (Task 6).
- Produces: cada item de vídeo entregue ao componente ganha `storageType: 'youtube' | 'r2'` e, para R2, o `id` do CourseVideo a passar ao player.

- [ ] **Step 1: Inspecionar o select de vídeos da lição**

Run: `grep -n "lessonVideos\|youtubeId\|courseVideo\|videos:" "app/api/area-restrita/lessons/[lessonId]/route.ts"`
Localize o bloco que monta `videos` a partir de `lessonVideos`.

- [ ] **Step 2: Incluir storageType/courseVideoId no select da lição**

No `include`/`select` dos `lessonVideos`, adicionar `courseVideoId` e a relação `courseVideo` com `storageType`/`youtubeId`. Ao montar cada item de `videos`, normalizar:

```typescript
// dentro do map de lessonVideos → videos
const cv = lv.courseVideo; // pode ser null
const isR2 = cv?.storageType === 'r2';
return {
  id: lv.id,
  title: lv.title,
  description: lv.description ?? null,
  displayOrder: lv.displayOrder,
  isRequired: lv.isRequired,
  storageType: isR2 ? 'r2' as const : 'youtube' as const,
  // R2: id do CourseVideo mestre p/ o player buscar a URL assinada
  courseVideoId: isR2 ? lv.courseVideoId : null,
  // YouTube: id próprio da lesson OU do courseVideo referenciado
  youtubeId: lv.youtubeId ?? cv?.youtubeId ?? null,
};
```

Atualizar a interface `videos` na página da aula (`app/area-restrita/curso/[courseSlug]/aula/[lessonSlug]/page.tsx` ~L66-74) para incluir `storageType: 'youtube' | 'r2'`, `courseVideoId: string | null`, e `youtubeId: string | null` (opcional).

- [ ] **Step 3: Branch em `LessonVideos.tsx`**

Trocar o `LessonVideoData` e o corpo do card para ramificar:

```tsx
'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import HostedVideoPlayer from '@/components/lms/HostedVideoPlayer';

interface LessonVideoData {
  id: string;
  title: string;
  description?: string | null;
  displayOrder: number;
  isRequired: boolean;
  storageType: 'youtube' | 'r2';
  courseVideoId?: string | null;
  youtubeId?: string | null;
}

interface LessonVideosProps {
  videos: LessonVideoData[];
}

export default function LessonVideos({ videos }: LessonVideosProps) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  if (videos.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-4">Videos</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {videos.map((video) => (
          <div key={video.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="relative aspect-video bg-gray-900">
              {video.storageType === 'r2' && video.courseVideoId ? (
                <HostedVideoPlayer videoId={video.courseVideoId} title={video.title} />
              ) : activeVideoId === video.id ? (
                <iframe
                  src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                  loading="lazy"
                />
              ) : (
                <button
                  onClick={() => setActiveVideoId(video.id)}
                  className="absolute inset-0 w-full h-full group cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                    <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 text-gray-900 ml-0.5" />
                    </div>
                  </div>
                </button>
              )}
            </div>
            <div className="p-3">
              <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">{video.title}</h4>
              {video.description && (
                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{video.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Incluir storageType no select do batch-data e branch em `CourseVideos.tsx`**

Em `app/api/area-restrita/batch-data/route.ts` (~L141-156), adicionar `storageType: true` ao `select` do `courseVideo.findMany`. Em `components/CourseVideos.tsx`, aplicar o mesmo branch: `storageType==='r2'` → `<HostedVideoPlayer videoId={video.id} title={video.title} />`; senão iframe/thumbnail YouTube existente. Ajustar a interface de props do componente para incluir `storageType: 'youtube' | 'r2'` (default tratado como youtube quando ausente).

- [ ] **Step 5: Verificar build e typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros. (Se algum consumidor de `CourseVideos`/`LessonVideos` reclamar de tipo, incluir `storageType` no mapeamento daquela query.)

- [ ] **Step 6: Commit**

```bash
git add app/api/area-restrita/lessons app/api/area-restrita/batch-data components/lms/LessonVideos.tsx components/CourseVideos.tsx "app/area-restrita/curso/[courseSlug]/aula/[lessonSlug]/page.tsx"
git commit -m "feat(videos): render ramifica YouTube vs R2 por storageType"
```

---

## Task 8: UI admin de upload (página dedicada)

**Files:**
- Create: `app/admin/videos/upload/page.tsx`
- Create: `app/admin/videos/upload/UploadVideoClient.tsx`
- Modify: `app/admin/videos/Header.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/videos/presigned-url` (Task 3), presigned PUT no R2, `POST /api/admin/videos/confirm` (Task 4).

- [ ] **Step 1: Server wrapper da página**

```tsx
// app/admin/videos/upload/page.tsx
import { courses } from '@/data/courses';
import { UploadVideoClient } from './UploadVideoClient';

export const metadata = { title: 'Upload de vídeo | Admin' };

export default function UploadVideoPage() {
  const coursesList = courses.map((c) => ({ id: c.id, title: c.title }));
  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Upload de vídeo (R2)</h1>
        <UploadVideoClient courses={coursesList} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Client do formulário de upload**

```tsx
// app/admin/videos/upload/UploadVideoClient.tsx
'use client';

import { useState } from 'react';

interface Props {
  courses: Array<{ id: string; title: string }>;
}

type Phase = 'idle' | 'signing' | 'uploading' | 'confirming' | 'done' | 'error';

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('PUT ' + xhr.status)));
    xhr.onerror = () => reject(new Error('Falha de rede no upload'));
    xhr.send(file);
  });
}

export function UploadVideoClient({ courses }: Props) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !courseId || !title.trim()) {
      setMessage('Preencha curso, título e selecione um arquivo.');
      setPhase('error');
      return;
    }
    try {
      setPhase('signing');
      setMessage('');
      const signRes = await fetch('/api/admin/videos/presigned-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ courseId, fileName: file.name, fileSize: file.size, fileType: file.type }),
      });
      if (!signRes.ok) {
        const err = await signRes.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao gerar URL de upload');
      }
      const { presignedUrl, r2Key } = await signRes.json();

      setPhase('uploading');
      await putWithProgress(presignedUrl, file, setProgress);

      setPhase('confirming');
      const confirmRes = await fetch('/api/admin/videos/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courseId,
          title: title.trim(),
          description: description.trim() || undefined,
          r2Key,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao confirmar o vídeo');
      }
      setPhase('done');
      setMessage('Vídeo enviado com sucesso!');
    } catch (err) {
      setPhase('error');
      setMessage(err instanceof Error ? err.message : 'Erro no upload');
    }
  }

  const busy = phase === 'signing' || phase === 'uploading' || phase === 'confirming';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-2xl shadow border">
      <div>
        <label className="block text-sm font-semibold mb-1">Curso</label>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full border rounded-lg px-3 py-2">
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Título</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Descrição (opcional)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={2} />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Arquivo de vídeo (MP4/WebM/MOV, até 5GB)</label>
        <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      {phase === 'uploading' && (
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <button type="submit" disabled={busy} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50">
        {phase === 'signing' && 'Preparando…'}
        {phase === 'uploading' && `Enviando… ${progress}%`}
        {phase === 'confirming' && 'Finalizando…'}
        {(phase === 'idle' || phase === 'done' || phase === 'error') && 'Enviar vídeo'}
      </button>
      {message && (
        <p className={`text-sm ${phase === 'error' ? 'text-red-600' : 'text-green-600'}`}>{message}</p>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Botão no Header**

Em `app/admin/videos/Header.tsx`, adicionar, ao lado do link "Novo Vídeo", um segundo `<Link>`:

```tsx
<Link
  href="/admin/videos/upload"
  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg flex items-center gap-2"
>
  Upload de vídeo (R2)
</Link>
```

(Envolver os dois links num `<div className="flex gap-3">`.)

- [ ] **Step 4: Verificar typecheck/lint**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint -- app/admin/videos`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/admin/videos/upload app/admin/videos/Header.tsx
git commit -m "feat(videos): página admin de upload de vídeo R2 (progresso direto)"
```

---

## Task 9: Verificação E2E na produção + docs

**Files:**
- Modify: `FUTURE_TASKS.md` (corrigir imprecisão A4 + marcar R2 vídeo)
- Modify: `CLAUDE.md` (nota sobre vídeo R2, se aplicável)

- [ ] **Step 1: Suite completa verde + build**

Run: `npm run test:run && npm run build`
Expected: testes passam; build sem erros.

- [ ] **Step 2: Deploy da branch e E2E na produção**

Abrir PR da branch `feat/video-r2-selfhosted` → após merge em `main`, o auto-deploy (~4min) publica. No domínio público de produção:
1. Como **admin**: `/admin/videos/upload` → subir um MP4 pequeno (H.264/AAC) num curso de teste → ver a barra de progresso completar e a mensagem de sucesso.
2. Confirmar que o `CourseVideo` R2 aparece na lista `/admin/videos` (thumbnail placeholder, storageType r2).
3. Anexar o `CourseVideo` a uma lição (aba Vídeos do editor de lição, via `courseVideoId`).
4. Como **aluno matriculado** no curso: abrir a aula → o `<video>` toca; testar seek.
5. Como **aluno sem matrícula** (ou deslogado): a mesma aula → player mostra "Você não tem acesso" (403).
6. Copiar a URL assinada da aba Network, esperar >2h (ou reduzir temporariamente a expiração) → confirmar que expira (403/AccessDenied do R2).

Registrar o resultado de cada passo (evidência antes de declarar pronto).

- [ ] **Step 3: Atualizar docs**

Corrigir em `FUTURE_TASKS.md` a entrada A4 (R2 vídeo privado agora existe) e remover a imprecisão "pipeline R2 pronto". Adicionar em `CLAUDE.md`, na seção de padrões, uma linha sobre `storageType` em `CourseVideo` e a rota de playback assinada.

- [ ] **Step 4: Commit**

```bash
git add FUTURE_TASKS.md CLAUDE.md
git commit -m "docs: registra vídeo auto-hospedado R2 (A4) e corrige backlog"
```

- [ ] **Step 5: Limpeza**

Remover `backup-videos-2026-07-10.json` do diretório de trabalho após confirmar sucesso (ou mover para fora do repo). Garantir que não foi commitado.

---

## Self-Review (cobertura do spec)

- Spec §4 (schema híbrido) → Task 1. `sizeBytes` refinado de BigInt→String (justificado nas Global Constraints).
- Spec §5 (upload) → Tasks 2, 3, 4, 8.
- Spec §6 (playback protegido) → Tasks 5, 6.
- Spec §7 (render por storageType) → Task 7.
- Spec §8 (erro), §9 (testes) → embutidos em cada task + Task 9.
- Spec §10 (trade-offs), §11 (YAGNI) → respeitados (sem HLS/transcode/DRM; `controlsList=nodownload` é mitigação leve, não DRM).
- Spec §13 (arquivos) → File Structure acima cobre todos.

Consistência de tipos: `storageType: 'youtube' | 'r2'`, `videoId` = id do `CourseVideo`, `sizeBytes: string`, `expiresIn` 900 (upload) / 7200 (playback) — usados de forma idêntica entre tasks.
