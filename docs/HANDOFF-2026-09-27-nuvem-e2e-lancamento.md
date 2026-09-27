# Handoff para sessão na nuvem: testes E2E dos fluxos de lançamento (P2)

Data: 27/09/2026. Autor do pedido: Daniel. Repositório: `Danbarral2019/sitedobarral`, branch nova a partir de `main`
(sugestão: `test/e2e-fluxos-lancamento`).

## Objetivo

Transformar em testes automáticos a checklist **P2 — Verificação Manual Pós-Deploy** do `FUTURE_TASKS.md`, único item
marcado como BLOQUEANTE para o lançamento. O site está em pré-lançamento (`COMING_SOON_ENABLED` ativo) e a checklist
nunca foi executada de ponta a ponta. Entrega: specs Playwright rodando no job `e2e` da CI, em PR para o Daniel revisar.

Fluxos a cobrir:

1. Registro **sem** QR code → verificação de email → login → página de planos.
2. Registro **com** QR code → verificação → login → área restrita com a matrícula de 1 mês (trial).
3. Reenvio do email de verificação com token → o novo token funciona e o antigo não.
4. Email de boas-vindas com acentos corretos (verificar o HTML/texto gerado, não a caixa de entrada).
5. Checkout Stripe (cartão) → webhook → `Subscription` + `Enrollment` criados; cancelamento remove só as matrículas
   **sem `qrCodeId`** (as presenciais ficam).

Fora do escopo: PIX (depende de convite da Stripe; está atrás de `NEXT_PUBLIC_PIX_ENABLED`) e a renderização da
newsletter no Gmail/Outlook (verificação visual, fica com o Daniel).

## Restrições

- 🔴 **Nunca tocar o banco de produção.** Os testes rodam só no banco descartável da CI. `e2e/fixtures/database.ts`
  (`resolveE2EDatabaseUrl`) recusa `DATABASE_URL` remota; manter essa trava e não contorná-la. Houve um spec que
  gravava em produção por engano (commit `72e167ce`) — atenção a código que passa por `lib/prisma`, que lê
  `DATABASE_URL`, não `TEST_DATABASE_URL` (ver o comentário no passo "Run isolated database scenarios" de
  `.github/workflows/test.yml`).
- 🔴 **Não chamar Gemini, Claude nem outro LLM.** O teto do Gemini de produção estourou em 26/09.
- 🔴 **Não enviar email de verdade** nem cobrar cartão de verdade. Nada de chave `sk_live_`.
- Há uma outra sessão na nuvem rodando a carga de acórdãos do TCU no banco de produção (PR #229). Esta sessão não
  deve rodar scripts contra o banco de produção em hipótese alguma.
- Não mexer em `lib/stripe.ts`, no webhook nem nas rotas de auth, salvo bug real encontrado pelos testes; nesse caso,
  parar, descrever o bug e perguntar antes de corrigir (site em produção, pagamento LIVE).

## O que já existe (reusar)

| Peça | Arquivo | Observação |
|---|---|---|
| Config Playwright | `playwright.config.ts` | Sobe `npm run dev`, `globalSetup` = `scripts/e2e-seed.ts`. |
| Trava de banco + login por cookie | `e2e/fixtures/database.ts` | `authenticateAs()` injeta JWT; os fluxos novos devem fazer login **pela UI**, que é o que se quer testar. |
| Seed | `scripts/e2e-seed.ts` | Usuários/curso/matrículas fixos. Acrescentar o que faltar (QR code válido, curso `'1'`). |
| Job de CI | `.github/workflows/test.yml` (job `e2e`) | Cria branch Neon `schema-only` descartável, roda specs listados explicitamente e apaga a branch. **Os specs novos precisam ser incluídos na lista.** |
| Specs de referência | `e2e/*.spec.ts` | Seguir o estilo de `course-expiration.spec.ts` e `admin-authorization.spec.ts`. |
| Rotas de auth | `app/api/auth/{register,verify-email,send-verification,validate-qr,login,…}` | |
| Webhook Stripe | `app/api/pagamento/webhook/route.ts` | Verifica assinatura com `constructEvent` (linha ~438). Idempotência via `ProcessedWebhookEvent`. |
| Teste unitário do webhook | `app/__tests__/webhook-route.test.ts` | Mostra como montar os eventos. |

## Como construir

1. **Email.** Descobrir como `register`/`send-verification` se comportam sem `RESEND_API_KEY` ou com chave de teste.
   O teste precisa obter o token de verificação sem caixa de entrada: ler do banco descartável (preferível) ou
   interceptar o envio. Não adicionar backdoor em rota de produção; se for preciso um gancho, que seja ativo só com
   variável de ambiente exclusiva de teste e desligado por padrão, e perguntar antes.
2. **Stripe sem rede.** Para o webhook: gerar um `STRIPE_WEBHOOK_SECRET` de teste só para a CI e assinar os payloads
   com `stripe.webhooks.generateTestHeaderString` — cobre `checkout.session.completed`, `invoice.paid`,
   `customer.subscription.deleted` e `invoice.payment_failed`, e o reenvio do mesmo `event.id` (idempotência).
   Para o checkout (`POST /api/pagamento/checkout`): validar a entrada (Zod) e, se houver `STRIPE_SECRET_KEY` de
   **teste** nos secrets da CI, a criação da sessão até o `url` de redirecionamento; sem a chave, pular com
   `test.skip` e mensagem clara. Não automatizar o formulário hospedado da Stripe.
3. **Coming-soon.** O middleware desvia rotas quando `COMING_SOON_ENABLED=true`. Garantir que o ambiente de teste
   deixe os fluxos acessíveis (o dev server da CI não deve herdar essa flag) e registrar no PR como isso foi tratado.
4. **Isolamento.** Cada teste cria seus próprios usuários com email único (`e2e-<fluxo>-<timestamp>@example.test`),
   para rodar em paralelo (`fullyParallel: true`) sem colisão.
5. **CI.** Incluir os specs novos no passo "Run isolated database scenarios" (ou num passo próprio) e listar no PR
   quais secrets novos a CI precisa (ex.: `STRIPE_SECRET_KEY` de teste, `STRIPE_WEBHOOK_SECRET` de teste), sem
   criá-los: quem cadastra secrets é o Daniel.

## Critério de pronto

- Specs verdes na CI, rodando no banco descartável. Rodar 2 vezes para confirmar que não são instáveis.
- Cada item da checklist P2 mapeado a um teste, ou explicitamente marcado como fora do escopo, com o motivo.
- Bugs encontrados: descritos no PR, não corrigidos sem autorização.
- PR em rascunho, com a descrição em português, no tom formal do projeto, dizendo o que ficou coberto, o que não
  ficou e o que o Daniel precisa fazer (secrets).
- Atualizar a seção P2 do `FUTURE_TASKS.md` marcando o que passou a ter teste automático.
