# Fase 6 — Summary (Auditoria do Golden Set)

**Data:** 2026-04-23
**Spec:** `docs/superpowers/specs/2026-04-23-fase6-golden-set-audit-design.md`
**Plano:** `docs/superpowers/plans/2026-04-23-fase6-golden-set-audit.md`

## Métricas antes/depois

| Métrica | Pré-Fase 6 (baseline) | Pós-Fase 6 | Δ |
|---|---|---|---|
| recall@5 (avg) | 34.1% | **66.3%** | **+32.2pp** |
| MRR | 0.352 | **0.851** | **+0.499** |
| nDCG@10 (avg) | 0.367 | **0.668** | **+0.301** |

**Meta spec:** ≥ 48% recall@5. **Status: atingida por folga de +18pp.**

### Por dificuldade

| Difficulty | N | Pré recall@5 | Pós recall@5 | Δ |
|---|---|---|---|---|
| easy | 8 | 38.0% | 54.6% | +16.6pp |
| medium | 43 | 32.6% | 69.3% | **+36.7pp** |
| hard | 2 | 50.0% | 50.0% | 0pp |

A categoria **medium** (que é o grosso do eval — 43/53) foi onde o ganho foi mais expressivo. Confirma a tese: as queries "medium" eram as mais afetadas pelo problema sistêmico do golden (clássico anotado vs moderno recuperado).

**Hard queries ficaram paradas em 50%** — são apenas 2 queries; `q-data-a-data` ainda está em 0% e é bucket A (termo técnico multi-palavra não captura vetorialmente). Fase 1 (HyDE) pode ajudar essa.

## 6A — Casos conhecidos

Executado em 2 commits (spot-check + operações hardcoded + persistência):

- **8 queries E** re-anotadas (+32 adições, 1 remoção ON AGU 2/2009 em `esp-518661-2`). 3 docs do plano ausentes no DB (Inf. 44/2010, Inf. 50/2011, Enunciado IBDA nº 5).
- **2 IDs fantasma** removidos de `q-data-a-data` (docs inexistentes `96cbdacf`, `097d3cdb`).
- **Spot-check de dedup:** 37 títulos duplicados no DB; 4 afetaram o golden — todos do padrão "Resposta a Consulta — Acórdão AC-XXX/YY-P" — resolvidos adicionando os IDs duplicados às anotações de `q-data-a-data` (2 pares), `q-srp-adesao-carona` e `t-habilitacao-manutencao-01`. 33 duplicatas não afetantes ficam registradas para **Fase 7** (dedup estrutural).

**Iteração técnica significativa em 6A:** primeira passada em `--auto` (LIKE do DB com `titleQuery` curto) pegou o primeiro match de cada consulta, errando **10 de 26 matches multi-match** (mesmo número de Inf., temas distintos). Corrigido atualizando `known-operations.ts` com `titleQuery` mais específicos (substring da ementa). Segunda passada: 100% matches únicos.

## 6B — Auditoria das 41

41 queries auditadas (53 anotadas − 12 skipped: 8 E + `q-data-a-data` + `esp-785767-20` + `q-srp-adesao-carona` + `t-habilitacao-manutencao-01`, todas já tocadas em 6A).

**Execução do audit:** 312 candidatos top-10 não-anotados coletados.

| `suggest_auto` (heurística) | Count |
|---|---|
| accept (top-5 + key-term match) | 15 |
| maybe (top-5 sem match OU top-6..10 com match) | 141 |
| reject (top-6..10 sem match) | 156 |

**Revisão humana** (caso-a-caso em conversa, batches por query):

| Decisão final | Count |
|---|---|
| `accept` | 70 |
| `accept-highly` | 25 |
| `reject` | 217 |
| `comment` | 0 |
| `empty` | 0 |

- **Queries afetadas por 6B:** 29 de 41 (12 queries ficaram com tudo reject).
- **Total de docs novos anotados:** 95 (70 relevant + 25 highly).
- **Auto-fill useful:** 15 `accept` + 156 `reject` = 171 decisões pré-aplicadas por heurística; 141 revisadas manualmente.

## Insights qualitativos

**Padrão sistemático confirmado (da Fase 0):** golden apontava para doc clássico (Súmula TCU, ON AGU pré-2014.133) enquanto o retriever entregava o doc moderno (art. literal da Lei 14.133, Inf. TCU recente). A Fase 6B anotou ambos, elevando recall@5 sem mudar retrieval.

**Distinção de regime (Lei 8.666 vs Lei 14.133):** várias queries envolvem teses que mudaram com a nova lei. Em `esp-728449-7` (preços máximos), por exemplo, Súmula 259 (Lei 8.666) limitava a obras/engenharia; art. 59 III Lei 14.133 generalizou. Marcado no `decision_note` das linhas correspondentes. **Registrado Fase 8 — modelagem de regime/vigência de normas** como follow-up estrutural.

**Docs ausentes no DB (cleanup pendente):** 3 Inf.s/Enunciados citados no plano não existem no DB. Indica que scraper/indexação tem buracos — vale investigação pontual.

## Recomendação para Fase 2 (rerank)

Com recall@5 em 66.3% e MRR em 0.851, o retriever já entrega o doc relevante **muito perto do topo** na maioria dos casos. Fase 2 (rerank) continua valendo para puxar recall dos 33.7% restantes — que são predominantemente:
- **`q-data-a-data`** (0%): termo técnico multi-palavra que embedding genérico não captura. Precisa Fase 1 (HyDE) ou Fase 3 (embedding jurídico).
- **Hard queries em geral:** 50% é teto sem intervenção adicional.
- **Medium queries restantes:** que ainda falham têm padrões variados — reranker pode limpar 3-5pp.

**Nova meta realista pós-Fase 6:** recall@5 ≥ 72-75% após rerank + HyDE combinados.

## Próximos passos

- [ ] **Fase 2 (rerank)** — próxima no roadmap. Já tem `rerankSearch` pronto em `eval/search-adapter.ts`. ~15 min pra rodar e medir.
- [ ] **Fase 1 (HyDE)** — complementar ao rerank, pode ajudar `q-data-a-data` e outras que ainda falham.
- [ ] **Fase 7 (registrada)** — dedup estrutural do `Document` (33 pares não-afetantes + potencialmente outros fora do top-50).
- [ ] **Fase 8 (registrada)** — modelagem de regime/vigência de normas (peso por atualidade no retrieval).
- [ ] Expandir regex `key-terms.ts` para capturar expressões multi-palavra minúsculas ("data a data", "dedicação exclusiva"). Registrado como follow-up da Fase 0, não atacado aqui.

## Artefatos

- **Golden set atualizado:** `eval/golden-set.json` (commits `6183a5b` e `b44301e`).
- **Backup:** `eval/golden-set.json.bak-2026-04-23`.
- **CSV de auditoria:** `eval/reports/annotation-audit-2026-04-23.csv` (312 linhas, decisões preservadas).
- **HTML de revisão:** `eval/reports/annotation-audit-2026-04-23.html` (gerado pra revisão humana).
- **Eval run pós-Fase 6:** `eval/reports/2026-04-23T23-03-28_pos-fase6.{md,json}`.
- **Commits principais:**
  - `6183a5b` — Fase 6A aplicada.
  - `b44301e` — Fase 6B aplicada.
  - `ffba18b` — Eval run pós-Fase 6.
