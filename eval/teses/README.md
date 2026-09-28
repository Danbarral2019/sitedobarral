# Medição das teses antes do assistente

A spec das teses (`docs/superpowers/specs/2026-09-04-publicacao-teses-tcu-design.md`, §9) só admite ligar as teses no assistente (`/api/documents/query`) depois de medir o efeito delas sobre a busca. O risco é concreto: a tese é curta, abstrata e escrita em linguagem de súmula, portanto parecida com uma pergunta. Ela tende a pontuar alto e empurrar os acórdãos para fora do contexto, e a IA passaria a responder pela síntese sem a fonte.

## Como rodar

```bash
npm run eval:teses
```

Pré-requisitos: a migração de `TeseEnunciadoChunk` aplicada e o cron `process-index-jobs` já tendo indexado as teses (50 por rodada). Com o índice vazio o script se recusa a rodar, porque o resultado diria "nenhum deslocamento", o que seria falso.

Custo: só embeddings da query e FTS, sem LLM, como o `eval:run`. O script só lê o banco.

## O que ele mede

Para cada query do golden set, a mesma busca híbrida roda duas vezes (parâmetros do `baselineSearch`: `limit` 20, `alpha` 0.6, sem cache), uma sem e outra com o ramo das teses no recorte `acervo`. A comparação é do top-5:

- **histograma de deslocados**: quantas queries perderam 0, 1, 2 ou mais resultados do top-5;
- **relevantes deslocados**: dos que saíram, quantos o golden set anota como relevantes. É o número que mais pesa, porque um resultado irrelevante que sai não é perda;
- **as três piores queries**, com o que saiu e o que entrou no lugar;
- **posição média** dos resultados que não são tese, antes e depois, que distingue empurrão geral de expulsão pontual;
- **teses no topo** (três primeiras posições), só como indicador de observação.

O relatório completo vai para `eval/reports/teses-<data>.json`.

## O que ele não decide

O limiar de aceitação não está fixado, de propósito: fixá-lo antes de ver a distribuição seria escolher no escuro. Com o relatório em mãos, a decisão é do usuário, e o limiar fixado vai para a §9 da spec junto do dado que o justificou.

Se o deslocamento for grande demais, o caminho não é desligar a feature. É reduzir o `limit` do ramo das teses (hoje `limit * 2`, em `lib/embeddings/vector-search.ts`) ou aplicar um fator de desconto na `similarity` do ramo, como a hierarquia já faz para os atos normativos, e medir de novo.
