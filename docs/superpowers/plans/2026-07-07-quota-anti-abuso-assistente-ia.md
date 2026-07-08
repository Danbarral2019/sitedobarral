# Quota anti-abuso do Assistente IA — Plano (executar 2026-07-08)

> **Objetivo:** impedir que abuso (scripts, contas compartilhadas, trials gratuitos) gere custo ilimitado de Claude/Gemini. Transformar "risco de prejuízo ilimitado" em "custo previsível por usuário". **Não consome Claude API** (é código: Upstash Redis + lógica).
>
> **Status:** PLANO. Decisões marcadas **[CONFIRMAR]** são defaults propostos — Daniel valida antes de executar.

## Contexto / estado atual (verificado 2026-07-07)

- **Já existe throttle anti-burst:** `checkRateLimit` (Upstash, `lib/cache/redis-client.ts`) + helper `lib/cache/rate-limit-helper.ts` (`enforceRateLimit`). O `/api/documents/query` limita **10 perguntas/min** por usuário não-admin.
- **O problema:** 10/min é anti-rajada, **não** impede abuso sustentado — 10/min × 24h ≈ **14.400 respostas/dia ≈ ~R$4.300/dia** (a ~R$0,30/resposta). Não há **quota diária/mensal** nem diferenciação **trial/QR (grátis) vs pagante**.
- **Buraco de cobertura:** `/api/jurisprudencia/query` **não tem limite nenhum** (endpoint de IA desprotegido). `/documents/query`, `/artigos/[numero]/chat`, `/lei-14133/search` têm o 10/min.
- **Sem kill-switch global** de custo (proteção contra ataque coordenado ou bug em loop).
- **Custo por resposta** (Claude Sonnet 5 + Citations, contexto ~20k tokens): ~R$0,30 (promo) a ~R$0,45 (padrão). Ver análise de custo na conversa de 2026-07-07.
- **Infra reaproveitável:** `redis-client.ts` tem `incrementCache`, `checkRateLimit`, `getCache/setCache`. `enrollment-utils.ts` tem `getActivePlanType`, `checkSubscriptionAccess`, e `qrCodeId` distingue trial/QR. Auth expõe `userId` e `role` (`verifyAuth`).

## Decisões de design

### 1. Modelo de quota em 3 camadas
- **Camada A — anti-burst (mantém a existente):** 10/min por usuário. Já implementado.
- **Camada B — quota diária + mensal por usuário, por tier** (NOVO — o coração da proteção):

  | Tier | Como identificar | Diária **[CONFIRMAR]** | Mensal **[CONFIRMAR]** | Racional |
  |---|---|---|---|---|
  | **Admin** | `role === 'admin'` | ∞ | ∞ | Sem limite |
  | **Premium** | `getActivePlanType === 'premium'` | 100 | 600 | Maior mensalidade (R$89,90) |
  | **Básico** | plano `basico` ativo | 50 | 300 | R$49,90 |
  | **Trial/QR (grátis)** | enrollment com `qrCodeId` e sem subscription | 30 | 100 | **Sem receita** → teto mais apertado; ainda generoso para avaliar |

  > **Nota de margem [CONFIRMAR]:** estes são **tetos anti-abuso**, não orçamento do usuário mediano (que faz ~20-50/mês, muito abaixo). Um usuário no teto de Básico (300/mês × R$0,30 = R$90) excederia a mensalidade — mas isso é a CAUDA, não a mediana. Para proteger margem por usuário além do teto, combinar com: (a) **prompt caching** (BIA-2/caching, ~40% mais barato/resposta) e/ou (b) **Gemini para trial** (fase 2 abaixo). Se Daniel preferir tetos alinhados à margem, reduzir Básico p/ ~100/mês e Premium p/ ~250/mês.

- **Camada C — kill-switch global de custo** (NOVO): contador global diário de respostas de IA; se ultrapassar `AI_DAILY_GLOBAL_CAP` (env, default **[CONFIRMAR]** 5000/dia), **desliga a síntese IA no site inteiro** (degrada para busca sem IA) até a virada do dia. Protege contra ataque coordenado / bug em loop. Alerta Sentry em 80%.

### 2. Comportamento ao estourar a quota **[CONFIRMAR]**
- **Default proposto:** bloqueio suave — HTTP 429 + mensagem amigável em PT:
  - Trial: *"Você atingiu seu limite de perguntas ao Assistente IA no período. Assine um plano para perguntar sem esse limite."* (+ CTA de upgrade).
  - Pagante: *"Você atingiu seu limite diário/mensal de perguntas ao Assistente. O limite renova em \<quando\>."*
- **Alternativa (toggle fácil):** em vez de bloquear, **degradar para busca-sem-IA** (retorna resultados de busca/FTS, sem o card de síntese). Menos abrupto, custo zero. Decidir qual é o default.

### 3. Onde identificar o tier
- Helper `resolveUserAiTier(userId): 'admin'|'premium'|'basico'|'trial'` — usa `verifyAuth` (role) + subscription/enrollment (`getActivePlanType`, `qrCodeId`). Cache curto (ex.: 60s) do tier por usuário para não bater no DB a cada pergunta.

### 4. Consistência de cobertura
- Aplicar a quota (Camada B + C) a **todos** os endpoints de IA que custam: `/documents/query`, `/jurisprudencia/query` (**hoje sem limite**), `/artigos/[numero]/chat`, `/lei-14133/search`, e qualquer RAG de planejamento que chame LLM. Extrair um helper único `enforceAiQuota(userId)` para não duplicar.

## Arquitetura / arquivos

- **Criar `lib/cache/ai-quota.ts`:**
  - `AI_QUOTA_LIMITS` (config por tier — diária/mensal).
  - `resolveUserAiTier(userId)` (com cache curto).
  - `enforceAiQuota(userId)`: resolve tier → checa diária + mensal (via `incr` Redis com TTL até fim do dia/mês) → incrementa contador global → checa kill-switch. Lança `QuotaExceededError` (novo erro semântico em `lib/errors/api-error.ts`) com `{ scope: 'daily'|'monthly'|'global', resetAt }`.
  - `AI_DAILY_GLOBAL_CAP` via env.
- **Modificar** os 4 (5) route handlers de IA: chamar `enforceAiQuota(userId)` **antes** de qualquer chamada LLM (após o 10/min existente). Admin faz bypass.
- **`lib/errors/error-handler.ts`:** mapear `QuotaExceededError` → 429 com corpo amigável.
- **Frontend (`AIAnswerCard`/`useGlobalSearch`):** tratar o 429 de quota exibindo a mensagem amigável + (trial) CTA de upgrade; opcionalmente mostrar "X perguntas restantes hoje".

## Plano de implementação (tarefas)

- [ ] **T1 — Config + tier resolver.** `lib/cache/ai-quota.ts`: `AI_QUOTA_LIMITS` + `resolveUserAiTier(userId)` (com cache 60s). Teste: cada combinação (admin/premium/basico/trial) resolve o tier certo. *(1 arquivo + teste)*
- [ ] **T2 — Núcleo `enforceAiQuota` (TDD).** Contadores diária+mensal via Redis `incr`+`expire` (chaves `ai:quota:d:${userId}:${YYYY-MM-DD}` e `:m:${userId}:${YYYY-MM}`); lança `QuotaExceededError` com scope+resetAt; admin bypass. Novo erro em `api-error.ts` + mapeamento 429 em `error-handler.ts`. Testes: dentro do limite passa; no limite+1 lança; diária vs mensal; admin ilimitado. *(Redis mockado nos testes, como em `quota-exhausted.test.ts`.)*
- [ ] **T3 — Kill-switch global (TDD).** Contador global diário + `AI_DAILY_GLOBAL_CAP` (env); ao exceder, `enforceAiQuota` sinaliza degradação global; alerta Sentry em 80%. Testes: abaixo do cap ok; acima degrada; alerta dispara.
- [ ] **T4 — Wire em `/documents/query`.** Chamar `enforceAiQuota` após o 10/min. Manter o burst. Ajustar o teste existente.
- [ ] **T5 — Wire em `/jurisprudencia/query`** (adicionar 10/min **e** `enforceAiQuota` — hoje 100% desprotegido).
- [ ] **T6 — Wire em `/artigos/[numero]/chat` e `/lei-14133/search`** (`enforceAiQuota` + manter burst).
- [ ] **T7 — Resposta amigável ao estourar.** 429 + mensagem PT por tier (+ CTA upgrade p/ trial). Definir default: bloqueio vs degradar-para-busca.
- [ ] **T8 — Frontend.** `AIAnswerCard`/hook: tratar 429 de quota (mensagem + CTA); opcional "N restantes hoje".
- [ ] **T9 — Observabilidade.** Log estruturado de quota-hit; alerta Sentry no kill-switch; (opcional) endpoint admin de top consumidores do dia.
- [ ] **T10 — Deploy + smoke.** Setar `AI_DAILY_GLOBAL_CAP` na Vercel; validar em prod (usuário de teste estoura quota e vê a mensagem; admin não é limitado).

## Fase 2 (opcional, maior impacto de custo — decidir depois)
- **Roteamento de modelo por tier:** Gemini Flash (~10-20× mais barato) como padrão para **trial**, Claude Sonnet 5 + Citations para **pagantes**. Reduz o custo por resposta do público sem receita. Reaproveita a camada `lib/ai/` (porta única `generate`). Mede impacto na régua (BIA-1) para garantir que a qualidade do trial segue aceitável.
- **Prompt caching** no prefixo estável da síntese (system + camada Lei) → ~40% mais barato/resposta para todos.

## Riscos / notas
- **Não quebrar produção:** `AI_DAILY_GLOBAL_CAP` alto o suficiente; degradação (não erro 500) quando o kill-switch dispara; admin sempre isento.
- **Contadores atômicos:** usar `incr` do Redis (atômico) — não read-modify-write.
- **TTL correto:** chave diária expira à meia-noite; mensal no fim do mês (calcular segundos restantes).
- **Multi-instância serverless:** Redis já resolve (o helper existente foi criado exatamente para isso).
- **Custo do plano em si:** R$0 de LLM — é infra/lógica.
