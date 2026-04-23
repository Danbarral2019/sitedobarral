# Roadmap — Elevar a qualidade da busca IA (recall@5)

**Criado em:** 2026-04-23
**Autor:** Daniel Barral + Claude (sessão de execução do reprocessamento)
**Status:** Planejado, aguardando execução
**Prioridade:** Média — produto funciona, mas recall@5 de ~34% é baixo para busca jurídica profissional. Limita utilidade do chat IA e da busca semântica na `/area-restrita/assistente`.

**Roadmaps antecessores (ambos já concluídos):**
- `ROADMAP_GEMINI_MODELO_25.md` — migração 2.0-flash → 2.5-flash (urgência de deprecação 2026-06-01).
- `ROADMAP_GEMINI_PAGO.md` — reprocessamento de 4.767 documentos com prompt enriquecido. **Eval provou que isso não moveu o recall** (34,2% → 34,1% ± ruído). Este novo roadmap começa daí.

---

## Resumo do aprendizado até aqui

Após executar os dois roadmaps acima, medimos o eval novamente:

| Métrica | Pré-roadmap | Pós-reprocess (4.767 docs) | Δ |
|---|---|---|---|
| recall@5 | 34,2% | **34,1%** | -0,1pp |
| MRR | 0,364 | 0,352 | -0,012 |
| nDCG@10 | 0,403 | 0,367 | -0,036 |

**Regressão ligeira.** Ou seja: reprocessar a base com resumos bonitos **não** é o caminho para melhorar retrieval. Hipótese confirmada a posteriori:
- A busca semântica chunka e embedda o campo `Document.content` (quando presente), **não** `Document.description`. Para TCU, informativos, DECOR, etc., o `content` não mudou — só o resumo mudou. Logo, os embeddings são praticamente os mesmos que antes.
- O FTS usa `description` ponderado, e ao trocar ementa oficial ("jurisprudência específica com terminologia exata") por resumo acessível ("o tribunal decidiu..."), perdemos match textual exato nas queries do golden set que copiam ementas.

**Os resumos novos continuam úteis** — viram conteúdo visível ao aluno na UI. Só não ajudam o retrieval.

Relatório que prova isso: `eval/reports/2026-04-23T02-25-41_pos-reprocessamento-completo.md`.

---

## Baseline atual (referência deste roadmap)

**Pós-Fase 6 (2026-04-23):** `eval/reports/fase6-summary-2026-04-23.md`

- **recall@5: 66,3%** (era 34,1% pré-Fase 6; golden set de 91 queries, 53 anotadas)
- **MRR: 0,851** (era 0,352)
- **nDCG@10: 0,668** (era 0,367)
- **Easy queries (8): 54,6%** (era 38%)
- **Medium queries (43): 69,3%** (era 32,6%) — maior ganho
- **Hard queries (2): 50,0%** (era 50% já) — travado; `q-data-a-data` continua em 0%

Alvos revisados (a partir do novo baseline 66,3%):
- Curto prazo (Fases 2 rerank + 1 HyDE, sem mudar schema): **≥ 72% recall@5** (+6pp)
- Médio prazo (Fase 3 com novo embedding model): **≥ 78% recall@5**
- Teto prático para busca jurídica com ferramentas disponíveis: ~80%

---

## Diagnóstico antes de plano — Fase 0

**Antes de implementar qualquer mudança**, preciso primeiro entender onde o sistema atual falha. Sem isso, as próximas fases são chute.

**Passos:**
1. Rodar `eval/cli/run-baseline.ts` com saída verbose para listar cada query do golden set e qual doc retornou vs qual era esperado.
2. Para as 21 queries com 0% recall@5, inspecionar:
   - O doc esperado existe e está indexado? (descartar bug de indexação)
   - A query tem terminologia muito específica (nome de ato, art. X da Lei Y) que embedding genérico perderia?
   - O chunk correto existe no `DocumentChunk` mas está baixo no ranking?
3. Categorizar as falhas em buckets:
   - **A. "Termo específico não chega"** (ex.: `IN SEGES/ME 65/2021` — embedding genérico não captura número de IN).
   - **B. "Tese similar, embedding diferente"** (reformulação do conceito falha no vetor).
   - **C. "Doc não está na base"** (bug de indexação — precisa ser corrigido no cron/scraper).
   - **D. "Doc está mas chunking cortou mal"** (pedaço relevante ficou em chunk próprio mas não retornou no top-k).

Saída: um markdown em `eval/reports/failure-analysis-YYYY-MM-DD.md` com essas categorias quantificadas. Esse mapa determina qual próxima fase faz mais sentido.

**Sem esta fase, não executar nenhuma outra.** Experimentos cegos nesta área rotineiramente não movem o ponteiro (comprovado por `ROADMAP_GEMINI_PAGO`).

---

## Fase 1 — Tentar HyDE (Hypothetical Document Embedding)

**Hipótese:** queries reais são curtas e em jargão do usuário; a base é texto jurídico denso. HyDE gera uma resposta hipotética via LLM antes de embeddar, aproximando o embedding do "espaço" dos documentos.

**Custo:** muito baixo. O `eval/search-adapter.ts` JÁ TEM `hydeSearch` implementado (linha ~30 do `run-baseline.ts`, flag `--hyde`). Basta rodar:

```bash
npm run eval:run -- --hyde --label "hyde-01"
```

**Ganho típico em literatura:** +5-15pp em queries curtas. Não custa uma linha de código.

**Trade-off:** cada query chama o LLM primeiro → latência +500ms a +1,5s. Se ganho for bom, vale incorporar na rota de busca IA.

**Critério de aceite:** se `recall@5` subir ≥ 5pp, adicionar `?hyde=true` opcional em `/api/documents/query` e `/api/jurisprudencia/query`, ativado por feature flag.

---

## Fase 2 — Cross-encoder reranking

**Hipótese:** a ordenação atual (top-k por similaridade de vetor) traz documentos relevantes mas não no top. Um cross-encoder pega os top-20 e reordena por relevância real (olhando query+doc juntos, não só embeddings separados).

**Opções:**
- **HuggingFace grátis**: `cross-encoder/ms-marco-MiniLM-L-12-v2` via `@xenova/transformers` (roda local no servidor, sem API key). Custo zero em API; ~200ms/query de CPU.
- **Cohere Rerank 3.5** ($0,002/req): já testado antes (`eval/reports/2026-04-12T20-56-17_cohere-rerank.md`) e **não melhorou** — mantido 44,5% recall na versão anterior do golden set. Mas aquele eval tinha um golden set menor (53 queries totais, não 91). Vale reexaminar com o golden atual.
- **LLM-based rerank (Gemini 2.5-flash com thinking budget)**: passar query + top-20 docs em um único prompt e pedir reordenação. ~$0,001/query com 2.5-flash, lento (~3s/query), mas pode ser a mais poderosa.

**Implementação:** `rerankSearch` já existe em `eval/search-adapter.ts` (flag `--rerank`). Rodar:

```bash
npm run eval:run -- --rerank --label "rerank-gemini-01"
npm run eval:run -- --cohere --label "rerank-cohere-01"
```

E se quiser HuggingFace, implementar um novo adaptador `hfRerank` em `eval/search-adapter.ts`.

**Critério de aceite:** ≥ 5pp em recall@5 E ≥ 0,05 em MRR. Se passar, implementar no server-side (com cache de resultados rerankeados).

---

## Fase 3 — Trocar o modelo de embeddings

**Hipótese mais impactante.** Os vetores de 768 dimensões do `gemini-embedding-2-preview` capturam semântica geral mas não são otimizados para português jurídico. Modelos mais recentes, maiores ou especializados podem dar salto significativo.

**Opções:**

| Modelo | Dim | Custo | Especial |
|---|---|---|---|
| `voyage-3` (Voyage AI) | 1024 | $0,02/1M tokens | State-of-art multilingual, tem `voyage-law-2` especializado em jurídico |
| `text-embedding-3-large` (OpenAI) | 3072 | $0,13/1M tokens | Padrão da indústria, performa bem em PT |
| `jina-embeddings-v3` | 1024 | Gratuito self-hosted | Multilingual, benchmarks fortes |
| `BAAI/bge-m3` | 1024 | Gratuito self-hosted | Multilingual, sparse+dense simultâneo |

**Custo de migração:**
- **Schema change**: `prisma/schema.prisma` — alterar `vector(768)` para `vector(1024)` ou `vector(3072)` nas 3 tabelas (`DocumentChunk`, `LegislativeActChunk`, `TribunalDecisionChunk`).
- **Migration SQL**: manual via `ALTER TABLE` + regeneração de índice ivfflat.
- **Re-embed**: re-rodar `migrate-to-embeddings.ts` e `index-legislative-acts.ts` com novo provider. Como temos ~12.500 chunks totais, é manejável em 1-2h.
- **Dev time**: criar `lib/embeddings/voyage-embeddings.ts` (ou similar) com a mesma interface de `gemini-embeddings.ts`. Substituir import em `document-processor.ts` e `legislative-act-processor.ts` via env var (similar ao padrão `EMBEDDING_MODEL` atual).
- **Custo de API**: ~$5-30 total para re-embed, dependendo do provider.

**Critério de aceite:**
- Recall@5 ≥ 50% (vs 34% atual) para a troca ser aceitável.
- Se só subir 2-3pp, não compensa a complexidade operacional (manter multi-provider, custo recorrente).

**Teste A/B antes da migração full:** re-embed 10% da base (500 docs) em tabela shadow `DocumentChunkV2` com vector(1024), rodar eval filtrando só por docs com chunk shadow. Se ganho real >10pp → migrar tudo. Se <5pp → desistir.

---

## Fase 4 — Tuning do hybrid search

**Hipótese:** o hybrid search combina vetor + BM25/FTS com pesos. Os pesos default podem estar desbalanceados.

Buscar em `lib/embeddings/hybrid-search.ts` e `lib/embeddings/vector-search.ts`:
- Como é feita a fusão (RRF, weighted sum)?
- Qual o peso atual de vetor vs FTS?
- Top-k de cada lado antes da fusão?

**Experimentos** (em `eval/cli/run-baseline.ts` — adicionar flags):
- Peso vetor 0.7 / FTS 0.3 vs peso vetor 0.3 / FTS 0.7 vs 50/50
- RRF com constante k=60 (default) vs k=30 vs k=100
- Top-k pre-fusion: 20 de cada vs 10 de cada

**Custo:** baixo. Só rodar eval várias vezes. Horas de dev, zero custo de API.

**Critério de aceite:** se algum tuning der +3pp, adotar. Senão, arquivar.

---

## Fase 5 — Estratégia de chunking

**Hipótese:** chunks atuais (1200 chars, overlap 200 — `lib/embeddings/text-chunker.ts`) podem quebrar mal em texto jurídico. Uma tese pode ficar partida entre dois chunks, nenhum com contexto completo.

**Experimentos:**
1. **Chunks menores + mais overlap** (800 chars / 400 overlap): mais chunks, mais granularidade semântica, maior custo de embed.
2. **Chunks maiores** (2400 / 400): captura teses completas, mas dilui o sinal semântico por chunk.
3. **Proposition-based chunking**: LLM extrai "proposições" autossuficientes do doc (1 tese = 1 proposição → 1 chunk). Caro (~$0,003/doc) mas potencialmente muito melhor.
4. **Semantic chunking**: usar embeddings de sentenças para detectar mudança de tópico antes de cortar.

**Custo:** médio. Requer re-embed de tudo para cada variação. Fazer em 10% da base primeiro para medir.

**Critério de aceite:** +5pp em recall@5 sobre baseline atual.

---

## Fase 6 — Auditoria do golden set

**Meta-fase.** O golden set pode ter problemas que inflam ou deflacionam as métricas:
- Algumas queries podem ter anotações erradas (doc esperado está errado).
- Algumas queries podem ter múltiplas respostas corretas mas só uma foi anotada.
- O split easy/medium/hard pode estar desalinhado.

**Passos:**
1. Reler `eval/golden-set.json` em pares: (query, expected_doc).
2. Para cada item: a query reflete uma pergunta real de aluno? O doc esperado é de fato a melhor resposta?
3. Corrigir/expandir anotações (usar `npm run eval:annotate` que já existe).
4. Aumentar golden set de 91 para 150+ queries cobrindo temas ainda não testados.

**Criterio de aceite:** golden set revisado + expandido, com changelog documentando alterações. Todas as fases anteriores devem ser re-rodadas com o novo golden set para comparação justa.

---

## Ordem sugerida de execução

**Status 2026-04-23:** Fase 0 (diagnóstico) e Fase 6 (auditoria do golden) concluídas. **recall@5 saltou de 34,1% para 66,3%** com golden auditado, sem mudar retrieval.

1. ✅ **Fase 0 — Diagnóstico** (concluída em 2026-04-23). Relatório: `eval/reports/failure-analysis-2026-04-23.md`. Distribuição: A=2, A'=2, B=7, D=1, D+=9, E=8, C/C-parcial=0. Achado crítico: 8 queries em E = problema de anotação, não retrieval.
2. ✅ **Fase 6 — Auditoria do golden set** (concluída em 2026-04-23). Resumo: `eval/reports/fase6-summary-2026-04-23.md`. 95 docs novos anotados + 3 removidos (1 ON misanotada + 2 IDs fantasma) + 4 dedups aplicados. **Ganho: +32,2pp em recall@5** (meta era +13,9pp).
3. **Fase 2 — Cross-encoder rerank** (próxima). Com recall@5 já em 66,3%, rerank deve puxar os 33,7% restantes onde o doc relevante existe no top-20 mas não top-5. Adapter `rerankSearch` pronto em `eval/search-adapter.ts`.
4. **Fase 1 — HyDE** (15 min, complementar). Pode ajudar queries residuais como `q-data-a-data` (0% recall — termo técnico multi-palavra).
5. **Fase 3 — Trocar embedding model** (1-2 dias). Só se Fase 2 + Fase 1 juntos não passarem de ~75%. Meta agora é > 78%.
6. **Fase 4 — Hybrid tuning (FTS)** (2h). Ainda útil para queries A'.
7. **Fase 5 — Chunking** — **arquivada**. Sem evidência nas falhas restantes.

### Fase 7 — Dedup estrutural do banco (nova, registrada em 2026-04-23)

Spot-check durante 6A revelou **37 títulos duplicados** em `Document` (padrão "Resposta a Consulta — Acórdão AC-XXX/YY-P"), dos quais 4 afetavam o golden (tratados defensivamente). Os 33 restantes não afetam o golden mas poluem o DB.

**Fix estrutural:** SQL de merge (manter 1 ID canônico, atualizar referências em `DocumentChunk` e remover duplicatas). Também incluir dedup por número (ON 89/2024 com 2 títulos diferentes — "ON 89/2024" e "Orientação Normativa AGU nº 89/2024" — precisa fuzzy match).

**Fora do escopo imediato** — fazer quando precisar endurecer o DB.

### Fase 8 — Modelagem de regime/vigência de normas (nova, registrada em 2026-04-23)

Revelação da 6B: várias teses mudaram entre Lei 8.666 e Lei 14.133 (ex.: preço máximo era obrigatório só em obras; agora é em qualquer objeto). Documentos das duas leis coexistem no DB, e o retriever não distingue vigência.

**Ideal:** enriquecer cada doc com metadata `lawRegime` (`'8.666' | '14.133' | 'both'`) e permitir filtro/boost por regime na busca.

**Pode ser feito:** (a) via regra manual sobre tabela `Document` (ex.: docs anteriores a 2021 = Lei 8.666), ou (b) via LLM classificando o content de cada doc. Incluir no retrieval adaptando o score RRF com peso por vigência da norma citada na query.

Fora do escopo imediato.

### Follow-ups de infraestrutura (abertos)

- **Expandir regex de key-terms** em `eval/scripts/failure-analysis/key-terms.ts` — hoje não captura expressões multi-palavra minúsculas ("data a data", "dedicação exclusiva", "escopo"). Afetou classificação de `q-data-a-data` na Fase 0.
- **Docs ausentes no DB** — 3 Inf.s/Enunciados referenciados no plano da Fase 6 não existem no banco (Inf. 44/2010, Inf. 50/2011, Enunciado IBDA nº 5). Indica buracos no scraper/indexação.

---

## Arquivos-chave neste roadmap

- `eval/cli/run-baseline.ts` — CLI atual, já tem flags `--hyde`, `--rerank`, `--cohere`.
- `eval/search-adapter.ts` — adaptadores `baselineSearch`, `rerankSearch`, `hydeSearch`.
- `eval/golden-set.json` — 91 queries, 53 anotadas.
- `eval/reports/` — histórico de runs.
- `lib/embeddings/vector-search.ts` — busca semântica produção.
- `lib/embeddings/hybrid-search.ts` — fusão vetor+FTS.
- `lib/embeddings/gemini-embeddings.ts` — cliente de embedding atual (trocar nesta fase 3).
- `lib/embeddings/text-chunker.ts` — chunking (Fase 5).
- `prisma/schema.prisma` — `vector(768)` nas 3 tabelas de chunks (Fase 3 mexe aqui).

---

## Rollback

Todas as fases com código são revertíveis via `git revert`.

Fase 3 (troca de embedding model) é a única que muda dados de forma grande — fazer em tabela shadow (`DocumentChunkV2`) e manter original até validar. Se regressão, apenas apontar rota de busca de volta para tabela antiga.

---

## Checklist de retomada após queda de energia

1. Ler este arquivo.
2. `git log --oneline -20` — ver se alguma fase foi commitada.
3. Rodar `npm run eval:run -- --label diag` pra confirmar o baseline atual ainda está em ~34%.
4. Continuar pela fase não executada, **respeitando a obrigatoriedade da Fase 0**.

---

## Histórico

- **2026-04-23**: documento criado após constatação (via eval) de que o reprocessamento do `ROADMAP_GEMINI_PAGO.md` não moveu o ponteiro. Hipótese "melhor resumo = melhor embedding" refutada empiricamente. Este roadmap separa resumos (Gemini pago) de busca (que precisa mexer em retrieval, não em geração).
- **2026-04-23**: Fase 0 concluída. Pipeline automático (`eval/scripts/analyze-failures.ts`) + revisão manual das 29 queries falhas. 28% revelaram-se problema de anotação (bucket E), não de retrieval — Fase 6 promovida para prioridade máxima. Relatório: `eval/reports/failure-analysis-2026-04-23.md`.
- **2026-04-23**: Fase 6 concluída. 6A aplicou 10 operações conhecidas (8 queries E + 2 IDs fantasma + 4 dedups). 6B auditou 41 queries restantes via heurística + revisão caso-a-caso no chat (141 decisões manuais em 34 queries). Total: 95 docs novos anotados (70 relevant + 25 highly), 3 removidos. **recall@5: 34,1% → 66,3% (+32,2pp)**, MRR: 0,352 → 0,851, nDCG@10: 0,367 → 0,668. Meta (48%) superada por +18pp. Registradas Fase 7 (dedup estrutural — 33 duplicatas remanescentes) e Fase 8 (modelagem de regime/vigência de normas). Resumo: `eval/reports/fase6-summary-2026-04-23.md`.
