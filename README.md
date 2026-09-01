# Site do Professor Daniel Barral

Aplicação pública e área restrita para conteúdo de direito administrativo e licitações, com acervo normativo, jurisprudência, glossário, cursos, busca híbrida, recursos de inteligência artificial e rotinas editoriais. A URL canônica é `https://profdanielbarral.com`.

## Arquitetura

O projeto usa Next.js 15 com App Router, React 19, TypeScript e Tailwind CSS. As páginas e APIs ficam em `app/`; componentes reutilizáveis, em `components/`; regras de domínio e integrações server-side, em `lib/`; schema e migrações PostgreSQL, em `prisma/`; tarefas operacionais, em `scripts/`; testes de navegador, em `e2e/`.

O banco é PostgreSQL com Prisma e extensão `pgvector`. O deploy ocorre na Vercel, com região primária `gru1`. Redis Upstash sustenta cache, rate limiting e controles sensíveis. Armazenamento de documentos usa R2 ou S3. Stripe, Resend, Mailchimp, Sentry e provedores de IA são habilitados por variáveis de ambiente.

## Pré-requisitos

- Node.js 20 e npm;
- PostgreSQL 16 compatível com a extensão `vector`;
- banco local descartável para E2E ou uma branch remota isolada informada exclusivamente por `TEST_DATABASE_URL`;
- credenciais das integrações que serão usadas no ambiente.

Não use o banco de produção em testes. O resolvedor E2E recusa uma `DATABASE_URL` remota e somente admite banco remoto quando ele é declarado de forma explícita em `TEST_DATABASE_URL`.

## Instalação local

```bash
npm ci
cp .env.example .env.local
npx prisma generate
npm run dev
```

Preencha `.env.local` com credenciais próprias. O arquivo não deve ser versionado. Para preparar um PostgreSQL local descartável, use `npx prisma db push`; em staging e produção, esse comando é proibido.

## Comandos

| Comando | Finalidade |
|---|---|
| `npm run dev` | servidor local |
| `npm run build` | build de produção sem migração |
| `npm run vercel-build` | geração Prisma, migrações pendentes e build na Vercel |
| `npm run lint` | lint do produto |
| `npx tsc --noEmit --incremental false` | verificação integral de tipos |
| `npm run test:run` | testes Vitest |
| `npm run test:coverage` | testes com cobertura e limites mínimos |
| `npm run test:e2e:smoke` | smoke público em navegador |
| `npm run test:e2e` | cenários críticos com dados sintéticos |
| `npm run analyze` | build com Bundle Analyzer |

## Variáveis de ambiente

O inventário com placeholders está em `.env.example`. Os grupos operacionais são:

- núcleo: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `JWT_SECRET`, `NEXT_PUBLIC_BASE_URL` e `CRON_SECRET`;
- testes: `TEST_DATABASE_URL`;
- Redis: `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`;
- e-mail: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM` e variáveis Mailchimp;
- IA: `GEMINI_API_KEY`, `GEMINI_API_KEY_BACKUP`, `ANTHROPIC_API_KEY`, `COHERE_API_KEY` e seletores de provedor e modelo;
- pagamentos: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e variáveis públicas de preço e Pix;
- armazenamento: variáveis `R2_*` ou `AWS_*` previstas pelo adaptador em uso;
- observabilidade: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `LOG_LEVEL` e `NEXT_PUBLIC_GA_ID`;
- operação editorial: variáveis `CLIPPING_*`, redes sociais, web push e modo de pré-lançamento.

Variáveis ausentes podem desabilitar integrações opcionais. Redis, segredo de cron e demais controles sensíveis falham de modo fechado nas rotas protegidas. Nunca registrar valores de variáveis em logs ou documentação.

## Banco e migrações

`prisma/schema.prisma` é a fonte do modelo. `prisma/migrations/0_init/migration.sql` é o baseline PostgreSQL. Depois que um banco existente for marcado conforme o runbook, o deploy executa apenas `prisma migrate deploy`.

Não editar uma migração já aplicada, não apagar registros de `_prisma_migrations` e não usar `prisma db push`, `prisma migrate reset` ou `prisma migrate dev` em banco remoto. O procedimento de baseline, ensaio e recuperação está em [docs/database/migration-runbook.md](docs/database/migration-runbook.md).

## Autenticação e autorização

A autenticação usa JWT em cookie HTTP-only. APIs administrativas devem usar a guarda central `withAdminApi`; uma requisição sem autenticação recebe 401 e um usuário sem papel administrativo recebe 403. Acesso a aulas, progresso e documentos é decidido pelas regras centrais de curso e documento, com verificação de expiração da matrícula.

## Integrações externas

Stripe, provedores de IA, Redis, e-mail e armazenamento devem ser testados com credenciais e recursos de sandbox. Os testes automatizados não fazem pagamento, envio real de e-mail nem chamada paga de IA. Crons da Vercel exigem `CRON_SECRET` e estão declarados em `vercel.json`.

## Testes e integração contínua

O workflow `.github/workflows/test.yml` bloqueia lint, testes, cobertura e build. O job de navegador cria PostgreSQL local com pgvector para o smoke. Cenários que gravam dados remotos só rodam quando existe uma `TEST_DATABASE_URL` isolada; pushes no ramo principal falham se esse segredo não estiver configurado.

Antes de uma publicação, siga [docs/operations/deploy-checklist.md](docs/operations/deploy-checklist.md). Vulnerabilidades transitivas temporariamente aceitas e suas mitigações constam de [docs/security/dependency-exceptions.md](docs/security/dependency-exceptions.md).

## Deploy e rollback

Toda mudança passa primeiro por preview ou staging com dados sintéticos. A implantação de schema tem janela própria, ponto de recuperação confirmado e aprovação expressa. O rollback da aplicação volta ao deployment anterior; o rollback de dados depende da branch ou restauração Neon preparada antes da mudança. O tráfego só é reaberto depois de `prisma migrate status`, smoke público e testes de autorização.
