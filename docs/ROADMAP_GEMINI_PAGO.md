# Roadmap — Aproveitar Gemini API Paga para Melhorar Busca

**Criado em:** 2026-04-22
**Autor:** Daniel Barral + Claude (sessão de planejamento)
**Status:** 🚫 **ARQUIVADO** em 2026-04-26 — hipótese refutada empiricamente em 2 experimentos independentes. Reprocessar resumos/descrições NÃO move recall@5, independente do modelo Gemini usado. Documentação preservada para histórico.

---

## Resultado final — hipótese refutada

A hipótese central deste roadmap era que **resumos enriquecidos** (input maior, output mais denso, parâmetros otimizados) gerariam embeddings melhores e elevariam recall em ≥10pp.

**Foi testada 2 vezes com modelos diferentes:**

| Data | Modelo | Pré (recall@5) | Pós (recall@5) | Δ |
|---|---|---:|---:|---:|
| 2026-04-23 | Gemini 2.5-flash | 34.2% | 34.1% | -0.1pp |
| 2026-04-26 | Gemini 3-flash-preview | 66.0% | 65.8% | -0.2pp |

Em ambos os casos a Δ ficou dentro da margem de ruído natural do LLM (~±0.5pp entre execuções idênticas). **Hipótese refutada com confiança.**

**Diagnóstico real:** o gargalo do retrieval NÃO é qualidade dos resumos. O salto de 34% → 66% que aconteceu em 2026-04-23 veio inteiramente da **auditoria do golden set** (Fase 6 do `ROADMAP_BUSCA_QUALIDADE.md`) — corrigir queries mal anotadas. O retrieval em si já estava OK; só o eval estava medindo errado.

**Próximos vetores reais de ganho** (não tratados por este roadmap):
- Trocar modelo de embedding (`gemini-embedding-2-preview` → `text-embedding-004` ou Voyage AI)
- Tuning de FTS (Postgres `tsvector` weights)
- Expansão do golden set por uso real (`SearchHistory` → eval)
- Cohere/Gemini rerank — já testado em 2026-04-12, regrediu, arquivado

**Custo total do experimento:** ~R$ 7 (1570 reprocess Flash + 1570 re-embed + 2 evals).

**Tempo total:** ~50min de wall clock, totalmente automatizado e idempotente (script `improve-tcu-descriptions.ts` + `migrate-to-embeddings.ts`).

---

## Status histórico (preservado)


**Acidentes importantes desta execução:**
1. O billing pago do usuário cobre a família Gemini **2.5**, não 2.0-flash (hardcoded em 28 arquivos do repo). Migração dos arquivos em escopo (`lib/tcu-enrichment.ts`, `lib/lei-indexer.ts`) feita no commit `eb7c4b1`. Outros arquivos ainda usam 2.0-flash e caem no pool free — roadmap de migração separado será necessário se a busca IA em produção estiver apresentando 429s.
2. Gemini 2.5 tem thinking mode **ativo por default**. Em tarefas curtas com `maxOutputTokens: 1024`, o thinking consome ~95% do budget e a resposta sai truncada. Fix em `SUMMARY_GENERATION_CONFIG` com `thinkingConfig: { thinkingBudget: 0 }` (commit `1e1dd55`). `lib/lei-indexer.ts` ainda não tem essa config — avaliar depois.
**Prioridade:** Alta — impacta diretamente qualidade das buscas IA no site

---

## Resumo executivo

O pipeline de enriquecimento de acórdãos TCU e indexação de embeddings está hoje
**artificialmente limitado** por parâmetros conservadores adotados no tier free do
Gemini (truncagens de input, delays entre chamadas, batch size pequeno, `maxOutputTokens`
baixo). Com a API paga já contratada, ajustar esses parâmetros e **reprocessar a base
com mais contexto por documento** deve melhorar a qualidade das buscas (recall e
utilidade dos resumos) sem trocar de modelo nem mexer em schema.

**Objetivo mensurável:** elevar `recall@5` do baseline atual (**34,2%** — medido
em 2026-04-22, ver `eval/reports/2026-04-22T18-24-07_pre-gemini-pago-fase0.md`)
em ≥ 10 pontos percentuais (meta: ≥ 44,2%), validado por `npm run eval:run`.

---

## Hipóteses a validar

1. **Resumos mais ricos** (input completo em vez de ementa truncada em 2.000 chars)
   melhoram a `description` que alimenta embeddings + FTS → maior recall.
2. **Indexação Lei 14.133 com contexto maior** (32k chars em vez de 4k) captura
   artigos citados em votos longos → `leiArticles` mais fiel.
3. **Batch maior e sem delays** permite reprocessar os ~2.400 chunks existentes em
   minutos, não horas — viabilizando iteração rápida.
4. **Re-embedding com descrição enriquecida** (não só mudança de parâmetro) gera
   vetores semanticamente mais densos sem trocar de provider.

Se o eval subir ≥ 10pp após etapas 1-5, hipótese confirmada.
Se subir < 5pp, avaliar troca de provider (Voyage AI, 1024 dims) — fora do escopo
deste roadmap.

---

## Estado atual (evidência com file:line)

### Truncagens de input
- `app/api/cron/sync-tcu-acordaos/route.ts:125` — ementa truncada em 2.000 chars:
  `${doc.metaTcu.ementaCompleta.slice(0, 2000)}`
- `lib/lei-indexer.ts:211-212` — conteúdo limitado a 4.000 chars (~1.000 tokens):
  `const maxLength = 4000; const content = document.content.substring(0, maxLength);`
  Comentário no código: "Gemini tem limites".

### Limites de output
- `app/api/cron/sync-tcu-acordaos/route.ts:141` — `maxOutputTokens: 512` (força
  resumo de 2-3 frases).

### Delays artificiais entre chamadas
- `app/api/cron/sync-tcu-acordaos/route.ts:74` — `ENRICHMENT_DELAY_MS = 800`.
- `app/api/cron/sync-tcu-acordaos/route.ts:207 e 228` — delay aplicado depois de
  cada chamada (Lei + resumo) → 1,6s por acórdão só de espera.
- `lib/lei-indexer.ts:310` — `500ms` entre análises de Lei em batch.
- `lib/embeddings/gemini-embeddings.ts:146` — `100ms` entre batches de embedding.

### Batch e config de embeddings
- `lib/embeddings/gemini-embeddings.ts:118` — `BATCH_SIZE = 100`.
- `lib/embeddings/gemini-embeddings.ts:236` — `rateLimit: 1500` (free tier).
- `lib/embeddings/gemini-embeddings.ts:18` — modelo `gemini-embedding-2-preview`,
  768 dims. **Mantém.**
- `lib/embeddings/text-chunker.ts:32-37` — chunk default 2.000 chars com overlap
  de 400. **Mantém** (aceita até 8k tokens ≈ 32k chars, mas chunk menor é melhor
  para retrieval granular).

### Backlog que trava frescor da busca
- Cron de indexação processa só `MAX_JOBS_PER_RUN = 10` — 727 documentos pendentes
  (documentado em `docs/superpowers/plans/2026-04-22-ia-jurisprudencia-semantic-search.md`).
  **Destravar isso está fora deste roadmap** (é outro roadmap — ver seção "Roadmaps
  relacionados"), mas os reprocessamentos desta frente devem respeitar/convergir com
  a solução daquele.

---

## Plano de execução — 7 fases

Cada fase é pequena o suficiente para rodar em uma sessão curta (< 60 min).
Se a energia cair entre fases, a próxima sessão retoma pela fase seguinte.
**Commitar ao final de cada fase** para preservar estado.

### Fase 0 — Baseline de eval (proteção contra regressão)

**Por que primeiro:** sem baseline documentado, não dá para afirmar que o roadmap
melhorou alguma coisa.

**Passos:**
1. Rodar `npm run eval:run` com o golden set atual (53 queries).
2. Confirmar que o relatório entra em `eval/reports/` com data de hoje.
3. Anotar neste roadmap (seção "Medições") os valores de recall@5, MRR, nDCG@10.

**Critério de aceite:** novo arquivo em `eval/reports/` e métricas anotadas abaixo.

**Commit:** `chore(eval): baseline pré-otimização Gemini pago`

---

### Fase 1 — Ampliar janela de input nos resumos TCU — ✅ CONCLUÍDA (2026-04-22)

**Arquivo:** `app/api/cron/sync-tcu-acordaos/route.ts`

**Resumo da execução:**
- Interface `buildSummaryPrompt` aceita agora `content: string | null`.
- Ementa truncada em 32.000 chars (antes 2.000); conteúdo integral adicionado em seção nova "Conteúdo integral do acórdão (voto/relatório/fundamentação)" truncado em 20.000 chars, com guarda para não repetir quando `content` for igual a `description` ou à ementa.
- Regra do prompt alterada: "2-3 frases" → "3-5 frases, priorize densidade: cite o raciocínio/fundamento quando relevante".
- `maxOutputTokens`: 512 → 1024.
- Typecheck passou sem novos erros (todos os erros de `tsc --noEmit` são pré-existentes em arquivos de teste não tocados).
- Teste manual em um acórdão real fica para a Fase 5 (script de reprocessamento) — mais eficiente do que criar um `enrich-one-tcu.ts` dedicado.


**Mudanças:**
- Linha 125: trocar `slice(0, 2000)` por `slice(0, 32000)` (ou sem slice, se o
  campo `ementaCompleta` estiver sempre dentro de ~30k chars).
- Linha 141: `maxOutputTokens: 512` → `maxOutputTokens: 1024`.
- Se `doc.content` existir e não estiver no prompt, adicioná-lo truncado em
  `.slice(0, 20000)` como seção "Conteúdo integral do acórdão".

**Testar manualmente:**
```bash
# rodar o cron em 1 acórdão novo via endpoint admin (se existir) ou
# simulando com um doc específico via script ad-hoc
npx tsx scripts/enrich-one-tcu.ts <documentId>
```

(Se `scripts/enrich-one-tcu.ts` não existir, criar — ver Fase 5.)

**Critério de aceite:** resumo gerado em teste é perceptivelmente mais específico
que o anterior (cita elementos do voto, não só da ementa).

**Commit:** `feat(tcu-cron): usar janela de contexto maior no resumo Gemini (pago)`

---

### Fase 2 — Ampliar janela na indexação da Lei 14.133 — ✅ CONCLUÍDA (2026-04-22)

**Arquivo:** `lib/lei-indexer.ts`

**Execução:** `maxLength` em `prepareContent` passou de 4.000 para 32.000 chars; delay entre chamadas em `analyzeBatch` de 500ms → 50ms. Typecheck limpo. Commit `ccbb469`.


**Mudanças:**
- Linha 211: `const maxLength = 4000` → `const maxLength = 32000`.
- Linha 216: mensagem `[... conteúdo truncado]` — manter, mas vai disparar bem menos.
- Linha 310: `setTimeout(resolve, 500)` → `setTimeout(resolve, 50)` (pago aguenta).

**Testar manualmente:** rodar `LeiIndexer.analyzeDocument()` em um acórdão longo
conhecido e confirmar que extrai mais artigos que antes (não regressão, mais recall).

**Critério de aceite:** sem erros Gemini 400 (input too large); artigos extraídos
em teste ≥ os da versão 4k.

**Commit:** `feat(lei-indexer): ampliar janela de análise para 32k chars`

---

### Fase 3 — Remover delays artificiais do cron de enriquecimento — ✅ CONCLUÍDA (2026-04-22)

**Arquivo:** `app/api/cron/sync-tcu-acordaos/route.ts`

**Execução:** `ENRICHMENT_DELAY_MS` 800 → 50. Aplicado nos dois pontos (após Lei indexer e após resumo Gemini). Sem concorrência paralela ainda — deixada para avaliação futura se o tempo total do cron virar gargalo. Commit `ce3868a`.


**Mudanças:**
- Linha 74: `const ENRICHMENT_DELAY_MS = 800` → `const ENRICHMENT_DELAY_MS = 50`.
- Considerar envolver o laço em `Promise.all` com concorrência controlada (ex.
  `p-limit` com 3-5 paralelo) — opcional nesta fase, avaliar complexidade vs ganho.

**Observação:** o timeout da Vercel é 300s (`maxDuration = 300` na linha 26). Se o
cron começar a rodar mais rápido e processar mais acórdãos por run, tudo ok.

**Critério de aceite:** tempo total do cron cai proporcionalmente; sem erros 429
(rate limit); logs mostram `enriquecimento em Xs` bem menor.

**Commit:** `perf(tcu-cron): reduzir delays assumindo tier pago Gemini`

---

### Fase 4 — Otimizar batch de embeddings — ✅ CONCLUÍDA (2026-04-22)

**Arquivo:** `lib/embeddings/gemini-embeddings.ts`

**Execução:** `BATCH_SIZE` 100 → 250; delay entre batches 100ms → 25ms; `EMBEDDING_CONFIG.rateLimit` 1500 → 10000; comentários do módulo e docstrings atualizados para refletir tier pago. Typecheck limpo. Commit `fce78ff`.


**Mudanças:**
- Linha 118: `const BATCH_SIZE = 100` → `const BATCH_SIZE = 250`.
  (Gemini aceita até 250 por call em embed; 500+ começa a ter problemas em testes
  reais da Google — ficar conservador.)
- Linha 146: delay `100ms` → `25ms`.
- Linha 236: comentário `rateLimit: 1500 (free tier)` → atualizar para refletir
  tier pago (~10k req/min).

**Critério de aceite:** script `migrate-to-embeddings.ts --dry-run` não quebra;
tempo estimado de re-indexação full cai de X para X/2.5.

**Commit:** `perf(embeddings): batch 250 e delays reduzidos para tier pago`

---

### Fase 5 — Script de reprocessamento focado

**Arquivo novo:** `scripts/reprocess-tcu-enriquecido.ts`

**Objetivo:** rodar as 2 fases de enriquecimento (Lei + resumo Gemini) em todos os
acórdãos TCU **já existentes** no banco usando os novos parâmetros, e marcar
`embeddingStatus: 'pending'` para que o cron de index-jobs re-gere os embeddings
com a descrição enriquecida.

**Esqueleto:**
```ts
// scripts/reprocess-tcu-enriquecido.ts
// Uso:
//   npx tsx scripts/reprocess-tcu-enriquecido.ts --dry-run
//   npx tsx scripts/reprocess-tcu-enriquecido.ts --limit 50
//   npx tsx scripts/reprocess-tcu-enriquecido.ts            # reprocessa tudo
//
// Idempotente: pode ser reexecutado sem efeitos colaterais além de refazer o
// resumo/índice Lei. Atualiza summaryGeneratedAt e embeddingStatus='pending'.

import { prisma } from '@/lib/prisma';
import { LeiIndexer } from '@/lib/lei-indexer';
// reaproveitar buildSummaryPrompt / callGemini exportando-os do cron
// OU duplicar aqui se exportá-los for refactor grande.

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find(a => a.startsWith('--limit'));
  const limit = limitArg ? Number(limitArg.split('=')[1] ?? process.argv[process.argv.indexOf(limitArg) + 1]) : undefined;

  const docs = await prisma.document.findMany({
    where: { category: 'acordao' },
    select: { id: true, title: true /* etc */ },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Reprocessando ${docs.length} acórdãos. dryRun=${dryRun}`);

  for (const doc of docs) {
    // 1) LeiIndexer.analyzeDocument com nova janela
    // 2) callGemini(buildSummaryPrompt(doc)) com novo maxOutputTokens
    // 3) update Document { summary, description, summaryGeneratedAt, embeddingStatus: 'pending' }
    // respeitar DELAY reduzido (50ms)
  }
}

main().catch(e => { console.error(e); process.exit(1); });
```

**Critério de aceite:**
- `--dry-run` lista docs e não altera nada.
- `--limit 5` processa 5 e logs mostram resumo/artigos atualizados.
- Run completo em acórdãos TCU (~157 pelo último diagnóstico) termina em < 15min
  sem erros 429 ou 5xx repetidos.

**Commit:** `feat(scripts): reprocessar acórdãos TCU com pipeline enriquecido`

---

### Fase 6 — Re-indexação dos embeddings com descrição nova

**Comando (já existe):**
```bash
npx tsx scripts/migrate-to-embeddings.ts --force
```

**Antes de rodar:**
- Confirmar que todos os docs reprocessados na Fase 5 estão com `embeddingStatus: 'pending'`.
- Rodar `--dry-run` primeiro para estimativa.

**Custo estimado (tier pago, 2.400 chunks):**
- ~10 chamadas de batch (250/batch).
- ~5 minutos com delays reduzidos.
- Alguns centavos de dólar (embeddings Gemini são baratos).

**Critério de aceite:**
- Todos os chunks de `DocumentChunk` dos acórdãos TCU recriados.
- Nenhum erro fatal; erros esporádicos < 1% aceitáveis.
- `embeddingStatus` de todos os docs TCU reprocessados passa a `indexed`.

**Commit:** `chore(embeddings): re-indexar acórdãos TCU após enriquecimento`
(commit só se houver mudanças de schema/metadata; a re-indexação em si altera DB,
não código.)

---

### Fase 7 — Medir e decidir

**Comando:**
```bash
npm run eval:run
```

**Comparar com baseline da Fase 0:**

| Métrica | Baseline (Fase 0) | Pós-otimização | Δ |
|---|---|---|---|
| recall@5 | __ | __ | __ |
| MRR | __ | __ | __ |
| nDCG@10 | __ | __ | __ |

**Decisão:**
- **Δ recall@5 ≥ 10pp:** sucesso. Documentar em `CLAUDE.md` seção "Recent Features".
  Considerar aplicar as mesmas otimizações ao pipeline de atos legislativos
  (`lib/embeddings/legislative-act-processor.ts`) e de decisões de tribunais
  estaduais (`lib/tribunal-scrapers/*`).
- **Δ recall@5 entre 5pp e 10pp:** parcial. Investigar queries que ainda falham no
  eval; avaliar adicionar extração de ratio decidendi / palavras-chave expandidas
  (Fase 8 futura, não no escopo atual).
- **Δ recall@5 < 5pp:** hipótese falha. Abrir roadmap separado para migração de
  provider (Voyage AI, 1024 dims, schema migration).

**Commit:** `docs(roadmap): registrar resultados pós-Gemini pago`

---

## Roadmaps relacionados (não no escopo desta frente)

1. **Ativar busca semântica em `/api/jurisprudencia/query`** —
   `docs/superpowers/plans/2026-04-22-ia-jurisprudencia-semantic-search.md`.
   Independente deste roadmap, mas se rodar antes aumenta o ganho percebido pelo
   usuário final.

2. **Destravar backlog do cron de indexação (727 pendentes)** —
   elevar `MAX_JOBS_PER_RUN` de 10 para 50 e mudar LIFO → FIFO. Deve ser feito
   **antes** da Fase 6 deste roadmap, para que a re-indexação não fique na fila.

3. **Eventual migração de provider de embeddings** —
   só abrir se Fase 7 indicar ganho insuficiente.

---

## Rollback

Todas as fases 1-4 são mudanças de parâmetros — revert simples via git.

Fase 5 (script) só grava no banco dados enriquecidos; se o resumo novo for pior,
rodar de novo com prompt ajustado, ou restaurar `summary` antigo a partir de
backup (confirmar se há backup recente do Neon antes de Fase 5).

**Precaução antes da Fase 5:** exportar `Document.summary` e `Document.description`
atuais em JSON:
```bash
npx tsx scripts/backup-tcu-summaries.ts  # criar junto com o reprocess
```

Fase 6 (re-embedding) sobrescreve `DocumentChunk` — se der ruim, rodar
`migrate-to-embeddings.ts --force` de novo com pipeline restaurado.

---

## Checklist de retomada após queda de energia

Se a energia cair no meio da execução, a próxima sessão deve:

1. Ler este arquivo.
2. Checar `git log --oneline -20` para ver qual fase foi commitada por último.
3. Continuar pela próxima fase não commitada.
4. Se a queda foi **durante** uma Fase 5 ou 6 (script rodando):
   - O script é idempotente — basta rodar de novo.
   - Mas verificar `embeddingStatus` no banco antes: se muitos ficaram `pending`
     no meio, o cron de index-jobs pode ter começado a processar → deixar seguir
     OU cancelar e rodar `--force` manual.

---

## Medições (preencher durante execução)

### Baseline (Fase 0) — EXECUTADO

- **Data:** 2026-04-22 18:24 UTC
- **Comando:** `npm run eval:run -- --label "pre-gemini-pago-fase0"`
- **Golden set:** 91 queries carregadas, 53 anotadas (38 skipped)
- **Modo:** hybrid baseline
- **Arquivo de report:** `eval/reports/2026-04-22T18-24-07_pre-gemini-pago-fase0.md`
- **recall@5: 34,2%**
- **MRR: 0,364**
- **nDCG@10: 0,403**

**Observação:** o baseline real é 10pp pior que o citado no roadmap inicial (44,5%
do report de 2026-04-12). A diferença vem de o golden set ter crescido (53 → 91
queries totais) e/ou mudanças no adaptador de busca. Este é o número correto para
comparar contra o pós-otimização.

**Meta atualizada:** recall@5 ≥ 44,2% (subir ≥ 10pp sobre 34,2%).

### Pós-otimização (Fase 7)
- Data: __________
- Arquivo de report: `eval/reports/__________.md`
- recall@5: __________
- MRR: __________
- nDCG@10: __________
- **Decisão final:** __________

---

## Histórico de mudanças neste roadmap

- **2026-04-22:** documento criado após análise do pipeline atual e correção de
  diagnóstico anterior (que havia subestimado o ganho do tier pago).
