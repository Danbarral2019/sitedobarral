# Probe multi-hop para o gate do BIA-8 (GraphRAG)

**Data:** 2026-07-12 · **Status:** desenho aprovado, aguardando plano de implementação

## Contexto

O BIA-8 (GraphRAG sobre o acervo) é um item de backlog **condicionado**: só deve ser explorado se a régua de avaliação mostrar que as respostas da BIA erram por **falta de contexto relacional / multi-hop**. Em 12/07/2026 os evals existentes (`eval/reports/*bia1*`, overall 87.2%) mostram o contrário: os piores casos falham por **síntese** (a fonte relevante já veio no contexto e não foi usada) e por **dados**, não por incapacidade de cruzar documentos. Além disso, o golden-set atual (93 queries) não tem nenhuma query multi-hop — ele não consegue nem medir a hipótese.

Este documento desenha o experimento que **decide o gate de forma auditável**: ou produz evidência de que multi-hop é um modo de falha real que só o grafo resolve (abre o BIA-8), ou confirma que não é (arquiva com evidência). O veredito atual e o critério estão registrados na memória em `bia-8-graphrag-gate.md`.

## Objetivo e não-objetivos

**Objetivo:** montar um subconjunto multi-hop na régua e um procedimento de decisão (a "escada de remédios") que classifique cada falha pela causa-raiz, isolando o subconjunto de falhas que **somente** o GraphRAG resolveria.

### Estado da infra de grafo (achado 12/07/2026)

Consulta ao banco (`scripts/list-multihop-triggers.ts`) revelou que a "infra de grafo que já existe", que o card do BIA-8 mandava aproveitar, está **crua**:
- `LegislativeActRelation`: **0 relações `confirmed`**, **274 `pending`** (100% heurística; 186 com confiança ≥0.9; 58 tocam a Lei 14.133). Distribuição: regulamenta 99, altera 92, revoga 44, complementa 33, modifica 6.
- 18 atos com `revoked=true`, mas o salto está só como **texto livre** em `revokedNote` (ex.: "Revogado pelo Decreto nº 12.807, de 2025") — não é FK navegável.

**Decisão (12/07):** estruturar o grafo **antes** do probe (confirmar as pending relevantes), em vez de extrair saltos do `revokedNote`. Isso deixa a infra 3a pronta de fato e é reaproveitável se o gate abrir. Ver **Fase 0**.

A curadoria não parte do zero — já existem: validador `scripts/validate-relation-chronology.ts --apply` (auto-rejeita `revoga`/`altera` cronologicamente impossíveis), UI `/admin/legislative-relations` (filtro por tipo/confiança/busca) e endpoint `POST /api/admin/legislative-relations/[id]` `{action}`.

**Não-objetivos (YAGNI):**
- **Não** construir o expansor de grafo / GraphRAG em si. Isso é o próprio BIA-8 e só começa se este probe abrir o gate.
- **Não** minerar logs de uso (decisão: fonte = experiência de domínio do Daniel).
- **Não** re-anotar ou mexer nas 93 queries existentes. O bloco multi-hop é aditivo.

## Fonte das queries: experiência de domínio

Daniel lista os **padrões reais** de pergunta que procuradores fazem e que plausivelmente exigem cruzar documentos. Eu instancio cada padrão contra as relações concretas do acervo, para virar uma query testável com ground truth verificável. Meta inicial: **10–15 queries multi-hop** cobrindo pelo menos estes tipos de salto:

1. **Revogação/substituição** — "A ON X ainda vale? O que a norma que a substituiu diz sobre Y?" (salto via `LegislativeActRelation.relationType = 'revoga'`).
2. **Alteração de dispositivo** — "Como ficou o art. N depois da alteração da norma Z?" (salto via `'altera'`).
3. **Regulamentação** — "Qual decreto regulamenta o art. N da Lei 14.133 e o que ele exige?" (salto via `'regulamenta'`).
4. **Precedente/divergência** — "Acórdão que cita o precedente P e diverge dele" (salto via citação em `tcuLegislacao` / texto — hoje não estruturado).

## Ground truth por hop (anti-viés)

Cada query multi-hop recebe ground truth **de cada ponta do salto**, não um conjunto único:

- `hop1Targets`: documento(s) que respondem o 1º salto (ex.: a norma revogadora).
- `hop2Targets`: documento(s) que respondem o 2º salto (ex.: o dispositivo de conteúdo da norma substituta).

A anotação vem das **relações do acervo** (`LegislativeActRelation` com `reviewStatus='confirmed'`, campo `revoked`) e do conhecimento do Daniel — **nunca** do top-K do próprio pipeline de busca. Anotar do output do pipeline tornaria o teste tautológico (ver lição registrada `feedback_eval_ground_truth_bias`).

## A escada de remédios (critério de decisão)

Para **cada** query multi-hop que não é bem respondida, aplico os níveis em ordem, do mais barato ao mais caro. A causa-raiz é o **primeiro** nível que explica a falha. O BIA-8 só se justifica para falhas que chegam ao Nível 3.

| Nível | Pergunta diagnóstica | Como testo | Se for a causa → |
|---|---|---|---|
| **0 — Síntese** | As duas pontas do salto (`hop1` e `hop2`) **já apareceram** no contexto recuperado, mas a resposta ignorou/não conectou? | Comparar `hop1Targets ∪ hop2Targets` com os documentos efetivamente recuperados (top-K). Se ambos presentes → é síntese. | **BIA-1**, não multi-hop. Filtro anti-falso-positivo. |
| **1 — Dados** | O documento-alvo do salto **existe** no acervo? | Query direta no banco pelos IDs de `hop2Targets`. | **BIA-5** (dados). Grafo não ajuda. |
| **2 — Contexto/tuning** | O alvo existe e é recuperável por similaridade, mas caiu **abaixo do top-K**? | Re-rodar a query com `n` maior / inspecionar posição do alvo no ranking completo. | Ajuste barato (n, reordenação). Grafo desnecessário. |
| **3 — Grafo** | O alvo existe mas **só** é encontrável seguindo uma relação entre documentos; nenhuma busca por similaridade o traz porque o texto da pergunta não se parece com o texto do alvo. | Confirmar que o alvo não aparece em nenhum `n` razoável E que a única forma de alcançá-lo é por relação. Distinguir os dois sub-casos abaixo. | **Abre o BIA-8.** |

O Nível 3 tem **dois sub-casos**, ambos justificam o BIA-8 mas com custos diferentes:
- **3a — relação estruturável** (saltos de legislação: `revoga`/`altera`/`regulamenta`, via `LegislativeActRelation`). A tabela e o detector existem, mas o grafo está vazio (0 confirmadas) — a **Fase 0** o popula. Depois disso, GraphRAG relativamente barato, sobre infra própria.
- **3b — relação ainda não estruturada** (citações entre acórdãos: hoje só texto em `tcuLegislacao`, sem tabela de relação). Justifica o BIA-8 também, mas exige **primeiro** extrair/estruturar o grafo de citações — custo maior, deve ser sinalizado como pré-requisito no relatório de decisão.

O Nível 0 é explícito e no topo justamente porque a evidência do BIA-1 mostra que é o vencedor mais provável (ex.: `t-publicacao-lai-01` omitiu o Inf. 212/2014 que estava no material). Sem ele, uma query multi-hop que "não citou a fonte" seria erroneamente creditada a multi-hop.

## Fase 0 — estruturar o grafo de legislação (pré-requisito)

Decisão de 12/07: precede o probe. Usa só ferramentas existentes.

1. **Triagem automática:** rodar `scripts/validate-relation-chronology.ts --apply` (e o de hierarquia) para auto-rejeitar as `revoga`/`altera` impossíveis. Reduz o volume sem esforço manual.
2. **Curadoria focada (Daniel):** na UI `/admin/legislative-relations`, filtrar por `revoga` + busca "14.133" + confiança ≥0.9 e confirmar/rejeitar. Prioridade = as ~58 que tocam a Lei 14.133 e os elos das cadeias temáticas de licitação (valores/dispensa, SRP, art. 26, terceirização, desfazimento, margem de preferência). **Não** precisa varrer as 274 — só o que serve às queries multi-hop.
3. **Saída:** grafo com relações `confirmed` suficientes para instanciar o ground truth `hop1/hop2Targets` das queries. Só então o probe (Fases seguintes) tem sobre o que rodar.

Gatilhos concretos já extraídos (cadeias de revogação reais do acervo) estão em `scripts/list-multihop-triggers.ts` e foram enviados ao Daniel para marcar quais viram query.

## Componentes / entregáveis

1. **Bloco multi-hop no golden-set (`eval/golden-set.json`, v3).** Aditivo. Cada query carrega `category: "multi-hop"`, `hopType` (revogacao|alteracao|regulamentacao|precedente), e as anotações `hop1Targets` / `hop2Targets` além do `relevant` padrão (união dos hops, para compatibilidade com o runner atual).
2. **Extensão de tipos (`eval/types.ts`).** Campos opcionais `hop1Targets?`, `hop2Targets?`, `hopType?` em `GoldenQuery` (opcionais → não quebram as 93 queries existentes).
3. **Métrica de recall por hop (`eval/metrics.ts` + `eval/runner.ts`).** Reusar `recallAtK` para computar, quando `hop2Targets` existe, um `recallAt5Hop2` separado. Reportar no agregado uma fatia `multiHop` (análoga a `byDifficulty`).
4. **Procedimento da escada (semi-automatizado).** Um script de diagnóstico (`eval/cli/diagnose-multihop.ts`) que, por query, imprime: documentos recuperados vs `hop1/hop2Targets`, resultado do Nível 0 (ambas as pontas no contexto?), Nível 1 (alvo existe no banco?), e posição do alvo no ranking completo (Nível 2). O Nível 3 é a conclusão quando 0–2 são descartados.
5. **Relatório de decisão.** Um `.md` em `eval/reports/` com a classificação de cada query pela escada e o veredito agregado: quantas falhas chegam ao Nível 3.

## Fluxo de dados

```
padrões de domínio (Daniel)
  → instanciar contra LegislativeActRelation/revoked/citações  → queries + hop1/hop2Targets
  → golden-set.json (bloco multi-hop, v3)
  → eval:run (runner estendido)  → recall padrão + recallAt5Hop2
  → diagnose-multihop.ts (escada 0→3 por query)
  → relatório de decisão  → GO (Nível 3 recorrente) / NO-GO (falhas param em 0–2)
```

## Critério de decisão (go/no-go)

- **NO-GO (arquiva BIA-8 com evidência):** nenhuma — ou apenas uma isolada — das queries multi-hop chega ao Nível 3. As falhas se concentram em Nível 0 (síntese/BIA-1) ou 1 (dados/BIA-5). Atualiza-se `bia-8-graphrag-gate.md` com o resultado.
- **GO (abre BIA-8):** um conjunto recorrente de queries multi-hop **realistas** chega ao Nível 3 — o alvo existe, é inalcançável por similaridade, e uma relação entre documentos o alcançaria. Só então se desenha o expansor de grafo (novo spec, o antigo "nível 3" vira implementação). O relatório distingue quanto do GO vem de **3a** (relação já estruturada, barato) vs **3b** (exige estruturar grafo de citações antes) — um GO majoritariamente 3b é um projeto maior que um GO 3a.

Limiar sugerido para GO: **≥ 30% das queries multi-hop** (≥ ~4 de ~12) param no Nível 3. A confirmar com Daniel ao ver os primeiros resultados — número pequeno de queries pede leitura qualitativa, não só corte.

## Validação do próprio probe

- **Sanidade do ground truth:** para cada query, `hop1Targets` e `hop2Targets` devem existir no acervo no momento da anotação (senão a query testa dado ausente, não multi-hop — mover para caso de Nível 1 explícito ou descartar).
- **Sanidade da escada:** ao menos uma query deve, por construção, cair em Nível 0 e outra em Nível 3 (casos-controle), para provar que o diagnóstico discrimina. Se tudo cai no mesmo nível, o instrumento não está medindo.
- **Reprodutibilidade:** `eval:run` no bloco multi-hop deve ser determinístico o suficiente para regressão futura (mesma régua que serve de baseline no dia em que o BIA-8 rodar).

## Achados durante a preparação (12/07/2026)

Ao instanciar as 6 perguntas validadas pelo Daniel contra o acervo, dois achados relevantes:

1. **5/6 cadeias estão no acervo e indexadas** (perguntas 1, 2, 4, 5 prontas para o probe).
2. **Bug de produção corrigido — Decreto 11.890/2024.** As perguntas 3 (art. 26) e 6 (margem de preferência) pareciam depender de um decreto ausente (12.218), mas a investigação mostrou que o 12.218 apenas **altera** o 11.890 (que segue vigente — foi inclusive alterado de novo em 2025 pelo 12.771). O 11.890 estava marcado `revoked=true` por **falso positivo** do detector de revogação (leu nota de revogação parcial de um inciso como revogação total). Como a busca filtra `la.revoked = false` (`lib/embeddings/vector-search.ts:410`), a **norma vigente de margem de preferência estava invisível para a BIA**. Corrigido para `revoked=false` (`scripts/audit-revogados-falsos-positivos.ts --apply`); auditoria dos 18 confirmou o bug **isolado** (só 1 falso positivo; os outros 17 são revogações totais legítimas).

**Implicação para o gate:** reforça o **NO-GO**. Parte da aparente "necessidade multi-hop" (perguntas 3 e 6) era, na verdade, um documento escondido por erro de curadoria — resolvido sem nenhum GraphRAG, exatamente o Nível 1 da escada (dado presente, filtrado por flag errada). O 12.218 será importado depois (decreto alterador, não bloqueante). As perguntas 3 e 6, pós-correção, viraram efetivamente single-hop (o 11.890 responde direto), então o núcleo multi-hop do probe se concentra nas perguntas 1, 2, 4, 5.

## Referências

- Memória: `bia-8-graphrag-gate.md` (veredito + critério), `busca-retrieval-trilha-fechada.md` (retrieval no teto), `feedback_eval_ground_truth_bias.md` (anti-viés de anotação), `legislacao-revogados-vinculacao.md` (flag `revoked`).
- Código: `eval/runner.ts`, `eval/metrics.ts`, `eval/types.ts`, `eval/golden-set.json`, `prisma/schema.prisma` (`LegislativeActRelation`, `LegislativeAct.revoked`, `Document.tcuLegislacao`).
