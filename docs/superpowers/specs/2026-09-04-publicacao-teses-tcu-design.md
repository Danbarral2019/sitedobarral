# Design — Publicação das teses destiladas do TCU

**Data:** 2026-09-04
**Status:** aprovado (brainstorming), aguarda plano de implementação
**Depende de:** `2026-07-21-persistencia-teses-tcu-design.md` (persistência das teses, em produção desde julho)
**Relacionado:** PR #207 (aprovação em lote de 87 enunciados), PR #206 (índice HNSW pendente)

## 1. Contexto

O cron `destilar-teses-tcu` produz teses desde julho: **265 destilações atuais, 512 enunciados, 110 divergências**, sobre um grafo de **100.016 arestas** de citação. Nada disso chega ao usuário — nenhuma rota do site lê `TeseDestilacao`, e as teses não têm embeddings, então também não entram na busca por IA. O único consumo é a folha de calibração (`scripts/build-folha-teses-tcu.ts`), gerada sob demanda para julgamento manual.

Em 03/09/2026, 87 enunciados foram aprovados em lote (confiança alta, posteriores ao filtro de matéria), somando **95 aprovados** com os 8 julgados individualmente.

As teses são o ativo mais diferenciado da base: o TCU não publica "teses". Elas são inferidas de como votos posteriores invocam cada precedente. Isso as torna simultaneamente o melhor ímã de tráfego orgânico e a melhor razão para assinar — daí o modelo de vitrine pública sobre acervo restrito.

## 2. Objetivo e não-objetivos

**Objetivo:** publicar as teses aprovadas em aba própria (vitrine pública + acervo restrito) e torná-las citáveis pela busca por IA, sempre acompanhadas da evidência literal que as sustenta.

**Não-objetivos:**
- Publicar as 110 divergências (fora da v1).
- Interface administrativa de curadoria — a promoção à vitrine é script.
- Rediscutir o motor de destilação ou o critério de aprovação.
- Criar o índice HNSW (PR #206, decisão independente).

## 3. Decisões de produto (tomadas no brainstorming)

| Decisão | Escolha |
|---|---|
| Acesso | Vitrine pública + acervo restrito |
| Unidade exibida e citada | A tese (enunciado), com link para o acórdão-líder |
| Procedência | Trechos-fonte sempre à vista, junto da tese |
| Evidência | Snapshot só dos trechos citados (abordagem C) |

## 4. O problema que define a arquitetura: a evidência é volátil

`TeseEnunciado.trechosFonte` guarda **índices** para um dossiê que **não é persistido**. O dossiê é recomposto do grafo a cada uso por `coletarTrechosDoAlvo`, e o grafo cresce todo dia (`sync-precedentes-tcu`).

A verificação atual (`build-folha-teses-tcu.ts:156`) compara apenas a **quantidade** de trechos:

```ts
const trechosConfiaveis = dossie.trechos.length === d.dossieTrechos;
```

Isso protege parte dos casos, mas não todos. `montarDossie` ordena por citação-no-voto e **corta em 40** (`trechos-de-citacao.ts:74,85,96`). Para um alvo saturado no teto, um citante novo pode entrar no top-40 e deslocar outro: a contagem continua 40, a verificação passa, e os índices apontam para trechos diferentes.

**Medição em 03/09/2026**, sobre os 95 enunciados aprovados:

| Estado do dossiê | Destilações | Enunciados |
|---|---|---|
| Abaixo do teto de 40 | 39 | 52 |
| Saturado (=40) | 28 | **43** |

Os 43 sob risco são justamente os mais citados — as melhores teses do acervo.

**Fragilidade adicional:** a consulta de arestas em `coletarTrechosDoAlvo` não tem `orderBy`. Como `dedup.sort` empata por `noVoto` e comprimento, empates são desfeitos pela ordem de retorno do banco, que é indefinida. Dois runs podem produzir índices diferentes sobre o mesmo grafo.

**A janela de recuperação fecha com o tempo.** `AcordaoCitacao` tem `criadoEm`, e uma aresta só existe se o inteiro teor do citante já existia quando ela foi extraída. Logo, filtrar arestas anteriores à data da destilação reconstrói fielmente o dossiê daquele momento. Cada dia de crescimento do grafo, porém, aumenta a chance de que a reconstrução deixe de casar. Persistir agora é o que preserva a evidência dos casos saturados.

## 5. Modelo de dados

```prisma
model TeseTrechoFonte {
  id          String   @id @default(cuid())
  enunciadoId String
  enunciado   TeseEnunciado @relation(fields: [enunciadoId], references: [id], onDelete: Cascade)
  ordem       Int
  trecho      String   @db.Text
  origemChave String
  origemId    String?
  noVoto      Boolean
  capturadoEm DateTime @default(now())

  @@index([enunciadoId])
}
```

Colado ao enunciado, não à destilação, porque `trechosFonte` é por enunciado e é ali que a evidência é exibida.

Campos novos em `TeseEnunciado`:

```prisma
vitrinePublica Boolean           @default(false)
trechos        TeseTrechoFonte[]
```

## 6. Reconstrução histórica (backfill)

1. `coletarTrechosDoAlvo` ganha parâmetro opcional `ateData?: Date`, que adiciona `criadoEm: { lt: ateData }` ao filtro de arestas.
2. A consulta de arestas ganha `orderBy` determinístico, e `montarDossie` ganha desempate por `origemChave`. Sem isso a reconstrução não é reproduzível.
3. Para cada destilação `atual` com enunciado aprovado: reconstruir o dossiê passando `td.criadoEm`, conferir `dossie.trechos.length === td.dossieTrechos`, e só então resolver os índices de `trechosFonte` e gravar os trechos.
4. Onde a contagem não casar, **não grava**. O enunciado fica sem evidência.

**Invariante de publicação:** tese sem evidência persistida não aparece na vitrine, não aparece no acervo e não é indexada. A procedência deixa de ser convenção de tela e vira propriedade do sistema.

Consequência aceita: parte dos 43 saturados pode não passar na verificação e ficar de fora. Perder teses é preferível a exibir evidência trocada.

### Daqui para frente

O backfill resolve o passivo; sozinho, não resolve o problema. `destilar-teses-tcu` cria destilações novas todo dia, e cada uma nasceria com a mesma evidência volátil.

`persistirDestilacao` (`lib/tcu/persistir-tese.ts`) passa a gravar os `TeseTrechoFonte` no mesmo momento em que grava a destilação. Ali não há reconstrução nem verificação a fazer: o cron acabou de montar o dossiê e o tem em mãos, então os índices casam por construção.

É a mesma forma do conserto feito em `catalogar-acordao.ts` no PR #206 — o dado derivado é persistido por quem o produz, em vez de ser recomposto depois por quem o consome.

## 7. Superfícies

| Rota | Acesso | Conteúdo |
|---|---|---|
| `/teses` | público | Vitrine: teses com `vitrinePublica`, com evidência |
| `/teses/[chave]` | público, profundidade variável | Acórdão-líder (ex. `/teses/1441-2016`) |
| `/area-restrita/teses` | assinantes | Acervo completo, busca e filtro |

Padrão de `/jurisprudencia`: `page.tsx` servidor com `metadata` + `revalidate`, e `Client.tsx`.

**Uma rota de detalhe, não duas.** `/teses/[chave]` mostra a todos as teses daquele acórdão que estão na vitrine; havendo outras, o assinante as vê na mesma página e o visitante vê um bloco de chamada. A conversão acontece no ponto de maior interesse.

**Estabilidade da vitrine.** `vitrinePublica` é gravado na promoção e **nunca revogado automaticamente**. Se a composição fosse calculada a cada render pelo ranking de citações, uma URL indexada pelo Google sairia da vitrine ao crescer o grafo, perdendo ranqueamento e batendo em paywall. A vitrine cresce; não oscila.

**Corte inicial:** 20 teses, por `dossieNoVoto` decrescente, entre aprovadas com evidência. Número ajustável — a promoção é script.

**Cartão da tese:** enunciado, acórdão-líder, contagem de citações no voto, primeiro trecho-fonte visível e os demais expansíveis.

**Menu:** entrada "Teses" no `Header` e no `Footer`. O menu desktop já tem sete itens; se o oitavo apertar o layout, o agrupamento do Header é ajuste próprio, fora do escopo desta feature.

**Sitemap:** `/teses` estático e as páginas de acórdão-líder com teses na vitrine como dinâmicas, no padrão de cursos e artigos em `app/sitemap.ts`.

## 8. Busca por IA

São duas superfícies com regras distintas:

| Superfície | Login | Teses visíveis |
|---|---|---|
| `/busca` → `/api/busca-integrada` | opcional (funciona anônimo) | só vitrine |
| Assistente → `/api/documents/query` | obrigatório, 401 sem auth (`route.ts:66`) | acervo, se acesso ativo; senão vitrine |

> Nota: o `CLAUDE.md` lista `/api/documents/query` como rota pública. O código exige autenticação. Corrigir quando o arquivo for tocado.

**Embeddings.** Tabela `TeseEnunciadoChunk` como quarto ramo do `UNION ALL` em `vector-search.ts`, com `sourceType: 'tese'`. A tabela própria não é simetria: o ramo precisa de `JOIN` na tabela-mãe para filtrar por aprovação e vitrine, como o ramo de `TribunalDecisionChunk` já faz para `tribunalCode` (`vector-search.ts:486`). Enunciados são curtos — um chunk cada, 95 linhas hoje.

**Canibalização (risco principal).** A tese é curta, abstrata e escrita em linguagem de súmula, portanto formalmente muito parecida com uma pergunta de usuário. Tende a pontuar alto e expulsar os acórdãos do contexto, fazendo a IA responder pela síntese sem a fonte — o oposto da decisão de procedência. Mitigação: quando uma tese entra no contexto, **o acórdão-líder entra junto**, por recuperação complementar, reaproveitando o mecanismo que `answerContext.ts:170` já usa para enunciados, ONs e apostilas.

**Citação:** `sourceType: 'tese'` apontando para `/teses/[chave]` com âncora do enunciado, com o trecho-fonte viajando junto na resposta.

**Invariante de indexação:** só entra enunciado com `veredito` preenchido **e** evidência persistida.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Evidência trocada nos 43 saturados | Reconstrução por `criadoEm` + verificação por contagem; não grava se não casar |
| Reconstrução não reproduzível (empates) | `orderBy` determinístico + desempate por `origemChave` antes do backfill |
| Teses expulsam acórdãos do contexto da IA | Recuperação complementar do acórdão-líder |
| Vazamento do acervo para não assinantes | Filtro de vitrine no ramo de busca, nas duas superfícies |
| URL pública virar restrita | `vitrinePublica` nunca revogado automaticamente |
| Teses publicadas sob a marca sem leitura individual | Evidência sempre à vista; 87 dos 95 vieram de lote (ver §10) |

## 10. Débito conhecido: a calibração não tem base

Não existe nenhum veredito negativo em toda a base — nunca se observou tese `imprecisa` ou `errada`. Isso não significa que o motor não erre: significa que só 8 teses foram julgadas individualmente e nenhuma falhou. A taxa de erro é desconhecida, e 87 dos 95 aprovados vieram de lote sobre confiança auto-declarada pelo modelo.

Publicar com a evidência à vista mitiga, porque o leitor confere. Não substitui medir. Recomendação: antes ou logo após o lançamento, julgar uma amostra de 15–20 teses da vitrine contra os trechos-fonte, para obter a primeira taxa real de acerto — `build-folha-teses-tcu.ts` já suporta `--amostra=N --seed=...`.

Três dos 87 aprovados são matéria de pessoal que escapou do filtro (`1724/2025` registro de pensão; `966/2025` aposentadoria e VBC). Devem ser removidos antes da promoção à vitrine.

## 11. Testes

- `montarDossie`: determinismo do desempate; saturação no teto de 40.
- `coletarTrechosDoAlvo` com `ateData`: exclui arestas posteriores.
- Backfill: não grava quando a contagem não casa; resolve índices corretamente quando casa.
- `persistirDestilacao`: grava os trechos junto da destilação nova, sem depender de reconstrução.
- Invariante: enunciado sem evidência não aparece em nenhuma das três rotas nem no índice.
- Acesso: anônimo em `/busca` recebe só vitrine; logado sem acesso ativo idem; assinante recebe acervo.
- Vitrine: promoção grava `vitrinePublica`; nada o revoga.

## 12. Sequência de execução (alto nível — detalhar no plano)

1. Determinismo em `montarDossie` e `coletarTrechosDoAlvo` (+ `ateData`).
2. Migration: `TeseTrechoFonte` e `TeseEnunciado.vitrinePublica`.
3. `persistirDestilacao` grava a evidência no ato — fecha a torneira antes de esvaziar o balde.
4. Backfill da evidência do passivo, com relatório de quantos enunciados ficaram sem.
5. Remoção dos 3 enunciados de matéria de pessoal.
6. Promoção da vitrine inicial (20).
7. Rotas `/teses`, `/teses/[chave]`, `/area-restrita/teses` + menu + sitemap.
8. `TeseEnunciadoChunk`, indexação e quarto ramo da busca.
9. Recuperação complementar do acórdão-líder e filtro de acesso nas duas superfícies.

Os passos 1–6 (evidência) e 7–9 (superfícies e busca) são independentes o bastante para virar duas ondas no plano de implementação. A primeira tem urgência própria: a janela de reconstrução fecha com o crescimento do grafo.
