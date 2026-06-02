# Alerta: Newsletter 2026-06 — Disparo Incompleto

**Check realizado em:** 2026-06-02T12:04:44.619Z  
**Mês de referência:** 2026-06

---

## JSON completo retornado pelo endpoint

```json
{
  "checkedAt": "2026-06-02T12:04:44.619Z",
  "currentMonth": "2026-06",
  "monthly": {
    "dispatchedThisMonth": true,
    "dispatchesThisMonthCount": 1,
    "lastSentAt": "2026-06-01T09:00:31.363Z",
    "lastSubject": "[em processamento] Newsletter mensal — disparo iniciado",
    "lastTotalSent": 0,
    "lastTotalFailed": 0,
    "lastDispatchInProcessing": true
  },
  "subscribers": {
    "active": 10
  }
}
```

---

## Condições tripadas

| Condição | Valor | Status |
|---|---|---|
| `dispatchedThisMonth === false` | `true` (cron rodou) | ✅ OK |
| `lastDispatchInProcessing === true` | `true` | ❌ **ALERTA** |
| `lastTotalFailed > 0 AND lastTotalSent === 0` | `0 > 0` → false | ✅ OK |
| `lastTotalFailed > lastTotalSent` | `0 > 0` → false | ✅ OK |

**Condição tripada:** `lastDispatchInProcessing === true`

O cron `monthly-newsletter` iniciou às **2026-06-01T09:00:31Z**, criou o registro `NewsletterSend` com subject `[em processamento] Newsletter mensal — disparo iniciado`, mas **nunca concluiu** o envio. `lastTotalSent` permanece em `0`, indicando que nenhum email foi entregue aos 10 assinantes ativos.

---

## Hipóteses

**`lastDispatchInProcessing === true`** — O cron iniciou (criou o registro `NewsletterSend`) mas crashou no meio da execução antes de atualizar o subject e os contadores finais. Possíveis causas:

1. **Timeout Vercel** — função excedeu `maxDuration=300s` (corrigido em commit `719e013`; improvável, mas verificar se o deploy da época tinha a correção).
2. **Crash na geração do conteúdo IA** — falha na chamada Anthropic/Gemini ao gerar o conteúdo da newsletter (rate limit, timeout de provider externo).
3. **Erro no Resend** — API key inválida, rate limit, ou domínio bloqueado; função crashou na primeira chamada de envio.
4. **Erro de banco (Prisma/Neon)** — conexão perdida após o `NewsletterSend.create` inicial.

---

## Como investigar

1. **Vercel Logs** → projeto `sitedobarral` → aba **Logs** → filtrar por `monthly-newsletter` em `2026-06-01` às 09:00 UTC → procurar stack trace ou erro de timeout.
2. **Resend Dashboard** → verificar se há tentativas de envio registradas em `2026-06-01` às 09h.

---

## Ação recomendada

Disparar manualmente via **Vercel → Cron Jobs → `monthly-newsletter` → Run**.

> ⚠️ Antes de disparar, verificar se o registro `[em processamento]` em `NewsletterSend` será sobrescrito ou se criará duplicata — para evitar enviar a newsletter duas vezes para os mesmos assinantes.
