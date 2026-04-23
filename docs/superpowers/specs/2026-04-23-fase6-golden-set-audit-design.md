# Fase 6 — Auditoria do Golden Set — Design

**Data:** 2026-04-23
**Contexto:** Fase 6 do `docs/ROADMAP_BUSCA_QUALIDADE.md`. A Fase 0 (failure analysis de 2026-04-23) revelou que 28% das falhas de retrieval são, na verdade, problemas de anotação do golden set (8 queries classificadas como bucket E) — ao invés de falhas do retriever. Fase 6 foi promovida à prioridade máxima do roadmap. Sem um golden limpo, experimentos de retrieval das Fases 2-5 rodariam sobre ruído.

## Objetivo

Produzir um golden set auditado e expandido, onde cada `annotations.relevant` reflete fielmente o conjunto de documentos que respondem à query. Alvo: elevar recall@5 do baseline atual (34.1%) para **≥ 48%** sem qualquer mudança de retrieval — apenas corrigindo/expandindo anotações.

## Escopo

- **Incluído:** as 53 queries anotadas do golden set. Operações:
  - 8 queries classificadas E na Fase 0 (expansão direta com base nas decisões já tomadas).
  - 2 IDs fantasma em `q-data-a-data` (remoção).
  - 1 caso de dedup em `esp-785767-20` (+ spot-check de outros pares).
  - Auditoria das 43 queries anotadas restantes (53 anotadas − 10 tocadas em 6A = 8 E + `q-data-a-data` + `esp-785767-20`) via tool nova `annotation-audit.ts`.

- **Fora de escopo:**
  - Anotar as 38 queries do golden ainda sem anotação.
  - Criar queries novas para atingir o alvo de 150+ do roadmap original.
  - Cleanup estrutural de duplicatas no banco (merge de docs em `Document`) — registrar como Fase 7 se spot-check revelar >15 pares.
  - Re-anotação de queries com `recall@5 > 20%` além das que forem flagadas pelo audit.
  - Alteração de `difficulty` das queries.

## Arquitetura

Fase 6 executa em 3 sub-fases sequenciais, cada uma produzindo commit separado para rollback pontual:

### Sub-fase 6A — Casos conhecidos (~45 min)

**Entradas:**
- `eval/golden-set.json`
- `eval/reports/2026-04-23T12-46-32_diag-fase0.json` (para extrair IDs dos top-5 de cada query E)
- Spot-check SQL sobre `Document` para identificar duplicatas.

**Script helper:** `eval/scripts/fase6a-apply-known.ts` — interativo, one-shot. Não é reusable; fica commitado como registro.

**Operações:**

1. **Spot-check de dedup** — SQL sobre `Document`:
   ```sql
   SELECT title, COUNT(*) AS dups, array_agg(id) AS ids
   FROM "Document"
   GROUP BY title
   HAVING COUNT(*) > 1
   ORDER BY dups DESC
   LIMIT 50;
   ```
   Filtrar pelo conjunto que aparece em qualquer `annotations.relevant`. Para cada par afetando o golden, adicionar o ID duplicado à anotação da(s) query(ies) relevante(s).

   **Decisão de escalação:** se mais de 15 pares afetarem o golden, registrar "Fase 7 — Dedup estrutural" no `ROADMAP_BUSCA_QUALIDADE.md` (não executar). Se ≤ 15, tratar defensivamente na anotação.

2. **Remoção de IDs fantasma em `q-data-a-data`:**
   - Remover `96cbdacf-7387-4286-9529-f2aacc81e7d8` de `annotations.relevant`.
   - Remover `097d3cdb-303b-40ec-b15b-e5ce70ae50ba` de `annotations.relevant`.

3. **Expansão de anotações das 8 E:** Para cada query, adicionar os docs do top-5 do eval run que foram discutidos na revisão caso-a-caso da Fase 0. Classificação:
   - `highlyRelevant` — docs cuja ementa/conteúdo resolve diretamente a tese da query (ex.: art. literal citado, Inf. com ementa quase idêntica à query).
   - `relevant` — docs de contexto adjacente (Manuais TCU, pareceres sobre o tema).

   Detalhamento por query (verificado e aprovado em conversa caso-a-caso em 2026-04-23). Cada linha indica a operação específica. **IDs exatos são extraídos do JSON do eval run** (campo `perQuery[i].predicted[]`) — a coluna "Documento" usa o título pra legibilidade.

   **Caso 1 — `t-pesquisa-precos-in65-01`**
   | Ação | Documento | Lista |
   |---|---|---|
   | Adicionar | IN SEGES/ME 65/2021 | `highlyRelevant` |
   | Adicionar | Manual TCU - 4.3.9.1 Fontes para obtenção de preços | `relevant` |
   | Adicionar | Manual TCU - 4.3.9.3 Definição e execução da forma de cálculo | `relevant` |
   | Manter | ON AGU 17/2009 (`845a2f3e`) | `relevant` |
   | Não adicionar | Manual TCU 5.10, Manual TCU 4.1.6 | — (tangenciais) |

   **Caso 2 — `t-eng-bdi-irpj-csll-01`**
   | Ação | Documento | Lista |
   |---|---|---|
   | Adicionar | Inf. 17/2010 (Vedação da inclusão de IRPJ e CSLL no BDI) | `highlyRelevant` |
   | Adicionar | Inf. 12/2010 | `relevant` |
   | Adicionar | Inf. 44/2010 | `relevant` |
   | Adicionar | Inf. 279/2016 | `relevant` |
   | Adicionar | Inf. 222/2014 | `relevant` |
   | Manter | Súmula TCU 254 (`47f91ef1`) | `highlyRelevant` |

   **Caso 3 — `t-terceirizacao-art48-01`**
   | Ação | Documento | Lista |
   |---|---|---|
   | Adicionar | Inf. 114/2012 (Proibir terceirização de atividade-fim) | `highlyRelevant` |
   | Adicionar | Inf. 345/2018 | `relevant` |
   | Manter | Súmula TCU 269 (`2b9515a0`) | `highlyRelevant` |
   | Não adicionar | Inf. 139/2013, Inf. 291/2016, Inf. 191/2014 | — (nicho terceirização jurídica, não o tema) |

   **Caso 4 — `esp-518661-2` (inclui remoção)**
   | Ação | Documento | Lista |
   |---|---|---|
   | **Remover** | ON AGU 2/2009 (`9add63a3`) | — (anotação colada errada — tema é parecer jurídico, não remanescente) |
   | Adicionar | Acórdão TCU 1498/2021 (Dispensa - Remanescente) | `highlyRelevant` |
   | Adicionar | Inf. 349/2018 | `relevant` |
   | Adicionar | Inf. 188/2014 | `relevant` |
   | Adicionar | Inf. 310/2016 | `relevant` |
   | Adicionar | Inf. 300/2016 | `relevant` |

   Após a operação, `relevant = [acc-1498, inf-349, inf-188, inf-310, inf-300]`, `highlyRelevant = [acc-1498]`.

   **Caso 5 — `esp-669066-13`**
   | Ação | Documento | Lista |
   |---|---|---|
   | Adicionar | Inf. 183/2014 (Adjudicar por item em objetos divisíveis) | `highlyRelevant` |
   | Adicionar | Inf. 237/2015 (Adjudicar por item como garantia de competitividade) | `highlyRelevant` |
   | Adicionar | Inf. 173/2013 | `relevant` |
   | Adicionar | Inf. 216/2014 | `relevant` |
   | Adicionar | Inf. 250/2015 | `relevant` |
   | Manter | Súmula TCU 247 (`03c1afd0`) | `highlyRelevant` |

   **Caso 6 — `esp-728449-12`**
   | Ação | Documento | Lista |
   |---|---|---|
   | Adicionar | Manual TCU - 4.4.3 Projeto Básico | `highlyRelevant` |
   | Adicionar | Manual TCU - 4.4.3.6 Orçamento detalhado | `highlyRelevant` |
   | Adicionar | Inf. 220/2014 | `relevant` |
   | Adicionar | Inf. 99/2012 | `relevant` |
   | Adicionar | Inf. 50/2011 | `relevant` |
   | Manter | Súmula TCU 260 (`17f6bcef`) | `highlyRelevant` |

   **Caso 7 — `esp-792741-1`**
   | Ação | Documento | Lista |
   |---|---|---|
   | Adicionar | Art. 125 - Lei 14.133/2021 | `highlyRelevant` |
   | Adicionar | Acórdão TCU 2391/2025 - Aditivo - Limite | `highlyRelevant` |
   | Adicionar | Acórdão TCU 781/2021 - Aditivo - Limite | `highlyRelevant` |
   | Adicionar | Inf. 516/2025 | `relevant` |
   | Adicionar | Inf. 476/2024 | `relevant` |
   | Manter | ON AGU 50/2014 (`471684ee`) | `relevant` (rebaixada de seu status original; mantida como referência histórica) |

   **Caso 8 — `esp-797806-1`**
   | Ação | Documento | Lista |
   |---|---|---|
   | Adicionar | Art. 41 - Lei 14.133/2021 | `highlyRelevant` |
   | Adicionar | Enunciado do IBDA nº 27 | `relevant` |
   | Adicionar | Enunciado do IBDA nº 5 | `relevant` |
   | Adicionar | Acórdão TCU 6875/2021 - Inexigibilidade - Fornecedor exclusivo | `relevant` |
   | Adicionar | Inf. 413/2021 | `relevant` |
   | Manter | Súmula TCU 270 (`470a8111`) | `highlyRelevant` |

   **Totais agregados:** 1 remoção, 34 adições (15 em `highlyRelevant`, 19 em `relevant`), 7 queries mantêm doc original.

4. **Commit:** `fix(eval): reanotar 8 queries E + remover IDs fantasma + handle dedup ON 89/2024`.

### Sub-fase 6B — Tool de auditoria + aplicação (~2-3h)

**Entregáveis:**
- `eval/scripts/annotation-audit.ts` — gera CSV de sugestões.
- `eval/scripts/fase6b-apply-audit.ts` — aplica decisões do CSV ao golden.

**Fluxo:**

1. **Gerar sugestões:**
   ```bash
   npx dotenv -e .env.local -- tsx eval/scripts/annotation-audit.ts \
     --from eval/reports/2026-04-23T12-46-32_diag-fase0.json \
     --skip-queries <ids-já-tratados-em-6A> \
     --threshold 10
   ```
   Para cada query anotada não pulada (43 queries):
   - Lê `predicted[0..N]` (top-10 por default) do eval run.
   - Filtra docs não presentes em `annotations.relevant`.
   - Para cada candidato, coleta: title, content snippet (500 chars em torno de key-terms da query via `matchKeyTermsInText` do módulo da Fase 0), posição, categoria.
   - Emite linha no CSV.

2. **Heurística auto-suggest:**
   - `suggest_auto = accept` — candidato em top-5 **E** title ou content contém ≥ 1 key-term.
   - `suggest_auto = maybe` — candidato em top-5 sem match de key-term **OU** em top-6..10 com match.
   - `suggest_auto = reject` — candidato em top-6..10 sem match.

3. **CSV de saída:** `eval/reports/annotation-audit-2026-04-23.csv`
   ```
   query_id, query_text, candidate_id, candidate_title, candidate_position,
   candidate_snippet, existing_relevants_count, suggest_auto,
   decision, decision_note
   ```
   `decision` vazio; valores aceitos: `accept`, `accept-highly`, `reject`, `comment`.

4. **Revisão manual:** abrir CSV no editor, preencher `decision` linha a linha. Estimativa: ~225 linhas totais × ~1 min/linha = ~90 min (após triagem mental, a maioria é decisão rápida).

5. **Aplicar decisões:**
   ```bash
   npx dotenv -e .env.local -- tsx eval/scripts/fase6b-apply-audit.ts \
     --csv eval/reports/annotation-audit-2026-04-23.csv --apply
   ```
   - Carrega CSV + `golden-set.json`.
   - Para cada linha com `decision` preenchido:
     - `accept` → push `candidate_id` em `query.annotations.relevant`.
     - `accept-highly` → push em `relevant` E em `highlyRelevant`.
     - `reject` → nenhuma ação.
     - `comment` → loga no stdout.
   - Dedup dos arrays.
   - Atualiza `annotations.annotatedAt` nos queries tocados.
   - **Append-only:** script não remove IDs existentes.
   - **Dry-run por default.** Aplicação persiste só com `--apply`.
   - Backup automático: salva `golden-set.json.bak-YYYY-MM-DD` antes de persistir.

6. **Commit:** `fix(eval): expandir anotações de 43 queries via auditoria de golden set`.

### Sub-fase 6C — Re-rodar eval + fechar fase (~5 min)

1. **Re-eval:** `npm run eval:run -- --label pos-fase6`
2. **Comparar métricas** com `pos-reprocessamento-completo` (34.1%) e `diag-fase0` (34.1%).
3. **Gerar resumo:** `eval/reports/fase6-summary-2026-04-23.md` com:
   - Diff de contagens no golden (docs adicionados/removidos por query).
   - Métricas antes/depois (recall@5, MRR, nDCG@10).
   - Lista dos 8 E + ajustes feitos.
   - Resumo da auditoria dos 45 (linhas revisadas / aceitas / rejeitadas).
   - Observações pra Fase 2 (rerank) — se a distribuição nova muda priorização.
4. **Atualizar `ROADMAP_BUSCA_QUALIDADE.md`:**
   - Fase 6 → ✅ com referência ao summary.
   - Novo baseline registrado.
   - Se spot-check revelou >15 duplicatas, adicionar "Fase 7 — Dedup estrutural" como entrada nova.
5. **Commits:**
   - `docs(eval): eval pós-Fase 6 + resumo de auditoria do golden`.
   - `docs(roadmap): Fase 6 ✅ com novo baseline recall@5`.

## Critério de aceite

1. `eval/golden-set.json` revisado e commitado (2 commits: 6A e 6B).
2. `eval/reports/fase6-summary-2026-04-23.md` gerado com métricas antes/depois e changelog.
3. `docs/ROADMAP_BUSCA_QUALIDADE.md` atualizado: Fase 6 ✅, novo baseline, possivelmente Fase 7 nova.
4. Re-eval com label `pos-fase6` commitado em `eval/reports/`.
5. recall@5 subiu (qualquer ganho). Meta é ≥ 48%; ganho < 10pp sinaliza heurística conservadora demais e merece segunda passada do audit com threshold diferente.

## Riscos e mitigações

- **Heurística auto-suggest rejeita candidatos válidos** → revisão manual completa mesmo das linhas com `suggest_auto=reject` de top-5. O CSV tem todas; filtrar no editor apenas por prioridade de ordem.
- **Remoções equivocadas** → apenas 1 remoção explícita (`esp-518661-2` retirando ON 2/2009). `fase6b-apply-audit.ts` é append-only por design.
- **Tool aplica dedup errado** → 6A tem step interativo de confirmação antes de persistir. 6B tem dry-run + backup `.bak`.
- **Tempo de revisão estoura** → se ultrapassar 3h revisão, parar e re-calibrar a heurística (ex.: `suggest_auto=accept` apenas com match forte). Melhor entregar menos mas bem revisado.
- **Re-eval regride em vez de melhorar** → investigar casos específicos via drill-down. Improvável dado que operação é append-only; regressão só se alguma remoção feita em 6A estiver errada.

## Rollback

Cada sub-fase tem commit isolado:
- 6A: `fix(eval): reanotar 8 queries E + ...`
- 6B: `fix(eval): expandir anotações de 43 queries via auditoria ...`
- 6C: 2 commits (eval run + roadmap)

`git revert` de qualquer um restaura golden ao estado anterior. Backup `.bak` serve como seguro extra para 6B.

## Arquivos afetados

- `eval/golden-set.json` — editado em 6A e 6B.
- `eval/scripts/fase6a-apply-known.ts` — novo (one-shot).
- `eval/scripts/annotation-audit.ts` — novo (reusable para futuras auditorias).
- `eval/scripts/fase6b-apply-audit.ts` — novo (one-shot, mas padrão reutilizável).
- `eval/reports/annotation-audit-2026-04-23.csv` — novo output de 6B passo 1.
- `eval/reports/fase6-summary-2026-04-23.md` — novo, gerado em 6C.
- `eval/reports/<stamp>_pos-fase6.{md,json}` — novos, gerados pelo eval:run.
- `docs/ROADMAP_BUSCA_QUALIDADE.md` — atualizado em 6C.

## Histórico

- **2026-04-23:** design criado após conclusão da Fase 0. Brainstorming definiu escopo (b) — 8 E + 45 auditoria + fantasmas + dedup —, abordagem híbrida (C) — edição direta para casos conhecidos + tool heurística para auditoria —, e critério de aceite (recall@5 ≥ 48%). Scope out: criação de novas queries, cleanup estrutural de DB, re-anotação de queries com recall > 20% não-flagadas.
