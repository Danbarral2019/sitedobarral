# Fase 4.1 — A/B de dimensão de embedding (Gemini 768 → 1536)

**Data:** 2026-07-07
**Autor:** Daniel + Claude
**Status:** Design aprovado — pronto para plano de implementação
**Contexto maior:** `docs/PLANO_RETOMADA_2026-07.md` (Fase 4.1) e `docs/ROADMAP_BUSCA_QUALIDADE.md` (Fase 3 — trocar modelo de embeddings)

---

## 1. Problema

O retrieval do assistente hoje usa `gemini-embedding-2-preview` **truncado para 768 dimensões**
(Matryoshka). O modelo entrega nativamente mais dimensões; a truncação para 768 pode estar
descartando sinal semântico fino que importa em texto jurídico (números de IN, termos técnicos
específicos, teses reformuladas).

**Baseline medido (recall@5 = 66,3%)** no golden set de 91 queries auditado (ver
`ROADMAP_BUSCA_QUALIDADE.md`). O rerank (cross-encoder) já foi testado e **falhou** — todas as
três abordagens regrediram vs baseline. Logo, a alavanca mais promissora restante é a
**qualidade do próprio vetor**.

## 2. Objetivo e não-objetivos

**Objetivo:** medir, de forma honesta e isolada, se aumentar a dimensão do embedding Gemini de
768 para **1536** eleva recall@5 em produção, e migrar se o ganho justificar.

**Não-objetivos (ficam de fora desta iteração):**
- Trocar de provider (Voyage, OpenAI, jina, bge). Decisão do Daniel: **Gemini-first**; Voyage só
  volta à mesa se o Gemini full-dim decepcionar.
- Chunking estrutural por artigo (Fase 4.2) — será uma iteração **separada**, para não misturar
  variáveis na medição.
- Tuning de pesos do hybrid search (Fase 4 do roadmap de busca) — independente.

## 3. Restrição técnica que fixa a dimensão-alvo em 1536

`pgvector` só constrói índice ANN (ivfflat/hnsw) até **2000 dimensões**. Portanto:
- **1536** → indexável, é o desafiante principal (2× o atual, sob o teto).
- **3072** → só armazenável; buscas cairiam em varredura exata. Inviável como default de produção.
  Opcionalmente medível **apenas no subconjunto do golden** (scan exato, base pequena) como
  curiosidade — sem promessa de produção.

**A verificar na implementação:** se o banco de produção hoje usa índice ivfflat/hnsw ou scan
exato (não encontramos criação de índice em `prisma/migrations` nem em `scripts/`; pode ter sido
criado manualmente). O alvo 1536 é seguro nos dois cenários.

**A verificar na implementação:** confirmar que `gemini-embedding-2-preview` aceita
`outputDimensionality: 1536` (ponto de truncação Matryoshka válido). Se o preview não aceitar 1536,
usar o ponto suportado mais próximo abaixo de 2000.

## 4. Arquitetura do experimento (shadow reversível)

### 4.1 Coluna shadow, não tabela nova
Adicionar coluna nullable `embedding1536 vector(1536)` nas **4 tabelas de chunk** que a busca cruza:
- `DocumentChunk`
- `LegislativeActChunk`
- `TribunalDecisionChunk`
- `LeiArticleEmbedding`

Nullable = **zero impacto em produção** (retrieval atual ignora a coluna). O caminho de
join/RRF/hybrid é idêntico ao de hoje — só troca a expressão do vetor (`embedding` → `embedding1536`).

*Alternativa descartada:* 4 tabelas `*V2` + reescrever a query de união do `vector-search.ts` =
muito mais código e superfície de risco, sem ganho.

### 4.2 Backfill completo, não amostra de 10%
Reembedar **toda** a base (~12,5k chunks) no shadow, não 10%. Motivo: recall@5 exige que os
documentos *distratores* também compitam no ranking; com só 10% da base indexada, os distratores
somem e o recall infla artificialmente. Como é o mesmo provider, o custo é baixo
(~$5–30, 1–2h) e vale a medição honesta.

### 4.3 Caminho de busca de eval isolado
Um adapter de eval novo usa a coluna 1536 **sem tocar no retrieval de produção**. Produção só muda
depois de a meta ser batida e a decisão ser tomada.

## 5. Fluxo de dados / componentes

| # | Componente | Responsabilidade |
|---|-----------|------------------|
| 1 | Migration SQL | `ALTER TABLE ... ADD COLUMN embedding1536 vector(1536)` nas 4 tabelas (nullable). |
| 2 | `scripts/embed-shadow-1536.ts` | Reembedar o **mesmo texto/chunking** em 1536d e popular `embedding1536` nas 4 tabelas. Idempotente, retomável, com log de progresso. |
| 3 | `lib/embeddings/gemini-embeddings.ts` | Suportar dimensão parametrizável na geração (a interface já usa `EMBEDDING_DIMENSION`; permitir override por chamada/env sem quebrar o default 768). |
| 4 | Caminho de busca shadow | Variante da busca (vector/hybrid) que consulta `embedding1536`. Preferir um parâmetro/flag interno reaproveitando `vector-search.ts`, não um fork copiado. |
| 5 | `eval/search-adapter.ts` | Novo adapter `shadowSearch1536` espelhando `baselineSearch` (limit 20, alpha 0.6, sem cache), apontando ao caminho shadow. |
| 6 | Runner de eval | Rodar golden (91 queries) com `baselineSearch` (768) e `shadowSearch1536` lado a lado. Reusar `eval/metrics.ts` (puro, já testado). |
| 7 | `eval/reports/fase4-embedding-dim-2026-07.md` | Relatório: recall@5, MRR, nDCG@10, por dificuldade, com veredito. |

## 6. Critério de aceite / decisão

- **≥ +5pp em recall@5** (66,3% → ≥ 71,3%) **sem regressão** em MRR → **migrar produção para 1536**:
  `ALTER` nas colunas reais, reindexar, re-embedar prod, tudo atrás de env var
  (`EMBEDDING_DIMENSION`) para rollback sem deploy.
- **< +5pp** → arquivar o experimento; a decisão de provider (Voyage) volta à mesa numa próxima
  sessão. A coluna shadow pode ser dropada.
- Reversível em **todo** ponto: coluna nullable, produção intocada até a meta ser atingida.

## 7. Testes

- Unit: gerador de embedding 1536 devolve vetor de dimensão correta; batch preserva ordem.
- Reuso das métricas puras existentes (`eval/metrics.ts`) — já cobertas por teste.
- Gate `test:run` **verde** antes de qualquer commit (lição registrada na Fase 3: mock de runtime
  não é pego por `tsc`).
- Migration aplicada e revertida em ambiente de teste antes de tocar prod.

## 8. Riscos

| Risco | Mitigação |
|-------|-----------|
| `gemini-embedding-2-preview` não aceitar 1536 | Verificar cedo; usar ponto Matryoshka suportado mais próximo. |
| Golden set pequeno (91) → ganho dentro do ruído | Reportar por faixa de dificuldade; exigir +5pp E ausência de regressão em MRR. |
| Custo/tempo de reembedar 12,5k chunks | Script idempotente e retomável; rodar fora de horário de pico. |
| Índice ANN 1536 mais lento/pesado que 768 | Medir latência do adapter shadow; comparar antes de migrar prod. |

## 9. Sequência de execução (alto nível — detalhar no plano)

1. Verificar suporte a `outputDimensionality: 1536` no provider.
2. Migration: adicionar colunas `embedding1536` (nullable) nas 4 tabelas.
3. Parametrizar dimensão no wrapper de embeddings sem alterar o default 768.
4. Script de backfill shadow + rodar backfill completo.
5. Caminho de busca shadow + adapter `shadowSearch1536`.
6. Rodar eval comparativo; escrever relatório.
7. Decisão go/no-go pela régua da seção 6.
8. (Se go) migração de produção atrás de env var + reindex + re-embed prod.
