# Fase 4.1 — A/B dimensão de embedding (768 vs 1536)

Data: 2026-07-07 · Golden: 91 queries (53 anotadas, 38 skipped) · Adapters: `baselineSearch` (768, `eval/reports/2026-07-07T16-53-46_baseline.md`) vs `shadowSearch1536` (1536, `eval/reports/2026-07-07T16-55-52_shadow-1536.md`) · Git SHA: `261843b9`

| Métrica | 768 (baseline) | 1536 (shadow) | Δ |
|---|---|---|---|
| recall@5 | 31.6% | 33.3% | +1.7 pp |
| MRR | 0.586 | 0.617 | +0.031 |
| nDCG@10 | 0.445 | 0.462 | +0.018 |

Por dificuldade (recall@5):

| Dificuldade | N | 768 | 1536 | Δ |
|---|---|---|---|---|
| easy | 8 | 44.0% | 41.7% | -2.3 pp |
| medium | 43 | 30.8% | 33.3% | +2.5 pp |
| hard | 2 | 0.0% | 0.0% | 0.0 pp |

Latência média por query: 768 = 847.8 ms · 1536 = 893.4 ms (+45.6 ms, +5.4%).

## Observação fora do escopo da régua

Ambas as rodadas desta A/B (768 e 1536) foram medidas no estado atual do código/dados
(HEAD `261843b9`, pós Fase 0-3 de Jul/2026). O recall@5 absoluto do baseline 768 caiu
de 65.8% (rodada de referência em `eval/reports/2026-04-26T15-18-09_baseline.md`,
git SHA `ba76fa6`) para 31.6% agora — uma regressão de ~34pp que antecede e é
independente desta A/B (a coluna `embedding1536` sequer existia em abril). A causa
provável está em mudanças recentes na busca/embeddings/RAG entre abril e julho
(ver `git log --oneline -- lib/embeddings/`), não em nada tocado pela Task 5. Isso
não invalida a comparação relativa 768-vs-1536 acima (ambos os braços rodaram sob o
mesmo código, mesmos dados, mesma golden set), mas é um achado que merece
investigação separada — o baseline absoluto de qualidade da busca está bem abaixo
do historicamente registrado.

## Veredito

Régua: migrar sse recall@5 ≥ +5pp E sem regressão em MRR.

- Δrecall@5 = +1.7 pp — **abaixo** do limiar de +5pp.
- ΔMRR = +0.031 — sem regressão (leve melhora).

Como o critério exige **ambas** as condições e a primeira (Δrecall@5 ≥ +5pp) não foi
atingida, a régua aponta para:

- [x] **NO-GO** — arquivar; reabrir a decisão de provider (Voyage) numa próxima sessão. Coluna shadow pode ser dropada.
- [ ] GO — abrir plano da migração de produção (ALTER colunas reais + reindex + re-embed + env `EMBEDDING_DIMENSION`, incluindo LeiArticleEmbedding).

A dimensão 1536 (mesmo provider Gemini, matryoshka truncation) traz uma melhora
marginal e consistente (recall@5, MRR e nDCG@10 todos levemente para cima), mas
não o suficiente para justificar o custo de uma migração de produção (re-embed de
~20k chunks + reindex + risco operacional) frente ao limiar de +5pp definido no
spec da Fase 4. Recomenda-se arquivar esta trilha e reabrir a hipótese de provider
especializado (Voyage) como próximo passo, conforme já prescrito na seção de
decisão pós-plano.
