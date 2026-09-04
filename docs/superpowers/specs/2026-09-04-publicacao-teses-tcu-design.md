# Design — Publicação das teses destiladas do TCU

**Data:** 2026-09-04
**Status:** em revisão pelo usuário
**Depende de:** `2026-07-21-persistencia-teses-tcu-design.md` (persistência das teses, em produção desde julho)
**Relacionado:** PR #207 (aprovação em lote de 87 enunciados), PR #206 (índice HNSW pendente)

## 1. Contexto

O cron `destilar-teses-tcu` produz teses desde julho: **265 destilações atuais, 512 enunciados, 110 divergências**, sobre um grafo de **100.016 arestas** de citação. Nada disso chega ao usuário — nenhuma rota do site lê `TeseDestilacao`, as teses não têm embeddings e não são exportadas. O único consumo é a folha de calibração (`scripts/build-folha-teses-tcu.ts`), gerada sob demanda.

Em 03/09/2026, 87 enunciados foram aprovados em lote (confiança alta, posteriores ao filtro de matéria), somando **95 com veredito `fiel`** junto dos 8 julgados individualmente.

As teses são o ativo mais diferenciado da base: o TCU não publica "teses". Elas são inferidas de como votos posteriores invocam cada precedente.

## 2. Objetivo e não-objetivos

**Objetivo:** publicar as teses elegíveis em aba própria (vitrine pública + acervo restrito), torná-las citáveis pela busca por IA e exportá-las para o acervo de RAG do ELIC, sempre acompanhadas da evidência literal que as sustenta.

**Não-objetivos:**
- Publicar as 110 divergências (fora da v1).
- Interface administrativa de curadoria — promoção e retirada são scripts.
- Rediscutir o motor de destilação.
- Criar o índice HNSW (PR #206, decisão independente).

## 3. Decisões de produto

| Decisão | Escolha |
|---|---|
| Acesso | Vitrine pública + acervo restrito |
| Unidade exibida e citada | A tese (enunciado), com link para o acórdão-líder |
| Procedência | Trechos-fonte sempre à vista, junto da tese |
| Evidência | Snapshot só dos trechos citados |

## 4. Identidade do acórdão: número e ano não bastam

`TeseDestilacao` identifica o alvo por `numeroAlvo` + `anoAlvo`, e `chave` é literalmente `${numero}/${ano}` (`persistir-tese.ts:92`). **No TCU esse par não é unívoco:** o mesmo número e ano existem em colegiados diferentes.

**Medição em 04/09/2026:**

| | |
|---|---|
| Alvos distintos com destilação atual | 265 |
| Destes, com mais de um colegiado em `Document` | **30** |
| Alvos com tese `fiel` e colisão de colegiado | 5 |

O Acórdão 56/2024 existe em Plenário, Primeira Câmara e Segunda Câmara; 63/2024 idem; 514/2025 e 602/2024 em dois colegiados.

O resto do sistema já trata o colegiado como parte da identidade: `Document` tem unique em `[acordaoNumero, acordaoAno, tcuOrgaoJulgador]`, e `AcordaoCitacao` grava `colegiadoAlvo`. Só a destilação não grava. Pior: `escolherCandidato` aceita `colegiadoPreferido` (`buscar-acordao-tcu.ts:56`), mas `destilar-teses-tcu` o chama **sem** argumento, ficando com o primeiro candidato não-relação. Uma tese pode estar atribuída ao acórdão errado.

**Decisões:**

1. `TeseDestilacao` ganha `colegiadoAlvo String?`. A identidade canônica passa a ser a tripla `(numeroAlvo, anoAlvo, colegiadoAlvo)`.
2. O backfill preenche `colegiadoAlvo` a partir de `AcordaoCitacao.colegiadoAlvo` quando houver valor único para o alvo; onde houver divergência ou ausência, fica `null`.
3. **Enquanto `colegiadoAlvo` for `null`, a destilação não é elegível para vitrine** (§7), porque a página pública afirmaria autoria de um acórdão que não sabemos qual é. Permanece elegível para acervo e exportação, com o colegiado omitido em vez de adivinhado.
4. O slug da rota inclui o colegiado: `/teses/1441-2016-plenario`. Sem colegiado resolvido não há página pública.
5. `destilar-teses-tcu` passa a chamar `escolherCandidato(cands, colegiadoPreferido)` com o colegiado majoritário das arestas, e grava o colegiado do candidato escolhido.

## 5. Ciclo de vida: versão de destilação ≠ estado de publicação

São dois eixos independentes, hoje confundidos num só campo (`atual`).

**Versão** é do pipeline: `TeseDestilacao.atual` marca a destilação corrente de um alvo. Redestilar cria uma versão nova e rebaixa a anterior.

**Publicação** é editorial: decide se uma tese aprovada aparece ao público. Campos novos em `TeseEnunciado`:

```prisma
publicado      Boolean   @default(false)  // entra no acervo restrito
vitrinePublica Boolean   @default(false)  // subconjunto público
retiradoEm     DateTime?                  // retirada editorial
retiradoMotivo String?
atualizadoEm   DateTime  @updatedAt       // necessário ao export incremental
```

**Redestilação.** `persistirDestilacao` já herda o veredito por texto idêntico (`herdadoDe`). O estado de publicação segue a mesma regra:

- Enunciado com texto **idêntico** ao da versão anterior herda `veredito`, `publicado` e `vitrinePublica`, e a evidência é regravada para a versão nova.
- Enunciado com texto **alterado** nasce com `veredito = null`, `publicado = false`, `vitrinePublica = false`. Volta à fila de julgamento.
- A versão anterior deixa de ser servida ao perder `atual`, mas **não é apagada** — é o registro do que já esteve publicado.

**Substituição de URL.** Se um acórdão-líder tinha página pública e, após redestilar, nenhuma tese sua é mais elegível, a rota não pode dar 404 para uma URL que o Google indexou. A página responde com o estado "tese em revisão", `noindex`, e sai do sitemap. Volta ao ar se a nova versão for aprovada e promovida.

**Retirada editorial.** Preencher `retiradoEm` torna o enunciado inelegível em **todos** os consumidores, imediatamente: some da vitrine, do acervo, do índice de busca e do próximo export (que apaga o arquivo, §8). Se era público, a URL passa a `noindex` e sai do sitemap. `retiradoMotivo` é obrigatório em conjunto — retirada sem motivo registrado é retirada que ninguém consegue auditar depois.

## 6. Elegibilidade canônica

Toda condição de elegibilidade no sistema deriva de um predicado único. **`veredito` preenchido não basta:** o vocabulário é `fiel | imprecisa | errada` (`parsear-veredito.ts:13`), e as duas últimas são reprovações.

```
ELEGIVEL_BASE(e) :=
      e.veredito = 'fiel'
  AND e.retiradoEm IS NULL
  AND e.destilacao.atual = true
  AND EXISTS (TeseTrechoFonte WHERE enunciadoId = e.id)
```

Por consumidor:

| Consumidor | Predicado |
|---|---|
| Acervo restrito (`/area-restrita/teses`) | `ELEGIVEL_BASE AND publicado` |
| Vitrine (`/teses`) | `ELEGIVEL_BASE AND publicado AND vitrinePublica AND colegiadoAlvo IS NOT NULL` |
| Busca por IA | o predicado do consumidor, conforme a visibilidade (§9) |
| `export:elic` | `ELEGIVEL_BASE` — **sem** `publicado` |

A diferença do ELIC é deliberada: aquele destino é acervo de RAG interno, não superfície editorial. Uma tese aprovada e ainda não promovida é útil lá e não estaria exposta a ninguém de fora. O que o ELIC **não** recebe é tese não aprovada, retirada, de versão superada ou sem evidência.

## 7. A evidência é volátil

`TeseEnunciado.trechosFonte` guarda **índices** para um dossiê que **não é persistido**. O dossiê é recomposto do grafo por `coletarTrechosDoAlvo`, e o grafo cresce todo dia (`sync-precedentes-tcu`).

A verificação atual (`build-folha-teses-tcu.ts:156`) compara apenas a quantidade:

```ts
const trechosConfiaveis = dossie.trechos.length === d.dossieTrechos;
```

`montarDossie` ordena por citação-no-voto e **corta em 40** (`trechos-de-citacao.ts:74,85,96`). Para um alvo saturado no teto, um citante novo entra no top-40 e desloca outro: a contagem continua 40, a verificação passa, e os índices apontam para trechos diferentes.

**Medição em 03/09/2026**, sobre os 95 enunciados `fiel`:

| Estado do dossiê | Destilações | Enunciados |
|---|---|---|
| Abaixo do teto de 40 | 39 | 52 |
| Saturado (=40) | 28 | **43** |

Os 43 sob risco são os mais citados — as melhores teses do acervo.

**Fragilidade adicional:** a consulta de arestas em `coletarTrechosDoAlvo` não tem `orderBy`. Como `dedup.sort` empata por `noVoto` e comprimento, empates são desfeitos pela ordem de retorno do banco, indefinida. Dois runs podem produzir índices diferentes sobre o mesmo grafo.

**A janela fecha com o tempo.** `AcordaoCitacao.criadoEm` permite reconstruir o dossiê histórico, porque uma aresta só existe se o inteiro teor do citante já existia. Cada dia de crescimento aumenta a chance de a reconstrução não casar.

### 7.1 Modelo da evidência

```prisma
model TeseTrechoFonte {
  id          String   @id @default(cuid())
  enunciadoId String
  enunciado   TeseEnunciado @relation(fields: [enunciadoId], references: [id], onDelete: Cascade)
  ordem       Int
  trecho      String   @db.Text

  // O acórdão CITANTE — quem escreveu o trecho. Não confundir com o
  // acórdão-líder, que é o alvo da destilação.
  origemNumero    Int
  origemAno       Int
  origemColegiado String?
  origemDocumentId String?
  origemDocument   Document? @relation(fields: [origemDocumentId], references: [id], onDelete: SetNull)
  noVoto      Boolean
  capturadoEm DateTime @default(now())

  @@index([enunciadoId])
  @@index([origemDocumentId])
}
```

Cada trecho identifica o **acórdão citante** pela mesma tripla da §4 e liga ao `Document` dele, que é onde vive o inteiro teor. Isso importa em dois lugares: na tela, o leitor clica no trecho e vai ao inteiro teor de quem o escreveu; na conferência, quem julga a tese consegue ler o contexto em volta da citação. `coletarTrechosDoAlvo` já dispõe do `Document` do citante (`trechos-de-citacao.ts:110-120`) — hoje o descarta e guarda só uma string `origemChave`.

`onDelete: SetNull` porque perder o documento do citante não invalida o trecho, que já está copiado; só perde o link. `Document` recebe o lado inverso da relação (`trechosDeTese TeseTrechoFonte[]`), exigido pelo Prisma.

`retiradoMotivo` obrigatório junto de `retiradoEm` (§5) é regra de aplicação, não de schema — o Prisma não expressa obrigatoriedade condicional. Fica no script de retirada e num teste.

### 7.2 Reconstrução histórica (backfill)

1. `coletarTrechosDoAlvo` ganha `ateData?: Date`, que adiciona `criadoEm: { lt: ateData }` ao filtro de arestas.
2. A consulta de arestas ganha `orderBy` determinístico e `montarDossie` ganha desempate por `origemChave`. Sem isso a reconstrução não é reproduzível.
3. Para cada destilação `atual` com enunciado `fiel`: reconstruir o dossiê com `td.criadoEm`, conferir `dossie.trechos.length === td.dossieTrechos`, e só então resolver os índices e gravar.
4. Onde a contagem não casar, **não grava**. O enunciado fica sem evidência e, por §6, fora de todos os consumidores.

Consequência aceita: parte dos 43 saturados pode ficar de fora. Perder teses é preferível a exibir evidência trocada.

### 7.3 Daqui para frente

O backfill resolve o passivo; sozinho, não resolve o problema. `persistirDestilacao` passa a gravar os `TeseTrechoFonte` no mesmo ato em que grava a destilação, onde o dossiê está em mãos e os índices casam por construção. É a forma do conserto feito em `catalogar-acordao.ts` (PR #206): quem produz o dado derivado é quem o persiste.

## 8. Consumidores

São quatro, com predicados da §6.

### 8.1 Vitrine pública e acervo restrito

| Rota | Acesso | Conteúdo |
|---|---|---|
| `/teses` | público | Vitrine |
| `/teses/[chave]` | público, profundidade variável | Acórdão-líder, ex. `/teses/1441-2016-plenario` |
| `/area-restrita/teses` | acesso ativo | Acervo completo, busca e filtro |

Padrão de `/jurisprudencia`: `page.tsx` servidor com `metadata` + `revalidate`, e `Client.tsx`.

**"Acesso ativo", não "assinante".** A regra canônica do site é `hasAnyActiveAccess(userId)` (`lib/auth.ts:187`): matrícula válida (vitalícia, sem expiração ou não expirada) **ou** assinatura ativa. Admin também. Um aluno presencial com matrícula por QR code tem acesso ao acervo sem nunca ter assinado; tratá-lo como não-assinante seria negar acesso a quem pagou pelo curso.

**Uma rota de detalhe, não duas.** `/teses/[chave]` mostra a todos as teses daquele acórdão que estão na vitrine; havendo outras, quem tem acesso ativo as vê na mesma página e o visitante vê um bloco de chamada.

**Estabilidade da vitrine.** `vitrinePublica` é gravado na promoção e **nunca revogado automaticamente** — só por retirada editorial explícita (§5). Se a composição fosse recalculada a cada render pelo ranking de citações, uma URL indexada sairia da vitrine ao crescer o grafo, perdendo ranqueamento e batendo em paywall.

**Cartão da tese:** enunciado, acórdão-líder com colegiado, contagem de citações no voto, primeiro trecho-fonte visível com link para o inteiro teor do citante, demais expansíveis.

**Menu:** entrada "Teses" no `Header` e no `Footer`. O menu desktop já tem sete itens; se o oitavo apertar o layout, o agrupamento do Header é ajuste próprio, fora do escopo.

**Sitemap:** `/teses` estático; páginas de acórdão-líder com tese na vitrine como dinâmicas. Retirada ou perda de elegibilidade remove a URL do sitemap e marca a página `noindex`.

### 8.2 Quarto consumidor: `export:elic`

`npm run export:elic` (`scripts/export-elic.ts`) exporta a base para a pasta do projeto ELIC, que a usa como acervo de RAG, reusando `runIncrementalExport`. As teses passam a ser exportadas junto.

**Predicado:** `ELEGIVEL_BASE` (§6) — todas as teses atuais com veredito `fiel` e evidência persistida, independentemente de `publicado`.

**Formato.** Markdown com frontmatter e wikilinks, como o resto do acervo. **Um arquivo por acórdão-líder**, não por tese: um enunciado isolado é uma frase de súmula sem contexto, e a recuperação melhora quando as teses do mesmo precedente, sua evidência e o relator chegam juntas. Caminho `teses/`, nome via `sanitizeFilename` no padrão de `lib/obsidian/export.ts`, incluindo o colegiado para não colidir (§4):

```
teses/acordao-1441-2016-plenario.md
```

**Frontmatter:**

```yaml
tipo: tese-tcu
acordao: "1441/2016"
numero: 1441
ano: 2016
colegiado: Plenário
relator: "..."
assunto: "..."
teses: 2
citacoesNoVoto: 262
confianca: alta
vereditos: [fiel, fiel]
publicado: true
vitrine: false
destilacaoId: "..."
atualizadoEm: 2026-09-04T12:00:00Z
fonte: https://profbarral.com.br/teses/1441-2016-plenario
```

O corpo traz cada enunciado, sua `inovacao`, e os trechos-fonte com o acórdão citante identificado e um wikilink para a nota dele quando existir no acervo — mantendo a procedência também no RAG.

**Incremental.** O estado é por destino (`sync-state.ts`), então isto não interfere no cofre do Obsidian. Um acórdão-líder é reescrito quando qualquer um dos seus enunciados elegíveis tem `atualizadoEm > lastExportAt`, ou quando algum trecho tem `capturadoEm > lastExportAt`. É por isso que `atualizadoEm` entra em `TeseEnunciado` (§5): sem ele não há sinal de mudança — `julgadoEm` só cobre o julgamento, e uma retirada ou uma promoção não o tocam.

**`--full` inicial.** A primeira exportação roda com `--full`, que já existe e ignora o estado de sincronização. Depois disso, incremental.

**Retirada de arquivos obsoletos — capacidade nova.** O motor hoje **não apaga nada**: `ExportResult` só conta `filesWritten`. Sem isso, uma tese retirada, reprovada numa redestilação ou que perdeu a evidência continuaria no acervo de RAG do ELIC para sempre, e continuaria sendo recuperada como se valesse. A exportação passa a:

1. computar o conjunto de arquivos esperados sob `teses/`;
2. remover os arquivos daquele diretório que não estejam no conjunto;
3. reportar `filesRemoved` no `ExportResult`.

A varredura é **estritamente limitada ao subdiretório `teses/`**. O destino é uma pasta do OneDrive de trabalho com material de outras origens; apagar fora desse escopo seria destruir arquivo de terceiro. `--dry-run` lista o que seria removido sem remover.

## 9. Busca por IA

Duas superfícies com regras distintas:

| Superfície | Login | Visibilidade das teses |
|---|---|---|
| `/busca` → `/api/busca-integrada` | opcional (funciona anônimo) | vitrine |
| Assistente → `/api/documents/query` | obrigatório, 401 sem auth (`route.ts:66`) | acervo se `hasAnyActiveAccess`, senão vitrine |

> O `CLAUDE.md` lista `/api/documents/query` como rota pública; o código exige autenticação. Corrigir quando o arquivo for tocado.

**Embeddings.** Tabela `TeseEnunciadoChunk` como quarto ramo do `UNION ALL` em `vector-search.ts`, com `sourceType: 'tese'`. A tabela própria não é simetria: o ramo precisa de `JOIN` na tabela-mãe para aplicar o predicado da §6, como o ramo de `TribunalDecisionChunk` já faz para `tribunalCode` (`vector-search.ts:486`). Enunciados são curtos — um chunk cada.

**Opt-in, não default.** `includeTeses?: boolean` (default `false`) em `SearchOptions` e `HybridSearchOptions`, no mesmo desenho de `includeTribunalDecisions` (`hybrid-search.ts:28`). Nenhum chamador existente muda de comportamento ao subir esta feature; cada superfície liga explicitamente. Junto vai `tesesVisibilidade: 'vitrine' | 'acervo'`, que seleciona o predicado.

**Chave de cache.** `vector-search.ts:160` monta a chave concatenando cada opção que altera o resultado (`td=`, `sd=`, `sl=`, `tc=`…). A chave ganha `:ts=<off|vitrine|acervo>`. **Sem isso há vazamento:** uma consulta de um usuário com acesso ativo gravaria no cache um resultado contendo o acervo, e o próximo anônimo com a mesma pergunta receberia esse resultado. A visibilidade é parte da identidade do resultado, não um pós-filtro.

**Adaptações em `/busca`:**

- `ContentType` em `lib/types/global-search.ts` ganha `'tese'`; nova interface `TeseResult` (enunciado, acórdão-líder com colegiado, citações no voto, primeiro trecho, href).
- `/api/busca-integrada` ganha `teses` no objeto `results`, populado só quando o predicado da vitrine tiver resultado; a rota já resolve `hasAnyActiveAccess` para decidir a demonstração do assistente (`route.ts:48`), e o mesmo valor passa a escolher a visibilidade.
- `app/busca/page.tsx`: `TabType` ganha `'teses'`, com contador na aba e no total.
- Cartão novo em `components/busca/`, exibindo enunciado, precedente e trecho-fonte — a mesma invariante de procedência da §7.

**Canibalização (risco principal).** A tese é curta, abstrata e escrita em linguagem de súmula, portanto formalmente muito parecida com uma pergunta de usuário. Tende a pontuar alto e expulsar os acórdãos do contexto, fazendo a IA responder pela síntese sem a fonte — o oposto da decisão de procedência. Mitigação: quando uma tese entra no contexto, **o acórdão-líder entra junto**, por recuperação complementar, reaproveitando o mecanismo que `answerContext.ts:170` já usa para enunciados, ONs e apostilas. A eficácia é medida (§11), não presumida.

**Citação:** `sourceType: 'tese'` apontando para `/teses/[chave]` com âncora do enunciado, com o trecho-fonte viajando junto na resposta.

## 10. Promoção da vitrine

**Conferência individual é pré-condição.** Nenhum enunciado entra na vitrine sem ter sido julgado um a um contra os trechos-fonte. Isso é verificável no dado que já existe: os 87 do lote têm `julgadoPor = 'danbarral:lote-confianca-alta'`.

Convenção, para que a regra seja mecânica e não subjetiva: **`julgadoPor` que contenha `:lote-` identifica julgamento em lote**; qualquer outro valor identifica julgamento individual. O script de promoção **recusa** promover enunciado com etiqueta de lote, e o mesmo predicado vale para o veredito herdado — um enunciado que herdou (`herdadoDe`) carrega a etiqueta de origem, então herança de veredito de lote continua sendo lote.

Consequência prática: das 95 teses `fiel`, só 8 estão hoje habilitadas à vitrine. As 20 da vitrine inicial precisam ser conferidas antes — é trabalho manual, com a folha de calibração, e é o gargalo real do lançamento público. O acervo restrito e o ELIC não têm essa exigência.

**Critérios de seleção dos candidatos à conferência:**

1. Ordenar por `dossieNoVoto` decrescente entre as elegíveis.
2. **Diversidade temática:** no máximo 3 teses por assunto, para a vitrine não virar uma página só sobre prescrição.
3. **Excluir colisões de colegiado** não resolvidas (`colegiadoAlvo IS NULL`, §4).
4. **Excluir matéria estranha** ao escopo do site. Os três casos conhecidos são `1724/2025` (registro de ato de pensão) e dois enunciados de `966/2025` (aposentadoria e VBC do plano de carreira), que escaparam do filtro de matéria. A exclusão é por retirada editorial com motivo registrado, não por remoção silenciosa.

**Corte inicial:** 20 teses. Número ajustável — a promoção é script.

## 11. Testes

**Elegibilidade e ciclo de vida**
- `veredito` `imprecisa` e `errada` não são elegíveis em nenhum consumidor.
- Redestilação com texto idêntico herda `veredito`, `publicado` e `vitrinePublica`; com texto alterado, zera os três.
- Versão superada (`atual = false`) sai de todos os consumidores sem ser apagada.
- `retiradoEm` torna inelegível em todos os consumidores; a URL vira `noindex` e sai do sitemap.
- Enunciado sem `TeseTrechoFonte` não aparece em nenhum consumidor.
- `colegiadoAlvo IS NULL` bloqueia vitrine, permite acervo e ELIC.

**Acesso**
- Anônimo em `/busca` recebe só vitrine.
- Autenticado sem acesso ativo recebe só vitrine.
- Matrícula válida por QR code (sem assinatura) recebe o acervo — a regra é `hasAnyActiveAccess`, não assinatura.
- Assinatura ativa recebe o acervo; admin idem.
- `/api/documents/query` sem token continua 401.

**Cache**
- Chaves de `vitrine` e `acervo` são distintas para a mesma pergunta.
- Resultado cacheado para acervo nunca é servido a requisição de vitrine (teste de vazamento).
- `includeTeses: false` produz chave e resultado idênticos ao comportamento anterior (não-regressão dos chamadores existentes).

**Exportação**
- `--full` exporta todas as elegíveis; incremental exporta só o que mudou desde `lastExportAt`.
- Alteração de `publicado` ou `vitrinePublica` marca o arquivo como desatualizado (via `atualizadoEm`).
- Tese retirada, reprovada ou com versão superada tem o arquivo **removido** na exportação seguinte.
- A remoção não toca arquivo fora de `teses/`.
- `--dry-run` não escreve nem remove.
- O estado de sincronização do ELIC não interfere no do cofre do Obsidian.

**Determinismo da evidência**
- `montarDossie` desempata de forma estável; dois runs produzem a mesma ordem.
- `coletarTrechosDoAlvo` com `ateData` exclui arestas posteriores.
- Backfill não grava quando a contagem não casa; resolve índices corretamente quando casa.
- `persistirDestilacao` grava os trechos junto da destilação nova, sem reconstrução.

**Canibalização (avaliação, não teste unitário)**
- Rodar `npm run eval:run` antes e depois de ligar `includeTeses`, comparando recall@5 do golden set com o baseline do `ROADMAP_BUSCA_QUALIDADE.md`.
- Medir, nas queries do golden set, quantos acórdãos-fonte saíram do top-5 ao entrarem teses — é essa métrica, e não o recall agregado, que revela a síntese expulsando a fonte.
- Critério de aceite: nenhuma query perde o acórdão-fonte do contexto. Se perder, a recuperação complementar do acórdão-líder não está cumprindo o papel e a feature não sobe para o assistente (a vitrine pode subir antes; são independentes).

## 12. Riscos

| Risco | Mitigação |
|---|---|
| Evidência trocada nos 43 saturados | Reconstrução por `criadoEm` + verificação por contagem; não grava se não casar |
| Reconstrução não reproduzível | `orderBy` determinístico + desempate por `origemChave` |
| Tese atribuída ao acórdão errado | Identidade pela tripla com colegiado; sem colegiado não há vitrine |
| Teses expulsam acórdãos do contexto | Recuperação complementar + critério de aceite medido (§11) |
| Vazamento do acervo por cache | Visibilidade na chave de cache |
| Vazamento por default | `includeTeses` é opt-in |
| URL pública virar 404 | `noindex` + saída do sitemap, nunca 404 |
| Arquivo obsoleto eterno no RAG do ELIC | Remoção de obsoletos, restrita a `teses/` |
| Remoção destruir arquivo alheio | Escopo estrito ao subdiretório + `--dry-run` |
| Publicar sob a marca sem leitura individual | Conferência individual como pré-condição da vitrine (§10) |

## 13. Débito conhecido: a calibração não tem base

Não existe nenhum veredito negativo em toda a base — nunca se observou tese `imprecisa` ou `errada`. Isso não significa que o motor não erre: significa que só 8 teses foram julgadas individualmente e nenhuma falhou. A taxa de erro é desconhecida, e 87 dos 95 aprovados vieram de lote sobre confiança auto-declarada pelo modelo.

A exigência de conferência individual para a vitrine (§10) transforma esse débito em trabalho programado: as 20 primeiras teses públicas produzem, de quebra, a primeira amostra real de acerto do motor — inclusive os primeiros vereditos negativos, se houver.

## 14. Sequência de execução (alto nível — detalhar no plano)

**Onda 1 — evidência e identidade** (urgente: a janela de reconstrução fecha)
1. Determinismo em `montarDossie` e `coletarTrechosDoAlvo` (+ `ateData`).
2. Migration: `TeseTrechoFonte`, `TeseDestilacao.colegiadoAlvo`, e em `TeseEnunciado` os campos de publicação e `atualizadoEm`.
3. `persistirDestilacao` grava evidência e colegiado no ato; `destilar-teses-tcu` passa `colegiadoPreferido`.
4. Backfill da evidência e do colegiado, com relatório de quantos ficaram sem.
5. Retirada editorial dos 3 enunciados de matéria estranha.

**Onda 2 — exportação** (independente das superfícies web)
6. Teses no `runIncrementalExport` + remoção de obsoletos restrita a `teses/`.
7. `export:elic --full` inicial.

**Onda 3 — superfícies e busca**
8. Conferência individual das candidatas à vitrine e promoção.
9. Rotas `/teses`, `/teses/[chave]`, `/area-restrita/teses` + menu + sitemap.
10. `TeseEnunciadoChunk`, indexação, quarto ramo opt-in e visibilidade na chave de cache.
11. Adaptações de `/busca` (tipos, API, aba, cartão).
12. Recuperação complementar do acórdão-líder e avaliação de canibalização antes de ligar no assistente.
