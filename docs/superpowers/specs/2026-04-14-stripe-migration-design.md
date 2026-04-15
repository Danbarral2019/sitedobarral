# Migração Mercado Pago → Stripe — Design

**Data:** 2026-04-14
**Autor:** Daniel Barral + Claude (Opus 4.6)
**Status:** Approved for implementation planning
**Repo:** `sitedobarral` (não ELIC)

---

## Contexto e motivação

O Site do Barral usa Mercado Pago como gateway de pagamento para as assinaturas dos planos Básico e Premium. O dono relatou dificuldade recorrente de configuração da conta MP, e o código atual apresenta 15 gotchas mapeados (ver seção "Estado atual"), incluindo:

- Webhook com `fail-open` quando secret não configurado
- "Assinatura" sem renovação automática — usuário precisa re-pagar manualmente a cada período
- Nenhum cron de expiração, nenhum e-mail transacional, nenhuma autogestão pelo usuário

A base de pagantes atual é **zero** (confirmado em 2026-04-14), o que viabiliza uma migração **clean cut** — sem convivência MP/Stripe, sem dados a migrar.

**Objetivo:** substituir integralmente Mercado Pago por Stripe Checkout + Stripe Subscriptions (incluindo Pix Automático via mandate), ganhando:

- Recorrência real (cartão e Pix)
- Customer Portal hospedado (autogestão de cartão, cancelamento, recibos)
- Eventos de webhook padronizados e bem documentados
- Fail-closed por padrão
- E-mails transacionais de ciclo de vida

---

## Estado atual (Mercado Pago)

**Stack:** Next.js 15.5.9 App Router, Prisma 7, Neon PostgreSQL, JWT-based auth.

**Arquivos de pagamento:**

| Arquivo | Papel |
|---|---|
| `lib/mercadopago.ts` | Wrapper do SDK + helpers de preço/enrollment |
| `app/api/pagamento/checkout/route.ts` | Cria preferência Cartão/Boleto (redirect) |
| `app/api/pagamento/pix/route.ts` | Gera PIX avulso com QR code inline |
| `app/api/pagamento/webhook/route.ts` | IPN handler (HMAC, status `approved`/`refunded`/`cancelled`) |
| `app/planos/page.tsx` | UI com 3 métodos (Cartão/PIX/Boleto) |
| `app/assinatura/{sucesso,cancelado,pendente}/page.tsx` | Páginas de retorno |
| `scripts/test-mercadopago.ts` | Validação manual de credenciais |

**Modelos Prisma afetados:**

- `User.mercadopagoPayerId`
- `Subscription.mercadopagoPreapprovalId`, `paymentMethod`, `status`, `currentPeriodStart/End`, `billingCycle`, `cancelAtPeriodEnd`
- Campos Stripe legados pré-existentes (de integração anterior removida): `User.stripeCustomerId`, `Subscription.stripeSubscriptionId`, `stripePriceId`

**Planos:**

- **Básico** — R$ 49,90/mês | R$ 499/ano (1 curso selecionado no checkout)
- **Premium** — R$ 89,90/mês | R$ 899/ano (todos os cursos)

**Gotchas mapeados:** 15 (ver mapeamento completo na Seção 10 deste documento).

---

## Decisões de projeto (travadas)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Base pagante no MP | Zero — corte limpo, sem migração de dados |
| 2 | Modelo de cobrança | Cartão: `Stripe Subscription` recorrente. PIX: `Stripe Subscription` com Pix Automático (mandate) |
| 3 | UI de checkout | Stripe Checkout (página hospedada por Stripe) |
| 4 | Métodos de pagamento | Cartão + PIX (sem boleto) |
| 5 | Estrutura de planos | Mantida (Básico/Premium × mensal/anual = 4 Prices recurring) |
| 6 | Autogestão | Stripe Customer Portal (hospedado) |
| 7 | Schema | Reusa campos `stripe*` pré-existentes; dropa `mercadopago*` |
| 8 | Pix mandate — amount_type | `fixed` — valor exato, mandato quebra se reajustar preço (aceito) |

---

## Arquitetura

```
┌─────────────────────┐
│  /planos (Next.js)  │  usuário seleciona plano + ciclo + método
└──────────┬──────────┘
           │ POST /api/pagamento/checkout { plan, billingCycle, method, courseId? }
           ▼
┌─────────────────────────────────────────────┐
│ app/api/pagamento/checkout/route.ts         │
│  - withAuth + Zod                           │
│  - guard: 409 se Subscription ativa         │
│  - lib/stripe.ts: createCheckoutSession()   │
│    → mode SEMPRE 'subscription'             │
│    → payment_method_types = [method]        │
│    → payment_method_options.pix.mandate_..  │
│       quando method='pix'                   │
│  - retorna { url } do Stripe Checkout       │
└──────────┬──────────────────────────────────┘
           │ window.location.href = url
           ▼
┌─────────────────────┐
│  Stripe Checkout    │  usuário paga (hospedado pelo Stripe)
└──────────┬──────────┘
           │ redirect → /assinatura/sucesso?session_id=...
           │ (cliente faz polling de /api/pagamento/status)
           │
           │ paralelo e assíncrono
           ▼
┌─────────────────────────────────────────────┐
│ POST /api/pagamento/webhook                 │
│  - stripe.webhooks.constructEvent (fail-    │
│    closed se secret ausente)                │
│  - dedup via ProcessedWebhookEvent          │
│  - despacha por event.type                  │
│  - muta Subscription + Enrollment           │
│  - dispara e-mail transacional              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ /area-restrita → "Gerenciar assinatura"     │
│  GET /api/conta/portal                       │
│    → stripe.billingPortal.sessions.create   │
│    → redirect pra portal do Stripe          │
└─────────────────────────────────────────────┘
```

### Princípios

1. **Webhook é a única fonte de verdade** para mutação de `Subscription`. A rota de checkout apenas cria sessão no Stripe; não escreve em `Subscription`. O usuário vê "pagamento aprovado" via redirect de sucesso + polling client-side de `/api/pagamento/status`.
2. **Idempotência obrigatória** em toda entrega de webhook (via tabela `ProcessedWebhookEvent` com unique em `stripeEventId`; rollback explícito em caso de falha no handler pra permitir retry do Stripe).
3. **Corte limpo** — `lib/mercadopago.ts`, rotas `/api/pagamento/{checkout,pix,webhook}` antigas, dependência `mercadopago`, envs `MERCADOPAGO_*` e campos `mercadopago*` saem na mesma PR.
4. **Fail-closed** no webhook: se `STRIPE_WEBHOOK_SECRET` faltar, endpoint responde 500 — nunca processa sem assinatura válida.
5. **`mode: 'subscription'` sempre** — tanto cartão quanto PIX (Automático). Não há fluxo one-time / `mode: 'payment'` neste projeto.
6. **E-mails transacionais dentro do webhook**, após mutação do DB, com try/catch silencioso — falha de e-mail nunca retorna 500 pro Stripe.

---

## Recursos no Stripe (bootstrap)

### Products

| lookup_key | Nome | Acesso |
|---|---|---|
| `prod_basico` | Plano Básico | 1 curso (via `metadata.courseId`) |
| `prod_premium` | Plano Premium | Todos os cursos ativos |

### Prices (4, todos `recurring` em BRL)

| lookup_key | Product | Tipo | Valor | Intervalo |
|---|---|---|---|---|
| `basico_monthly` | prod_basico | recurring | R$ 49,90 | month |
| `basico_yearly` | prod_basico | recurring | R$ 499,00 | year |
| `premium_monthly` | prod_premium | recurring | R$ 89,90 | month |
| `premium_yearly` | prod_premium | recurring | R$ 899,00 | year |

Cartão e Pix compartilham o mesmo Price (a diferença fica em `payment_method_types` + `payment_method_options` da `CheckoutSession`).

### Lookup em runtime

```ts
async function resolvePriceId(plan, billingCycle): Promise<string> {
  const prices = await stripe.prices.list({
    lookup_keys: [`${plan}_${billingCycle}`],
    limit: 1,
    active: true,
  })
  if (!prices.data[0]) throw new Error(`Price ${plan}_${billingCycle} not found`)
  return prices.data[0].id
}
```

### Script de bootstrap

`scripts/stripe-bootstrap.ts` — idempotente, cria/atualiza os 2 Products + 4 Prices via `lookup_key`. Roda uma vez por ambiente (test, live).

### Metadata em toda Checkout Session

```ts
{
  userId,
  plan: 'basico' | 'premium',
  billingCycle: 'monthly' | 'yearly',
  courseId: <id> | '',  // obrigatório pra basico
}
```

Também setada em `subscription_data.metadata` pra que eventos `invoice.*` subsequentes tenham contexto.

---

## Módulos de backend

### `lib/stripe.ts`

Substitui `lib/mercadopago.ts`. Zero lógica de negócio — só mapeia params.

**Exports:**

```ts
getStripe(): Stripe
resolvePriceId(plan, billingCycle): Promise<string>
priceAmountInCents(plan, billingCycle): number      // valor do mandate Pix em centavos
ensureStripeCustomer(user): Promise<string>          // persiste User.stripeCustomerId
createCheckoutSession(params): Promise<{ url, sessionId }>
createBillingPortalSession(userId, returnUrl): Promise<{ url }>
calculatePeriodEnd(start, billingCycle): Date
createEnrollmentsForSubscription(params): Promise<void>
removeEnrollmentsForSubscription(subscriptionId): Promise<void>
```

**Lógica chave em `createCheckoutSession`:**

```ts
return stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: stripeCustomerId,
  line_items: [{ price: priceId, quantity: 1 }],
  payment_method_types: [method],
  payment_method_options: method === 'pix' ? {
    pix: {
      mandate_options: {
        amount: priceAmountInCents(plan, billingCycle),  // ex: 4990 (Básico mensal) em centavos
        amount_type: 'fixed',
        payment_schedule: billingCycle === 'yearly' ? 'yearly' : 'monthly',
        reference: `Site do Barral - ${planLabel}`,
      },
    },
  } : undefined,
  subscription_data: {
    metadata: { userId, plan, billingCycle, courseId: courseId ?? '' },
  },
  success_url: `${baseUrl}/assinatura/sucesso?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${baseUrl}/assinatura/cancelado`,
  metadata: { userId, plan, billingCycle, courseId: courseId ?? '' },
})
```

**`removeEnrollmentsForSubscription`** preserva enrollments com `qrCodeId != null` (regra que já existe — alunos de sala presencial não perdem acesso).

### Rotas

| Rota | Método | Auth | Função |
|---|---|---|---|
| `POST /api/pagamento/checkout` | POST | `withAuth` | Cria Checkout Session, retorna `{ url }` |
| `POST /api/pagamento/webhook` | POST | assinatura Stripe | Dispatcher de eventos |
| `GET /api/conta/portal` | GET | `withAuth` | Redireciona pro Billing Portal |
| `GET /api/pagamento/status` | GET | `withAuth` | Retorna `{ subscription }` pro polling da tela de sucesso |

**Rotas deletadas:** `app/api/pagamento/pix/route.ts`.

**Validação Zod (checkout):**

```ts
const CheckoutSchema = z.object({
  plan: z.enum(['basico', 'premium']),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  method: z.enum(['card', 'pix']),
  courseId: z.string().optional(),
}).refine(
  (d) => d.plan !== 'basico' || !!d.courseId,
  { message: 'courseId obrigatório para plano Básico', path: ['courseId'] }
)
```

**Guard de assinatura duplicada (checkout):**

```ts
const active = await prisma.subscription.findFirst({
  where: {
    userId,
    status: { in: ['active', 'processing', 'past_due'] },
    currentPeriodEnd: { gt: new Date() },
  },
})
if (active) throw new ApiError(409, 'Você já tem uma assinatura ativa. Gerencie pelo portal.')
```

---

## Schema Prisma — delta

### `User`

```diff
model User {
  ...
  stripeCustomerId   String?   # já existia, passa a ser USADO
- mercadopagoPayerId String?
  ...
}
```

### `Subscription`

```diff
model Subscription {
  id                        String @id @default(uuid())
  userId                    String
  user                      User @relation(fields: [userId], references: [id], onDelete: Cascade)

+ stripeCustomerId          String?   # denormalizado pra query rápida
  stripeSubscriptionId      String? @unique
+ stripeCheckoutSessionId   String? @unique  # dedup adicional
  stripePriceId             String?

- mercadopagoPreapprovalId  String? @unique

  paymentMethod             String?   # 'card' | 'pix'
  plan                      String    # 'basico' | 'premium'
  billingCycle              String?   # 'monthly' | 'yearly'
  courseId                  String?
  status                    String    # 'active' | 'processing' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete'
  currentPeriodStart        DateTime
  currentPeriodEnd          DateTime
  cancelAtPeriodEnd         Boolean @default(false)

  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  @@index([userId])
  @@index([status])
  @@index([userId, status])
+ @@index([stripeSubscriptionId])
}
```

**Notas:**

- `stripeSubscriptionId` mantido nullable por precaução (estado transitório entre criação da session e webhook), na prática sempre preenchido após `checkout.session.completed`.
- Novo valor `'processing'` em `status` — PIX em processamento do Bacen (até 7 dias). Tratado como acesso válido.
- `hasAccessToCourse()` precisa aceitar `status IN ('active', 'processing')`.

### Nova tabela: `ProcessedWebhookEvent`

```prisma
model ProcessedWebhookEvent {
  stripeEventId String   @id
  eventType     String
  processedAt   DateTime @default(now())

  @@index([processedAt])
}
```

Dedup de webhooks. Insert com `ON CONFLICT DO NOTHING`; se colidiu, já foi processado.

### SQL da migração (idempotente)

```sql
-- 1. Remove MP
ALTER TABLE "User" DROP COLUMN IF EXISTS "mercadopagoPayerId";
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "mercadopagoPreapprovalId";

-- 2. Adiciona Stripe fields
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- 3. Índices
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeCheckoutSessionId_key"
  ON "Subscription"("stripeCheckoutSessionId");
CREATE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_idx"
  ON "Subscription"("stripeSubscriptionId");

-- 4. Dedup
CREATE TABLE IF NOT EXISTS "ProcessedWebhookEvent" (
  "stripeEventId" TEXT PRIMARY KEY,
  "eventType" TEXT NOT NULL,
  "processedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ProcessedWebhookEvent_processedAt_idx"
  ON "ProcessedWebhookEvent"("processedAt");
```

Aplicado via `scripts/migrate-mp-to-stripe.ts` com `@neondatabase/serverless`.

**Sanity opcional:** `DELETE FROM "Subscription"` para zerar linhas órfãs de testes (se existirem) antes da migração — decisão do operador no dia do deploy.

---

## Webhooks — eventos tratados

| Event type | Quando dispara | Ação |
|---|---|---|
| `checkout.session.completed` | Checkout pago (cartão ou PIX) | Cria `Subscription` local + enrollments; dispara e-mail de boas-vindas |
| `invoice.paid` | Cobrança recorrente bem-sucedida | Atualiza `currentPeriodEnd`; dispara e-mail de recibo |
| `invoice.payment_failed` | Renovação falhou | `status='past_due'`; dispara e-mail (cartão: "atualize"; pix: "ajuste mandato") |
| `customer.subscription.updated` | Mudança via Portal | Sincroniza `cancelAtPeriodEnd` e `status` |
| `customer.subscription.deleted` | Fim da assinatura | `status='canceled'`; remove enrollments; dispara e-mail de despedida |
| `charge.refunded` | Reembolso manual | `status='canceled'`; remove enrollments |
| `charge.dispute.created` | Chargeback | `status='canceled'`; remove enrollments; Sentry alert |

**Eventos explicitamente ignorados:**

```ts
const IGNORED = new Set([
  'payment_intent.created',
  'payment_intent.succeeded',
  'invoice.created',
  'invoice.finalized',
  'customer.created',
  'customer.updated',
  // ...lista completa no handler
])
```

Eventos não mapeados e não ignorados logam em `warn` pra facilitar debug.

### Esqueleto do dispatcher

```ts
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('no signature', { status: 400 })

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    logger.error('STRIPE_WEBHOOK_SECRET não configurado — webhook rejeitado')
    return new Response('misconfigured', { status: 500 })   // FAIL CLOSED
  }

  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret)
  } catch {
    return new Response('invalid signature', { status: 400 })
  }

  // Dedup
  try {
    await prisma.processedWebhookEvent.create({
      data: { stripeEventId: event.id, eventType: event.type },
    })
  } catch {
    return new Response('already processed', { status: 200 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': await handleCheckoutCompleted(event); break
      case 'invoice.paid':                await handleInvoicePaid(event); break
      case 'invoice.payment_failed':      await handleInvoiceFailed(event); break
      case 'customer.subscription.updated': await handleSubscriptionUpdated(event); break
      case 'customer.subscription.deleted': await handleSubscriptionDeleted(event); break
      case 'charge.refunded':             await handleChargeRefunded(event); break
      case 'charge.dispute.created':      await handleChargeDispute(event); break
      default:
        if (!IGNORED.has(event.type)) {
          logger.warn({ eventType: event.type }, 'evento não mapeado')
        }
    }
    return new Response('ok', { status: 200 })
  } catch (err) {
    // rollback do dedup para permitir retry do Stripe
    await prisma.processedWebhookEvent.delete({
      where: { stripeEventId: event.id },
    }).catch(() => {})
    logger.error({ err, eventType: event.type }, 'webhook handler error')
    return new Response('handler error', { status: 500 })
  }
}
```

---

## Frontend

### `/planos/page.tsx`

- Remove opção "Boleto" (UI + texto).
- Ambos os botões (Cartão, PIX) chamam `POST /api/pagamento/checkout` com `method` no body e fazem redirect via `window.location.href = url`.
- **Remove** o componente que renderiza QR code inline para PIX (o Stripe mostra o QR na página deles).
- Abaixo do botão PIX, texto obrigatório: **"Você vai autorizar um mandato Pix Automático no app do seu banco. Valor cobrado: R$ XX,XX por [mês|ano]."**
- Se `POST /api/pagamento/checkout` retornar 409: toast + botão "Gerenciar assinatura" linkando para `/api/conta/portal`.

### `/assinatura/sucesso/page.tsx`

- Polling client-side de `GET /api/pagamento/status?session_id=...` a cada 3s, por até 30s.
- Enquanto pendente: spinner + "Confirmando pagamento…".
- Se confirma dentro de 30s: redirect para `/area-restrita`.
- Se estoura 30s: mensagem "Estamos finalizando, você receberá um e-mail quando liberar."

### `/assinatura/cancelado/page.tsx`

- Texto: "Pagamento não concluído." + botão "Tentar novamente" → `/planos`.

### `/assinatura/pendente/page.tsx`

- **Deletado.** Redireciona para `/assinatura/sucesso` (com flag de "aguardando").

### `/area-restrita` — Gerenciar assinatura

- Mostrar botão "Gerenciar assinatura" se usuário tem `Subscription` em `status IN ('active', 'processing', 'past_due')`.
- Link: `GET /api/conta/portal`.
- Status legível ao lado:
  - `active` → "Assinatura ativa — próxima cobrança em DD/MM/AAAA"
  - `processing` → "Pagamento em processamento (Pix leva até 7 dias para confirmar)"
  - `past_due` → "Pagamento falhou — atualize seu cartão/mandato"
  - `canceled` → "Seu acesso encerra em DD/MM/AAAA" (sem botão)

### E-mails transacionais (Resend)

| Evento disparador | Template |
|---|---|
| `checkout.session.completed` | Boas-vindas ao [plano], link para área do aluno |
| `invoice.paid` (renovação) | Recibo de renovação, próxima cobrança |
| `invoice.payment_failed` (cartão) | Cartão recusado, link para portal |
| `invoice.payment_failed` (pix) | Mandato Pix insuficiente — ajuste no app do banco |
| `customer.subscription.deleted` | Confirmação de encerramento |

Helper: `sendSubscriptionEmail(template, user, payload)` com try/catch silencioso. E-mail falhar **não** retorna 500 no webhook.

---

## Segurança, envs, CSP

### Env vars

**Adicionar:**

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=   # opcional; reserva pra uso futuro com Elements
```

**Remover:**

```bash
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
```

**Validação hard em prod:** `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` obrigatórios; `getStripe()` lança no primeiro uso se faltar em prod; webhook dispatcher fail-closed.

**Nenhum segredo no client:** grep `STRIPE_SECRET_KEY` fora de `app/api/**` e `lib/` é regressão.

### CSP (`next.config.ts`)

Diff mínimo (o Checkout e o Portal são redirects completos, não iframe):

```diff
connect-src 'self' ...
- https://sdk.mercadopago.com
+ https://api.stripe.com

frame-src 'self' https://www.youtube.com https://vercel.live
- https://www.mercadopago.com.br
```

Nada a adicionar em `script-src` (Elements não é usado).

### Webhook endpoint no dashboard

- URL: `https://www.profdanielbarral.com/api/pagamento/webhook`
- Signing secret: copiar `whsec_...` → `STRIPE_WEBHOOK_SECRET`
- Eventos habilitados (exatamente 7, não "enviar todos"):
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `charge.refunded`
  - `charge.dispute.created`
- API version travada no cliente do SDK (a versão padrão do `stripe` npm package instalado; substituir pela mais recente estável no momento da implementação).

### Rate limiting

- `POST /api/pagamento/checkout`: **5 req/min/usuário**
- `GET /api/conta/portal`: **10 req/min/usuário**
- `POST /api/pagamento/webhook`: **sem rate limit** (Stripe precisa entregar)

Se o SdB não tem rate limiter instalado ainda, fica como risco aceito desta PR (sinalizar no plano).

### CPF

O backend **não** envia CPF para o Stripe Customer. Se o Stripe coletar CPF do pagador no próprio Checkout (pra compliance BR), é entre o usuário e o Stripe — o dado não passa pelo nosso servidor. Nota fiscal eletrônica = projeto separado futuro.

### Logs

- Webhook recebido → `debug { eventId, eventType }`
- Handler mutando DB → `info`
- Falha de handler → `error { err, eventType, eventId }` (sem payload cru)
- Nunca logar `payment_method_details` cru (pode ter últimos 4 dígitos)

---

## Rollout

### Ordem de commits numa única PR

1. **Bootstrap Stripe (sem código)** — conta em test mode, rodar `stripe-bootstrap.ts`, cadastrar webhook, copiar `whsec_...`.
2. **Schema + SQL** — `prisma/schema.prisma` com deltas; `scripts/migrate-mp-to-stripe.ts`; `npx prisma generate`.
3. **`lib/stripe.ts` + bootstrap** — biblioteca + script idempotente; sem rotas ainda.
4. **Rotas de API** — checkout, webhook, portal, status; deleta `api/pagamento/pix`; testes Vitest.
5. **Frontend** — `/planos`, `/assinatura/sucesso`, `/area-restrita`, remove `/assinatura/pendente`.
6. **E-mails Resend** — 5 templates.
7. **CSP + envs + docs** — `next.config.ts`, `.env.example`, atualiza CLAUDE.md.
8. **Remoção MP** — deleta `lib/mercadopago.ts`; `npm uninstall mercadopago`; `scripts/test-mercadopago.ts` deletado; `grep -ri mercado` zero em código.

### Gates antes de prod

- [ ] Stripe test mode configurado (products/prices/webhook)
- [ ] E2E manual em test mode: cartão assina → `invoice.paid` chega → `currentPeriodEnd` atualiza
- [ ] E2E manual em test mode: PIX assina → mandate criado → primeira cobrança sucedida → `processing` tolerado
- [ ] E2E manual: cancel via Portal → `cancelAtPeriodEnd=true`; acesso até fim do ciclo
- [ ] E2E manual: dispute no dashboard → handler remove acesso
- [ ] `grep -ri mercado` zero em `app/`, `lib/`, `components/`, `scripts/` (docs históricos ok)
- [ ] `npm test` verde
- [ ] `npm run lint` limpo
- [ ] `npm run build` passa

### Deploy em prod

1. Ativar live mode na conta Stripe.
2. Rodar `stripe-bootstrap.ts` em live.
3. Cadastrar webhook live → copiar `whsec_live_...`.
4. Setar envs live no Vercel; remover envs MP.
5. Rodar `migrate-mp-to-stripe.ts` contra Neon prod.
6. Deploy.
7. Smoke test: assinatura real (cartão + PIX) + cancel + reembolso no dashboard.
8. Anúncio aos usuários.

### Rollback

- **Código:** revert da PR.
- **Schema:** não há rollback parcial — colunas MP dropadas não voltam sozinhas. Se precisar reverter, revert código **+** reaplicar colunas MP via SQL manual. Este constraint está registrado e aceito.
- **Stripe:** conta live fica como está; zero custo enquanto não houver session.

---

## Testes

### Unit (Vitest)

- `lib/stripe.ts`:
  - `resolvePriceId` retorna ID correto para cada combinação
  - `calculatePeriodEnd` bate com mês/ano
  - `ensureStripeCustomer` cria/reutiliza
- Webhook dispatcher:
  - Evento não mapeado e não ignorado → warn, retorna 200
  - Evento já processado → no-op, retorna 200
  - Falha no handler → rollback de dedup, retorna 500

### Integration (Vitest + Prisma em DB de teste)

- `checkout.session.completed` (cartão) → cria Subscription com `stripeSubscriptionId`, enrollments
- `checkout.session.completed` (PIX, mandate) → cria Subscription com `paymentMethod='pix'`
- `invoice.paid` → atualiza `currentPeriodEnd`
- `customer.subscription.deleted` → `status='canceled'`, remove enrollments preservando `qrCodeId != null`
- `charge.dispute.created` → `status='canceled'`, remove enrollments
- Webhook duplicado (mesmo `event.id`) → segundo é no-op
- Guard de assinatura ativa no checkout → 409

### Manual E2E

Lista na seção Rollout (Gates). Não automatizo com Playwright nesta PR.

### Fora do escopo

- Cobertura exata
- Testes do SDK do Stripe
- UI E2E (Playwright) — se o SdB não tiver framework rodando ainda

---

## Gotchas mapeados

| # | Gotcha original (MP) | Status com Stripe |
|---|---|---|
| 1 | Sem renovação automática | **Resolvido** (cartão + Pix Automático) |
| 2 | Subscription criada só por webhook, sem polling | **Parcial** — `/api/pagamento/status` + polling na tela de sucesso |
| 3 | Webhook fail-open | **Resolvido** (fail-closed) |
| 4 | `paymentMethod` vem só do response | **Resolvido** |
| 5 | `external_reference` como JSON string | **Resolvido** (usa `metadata` nativa) |
| 6 | Refund só manual | **Parcial** — handler reage; refund ainda via dashboard |
| 7 | `currentPeriodStart/End` podem ficar no passado | **Resolvido** (`invoice.paid` resync) |
| 8 | QR code enrollments sticky após cancel | **Mantido** (feature, preservado) |
| 9 | Sem e-mail de confirmação | **Resolvido** (5 templates) |
| 10 | Sem guard de assinatura duplicada | **Resolvido** (409 na rota) |
| 11 | Campos Stripe legados no schema | **Resolvido** (ativamente usados) |
| 12 | Página pendente sem fluxo de resolução | **Resolvido** (deletada; polling + e-mail) |
| 13 | PIX sem recorrência | **Resolvido** (Pix Automático) |
| 14 | `billingCycle` stored-not-used | **Resolvido** (direciona Price + mandate `payment_schedule`) |
| 15 | Dispute não tratado | **Resolvido** (handler dedicado) |

### Dívida técnica aceita

- Refund self-service pelo usuário — fora de escopo
- Nota fiscal eletrônica — fora de escopo
- Admin dashboard de métricas (MRR, churn, LTV) — Stripe dashboard cobre

### Risco específico de Pix Automático

**Mandato imutável.** Com `amount_type='fixed'`, qualquer reajuste de preço quebra os mandatos ativos — clientes precisam refazer. Decisão aceita em 2026-04-14. Mitigação futura: se reajustar preço, criar novo Price com novo `lookup_key` (ex: `basico_monthly_v2`) e forçar novos assinantes pra ele; comunicar antigos por e-mail.

### Risco regulatório

Pix Automático exige que participantes do Bacen mantenham patrimônio líquido mínimo de R$ 5M a partir de 1º/01/2026. Restrição do **Stripe**, não nossa — consumimos o serviço. Se o Stripe perder a licença, é um bloqueio externo que exige plano B. Fora do escopo deste design.

---

## Dependências externas

- **Stripe** — conta ativa com Pix Automático habilitado para o Brasil
- **Resend** — já em uso no SdB
- **Neon PostgreSQL** — já em uso

---

## Referências

- [Pix payments — Stripe Docs](https://docs.stripe.com/payments/pix)
- [Accept a recurring Pix payment — Stripe Docs](https://docs.stripe.com/payments/pix/accept-a-recurring-payment)
- [Stripe Checkout — Subscription mode](https://docs.stripe.com/checkout/how-checkout-works#create-a-subscription)
- [Stripe Billing Portal](https://docs.stripe.com/customer-management)
- [Stripe Webhook best practices](https://docs.stripe.com/webhooks/best-practices)
