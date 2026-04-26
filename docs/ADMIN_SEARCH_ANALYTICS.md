# Admin Search Analytics — Guia de operação

**Criado em:** 2026-04-24
**Para:** Daniel Barral
**Contexto:** pós-lançamento, como tirar valor real do dashboard.

---

## Operação em produção (kill-switch + alertas automáticos)

### Kill-switch: `SEARCH_ANALYTICS_ENABLED`

Variável de ambiente (default ligado). Para **pausar a coleta** sem deploy:

```
SEARCH_ANALYTICS_ENABLED=false
```

Quando desligado:
- `POST /api/area-restrita/search-history` retorna `{ id: null, disabled: true }` sem gravar.
- Dados históricos continuam acessíveis em `/admin/search-analytics`.
- Botões 👍/👎 em entradas existentes continuam funcionando (PATCH não é gateado).

**Quando usar:** se aparecer bug em coleta, queda de DB, vazamento, ou se for fazer manutenção. Coloca `false` na Vercel → invalidar cache → coleta para. Reativar é só remover/setar `true` e redeploy.

### Alerta automático no cron `monitoring-alerts` (a cada 6h)

Dispara email para `ADMIN_ALERT_EMAIL` se nos **últimos 7 dias** houver **≥10 votos** E **proporção de 👎 ≥ 30%**. Configurado em `app/api/cron/monitoring-alerts/route.ts` (constantes `FEEDBACK_RATIO_THRESHOLD` e `FEEDBACK_MIN_VOTES`).

Ao receber alerta:
1. Acessar `/admin/search-analytics` e olhar a seção Feedback.
2. Seguir o decision tree abaixo.
3. Se for falso alarme (caso raro/uma feature nova causou flutuação), considerar ajustar threshold ou silenciar pontualmente em produção.

### Targets de qualidade (do `ROADMAP_BUSCA_QUALIDADE.md`)

- **Curto prazo:** recall@5 ≥ 72%
- **Médio prazo:** recall@5 ≥ 78%
- **Hoje (baseline):** 66,3% (medido 2026-04-23 com golden set de 91 queries)

Eval com `npm run eval:run` regressão a cada PR que toque retrieval/embedding.

---

## Decision tree pós-feedback negativo

Quando você recebe um alerta ou identifica queries 👎 recorrentes:

```
Query 👎 detectada
  │
  ├─ Reproduzir com mesmos filtros (coluna "Últimas ocorrências")
  │
  ├── O doc/decisão certo apareceu no top-K?
  │   ├── SIM → problema de SÍNTESE
  │   │   → Ajustar systemInstruction/buildPrompt da rota
  │   │   → Path: app/api/{documents,jurisprudencia}/query/route.ts
  │   │
  │   └── NÃO → problema de RETRIEVAL
  │       │
  │       ├── O doc existe no acervo?
  │       │   ├── SIM → adicionar ao golden set (`eval/golden-set.json`)
  │       │   │   → Considerar Fase 3 (embedding) ou Fase 4 (FTS)
  │       │   │     do ROADMAP_BUSCA_QUALIDADE.md
  │       │   │
  │       │   └── NÃO → gap de conteúdo
  │       │       → Scraper/indexação ou import legislativo manual
  │       │       → Verificar `scripts/diagnose-pending-embeddings.ts`
  │       │
  │       └── Tribunal específico (TCE-X) sem chunks?
  │           → `scripts/diagnose-jurisprudencia-embeddings.ts`
  │           → Backfill via `process-index-jobs`
  │
  └── 5+ feedbacks 👎 distintos na mesma sessão de revisão?
      → Considerar pausar com SEARCH_ANALYTICS_ENABLED=false
        enquanto investiga regressão maior
```

---

## Onde encontrar

URL: `/admin/search-analytics` (requer role `admin`).

Dado: últimos 30 dias de atividade dos alunos nas duas rotas de busca IA:
- `/api/documents/query` (assistente geral + busca global) — `type='documents'`
- `/api/jurisprudencia/query` (aba de jurisprudência) — `type='jurisprudencia'`

---

## O que olhar primeiro

**A cada 1-2 semanas**, entre no dashboard e dê atenção nesta ordem:

### 1. Seção "Feedback dos alunos" (nova, 2026-04-24)

Esta é a seção **mais valiosa** pós-lançamento.

- **Contador no cabeçalho**: 👍 X | 👎 Y | Z sem feedback. Se a relação 👎/👍 for alta (>20%), há problema de qualidade geral. Se for muito baixa (<5%) com muito "sem feedback", o botão provavelmente está pouco visível ou os alunos não sabem que existe.
- **Coluna esquerda — Top queries recorrentes**: queries que múltiplos alunos marcaram 👎. **Prioridade máxima pra golden set + retrieval.** Cada entrada mostra:
  - Contador (quantas vezes marcada ruim)
  - Texto da query
  - Tipo (`documents` ou `jurisprudencia`)
  - Última ocorrência
- **Coluna direita — Últimas ocorrências**: lista detalhada, uma por vez, com:
  - Query original (não normalizada)
  - **Filtros aplicados** no momento da busca (ex: `{"courseId":"10"}` ou `{"tribunal":"TCU","year":2024}`) — crítico pra reproduzir o caso
  - **Nota opcional** se o aluno escreveu por quê (UI ainda não expõe esse campo pro aluno, mas a coluna está no DB pronta pra futuro)
  - Data/hora do feedback

### 2. "Sem Resposta IA" (cartão amarelo)

Queries em que o Gemini não conseguiu sintetizar (resultado vazio, Gemini falhou, etc.). **Diferente de 👎** — aqui é falha técnica ou retrieval que não encontrou nada. Investigar se são queries com digitação estranha (filtrar com a seção "Queries Muito Curtas") ou buracos reais no acervo.

### 3. "Top Queries" (busca mais frequente)

Não são necessariamente problemas — podem ser tópicos populares. Útil pra saber o que o público pergunta muito e garantir que o golden set cobre esses temas.

---

## Workflow recomendado pós-lançamento

### Toda semana (~15 min)

1. Entrar em `/admin/search-analytics`.
2. Na seção **Feedback**, anotar as queries 👎 recorrentes em uma planilha/arquivo (ex: `docs/feedback-negativo-{AAAA-MM-DD}.md`).
3. Pra cada query anotada, abrir a rota (`/area-restrita/assistente` ou `/area-restrita/jurisprudencia`), usar os **mesmos filtros** que aparecem na coluna "Últimas ocorrências", e reproduzir o problema. Ver se:
   - É **retrieval ruim** (top-K não tem o doc certo) → candidato forte pra golden set
   - É **síntese ruim do Gemini** (retrieval trouxe o certo mas resposta não ajudou) → ajustar prompt
   - É **gap de conteúdo** (documento relevante não está no acervo) → scraper/indexação

### Toda 4-6 semanas (~1-2h)

Rodar script futuro `eval/cli/import-from-history.ts` (ainda não existe — criar quando tiver volume) para **amostrar top queries distintas** do `SearchHistory` e gerar template anotável pro golden set. Passo-a-passo pretendido:

1. Script filtra `SearchHistory` dos últimos N dias.
2. Agrupa por `LOWER(TRIM(query))`.
3. Prioriza: queries com `feedback=-1`, queries com `aiAnswer IS NULL`, queries mais frequentes sem feedback.
4. Gera entries no formato do `eval/golden-set.json` (campo `annotations.relevant` fica vazio pra você anotar manualmente).
5. Você anota via `npm run eval:annotate` conforme workflow existente.
6. Rodar eval (`npm run eval:run`) mede se as mudanças recentes movem o recall pra cima/baixo.

### Quando quiser investigar uma query específica

Abrir terminal, rodar:

```bash
npx dotenv -e .env.local -- npx tsx scripts/verify-admin-analytics.ts
```

Esse script replica as queries SQL do endpoint admin e imprime o shape exato dos dados, útil pra debug ou export manual.

Pra consultar uma query específica, SQL direto:

```sql
SELECT id, type, query, filters, feedback, feedbackNote, feedbackAt, "createdAt"
FROM "SearchHistory"
WHERE LOWER(query) LIKE '%segregação%'
ORDER BY "createdAt" DESC
LIMIT 20;
```

---

## Interpretando os dados

**👎 aparece, mas o doc CERTO estava no top-K** → problema de síntese, não retrieval. O Gemini citou mal, resumiu de forma confusa, ou perdeu contexto. Ajustar o `systemInstruction` ou `buildPrompt` da rota.

**👎 aparece, e o doc certo NÃO estava no top-K** → problema de retrieval. Candidato forte pra:
- Anotar no golden set
- Considerar se precisa de Fase 3 (trocar embedding) ou Fase 4 (tuning FTS) do ROADMAP_BUSCA_QUALIDADE.md

**👎 frequente em jurisprudência de TCE-X específico** → provavelmente `TribunalDecision` de TCE-X ainda tem poucas embeddings. Ver `scripts/diagnose-jurisprudencia-embeddings.ts` pra conferir o estado + rodar backfill pontual.

**Nenhum 👎 mas muitos "sem feedback"** → os alunos talvez não estejam vendo o botão. Verificar se ele aparece em mobile, se o hover funciona em touch screens, etc.

---

## Referências no código

- Schema: `prisma/schema.prisma` modelo `SearchHistory`
- Backend analytics: `app/api/admin/search-analytics/route.ts`
- UI admin: `app/admin/search-analytics/SearchAnalyticsClient.tsx`
- UI do aluno (onde 👍/👎 aparecem):
  - `components/ChatInterface.tsx` (assistente geral)
  - `app/area-restrita/jurisprudencia/JurisprudenciaRestritaClient.tsx` (jurisprudência)
- Endpoint de feedback: `app/api/area-restrita/search-history/[id]/feedback/route.ts`
- Scripts de diagnóstico:
  - `scripts/verify-admin-analytics.ts` — espelha queries SQL do dashboard
  - `scripts/diagnose-pending-embeddings.ts` — estado das filas de indexação
  - `scripts/diagnose-jurisprudencia-embeddings.ts` — distribuição de chunks por tribunal

---

## Limitações conhecidas (por ora)

- **Não há UI pro aluno escrever `feedbackNote`**. O campo existe no DB e a API aceita via `PATCH`, mas o botão 👎 atual não abre um textarea. Adicionar quando fizer sentido (talvez um mini prompt "quer explicar por quê?" após 👎).
- **Latência e tokens por busca não são persistidos**. O logger do pino captura, mas não vai pro `SearchHistory`. Se quiser análise de custo por query, Vercel Observability já cobre parcialmente.
- **Clicks em fontes e reformulações de query não são rastreados**. Daria sinal comportamental fino mas exige instrumentação adicional no frontend.

Esses 3 são explicitamente fora do escopo da entrega 2026-04-24. Adicionar só se derem sinal que valem o esforço.

---

## Banner educativo (rollout)

`components/area-restrita/FeedbackTipBanner.tsx` é mostrado **uma vez por usuário** em `/area-restrita/assistente` e `/area-restrita/jurisprudencia`, persistido via `localStorage` (`feedback-tip-shown-v1`). Reset manual pra testar:

```js
localStorage.removeItem('feedback-tip-shown-v1');
```

Para ressetar para todos os usuários após uma mudança de UX significativa, basta bumpar a versão na key (`feedback-tip-shown-v2`).
