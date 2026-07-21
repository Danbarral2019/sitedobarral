# Onda W1 da ingestão retroativa do TCU — resultado do portão

**Data:** 2026-07-21
**Spec:** `docs/superpowers/specs/2026-07-20-ingestao-retroativa-tcu-design.md`
**Plano:** `docs/superpowers/plans/2026-07-20-ingestao-retroativa-tcu-w1.md`
**Mecanismo:** PR #162, mergeado em `main` (`cf6d21a7`), em produção.

## VEREDITO: GO

O critério estava fixado antes da execução: **≥ 1.000 arestas novas com `noVoto = true`**. Resultado: **2.389**. Passou com folga de 2,4×.

## Números

### Linha de base (20/07, antes de qualquer escrita)

| | |
|---|---|
| Acórdãos (`acordao` + `acordao-grafo`) | 1.863 |
| Com inteiro teor | 1.685 |
| Arestas em `AcordaoCitacao` | 16.833 |
| Arestas no voto | 5.644 |

### Depois da W1

| Métrica | Valor |
|---|---|
| Ingeridos como combustível | 3.954 |
| Catalogados (com `tcuAnalise`) | 1.098 |
| Arestas novas | 8.548 |
| **Arestas novas no voto** | **2.389** |
| Por acórdão **catalogado** | **2,18** |
| Régua histórica do acervo curado | 3,35 |

⚠️ **O denominador correto é o de catalogados, não o de ingeridos.** Só um acórdão com inteiro teor pode produzir aresta. Os 3.954 ingeridos incluem ~2.800 que o cron de produção puxou sozinho e que ainda não passaram pela catalogação — não são material perdido, são fila. Medir 2.389 contra 3.954 daria 0,60 e subestimaria o rendimento pela metade.

**2,18 arestas-no-voto por acórdão catalogado é 65% da régua histórica** (3,35). A perda em relação ao acervo atual era esperada e está explicada: o acervo de hoje foi curado por relevância temática em licitações, enquanto o backfill pega acórdãos comuns de qualquer assunto. Perder um terço do rendimento para ganhar um universo inteiro é uma troca boa.

## O efeito que realmente importa

O objetivo da frente nunca foi "mais arestas", e sim **tirar leading cases da faixa magra**, onde o motor de destilação se cala. Distribuição atual:

| Citações no voto | Casos |
|---|---|
| ≥ 20 | 18 |
| 10–19 | 19 |
| 5–9 | 89 |
| **≥ 5 (faixa aproveitável)** | **126** |
| 2–4 | 1.003 |
| < 2 | 9.311 |

Antes da W1, a medição de 20/07 sobre os 100 maiores leading cases encontrava **9 casos** com 10 ou mais citações no voto. Agora são **37**.

⚠️ **Ressalva de comparabilidade:** a medição de 20/07 foi feita sobre o top-100 ranqueado por citações *totais*, não por citações no voto, então o número "antes" não é uma contagem exaustiva da faixa e a comparação 9 → 37 não é exata. A direção e a ordem de grandeza, porém, são inequívocas — e foram obtidas com apenas ~1.100 acórdãos catalogados, uma fração da campanha.

## Custo e desempenho reais

| | Projetado | Medido |
|---|---|---|
| Descarte na ingestão | ~80% (acórdãos de relação) | **70,9%** (3.543 de 5.000) |
| Tempo por acórdão | ~8 s | ~12 s (221 min para ~1.100) |
| Erros de ingestão | — | **0** |

**Taxa de falha no download: ~18%** (228 falhas em 1.926 tentativas), quase todas timeout no RTF. Nenhum acórdão foi descartado em definitivo — `tcuAnaliseTentativas` dá três chances e os desistidos estão em zero. Ainda assim, isso encarece a campanha: parte do material exige duas ou três passadas.

**A execução local caiu uma vez** com erro de conexão do Prisma, após ~1.900 itens. Retomada foi limpa, porque a fila se drena por `tcuAnalise IS NULL`. ⚠️ Não se sabe se o mesmo ocorreria no cron da Vercel, que trabalha em fatias de 300 s e recria a conexão a cada execução — provavelmente não, mas é ponto a observar na W2, não fato estabelecido.

## Desvios do plano

**O `--limit` do plano estava errado.** A Task 6 mandava rodar `backfill-tcu-inteiro-teor.ts --execute --limit=1000`. Aquele script ordena por `id` e aplica `take` **antes** de pular os já catalogados, então o limite teria sido consumido pelos 1.685 acórdãos antigos, sem tocar em nenhum dos novos. Rodou-se sem `--limit`: os já feitos são pulados de graça, sem download.

**O cron de produção entrou no meio da medição.** Mergeamos antes de medir (decisão do Daniel), então o cron das 6h15 rodou e ingeriu ~2.800 acórdãos por conta própria. Isso mudou o denominador de ingeridos, mas não contamina o resultado — as arestas vêm dos catalogados, e a fila cresceu, o que é o comportamento desejado.

## O que este resultado NÃO autoriza

- **A cauda profunda continua fora de alcance.** Há 9.311 alvos com menos de 2 citações no voto. Nada aqui sugere que a campanha completa os resgate.
- **A projeção de duração da campanha piorou.** Com ~12 s por acórdão em vez de 8, e ~18% de retrabalho por timeout, a estimativa de ~2,5 dias da spec §3 precisa ser refeita na W2 com o consumo real da Vercel.
- **Nada foi indexado na busca nem no RAG**, conforme a decisão do Daniel. Os 3.954 registros estão invisíveis nas superfícies do site.

## Próximo passo

**W2 — a campanha.** Elevar `catalog-tcu-inteiro-teor` para cada 10 minutos, deixar o backfill caminhar até dez/2023 e acompanhar por métrica. O cursor está em `offset` avançado e a data mais antiga alcançada ainda é de 2026 — a campanha mal começou.
