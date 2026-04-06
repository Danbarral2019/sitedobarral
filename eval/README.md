# Eval Framework

Mede a qualidade do retrieval da busca jurídica do site usando um golden set
curado e três métricas padrão.

## Conceito

- **Golden set** (`golden-set.json`): conjunto de queries representativas com
  documentos relevantes anotados manualmente.
- **Metrics**: recall@5, MRR, nDCG@10 — calculadas por query e agregadas.
- **Reports**: cada execução escreve um markdown em `reports/`. Commitar para
  ter timeline visível de melhorias/regressões.

Esta fase mede SÓ retrieval (ranking de documentos). A qualidade do texto
sintetizado pela LLM (alucinações) é assunto de uma fase futura (LLM-as-judge).

## Comandos

```bash
# Anotar (interativo) — lista queries existentes, escolhe uma
npm run eval:annotate

# Anotar uma query específica
npm run eval:annotate -- --id q-data-a-data

# Criar uma query nova do zero
npm run eval:annotate -- --new

# Rodar o eval e gerar relatório
npm run eval:run

# Rodar com label customizado (vai pro nome do arquivo)
npm run eval:run -- --label "antes-rerank-cohere"
```

## Workflow para construir o golden set inicial

1. Use `npm run eval:annotate -- --new` para criar suas 50 queries (ou comece com as 5-10 que mais te incomodam).
2. Para cada query, o CLI roda a busca atual e mostra o top-10. Marque os relevantes que aparecerem.
3. Se a resposta correta NÃO estiver no top-10, cole o documentId manualmente quando perguntado — a meta é capturar a verdade-de-base, não o que o sistema atual encontra.
4. Quando tiver ~10 queries anotadas, rode `npm run eval:run -- --label "baseline"` para tirar a primeira foto.

## Métricas — interpretação rápida

- **recall@5**: alto = a info certa chega ao usuário no top-5. < 60% = problema sério de retrieval.
- **MRR**: alto = a melhor resposta vem cedo no ranking. < 0.5 = ranking ruim.
- **nDCG@10**: combina relevância graduada (highly relevant pesa 2x). 1.0 = ranking perfeito; ≥ 0.8 é bom.

## O que NÃO está aqui (yet)

- Avaliação da síntese (texto gerado pela LLM)
- LLM-as-judge para queries sem ground truth
- Cobertura de `lei-14133/search` separadamente
