# Roadmap — Stripe Fase 3 (transição LIVE)

**Criado em:** 2026-04-25
**Última atualização:** 2026-04-25
**Autor:** Daniel Barral + Claude (sessão de validação E2E + páginas legais)
**Status:** Fases 1 e 2 ✅ fechadas. Fase 3 (LIVE) destravada — KYC concluído, falta config + smoke test final.

---

## ✅ O que está pronto

### Fase 1 — Modo TEST (concluída em 2026-04-24)
- Conta Stripe criada, KYC enviado
- 2 Products + 4 Prices criados via `scripts/stripe-bootstrap.ts` (lookup_keys: `basico_monthly`, `basico_yearly`, `premium_monthly`, `premium_yearly`)
- Envs `STRIPE_SECRET_KEY` (test), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test), `STRIPE_WEBHOOK_SECRET` (test) configuradas em `.env.local` e Vercel (Production + Preview)
- Webhook test mode cadastrado em `https://www.profdanielbarral.com/api/pagamento/webhook` com 6 eventos:
  - `checkout.session.completed`
  - `customer.subscription.{created,updated,deleted}`
  - `invoice.payment_{succeeded,failed}`
- Healthcheck validado (`POST` sem signature → 400)

### Fase 2 — Validação E2E (concluída em 2026-04-25)
- Customer Billing Portal habilitado e configurado:
  - cancel mode = `at_period_end` (alinhado com webhook)
  - `customer_update`, `payment_method_update`, `invoice_history` ON
  - `subscription_update`, `subscription_pause` OFF (intencional)
  - Default return URL: `https://www.profdanielbarral.com/area-restrita`
  - Headline: "Gerencie sua assinatura do Site do Prof. Daniel Barral"
- KYC ✅ verificado pela Stripe — `charges_enabled`, `payouts_enabled`, `details_submitted` todos OK
- Capabilities ativas: `card_payments`, `boleto_payments`, `transfers` (⚠️ Pix ainda não — ver pendências)
- Google Pay ativado no dashboard (aparece automaticamente sobre cartão no Checkout)
- E2E completo testado em prod (test mode) com `aluno@teste.com`:
  - Checkout cartão `4242` → Stripe Customer + Subscription criados → Enrollment `courseId=2` (básico) com `expiresAt=null`
  - Cancel via Customer Portal → DB atualizou `cancelAtPeriodEnd=true` (após fix do bug 2)
- **2 bugs do webhook descobertos e corrigidos** (commit `5edb4c3`):
  1. `invoice.payment_succeeded` cadastrado mas sem handler — quebraria renovação mensal
  2. `handleSubscriptionUpdated` ignorava `cancel_at` — Customer Portal moderno usa esse campo, não `cancel_at_period_end`
- Páginas legais criadas e deployadas em prod (commit `9eb901d`):
  - `/termos` (Termos de Uso) — 13 seções, CDC art. 49, foro do consumidor
  - `/privacidade` (Política de Privacidade LGPD) — 10 seções, tabela de bases legais, lista de processadores
  - Footer atualizado com links jurídicos

---

## 🚧 Pendências da Fase 3 (LIVE mode)

### Bloqueantes pré-LIVE

#### P1. Habilitar Pix Automático (assíncrono, depende da Stripe)
- **Status:** capability `pix_payments` não aparece nas opções do dashboard (provavelmente early access)
- **O que fazer:**
  1. Stripe Dashboard → Suporte → "Falar com nossa equipe"
  2. Mensagem sugerida:
     > Olá! Preciso habilitar **Pix Automático (Pix recorrente)** na minha conta para cobrar assinaturas mensais/anuais. Já tenho `card_payments` e `boleto_payments` ativos, e a conta está verificada. Podem habilitar a capability `pix_payments` (com `mandate_options` para recurring)?
  3. Aguardar resposta (1-3 dias úteis)
- **Não-bloqueia LIVE com cartão** — pode lançar com cartão e habilitar Pix depois

#### P2. Criar email `dpo@profdanielbarral.com`
- **Status:** referenciado na Política de Privacidade como canal do Encarregado, ainda não existe
- **Provedor de email atual:** Titan Email (MX `mx1.titan.email` / `mx2.titan.email`)
- **2 opções:**
  - **A) Alias/Forwarder (gratuito, recomendado):** no painel do registrar (Hostinger/GoDaddy/etc), criar `dpo@profdanielbarral.com` como encaminhamento pra `danbarral@gmail.com`. Pra responder como dpo@, configurar "Send mail as" no Gmail.
  - **B) Caixa nova (~R$ 8-15/mês):** adicionar usuário no Titan, login independente
- Sem isso, qualquer titular que mandar email pra dpo@ recebe bounce

#### P3. Cadastrar URLs jurídicas no Customer Portal
- **Onde:** Stripe Dashboard → Settings → Billing → Customer portal → Business information
- **Preencher:**
  - Terms of service URL: `https://www.profdanielbarral.com/termos`
  - Privacy policy URL: `https://www.profdanielbarral.com/privacidade`
- 2 minutos. Hoje aparece como "Nenhum link atualmente definido".

### Etapas da transição LIVE

#### P4. Trocar envs do Vercel Production pra LIVE
- **Onde:** Vercel Dashboard → projeto `sitedobarral` → Settings → Environment Variables
- **Trocar (em Production apenas, deixar Preview com test keys):**
  - `STRIPE_SECRET_KEY` → `sk_live_...`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
  - `STRIPE_WEBHOOK_SECRET` → `whsec_live_...` (vai gerar no passo P6)
- ⚠️ **NÃO mudar em Preview** — preview continua testando com test keys até a gente decidir

#### P5. Bootstrap Products + Prices em LIVE
```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
# Pegar a sk_live_ no Stripe Dashboard → Developers → API keys → live mode
STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/stripe-bootstrap.ts
```
- Idempotente — usa `lookup_key` pra detectar existência
- Vai criar `prod_basico_sdb`, `prod_premium_sdb` + 4 Prices em live

#### P6. Cadastrar webhook em LIVE
- **Stripe Dashboard (live mode!) → Developers → Webhooks → Add endpoint**
- URL: `https://www.profdanielbarral.com/api/pagamento/webhook`
- Eventos (mesmos 6 do test):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Após criar, copiar o **Signing secret** (`whsec_...`) e colar em `STRIPE_WEBHOOK_SECRET` (P4)
- Repetir Customer Portal config em live mode (mesmas opções da Fase 2)

#### P7. Redeploy production
- Após trocar envs (P4), fazer redeploy pra carregar as novas:
  ```bash
  cd "/c/Projeto de site do Barral/sitedobarral-stripe"
  git commit --allow-empty -m "chore: redeploy para carregar envs LIVE"
  git push
  ```
- Ou no dashboard Vercel: deploy mais recente → ⋯ → "Redeploy"
- Depois promover pra production:
  ```bash
  npx vercel ls   # pega a URL do preview novo
  npx vercel promote <URL> --yes
  ```
- Validar com `scripts/check-stripe-account.ts` — modo deve aparecer como `LIVE`
- Validar healthcheck: `POST /api/pagamento/webhook` sem signature → 400

#### P8. Smoke test final em LIVE com cartão real
- Criar (ou reusar) usuário de teste pessoal logado em `/planos`
- Assinar **Plano Básico Mensal (R$ 49,90)** com cartão **real** seu
- Validar via `scripts/check-test-result.ts`:
  - Subscription criada com `stripeSubscriptionId` em formato live (`sub_1...`)
  - Enrollment criado
  - Webhook eventos processados
- **Imediatamente reembolsar pelo dashboard Stripe:**
  - Customers → seu user → Subscriptions → cancelar imediatamente (não at_period_end)
  - Charges → o R$ 49,90 → Refund full
- Validar que `customer.subscription.deleted` chega → enrollment é removido (não tem QR)

---

## Comandos úteis (scripts criados durante a sessão)

Todos rodam com `npx dotenv -e .env.local -- npx tsx scripts/<nome>.ts`. Só leitura, sem efeito colateral.

| Script | Uso |
|---|---|
| `scripts/check-stripe-env.ts` | Confirma 3 vars Stripe carregadas em `.env.local` (mostra prefixo + últimos 4 chars) |
| `scripts/check-stripe-account.ts` | Capabilities, requirements e disabled_reason; aponta se conta está pronta pra LIVE |
| `scripts/check-stripe-portal.ts` | Lê config ativa do Customer Portal e valida features ON/OFF + cancel mode |
| `scripts/verify-stripe-prices.ts` | Confirma que os 4 lookup_keys resolvem |
| `scripts/check-test-result.ts` | Verificação ponta-a-ponta após teste de assinatura (DB + Stripe API) — espera `aluno@teste.com` |
| `scripts/check-test-candidates.ts` | Lista admins, total de usuários e candidatos não-admin pra E2E |
| `scripts/check-cancel-state.ts` | Retrieve direto de uma subscription com foco em campos de cancelamento |
| `scripts/check-recent-events.ts` | Lista os últimos 50 eventos da conta sem filtro |
| `scripts/inspect-event.ts <event_id>` | Retrieve detalhado de um event id (incluindo `previous_attributes`) |
| `scripts/dump-account-fields.ts` | Dump de campos relevantes de Account (`business_profile`, `company`, `settings.*`) |
| `scripts/stripe-bootstrap.ts` | Cria Products + Prices idempotente (rodar em test e em live) |

---

## Notas técnicas (gotchas descobertos — pra não repetir)

### Customer Portal usa `cancel_at`, não `cancel_at_period_end`
Em 2026-04-25 o Customer Portal moderno agenda cancelamentos via `cancel_at` (timestamp), e mantém `cancel_at_period_end: false`. Nosso `handleSubscriptionUpdated` foi ajustado pra derivar `cancelAtPeriodEnd: true` quando qualquer um dos dois sinaliza cancel. Se algum dia precisarmos da data exata do cancel agendado, adicionar coluna `cancelAt: DateTime?` no schema (hoje confiamos que coincide com `currentPeriodEnd`).

### `invoice.paid` vs `invoice.payment_succeeded`
Os dois eventos disparam em cobranças bem-sucedidas (event.ids distintos). O webhook está cadastrado pra ouvir `invoice.payment_succeeded`; mapeamos os DOIS pro mesmo `handleInvoicePaid` por defesa. Idempotência garantida por `ProcessedWebhookEvent`.

### Standard accounts BR usam `settings.dashboard.*`, não `business_profile.*`
Conta tipo `standard` no Brasil não popula `business_profile.name` — o display name fica em `acc.settings.dashboard.display_name` e o statement descriptor em `acc.settings.payments.statement_descriptor`. Não confiar em `business_profile` pra validar dados públicos.

### `accounts.retrieve()` sem args
SDK v22 tipa `accounts.retrieve(id)` com id obrigatório, mas a API aceita sem args (retorna a conta da chave). Usar cast pra `any`.

### Vercel: branch `stripe-migration` é Preview, não Production
A production branch no Vercel é `main` (alias `sitedobarral-git-main-...`). Push em `stripe-migration` sempre vira preview. Pra ir pra prod tem que `vercel promote <preview-url> --yes` (vai rebuildar com env de production). Quando a feature estiver fechada, mergear `stripe-migration` em `main` define isso permanentemente.

### CRLF warnings no Windows
Editor está salvando como LF; Git no Windows reescreve pra CRLF na próxima escrita. Apenas warning — sem efeito no comportamento. Pode ignorar.

---

## Como retomar

1. `cd "/c/Projeto de site do Barral/sitedobarral-stripe"`
2. `git checkout stripe-migration && git pull`
3. Ler este arquivo + (referência) `docs/superpowers/specs/2026-04-14-stripe-migration-design.md`
4. Decidir por onde começar (sugestão: P3 → P5 → P6 → P4 → P7 → P8 — Pix e DPO podem rodar em paralelo)
5. Validar cada passo com o script correspondente da tabela de comandos

---

## Rollback (se algo der errado em LIVE)

1. **Imediato:** suspender o webhook live no Stripe Dashboard (pra parar retries) → `Disabled`
2. Reverter os 3 envs do Vercel Production de volta pras chaves test (cópia de Preview)
3. Redeploy
4. Subscriptions live já criadas ficam órfãs no Stripe, mas a conta volta a operar em test mode
5. Investigar a causa, corrigir, repetir P5-P8
