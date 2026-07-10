# Design — Vídeo auto-hospedado no R2 (privado / paywall-safe)

**Data:** 2026-07-10
**Feature:** A4 — videoaulas do LMS hospedadas de forma privada no Cloudflare R2, protegidas por matrícula (sem YouTube).
**Handoff de origem:** `docs/HANDOFF-r2-video-selfhosted.md`
**Decisão-mãe:** R2-puro (player progressivo) — descartado Cloudflare Stream (custo por-minuto-assistido pune o sucesso do curso; egress do R2 é grátis).

---

## 1. Objetivo & motivação

Hoje o vídeo do LMS é embed de YouTube. Para conteúdo pago isso fura o paywall:
um vídeo "não listado" é assistível por qualquer pessoa com o link, e o `youtubeId`
fica no HTML → extraível. O objetivo é permitir que o Prof. Daniel hospede as
videoaulas de forma **privada**, com acesso liberado apenas para quem tem matrícula
válida (ou subscription ativa), via **URL assinada com expiração**.

## 2. Decisões de design fechadas (brainstorming 2026-07-10)

- **R2-puro, não Cloudflare Stream.** Egress grátis → custo ~fixo e baixo (~US$3/mês
  para ~100h em 1080p), independente de audiência. Stream cobraria por minuto assistido.
- **MVP progressivo** (`<video>` HTML5), **sem HLS/adaptativo.** HLS fica para depois,
  só se houver reclamação real de buffering (a arquitetura R2 não impede adicioná-lo:
  pré-transcodificar segmentos HLS no próprio R2, egress ainda grátis).
- **Modelo híbrido:** YouTube continua funcionando por vídeo (`storageType`); R2 é opção nova.
- **Asset mestre no `CourseVideo`:** o upload/registro R2 vive no `CourseVideo`; a
  `LessonVideo` referencia via `courseVideoId` (um upload serve várias lições).
- **Expiração da URL assinada:** 2 horas.
- **Teto de tamanho:** 5 GB por vídeo (PUT único basta; sem multipart no MVP).

## 3. Arquitetura (fluxo ponta-a-ponta)

```
Admin sobe MP4 ──► presigned PUT ──► R2 (bucket, prefixo videos/)
                                         │
CourseVideo (asset mestre, storageType='r2', r2Key) ◄── confirm grava registro
        ▲
        │ courseVideoId (referência)
LessonVideo ──► aluno abre lição
                     │
              player pede URL ──► GET /api/area-restrita/videos/[id]/url
                                       │ checa enrollment/subscription
                                       ▼
                              getSignedR2Url(GET, 2h) ──► <video> toca
```

- Upload passa **direto do navegador pro R2** via presigned PUT — nunca pela função
  serverless (respeita o limite de body ~4.5MB e o timeout da Vercel).
- Playback só entrega a URL assinada **depois** de checar matrícula.

## 4. Schema (Prisma) — híbrido, não-destrutivo

**`CourseVideo`** (asset mestre ganha suporte R2):

| Campo | Mudança |
|---|---|
| `storageType` | **novo** — `String @default("youtube")` (`'youtube' \| 'r2'`) |
| `youtubeUrl` | passa a ser opcional (`String?`) |
| `youtubeId` | passa a ser opcional (`String?`) |
| `r2Key` | **novo** — `String?` |
| `contentType` | **novo** — `String?` |
| `sizeBytes` | **novo** — `BigInt?` (Int não segura arquivos >2GB) |
| `durationSeconds` | **novo** — `Int?` |

**`LessonVideo`**:

| Campo | Mudança |
|---|---|
| `youtubeUrl` | passa a ser opcional (`String?`) |
| `youtubeId` | passa a ser opcional (`String?`) |

Vídeo R2 numa lição = referenciar um `CourseVideo` via `courseVideoId` (campo já
existe); a `LessonVideo` **não** duplica `r2Key`.

**Segurança da migração:** só torna campos opcionais + adiciona colunas → linhas
existentes ficam `storageType='youtube'` intactas. Rodar snapshot do banco antes de
aplicar (`prisma db push` / migration).

## 5. Upload (2 rotas admin + UI)

### 5.1 `POST /api/admin/videos/presigned-url` (admin-only)
- Molde: `app/api/admin/upload/presigned-url/route.ts`.
- Auth: `verifyToken` + `role === 'admin'`. Rate-limit (`enforceRateLimit`).
- Valida MIME de vídeo (`video/mp4`, `video/webm`, `video/quicktime`) + tamanho ≤ 5 GB.
- Gera chave `videos/<courseId>/<uuid>-<nome-sanitizado>`.
- Retorna `{ presignedUrl, r2Key, fileId, expiresIn }`. Expiração do presigned: 15 min.

### 5.2 `POST /api/admin/videos/confirm` (admin-only)
- Confere que o objeto existe no R2 (`fileExistsInR2(r2Key)`) antes de gravar.
- Grava `CourseVideo` com `storageType='r2'`, `r2Key`, `title`, `description?`,
  `sizeBytes`, `contentType`, `durationSeconds?`, `courseId`, `displayOrder`.
- Erros semânticos (Fase 8) + `handleApiError`.

### 5.3 UI admin (`app/admin/videos/VideosClient.tsx`)
- Toggle **YouTube | Upload**.
- Upload: `<input type=file accept="video/*">` + barra de progresso via
  `XMLHttpRequest` (dá progresso de upload; `fetch` não). Fluxo:
  1. pede presigned; 2. `xhr.PUT` direto pro R2 com `onprogress`; 3. chama `confirm`.

## 6. Playback protegido

### 6.1 `GET /api/area-restrita/videos/[id]/url` (`withUserApi`)
- `id` = `CourseVideo.id`.
- Checa **enrollment válido OU subscription ativa** para o `courseId` do vídeo
  (molde: `quiz/submit/route.ts` ~L32-47; canônico: `lib/enrollment-utils.ts`).
  Admin bypassa.
- Se `storageType==='r2'`: retorna `{ url: getSignedR2Url(r2Key, 7200, 'GET'), expiresIn: 7200 }`.
- Sem acesso → `AuthorizationError` (403). Vídeo/`r2Key` ausente → `NotFoundError` (404).

### 6.2 `HostedVideoPlayer.tsx` (componente client novo)
- Recebe `videoId`; busca a URL assinada; renderiza `<video controls preload="metadata">`.
- No evento `error` do `<video>` (URL expirada após pausa longa), re-busca a URL **uma vez**.
- Seek/scrubbing funciona nativo (R2 honra byte-range no GET assinado).

## 7. Render (branch por storageType)

`components/lms/LessonVideos.tsx` e `components/CourseVideos.tsx`:
- `storageType==='youtube'` (ou ausente) → `<iframe>` YouTube (atual, intacto).
- `storageType==='r2'` → `<HostedVideoPlayer videoId={...}>`.

Para `LessonVideo` R2: resolver o `CourseVideo` referenciado (`courseVideoId`) e usar
o `id` desse `CourseVideo` no player. As queries que alimentam esses componentes passam
a incluir `storageType` (e `courseVideoId` no caso de lição).

## 8. Tratamento de erro

Padrão Fase 8: erros semânticos (`NotFoundError`, `AuthorizationError`,
`ValidationError`), `handleApiError()` num único catch, `apiLogger` com contexto.
Upload: presigned expirado (15 min) / MIME ou tamanho inválido → 400.

## 9. Testes

- **Unit:** validação MIME/tamanho; geração de chave `videos/...`; lógica do gate de
  acesso (enrollment/subscription/admin).
- **Integração:** presigned-url → 403 p/ não-admin, 200 p/ admin; confirm grava linha
  e rejeita `r2Key` inexistente; playback → 403 sem matrícula, 200 com matrícula.
- **E2E manual na produção** (regra do projeto: "pronto" ≠ funciona; preview tem SSO):
  subir MP4 pequeno como admin → anexar a uma lição → aluno matriculado assiste →
  não-matriculado bloqueado → confirmar que a URL assinada expira após a janela.

## 10. Trade-offs assumidos

- **URL assinada é compartilhável dentro da janela de 2h** — muito melhor que YouTube
  (permanente), não é DRM. Aceito no MVP.
- **Sem transcodificação:** serve o arquivo como veio → recomendação operacional:
  exportar **MP4 H.264/AAC** (compatível com todos os navegadores).
- **Egress grátis** no R2 → custo previsível e baixo.

## 11. Fora de escopo (YAGNI)

HLS/streaming adaptativo · pipeline de transcodificação · assinatura por-usuário/DRM ·
upload de thumbnail custom (usa primeiro frame via `preload=metadata`) · migração dos
vídeos YouTube existentes (ficam híbridos) · job de limpeza de órfãos (upload OK +
confirm falho) — o `confirm` já valida existência; limpeza sistemática fica para depois.

## 12. Restrições técnicas do projeto (lembretes)

- Serverless (Vercel): upload direto-pro-R2 obrigatório; efeitos pós-resposta via
  `after()`/`runAfterResponse` (`lib/api/after-response.ts`).
- Next 15.5 / Prisma 7 (PrismaNeon): scripts standalone com `new PrismaClient({ adapter })`
  + `dotenv -e`. Puxar env de prod com `vercel env pull` e apagar depois.
- Env R2_* já em produção (usadas por documentos) — confirmar `vercel env ls production`.

## 13. Arquivos (criar / modificar)

**Criar:**
- `app/api/admin/videos/presigned-url/route.ts`
- `app/api/admin/videos/confirm/route.ts`
- `app/api/area-restrita/videos/[id]/url/route.ts`
- `components/lms/HostedVideoPlayer.tsx`

**Modificar:**
- `prisma/schema.prisma` (CourseVideo, LessonVideo)
- `app/admin/videos/VideosClient.tsx` (toggle YouTube|Upload + progresso)
- `components/lms/LessonVideos.tsx`, `components/CourseVideos.tsx` (branch storageType)
- Queries que alimentam esses componentes (incluir `storageType`, `courseVideoId`)
