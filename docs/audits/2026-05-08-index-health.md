# Audit: Index Queue Health Check — 2026-05-08

**Timestamp:** 2026-05-08T12:00:49Z  
**Agente:** scheduled one-shot monitor  
**Status:** ⚠️ UNHEALTHY — site inacessível

---

## Resultado do Fetch

### Domínio primário: `profbarral.com.br`

```
curl: (6) Could not resolve host: profbarral.com.br
```

**Causa:** falha de resolução DNS — domínio inexistente ou sem registro DNS configurado.

### Domínio fallback: `profdanielbarral.com` (e `www.profdanielbarral.com`)

```
HTTP/2 403
x-deny-reason: host_not_allowed
content-type: text/plain
```

**Causa:** Vercel está rejeitando todas as requisições com `host_not_allowed`. O domínio não está vinculado ao projeto Vercel, ou o binding foi removido/expirou.

### JSON retornado

Nenhum — endpoint `/api/index-health` não foi alcançado em nenhum dos domínios.

---

## Thresholds avaliados

Não foi possível avaliar thresholds numéricos pois o endpoint está inacessível. O próprio site está down — estado **UNHEALTHY (site quebrado)**.

---

## Causa provável

O header `x-deny-reason: host_not_allowed` é específico do Vercel e indica uma das seguintes situações:

1. **Domínio desvinculado no Vercel:** o domínio `profdanielbarral.com` foi removido da lista de domínios do projeto em `vercel.com/danbarral2019/sitedobarral/settings/domains`.
2. **SSL expirado ou falha no bind:** o certificado TLS ou o bind do domínio falhou silenciosamente após um redeploy ou alteração de DNS.
3. **Projeto deletado/arquivado:** o projeto Vercel pode ter sido arquivado, causando rejeição de todos os hosts.
4. **Alteração de DNS apontando para servidor errado:** o registro A/CNAME pode estar apontando para um IP/host Vercel errado (ex: projeto antigo ou região diferente).

O domínio `profbarral.com.br` com falha DNS sugere que esse era um alias recente ainda sem propagação, ou um domínio planejado que ainda não foi registrado/configurado.

---

## Ações recomendadas

### 1. Verificar configuração de domínio no Vercel (PRIORIDADE MÁXIMA)

Acesse: `https://vercel.com/danbarral2019/sitedobarral/settings/domains`

- Confirme que `profdanielbarral.com` e `www.profdanielbarral.com` estão listados e com status **Valid**.
- Se aparecer erro de DNS ou certificado, clique em **Refresh** ou **Remove and re-add** o domínio.

### 2. Verificar registros DNS

No painel do registrador do domínio:

```
profdanielbarral.com     A/CNAME → deve apontar para Vercel
www.profdanielbarral.com CNAME   → cname.vercel-dns.com
```

Validar com: `dig profdanielbarral.com` ou `nslookup profdanielbarral.com`

### 3. Verificar deployments recentes no Vercel

```
https://vercel.com/danbarral2019/sitedobarral/deployments
```

Checar se o último deploy concluiu com sucesso e se não há erros de build que possam ter causado rollback para configuração sem domínio.

### 4. Verificar function logs (para quando o site voltar)

```
https://vercel.com/danbarral2019/sitedobarral/functions
```

Filtrar por `/api/cron/process-index-jobs` e `/api/index-health` para avaliar se o cron estava funcionando antes da queda.

---

## Comandos para rodar localmente (quando o site voltar)

Se após restaurar o site a fila de indexação estiver degradada, executar:

```bash
# Backfill de embeddings pendentes (documents + legislative acts)
npx dotenv -e .env.local -- npx tsx scripts/backfill-pending-embeddings.ts --apply

# Gerar resumos didáticos de atos legislativos sem summary
npx dotenv -e .env.local -- npx tsx scripts/generate-legislative-act-summaries-gemini.ts --apply

# Verificar status atual da indexação
npx tsx scripts/migrate-to-embeddings.ts --dry-run
npx tsx scripts/index-legislative-acts.ts --dry-run
```

---

## Contexto técnico

- **Cron de indexação:** `/api/cron/process-index-jobs` — corrigido em commit `379db18` (2026-05-01), deveria rodar a cada 15 min
- **Endpoint de health:** `/api/index-health` — criado em commit `a3a1eee` (2026-05-01)
- **Pipeline:** FTS + pgvector via Gemini `text-embedding-004`
- **Última indexação conhecida:** 428/429 documentos, 1.598 chunks (antes da queda)
- **Atos legislativos:** 53 atos, 801 chunks (antes da queda)

---

_Gerado automaticamente pelo agente de monitoramento one-shot em 2026-05-08._
