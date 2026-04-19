# Stripe Migration — Progresso (2026-04-18)

Companion do design doc em `2026-04-14-stripe-migration-design.md`.
Ponto de partida: branch `stripe-migration` (origin/stripe-migration no GitHub).

## Estado atual

- Branch: `stripe-migration`
- Testes: **789/789 verdes**, 2 skipped
- Lint: 0 errors (9 warnings pré-existentes em arquivos não-Stripe)
- Build: compila e passa TS check; `prisma db push` + `DATABASE_URL` são necessários para prerender estático (configurados no Vercel via script `vercel-build`)

## Commits da migração

Ordem no branch (do mais antigo ao mais recente):

| SHA | Mensagem |
|---|---|
| `acf730a` | docs(specs): design de migração Mercado Pago → Stripe |
| `e633874` | chore: replace mercadopago dependency with stripe |
| `3b5d5b8` | feat(schema): switch Subscription from MP to Stripe, add ProcessedWebhookEvent |
| `74a3ae8` | feat(migration): SQL script to switch Subscription schema MP→Stripe |
| `c81143e` | feat(stripe): getStripe/resolvePriceId/priceAmountInCents/calculatePeriodEnd |
| `eaf5f70` | feat(stripe): ensureStripeCustomer with DB persistence |
| `8e38d2a` | feat(stripe): createCheckoutSession with Pix mandate + billing portal |
| `b08f056` | feat(stripe): enrollment create/remove helpers (preserving qrCodeId) |
| `fa374cb` | feat(scripts): idempotent Stripe products+prices bootstrap |
| `b1d9233` | feat(api): rewrite checkout route for Stripe with 409 guard |
| `e7567ef` | feat(stripe): webhook handler with idempotency and email stubs |
| `2da51c3` | test: update prisma mock for Stripe models, fix redis-client assertions |
| `e26f6f3` | feat(email): transactional subscription emails (5 templates + shell) |
| `7f97621` | feat(stripe): billing portal redirect route and header badge wired |
| `d1906ee` | feat(stripe): poll subscription status on checkout success page |
| `55f5bc0` | feat(stripe): 'manage subscription' CTA on 409 in plans page |
| `5e144d9` | chore(mp): remove Mercado Pago residuals |
| `e1e9722` | fix(build): adapt to Stripe SDK v22 types and satisfy Next 15 lint/build |

## O que está pronto

### Backend

- `lib/stripe.ts`: `getStripe`, `ensureStripeCustomer`, `createCheckoutSession` (cartão + Pix com mandate), `createBillingPortalSession`, `resolvePriceId`, `priceAmountInCents`, `calculatePeriodEnd`, `createEnrollmentsForSubscription`, `removeEnrollmentsForSubscription`.
- `POST /api/pagamento/checkout`: validação Zod (`plan`, `billingCycle`, `method`, `courseId?`), checagem 409 de assinatura ativa, retorna `{ url }`.
- `POST /api/pagamento/webhook`: fail-closed (exige `STRIPE_WEBHOOK_SECRET`), dedup via `ProcessedWebhookEvent` com rollback em erro, dispatch table para 7 eventos (`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`), lista explícita de eventos ignorados.
- `GET /api/conta/portal`: redireciona 303 para o Stripe Billing Portal (ou `/planos` se sem subscription).
- `GET /api/pagamento/status?session_id=X`: valida ownership da session via Stripe, retorna `{ subscription }` para polling da página de sucesso.

### E-mails transacionais (Resend)

`lib/email-templates/shell.ts` + `lib/email-templates/subscription.ts`:
- Welcome (checkout.session.completed)
- Receipt (invoice.paid) — valor pago, próxima cobrança, link da fatura
- Card failed (invoice.payment_failed, cartão) — link do billing portal
- Pix mandate failed (invoice.payment_failed, pix)
- Canceled (customer.subscription.deleted) — data de fim do acesso

HTML inline + plain text. Shell compartilhado alinhado visualmente com `newsletter.ts` (gradiente navy/blue, Georgia headings, inline styles).

### Frontend

- `/planos` (`app/planos/page.tsx`): sempre POSTa `/api/pagamento/checkout` com `method: 'card' | 'pix'`; remove QR inline (hospedado pelo Stripe); toast de 409 com CTA "Gerenciar assinatura".
- `/assinatura/sucesso/page.tsx`: polling a cada 3s × 10 tentativas (30s total); estados polling / confirmed (redirect `/area-restrita`) / timeout (mensagem "vamos emailar") / error.
- `/area-restrita` header (`components/area-restrita/AreaRestritaHeader.tsx`): badge do plano ativo agora aponta para `/api/conta/portal`.

### Testes (28 arquivos, 789 testes)

- `app/__tests__/webhook-route.test.ts`: 7 testes do dispatcher
- `app/__tests__/portal-route.test.ts`: 4 testes da rota do portal
- `app/__tests__/status-route.test.ts`: 7 testes da rota de status
- `lib/email-templates/__tests__/subscription.test.ts`: 10 testes dos templates
- Demais suites pré-existentes continuam verdes.

### Corte limpo MP

- `lib/mercadopago.ts`, `app/api/pagamento/pix/route.ts`, `scripts/test-mercadopago.ts` deletados
- CSP em `next.config.ts` sem `sdk.mercadopago.com` e `mercadopago.com.br`
- `.env.example` com seção `STRIPE_*` documentada
- Copy em `/planos` FAQ atualizado ("via Stripe")
- `grep -i mercadopago` em `app/ lib/ components/ scripts/` retorna só `scripts/migrate-mp-to-stripe.ts` (intencional — script de migração de dados)

## Descobertas técnicas importantes

### Stripe SDK v22 — quebras de tipo

`stripe@^22.0.2` removeu do tipo (mas o runtime ainda recebe via API webhook):

- `Invoice.subscription` → agora em `invoice.parent.subscription_details.subscription`
- `Subscription.current_period_end` → agora em `subscription.items.data[0].current_period_end`
- `Charge.invoice` → removido do tipo; ainda retornado pela API, acesso por cast local

Helpers em `app/api/pagamento/webhook/route.ts` isolam isso: `extractInvoiceSubscriptionId`, `extractCurrentPeriodEnd`, `extractChargeInvoiceId`. Se mudar API version no futuro ou subir de SDK, revisar esses helpers primeiro.

### Pix mandate no SDK

`payment_method_options.pix.mandate_options` ainda não tem tipo no SDK. Dois `as any` em `lib/stripe.ts::createCheckoutSession` com `eslint-disable-next-line` e comentário explicando.

### ESLint e arquivos de teste

`eslint.config.mjs` tem override que desabilita `@typescript-eslint/no-explicit-any` em `**/*.test.ts`, `**/*.test.tsx`, `**/__tests__/**` — os mocks de route handler usam padrão `(...args: any[])` extensivamente. Também ignora `eval/**` e `mcp-server-gemini/**` (tooling interno, não parte do web app).

### Next 15 — `useSearchParams` + Suspense

A `/assinatura/sucesso` usa `useSearchParams()` e precisa estar envolta em `<Suspense>` ou o prerender estático quebra. Feito — `SucessoContent` fica dentro de `<Suspense>` no default export.

## O que falta

### Gates antes de prod (spec linhas 599-609)

- [ ] Stripe test mode configurado (products/prices via bootstrap; webhook cadastrado)
- [ ] E2E manual cartão: assina → `invoice.paid` chega → `currentPeriodEnd` atualiza
- [ ] E2E manual Pix: mandate criado → primeira cobrança → `processing` tolerado
- [ ] E2E manual cancel via Portal: `cancelAtPeriodEnd=true`, acesso até fim do ciclo
- [ ] E2E manual dispute no dashboard: handler remove acesso

### Configuração manual no Vercel / Stripe (não-código)

1. Envs no Vercel (Preview + Production):
   - `STRIPE_SECRET_KEY` (test = `sk_test_...`, prod = `sk_live_...`)
   - `STRIPE_WEBHOOK_SECRET` (do painel Stripe após cadastrar webhook)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (reserva, não usado hoje)
   - Remover `MERCADOPAGO_*`
2. Rodar `npx tsx scripts/stripe-bootstrap.ts` em test mode para criar Products + Prices (idempotente, usa `lookup_keys`).
3. Cadastrar webhook no Stripe Dashboard apontando para URL do deploy:
   - Endpoint: `https://<preview>.vercel.app/api/pagamento/webhook`
   - Eventos (lista do spec): `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`
   - Copiar o Signing Secret e colar em `STRIPE_WEBHOOK_SECRET`.
4. Para live mode (após gates de test passarem):
   - Ativar live mode na conta Stripe
   - Repetir bootstrap e webhook em live
   - Rodar `npx tsx scripts/migrate-mp-to-stripe.ts` contra Neon prod (caso houvesse dados MP a migrar — hoje zero pagantes)

### Melhorias pós-merge (spec linhas 488-496, nice-to-have)

- Na `/area-restrita`, mostrar status legível da subscription ao lado do botão de gerenciar:
  - `active` → "Assinatura ativa — próxima cobrança em DD/MM/AAAA"
  - `processing` → "Pagamento em processamento (Pix leva até 7 dias)"
  - `past_due` → "Pagamento falhou — atualize seu cartão/mandato"
  - `canceled` → "Seu acesso encerra em DD/MM/AAAA"
- Testes E2E automatizados (Playwright) do fluxo checkout → webhook → enrollment.
- Preview visual dos e-mails (ex.: `@react-email/preview-server`) para validar renderização antes de enviar ao usuário.
- Cron de monitoramento: detectar subscriptions em `processing` há mais de 7 dias e alertar.

## Como retomar

1. `cd "/c/Projeto de site do Barral/sitedobarral-stripe"`
2. `git checkout stripe-migration && git pull`
3. `npm install` (Prisma generate rodará no postinstall)
4. Ler este arquivo + `2026-04-14-stripe-migration-design.md`
5. Decidir: configurar test mode (passos da seção "Configuração manual"), executar smoke tests, ou continuar com melhorias pós-merge

## Rollback

Spec linhas 622+: `git revert` dos commits de `e633874` em diante reverte toda a migração. Subscriptions já criadas no Stripe ficam órfãs mas não bloqueiam a rotina — os webhooks deixam de ser recebidos pelo endpoint antigo (que foi deletado). Antes de rollback em prod, suspender o endpoint do webhook no Stripe Dashboard para evitar retries infinitos.
