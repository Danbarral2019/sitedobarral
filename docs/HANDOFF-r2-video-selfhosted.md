# HANDOFF — Vídeo auto-hospedado no R2 (privado / paywall-safe)

**Criado:** 2026-07-10 · **Para:** nova sessão retomar o A4 na direção "vídeo próprio privado"
**Como começar:** invoque a skill **`superpowers:brainstorming`** — isto é um feature novo de verdade, decidir o design ANTES de codar. Este doc te dá todo o contexto pra não reexplorar.

---

## Objetivo

Permitir que o Prof. Daniel hospede as videoaulas do LMS de forma **privada**, protegida pelo login/matrícula, **sem YouTube** — para que o conteúdo do curso pago não vaze.

## Por quê (o problema que motivou)

Hoje o vídeo do LMS é **embed de YouTube** (ver `[[a4-videos-youtube]]`). Para conteúdo pago isso fura o paywall: um vídeo "não listado" é assistível por **qualquer pessoa com o link**, e o `youtubeId` fica no HTML da página → extraível → assistível direto no YouTube. Daniel reconsiderou e quer o caminho correto: **auto-hospedado no R2 com URLs assinadas** (acesso só para quem tem matrícula, link expira).

## Estado atual — o que EXISTE vs o que FALTA

**Existe (YouTube, funcionando):**
- Models `CourseVideo` (prisma/schema.prisma ~L640) e `LessonVideo` (~L1240) — **só `youtubeUrl` + `youtubeId`**, nenhum campo de storage/R2.
- Rotas admin: `app/api/admin/course-videos/route.ts` e `app/api/admin/lessons/[id]/videos/route.ts` (exigem `youtubeUrl`, extraem ID via `lib/admin/lesson-youtube.ts`).
- UI admin: `app/admin/videos/VideosClient.tsx` (galeria do curso) e `components/admin/lms/lesson-editor/LessonVideosTab.tsx` (aba de vídeo da lição) — campo "URL do YouTube".
- Playback público: `components/lms/LessonVideos.tsx` e `components/CourseVideos.tsx` — `<iframe src="youtube.com/embed/${youtubeId}">`.

**Falta (o que construir):** todo o caminho de vídeo hospedado — schema, upload de arquivo grande, playback protegido, player, UI admin de upload.

## ✅ Boa notícia — o R2 já tem o essencial

`lib/storage/r2-client.ts` está pronto e tem **exatamente** as primitivas necessárias:
- **`generatePresignedUploadUrl(key, expiresIn, contentType)`** → URL assinada de **PUT**: o navegador sobe o arquivo **direto pro R2**, sem passar pela função serverless (evita o limite de body de ~4.5MB da Vercel; PUT único suporta até 5GB — multipart só se precisar de mais).
- **`getSignedR2Url(key, expiresIn, 'GET')`** → URL assinada de **GET com expiração**: é ISTO que protege o playback (gera um link temporário só depois de checar a matrícula).
- `deleteFromR2`, `fileExistsInR2`, `getPublicR2Url`, `isR2Configured()`.
- **Env vars (já em produção, usadas pelos documentos):** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` (opcional). Confirmar no Vercel (`vercel env ls production`).

⚠️ O route de upload atual (`app/api/admin/upload/presigned-url/route.ts`) NÃO serve: capa em **50MB** e só aceita MIME de documento (PDF/DOC/imagem). Vídeo precisa de um route próprio (MIME de vídeo + limite maior + chave `videos/...`).

## Escopo a construir (esboço — refinar no brainstorming)

1. **Schema:** adicionar suporte a vídeo hospedado. Decidir: campos R2 no `CourseVideo`/`LessonVideo` existentes (ex.: `r2Key`, `storageType: 'youtube'|'r2'`, `durationSeconds`, `sizeBytes`, `contentType`) — abordagem **híbrida** que mantém YouTube como opção — ou um model novo. `backup-lei-14133`-style: rodar backup antes de migração de schema sensível.
2. **Upload:** route `POST /api/admin/videos/presigned-url` (admin-only) que valida MIME de vídeo + tamanho e retorna presigned PUT (`generatePresignedUploadUrl`, chave `videos/<courseId>/<uuid>-<nome>`); route `confirm` que grava o registro após o upload. UI admin com `<input type=file>` + barra de progresso (upload direto pro R2 via `fetch(PUT)`).
3. **Playback protegido:** route `GET /api/area-restrita/videos/[id]/url` (ou similar) que **checa a matrícula** (mesmo padrão do `quiz/submit`: `enrollment` no `courseId` OU subscription ativa) e só então retorna `getSignedR2Url(r2Key, ~2h, 'GET')`. Player consome essa URL.
4. **Player:** componente com `<video>` HTML5 apontando pra URL assinada. Tratar expiração (renovar a URL) e, se quiser streaming adaptativo, avaliar HLS (mais complexo — provavelmente YAGNI no MVP).
5. **UI admin:** trocar/complementar o campo "URL do YouTube" por upload de arquivo (ou toggle YouTube/Upload).

## Decisões de design a brainstormar (as perguntas-chave)

- **Híbrido ou só R2?** Manter YouTube como opção por vídeo (`storageType`) ou migrar tudo pra R2?
- **Player:** `<video>` simples com URL assinada (MVP, suficiente) vs HLS/streaming adaptativo (transcodificação, mais infra)?
- **Transcodificação/formatos:** aceitar o MP4 do Daniel como está, ou transcodificar (H.264/AAC, múltiplas resoluções)? R2 não transcodifica — precisaria de serviço externo (Cloudflare Stream? mux? um job). **Cloudflare Stream** pode ser a alternativa "certa" (hospedagem de vídeo dedicada da Cloudflare com signed URLs + player + adaptativo) — avaliar vs R2-puro no brainstorming.
- **Expiração da URL assinada** e proteção contra compartilhamento (link expira em X min/horas; opcional: assinar por usuário).
- **Limite de tamanho** por vídeo (aula típica?) — define se PUT único (≤5GB) basta ou precisa multipart.
- **Custo:** R2 (armazenamento + egress — R2 tem egress grátis, vantagem grande vs S3) vs Cloudflare Stream (por minuto armazenado + assistido).
- **Migração:** os vídeos YouTube atuais (se houver) ficam como estão (híbrido) ou migram?

## Restrições técnicas & gotchas (deste projeto)

- **Serverless (Vercel):** upload TEM que ser direto-pro-R2 via presigned PUT — não passar o arquivo pela função (limite de body + timeout). Efeitos colaterais pós-resposta usam `after()`/`runAfterResponse` (`lib/api/after-response.ts`) — ver `[[feedback-serverless-fire-and-forget]]`.
- **Next 15.5 / Prisma 7 (PrismaNeon):** scripts standalone usam `new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) })` + `dotenv -e ...`. Rodar via `npx dotenv -e .env.diag.local -- npx tsx ...` (puxar env de prod com `vercel env pull` e **apagar depois**).
- **Auth admin:** rotas de upload checam `verifyToken` + `role==='admin'` (ver o presigned-url de documentos como template). Playback checa matrícula (template: `quiz/submit/route.ts` linhas ~30-45).
- **Verificar sempre no ambiente deployado** (padrão desta sessão: "pronto" ≠ funciona — validar E2E). O preview do Vercel tem SSO (bloqueia curl); E2E confiável só na produção (domínio público).

## Primeiros passos sugeridos pra próxima sessão

1. Invocar `superpowers:brainstorming`.
2. Ler: `lib/storage/r2-client.ts`, os 2 models de vídeo no schema, `app/api/admin/upload/presigned-url/route.ts` (template de upload), `app/api/area-restrita/lessons/[lessonId]/quiz/submit/route.ts` (template de checagem de matrícula), os componentes de playback.
3. Decisão-mãe primeiro: **R2-puro (`<video>` + signed URL)** vs **Cloudflare Stream**. Isso muda todo o resto.
4. Confirmar env R2 no Vercel (`vercel env ls production` → R2_*).
5. Brainstorm → spec (`docs/superpowers/specs/`) → writing-plans → TDD.

## Arquivos-chave (mapa rápido)

| Papel | Arquivo |
|---|---|
| Cliente R2 (pronto) | `lib/storage/r2-client.ts` |
| Models de vídeo (youtube) | `prisma/schema.prisma` (CourseVideo ~L640, LessonVideo ~L1240) |
| Upload de documento (template) | `app/api/admin/upload/presigned-url/route.ts` + `confirm/route.ts` |
| Rotas de vídeo (youtube) | `app/api/admin/course-videos/route.ts`, `app/api/admin/lessons/[id]/videos/route.ts` |
| UI admin de vídeo | `app/admin/videos/VideosClient.tsx`, `components/admin/lms/lesson-editor/LessonVideosTab.tsx` |
| Playback (youtube) | `components/lms/LessonVideos.tsx`, `components/CourseVideos.tsx` |
| Checagem de matrícula (template) | `app/api/area-restrita/lessons/[lessonId]/quiz/submit/route.ts` (~L30-45), `lib/enrollment-utils.ts` |
| Pós-resposta em serverless | `lib/api/after-response.ts` (`runAfterResponse`) |

---

**Contexto da sessão de origem (2026-07-10):** dia produtivo — Stripe LIVE validado, coming-soon ativado, P2 verificado, **bug de gamificação corrigido (PR #141)**, 1º quiz piloto publicado (Curso 10). O A4 estava marcado como "R2 pronto" no backlog, mas a validação mostrou que era YouTube; Daniel optou por YouTube no MVP e depois reconsiderou o R2 privado — daí este handoff.
