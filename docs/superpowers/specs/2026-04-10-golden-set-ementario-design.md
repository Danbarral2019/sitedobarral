# Golden Set derivado do Ementario ELIC

## Objetivo

Gerar automaticamente ~79 queries anotadas para o golden set do eval framework do sitedobarral, usando as teses curadas do projeto ELIC de uniformizacao como fonte autoritativa. Os fundamentos citados nas teses (acordaos TCU, ONs AGU, pareceres DECOR) servem como anotacoes de relevancia pre-validadas por procuradores.

## Fonte de dados

- `F:\OneDrive - AGU\Elic - projeto uniformizacao\teses\banco.json` (33 teses transversais)
- `F:\OneDrive - AGU\Elic - projeto uniformizacao\templates\{id} - {nome}\{id}.json` (23 fichas, ~343 teses especificas)
- Selecao: todas as 33 transversais + ~2 especificas por template (~46), priorizando teses com fundamentos diversificados

## Pipeline

### Etapa 1: Extracao e normalizacao

Script le banco.json + fichas e extrai para cada tese selecionada:
- `query`: versao resumida do enunciado, como um procurador buscaria (~10-20 palavras)
- `fundamentos_raw`: lista de referencias parseadas individualmente (ex: "Acordao 597/2023-Plenario", "ON AGU 52/2014")
- `metadata`: transversal vs especifica, template de origem, tema, dificuldade estimada

A reformulacao do enunciado em query de busca e feita por regras simples:
- Remover conectivos juridicos longos ("A inscricao da contratada no... impede a celebracao de...")
- Manter termos-chave do dominio ("CADIN inscricao contratos impedimento")
- Queries devem ter 5-15 palavras, linguagem natural

### Etapa 2: Correlacao com o indice do sitedobarral

Para cada fundamento extraido, resolver o documentId correspondente no banco:

**Match exato (prioridade):**
- Acordaos TCU: buscar `acordaoNumero` + `acordaoAno` na tabela Document (campos acordaoNumero, acordaoAno)
- ONs AGU: buscar `onNumber` + `onYear` na tabela Document
- Para outros: buscar substring no campo `title` via SQL ILIKE

**Fallback semantico:**
- Se match exato nao encontrar, rodar `hybridSearch({ query: referencia, limit: 5 })` e aceitar top-1 se `similarity >= 0.7`
- Marcar como `not_found` se nenhum caminho resolver

Resultado: mapeamento `referencia -> documentId | null`

### Etapa 3: Montagem do golden set

Para cada tese selecionada:
1. `highlyRelevant` = documentIds resolvidos dos fundamentos curados (confianca maxima)
2. `relevant` = highlyRelevant (inicialmente identicos; expandidos apos revisao)
3. Rodar a query no baselineSearch e coletar top-10
4. Documentos no top-10 que NAO estao nos fundamentos curados -> `candidates_pending_review`
5. Gerar relatorio markdown com candidatos para revisao do coordenador

### Formato de saida

Compativel com `eval/golden-set.json` (tipo GoldenSet de eval/types.ts):

```json
{
  "id": "t-cadin-01",
  "query": "CADIN inscricao impede celebracao contratos aditivos",
  "description": "Tese transversal T-CADIN-01: inscricao no CADIN apos 16/09/2024 impede celebracao.",
  "category": "tese-transversal",
  "difficulty": "medium",
  "annotations": {
    "relevant": ["uuid-doc-1", "uuid-doc-2"],
    "highlyRelevant": ["uuid-doc-1"],
    "annotatedAt": "2026-04-10T...",
    "annotatedBy": "elic-import",
    "notes": "Fundamentos curados: Lei 10.522/2002 art. 6-A, Parecer 63/2024/DECOR. Candidatos nao curados: [lista]."
  }
}
```

Campo extra `_elic` (ignorado pelo runner, util para rastreabilidade):
```json
"_elic": {
  "source": "transversal",
  "code": "T-CADIN-01",
  "fundamentos_curados": ["Lei 10.522/2002, art. 6-A", "Parecer 63/2024/DECOR/CGU/AGU"],
  "fundamentos_resolved": { "Parecer 63/2024/DECOR/CGU/AGU": "uuid-doc-1" },
  "fundamentos_not_found": ["Lei 10.522/2002, art. 6-A"],
  "candidates_pending_review": ["uuid-doc-3"]
}
```

## Selecao de teses especificas

Criterio: para cada template, selecionar as 2 teses especificas com maior diversidade de fundamentos (contagem de tipos distintos: TCU, ON, DECOR, CPLC, IN, lei). Empate: preferir a com enunciado mais curto (query mais focada).

## Estimativa de dificuldade

- `easy`: tese cujo enunciado menciona artigo de lei especifico (ex: "art. 18, §1o da Lei 14.133")
- `medium`: tese com referencia a jurisprudencia ou orientacao normativa
- `hard`: tese conceitual sem referencia direta a artigo (ex: "A analise juridica da ELIC restringe-se aos aspectos estritamente juridicos")

## Merge com golden set existente

As 12 queries existentes em golden-set.json sao preservadas. As novas queries sao adicionadas ao array. O `version` e incrementado para 2.

## Entregaveis

1. `eval/scripts/generate-golden-from-ementario.ts` — executa as 3 etapas
2. `eval/golden-set.json` atualizado (~91 queries: 12 existentes + ~79 novas)
3. `eval/reports/ementario-candidates.md` — candidatos para revisao humana
4. Baseline run com as queries anotadas

## Fora de escopo

- Nao altera eval runner, metrics ou report
- Nao modifica hybridSearch
- Nao importa documentos novos no sitedobarral
- Nao faz revisao automatica dos candidatos (gera relatorio para revisao humana)
