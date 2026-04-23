# Fase 0 — Análise de Falhas do Retrieval (recall@5 ≤ 20%) — Design

**Data:** 2026-04-23
**Contexto:** Fase 0 do `docs/ROADMAP_BUSCA_QUALIDADE.md`. O eval pós-reprocessamento completo (`eval/reports/2026-04-23T02-25-41_pos-reprocessamento-completo.md`) mostrou recall@5 travado em ~34%. O roadmap determina que **nenhuma outra fase seja executada** antes de se diagnosticar onde o sistema falha — experimentos cegos já foram feitos e não moveram o ponteiro.

## Objetivo

Produzir um mapa auditável das queries do golden set que o retrieval atual falha, categorizadas em buckets que apontam diretamente para as Fases 1-6 do roadmap principal. Esse mapa decide **quais fases executar primeiro** e **quais podem ser arquivadas**.

A análise não corrige nada — só produz relatório.

## Escopo

- **Universo:** queries do golden set (`eval/golden-set.json`, 53 anotadas) com `recallAt5 ≤ 0.2` no último run. No eval atual isso dá **29 queries** (28 com 0% + `q-sancoes-impedimento-licitar` em 20%).
- **Run fonte:** `eval/reports/2026-04-23T02-25-41_pos-reprocessamento-completo.md` (git sha `dd10632`), mas o design funciona para qualquer run subsequente — basta reexecutar após mudanças.
- **Fora de escopo:**
  - Queries não anotadas (38 do golden set) — tratadas em Fase 6.
  - Queries com recall@5 > 20% — comportamento "aceitável" para este diagnóstico.
  - Execução das Fases 1-6 em si.
  - Auditoria estrutural do golden set (Fase 6 separada; esta Fase 0 pode apenas *sinalizar* casos com anotação suspeita via bucket E).

## Arquitetura

Dois artefatos, todos dentro do módulo `eval/`:

### 1. Patch em `eval/cli/run-baseline.ts`

Além do markdown atual, gravar `eval/reports/{stamp}_{label}.json` com o `EvalRun` completo. O `runner.ts` já popula `perQuery[].predicted: string[]` (top-20) — falta só persistir.

Mudança estimada: ~10 linhas (um `JSON.stringify` e um `writeFileSync`).

### 2. Novo `eval/scripts/analyze-failures.ts`

CLI one-off que:
1. Lê o JSON do último run (`--from <path>` ou auto-detect do mais recente em `eval/reports/`).
2. Filtra queries com `recallAt5 ≤ 0.2`.
3. Para cada query falha, enriquece com dados do Postgres (ver "Sinais coletados").
4. Aplica heurística de bucket (ver "Heurística").
5. Emite `eval/reports/failure-analysis-YYYY-MM-DD.md` + `failure-analysis-YYYY-MM-DD.csv`.

Não muta nada no banco. Só `SELECT` em `Document` e `DocumentChunk`, mais chamadas ao `hybridSearch` já existente (para `limit: 100` quando MRR = 0 no top-20).

### Fluxo de execução

```bash
npm run eval:run -- --label diag-fase0
npx tsx eval/scripts/analyze-failures.ts --from eval/reports/<stamp>_diag-fase0.json
# Revisão manual dos buckets ambíguos no CSV; narrativa consolidada no MD.
```

## Sinais coletados por query falha

Colunas por linha no CSV:

**Do eval run (JSON):**
- `id`, `query`, `difficulty`
- `recallAt5`, `reciprocalRank` (MRR single-query)
- `predicted[]` (top-20 IDs)
- `annotations.relevant[]`, `annotations.highlyRelevant[]`

**Do Postgres (uma consulta por doc relevante, cacheada em memória):**
- `docExists` (bool)
- `docType`, `docTitle`, `docContentLen`
- `chunkCount` (0 → não indexado)
- `docPositionInTop100` — **só** se MRR = 0 no top-20. Re-roda `hybridSearch({ limit: 100 })` e procura o primeiro doc relevante. Valor ∈ {1..100, null}.

**Derivados da query (regex + substring match, case-insensitive):**
- `keyTermsInQuery[]`: tokens "pesados" extraídos por regex:
  - Números de lei: `\b\d{1,3}\.\d{3}/\d{4}\b` (ex.: `14.133/2021`)
  - Artigos: `\bart(?:igo)?\.?\s*\d+\b`
  - Normas específicas: `\bIN\s+[A-Z/]+\s*\d+/\d+\b` (ex.: `IN SEGES/ME 65/2021`)
  - Anos soltos: `\b/\d{4}\b`
  - Siglas maiúsculas com ≥2 letras: `\b[A-Z]{2,}\b`
  - Excluir stopwords óbvias (ex.: `OU`, `DE`).
- `keyTermsInExpectedDoc` (bool por termo): cada key term bate substring no `content` concatenado dos docs relevantes?
- `keyTermsInTop5Docs` (bool por termo): idem, nos `content` dos top-5 retornados.

**Agregado no CSV:**

```
id, query, difficulty, recall@5, mrr,
n_relevant, n_relevant_with_chunks,
doc_position_top100, key_terms,
key_terms_in_expected, key_terms_in_top5,
top5_titles, bucket_auto, bucket_reason, bucket_manual
```

`bucket_manual` começa vazio; revisão humana preenche e se torna fonte de verdade.

**Fora do YAGNI:**
- Similaridade vetorial crua dos chunks (redundante com posição no ranking).
- Distribuição de scores RRF (não muda decisão de bucket).
- Análise sintática da query (regex basta).

## Heurística de auto-bucket

Regras aplicadas **em ordem** (primeira que bate vence).

Para cada query, agregar sobre **todos** os docs em `annotations.relevant[]` (não só o primeiro):

### Regra 1 — `C. Não indexado`
- Se nenhum doc relevante tem `chunkCount > 0` → bucket `C`.
- Se **alguns** têm e **outros** não → bucket `C-parcial` (subset existe mas não totalmente chunked).
- Fase sugerida: fix no cron/scraper ou re-rodar `migrate-to-embeddings.ts`.

### Regra 2 — `D. Ranking ruim`
- Se `reciprocalRank > 0` (algum doc relevante no top-20 mas fora do top-5) **ou** `docPositionInTop100 ≤ 20` → bucket `D`.
- Subcaso `D+` se `docPositionInTop100 ≤ 10` (perto de top-5; reranker provavelmente resolve).
- Fase sugerida: **Fase 2** (cross-encoder rerank) ou **Fase 4** (hybrid tuning).

### Regra 3 — `A. Termo específico ausente do doc`
- Se `keyTermsInQuery.length > 0` e nenhum desses termos aparece no `content` dos docs relevantes → bucket `A`.
- Interpretação: query usa jargão/número que o doc canônico **não contém literalmente**; embedding genérico não faz a ponte.
- Fase sugerida: **Fase 1** (HyDE) ou **Fase 3** (embedding jurídico especializado).

### Regra 4 — `A'. Termo presente mas doc longe no ranking`
- Se key terms aparecem no doc esperado **mas** doc está fora do top-100 → bucket `A'`.
- FTS deveria ter pegado; não pegou. Investigar pesos `content` vs `description` e bug possível.
- Fase sugerida: **Fase 4** (tuning FTS) + investigação pontual.

### Regra 5 — `B. Tese parafraseada` (fallback)
- Se nenhuma regra acima bate → bucket `B`: doc existe, indexado, alguns termos batem, mas vetor do chunk certo não é próximo o bastante do vetor da query.
- Fase sugerida: **Fase 3** (embedding) ou **Fase 5** (chunking).

### Bucket `E. Anotação suspeita` (manual, não automático)
- Marcado na revisão humana quando, ao ler query + top-5, percebo que algum top-5 retornado **também** responderia à query mas não está em `annotations.relevant`.
- Serve como input para **Fase 6** (auditoria do golden set).
- O script não classifica E automaticamente — apenas reserva a coluna `bucket_manual` para que a pessoa classifique.

### Nota sobre precisão da heurística

A heurística **é deliberadamente conservadora**: prefere classificar errado como B (fallback) do que empurrar para A com falso positivo. A revisão manual corrige; isso é esperado. O valor do auto-bucket é:
1. Fornecer ponto de partida auditável.
2. "Dar de graça" as classificações óbvias (C por `chunkCount=0`, D por MRR > 0).
3. Deixar B/A/A' como os casos que merecem leitura humana.

## Formato dos entregáveis

### `eval/reports/failure-analysis-YYYY-MM-DD.md`

Estrutura:

```markdown
# Failure Analysis — YYYY-MM-DD

- **Run fonte:** <caminho do JSON>
- **Escopo:** 29 queries com recall@5 ≤ 20% (de 53 anotadas).
- **Metodologia:** `eval/scripts/analyze-failures.ts`

## Distribuição por bucket

| Bucket | Auto | Após review | Fase sugerida |
|---|---|---|---|
| A. Termo específico ausente | N | N | Fase 1 + Fase 3 |
| A'. Termo presente, doc longe | N | N | Fase 4 |
| B. Tese parafraseada | N | N | Fase 3 |
| C. Não indexado | N | N | Fix scraper |
| D. Ranking ruim | N | N | Fase 2 |
| E. Anotação suspeita | 0 | N | Fase 6 |

## Recomendação de ordem revisada das fases

(Texto curto — dada a distribuição real, reordenar 1-6 do roadmap.)

## Drill-down por query

### <id> — bucket X
- **Query:**
- **Doc esperado (principal):**
- **Key terms:**
- **Em `content` do doc esperado?**
- **Posição top-100:**
- **Top-5 retornados:**
- **Por que X:**
- **Bucket review:** (confirmado / reclassificado para Y)

(29 seções)
```

### `eval/reports/failure-analysis-YYYY-MM-DD.csv`

Colunas conforme "Sinais coletados". `bucket_manual` vazio — preenchido na revisão.

### `eval/reports/failure-analysis-YYYY-MM-DD-raw.json` (opcional)

Dump completo dos sinais se chamado com `--dump-raw`. Usado se quisermos re-agregar sem re-consultar o DB.

## Critério de aceite

Fase 0 é dada por concluída quando:
1. Script `analyze-failures.ts` roda sem erro contra o run pós-reprocessamento.
2. CSV tem 29 linhas, uma por query do escopo, todas com `bucket_auto` preenchido.
3. Revisão manual feita: `bucket_manual` preenchido para todas, com pelo menos as reclassificações justificadas em uma ou duas frases.
4. MD contém "Distribuição por bucket" com contagens finais + "Recomendação de ordem revisada das fases" com 3-5 bullets concretos.
5. O arquivo MD é commitado em `eval/reports/`.

## Riscos e mitigações

- **Heurística enviesa a revisão humana** → expor `bucket_reason` no CSV para que a pessoa veja *por que* o script classificou assim e discorde conscientemente.
- **Key-terms regex muito agressiva gera falso positivo em A** → começar com regex conservadora, rodar uma vez, inspecionar os buckets A e ajustar a lista de stopwords se necessário.
- **`docPositionInTop100` adiciona latência** → só executa quando MRR = 0, ou seja, para ~18 queries × 1 chamada de busca. ~30s total. Aceitável.
- **Revisão manual vira 3-4h de trabalho** → é o custo de evitar executar Fases 1-5 no escuro. O roadmap principal é explícito que Fase 0 é obrigatória.

## Rollback

Reversível via `git revert`. O patch em `run-baseline.ts` é aditivo (nunca remove o MD atual). O script é standalone e não muta dados.

## Arquivos afetados

- `eval/cli/run-baseline.ts` — patch aditivo para emitir JSON.
- `eval/scripts/analyze-failures.ts` — novo.
- `eval/reports/failure-analysis-YYYY-MM-DD.{md,csv}` — novos outputs.

## Histórico

- **2026-04-23:** design criado após brainstorming. Escolhido Approach B (heurística auto-bucket + revisão manual) sobre A (100% manual) e C (sem buckets pré-definidos).
