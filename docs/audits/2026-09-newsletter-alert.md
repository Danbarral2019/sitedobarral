# Alerta Newsletter — Setembro 2026

**Timestamp do check:** 2026-09-02T12:00 UTC (disparo agendado do dia 2)
**Mês de referência:** 2026-09
**Status:** ALERTA — Endpoint inacessível

---

## Resultado do check

O agente de monitoramento não conseguiu acessar o endpoint `/api/newsletter-health` em **nenhum** dos dois domínios configurados:

| Domínio | Resultado |
|---|---|
| `https://www.profdanielbarral.com/api/newsletter-health` | 403 — conexão rejeitada pelo proxy de egresso |
| `https://www.profbarral.com.br/api/newsletter-health` | 403 — conexão rejeitada pelo proxy de egresso |

O erro retornado foi:
```
curl: (22) The requested URL returned error: 403
[agent-proxy] connect_rejected (the egress proxy denied the CONNECT
(organization policy) or could not reach the destination)
```

**Obs.:** O 403 é do proxy de egresso da sessão remota Claude Code (política de rede do ambiente), não necessariamente do site em si. O site pode estar no ar, mas o ambiente de execução remoto não tinha permissão para conectar-se a hosts externos.

---

## Impacto

Como o endpoint estava inacessível, **não foi possível determinar** se o cron `monthly-newsletter` do dia 1/set/2026 (09:00 UTC) foi executado com sucesso.

---

## Condições que não puderam ser verificadas

- `monthly.dispatchedThisMonth` — não verificado
- `monthly.lastDispatchInProcessing` — não verificado
- `monthly.lastTotalFailed` / `lastTotalSent` — não verificados

---

## Hipóteses e próximos passos

### Se o site estiver fora do ar
- Verificar status em **Vercel Dashboard** → projeto `sitedobarral` → Deployments.
- Verificar domínios no Vercel (DNS, certificados SSL).

### Se o site estiver no ar mas o cron falhou
- Verificar **Vercel → Cron Jobs → `monthly-newsletter`** → histórico de execuções do dia 01/09/2026.
- Verificar logs de runtime em Vercel para o cron (erros, timeouts).

### Para disparar a newsletter manualmente (se o cron de fato não rodou)
```
Vercel → projeto sitedobarral → Settings → Cron Jobs → monthly-newsletter → Run
```

### Para consultar o endpoint manualmente
```bash
curl https://www.profdanielbarral.com/api/newsletter-health
```

---

## Referências

- Endpoint criado em commit `87130ca` (2026-05-01).
- Cron corrigido em commit `719e013` (2026-05-01): `maxDuration=300s`, fallbacks IA, `NewsletterSend.create` antecipado.
- Vercel Cron schedule: dia 1 às 09:00 UTC.
