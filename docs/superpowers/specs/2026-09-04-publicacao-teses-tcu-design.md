# Design — Publicação das teses destiladas do TCU

**Data:** 2026-09-04
**Status:** aprovado pelo usuário — pronto para o plano de implementação
**Depende de:** `2026-07-21-persistencia-teses-tcu-design.md` (persistência das teses, em produção desde julho)
**Relacionado:** PR #207 (aprovação em lote de 87 enunciados), PR #206 (índice HNSW pendente)

## 1. Contexto

O cron `destilar-teses-tcu` produz teses desde julho: **265 destilações atuais, 512 enunciados, 110 divergências**, sobre um grafo de **100.016 arestas** de citação. Nada disso chega ao usuário — nenhuma rota do site lê `TeseDestilacao`, as teses não têm embeddings e não são exportadas. O único consumo é a folha de calibração (`scripts/build-folha-teses-tcu.ts`), gerada sob demanda.

Em 03/09/2026, 87 enunciados foram aprovados em lote (confiança alta, posteriores ao filtro de matéria), somando 95 com veredito `fiel` junto dos 8 julgados individualmente. Desde então duas versões foram superadas por redestilação: em 04/09 são **93 em destilações atuais** — o número que este spec usa em todas as contas — e 14 outros em versões já superadas.

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

## 4. Identidade inequívoca do acórdão-líder

`TeseDestilacao` identifica o alvo por `numeroAlvo` + `anoAlvo`, e `chave` é literalmente `${numero}/${ano}` (`persistir-tese.ts:92`). **No TCU esse par não é unívoco:** o mesmo número e ano existem em colegiados diferentes. O Acórdão 56/2024 existe em Plenário, Primeira Câmara e Segunda Câmara; 63/2024 idem.

Pior: `escolherCandidato` aceita `colegiadoPreferido` (`buscar-acordao-tcu.ts:56`), mas `destilar-teses-tcu` o chama **sem** argumento, ficando com o primeiro candidato não-relação. Há teses hoje possivelmente atribuídas ao acórdão errado.

### 4.1 Por que não resolver por inferência

Duas heurísticas foram consideradas e **descartadas**, ambas por evidência:

**Colegiado majoritário das arestas.** O `colegiadoAlvo` de `AcordaoCitacao` é extraído por regex do texto de quem cita, e discorda da base em casos reais: para 2007/2025 e 2515/2023 o grafo diz "Segunda Câmara" enquanto o `Document` correspondente é "Plenário". Escolher por maioria seria propagar erro de extração com aparência de consenso.

**Casar com o `Document` da nossa base.** Dos 93 enunciados `fiel` em destilações atuais, a regra estrita resolveria só **41**: em **39** o acórdão-líder sequer existe como `Document` (o grafo é construído a partir do texto de quem cita, não do citado), e 8 casam com mais de um. Nossa base não é autoridade sobre a identidade de um acórdão que ela não tem.

### 4.2 Identificador oficial como fonte da identidade

O TCU fornece a identidade. `buscarAcordaoPorNumero` — que o cron **já chama** — devolve `CandidatoAcordao` com `key` no formato `ACORDAO-COMPLETO-<n>`, além de `colegiado`, `relator` e `link` (`buscar-acordao-tcu.ts:13-23,37`). É o mesmo identificador que `TribunalDecision.sourceId` guarda para os acórdãos ingeridos.

Campos novos em `TeseDestilacao`:

```prisma
acordaoKey       String?   // ACORDAO-COMPLETO-<n>, identificador oficial do TCU
colegiadoAlvo    String?   // do registro oficial, não do grafo
relatorAlvo      String?
urlAlvo          String?
documentId       String?   // enriquecimento opcional, NÃO é a identidade
document         Document? @relation(fields: [documentId], references: [id], onDelete: SetNull)
```

**Regra de resolução:**

1. Consultar o TCU por `(numero, ano)`.
2. Exatamente um candidato não-relação → resolvido: gravar `acordaoKey`, `colegiadoAlvo`, `relatorAlvo`, `urlAlvo`.
3. Mais de um candidato não-relação → **ambíguo**: os campos ficam `null`.
4. Nenhum candidato, ou falha de rede → **não resolvido**: `null`, e tenta de novo na próxima passada.
5. `documentId` é resolvido à parte, pela tripla `(acordaoNumero, acordaoAno, tcuOrgaoJulgador)` contra o `Document`, e serve só para enriquecer a página com o inteiro teor que já temos. Sua ausência não afeta a identidade.

### 4.3 Três níveis de procedência, não um portão binário

A primeira versão desta seção excluía de TODOS os consumidores a destilação sem `acordaoKey`. **Medido em 04/09/2026, isso custava 34 das 93 teses aprovadas** — mais de um terço — e a decisão foi revista.

O erro do enquadramento anterior: a tese **não depende do acórdão-líder para existir**. Ela é extraída dos votos citantes, e esses estão todos identificados — cada `TeseTrechoFonte` aponta para o `Document` exato de quem escreveu o trecho (§7.1). O que a ambiguidade deixa em aberto é apenas **qual colegiado** julgou o precedente: sabe-se que é o "2298/2025", não se é do Plenário ou de uma Câmara. Suprimir a tese inteira por uma imprecisão de rótulo descarta conteúdo bom e provado.

**Os próprios votos citantes costumam dizer o colegiado.** Medição sobre os 109 alvos sem identidade oficial:

| Situação | Alvos |
|---|---|
| Votos citantes **concordam** num colegiado | 70 |
| Citantes discordam entre si | 29 |
| Nenhum citante informa colegiado | 10 |

Em 70 casos a resposta está no nosso próprio grafo, escrita pelos ministros ao invocar o precedente — a mesma fonte de onde a tese foi extraída.

> Nota sobre a §4.1: aquela seção descarta "colegiado majoritário das arestas", e isso continua valendo. **Convergência não é maioria:** a regra aqui exige que TODOS os citantes que informam colegiado digam o mesmo, e cai fora com um único discordante. A §4.1 também invocava casos em que o grafo discorda do `Document`; esse argumento era fraco, porque o `Document` comparado pode ser justamente o outro acórdão homônimo — ele não é árbitro num caso de homonímia.

**Os três níveis:**

| Nível | Origem do colegiado | Consumidores |
|---|---|---|
| 1. Identidade oficial | registro do TCU (`acordaoKey`) | todos, inclusive vitrine |
| 2. Convergência dos citantes | unanimidade entre os votos que informam | acervo, busca, ELIC |
| 3. Sem colegiado | não afirmado | acervo, busca, ELIC — exibido como "Acórdão N/ANO", sem afirmar colegiado |

**Ganho medido:** de 59 para **90** enunciados publicáveis (59 oficiais + 24 por convergência + 7 sem colegiado).

**A vitrine exige nível 1.** Ela é a superfície pública sob a marca, e uma URL como `/teses/2298-2025-plenario` afirmaria o colegiado no próprio endereço. Sem confirmação oficial, não se afirma. Os níveis 2 e 3 aparecem no acervo e na busca, onde o rótulo pode ser qualificado na própria tela. (Decisão revisitável na Onda 3, quando a vitrine for construída — se o corpo de nível 1 se mostrar pequeno demais, admitir o nível 2 é mudança de uma linha no predicado.)

**Campos:** `TeseDestilacao` ganha `origemIdentidade String?` — `'tcu-oficial'`, `'convergencia-citantes'` ou `null` — e `citantesConcordantes Int?`, a contagem de votos que sustentam o colegiado no nível 2. O nível é derivado desses campos, não gravado por extenso.

**Invariante que permanece:** nunca afirmar colegiado que não se sabe. O nível 2 afirma o que os votos citantes afirmam, com a contagem à vista; o nível 3 não afirma nada. Nenhum dos dois inventa.

O slug da rota deriva da identidade oficial: `/teses/1441-2016-plenario`.

**Contrato de `escolherCandidato` — alteração explícita.** O helper hoje termina em `return (completos[0] ?? cands[0]) || null` (`buscar-acordao-tcu.ts:62-63`): com vários candidatos, devolve o primeiro. Essa queda é exatamente a inferência que a §4.1 descarta, e ela precisa sair do caminho da identidade. O contrato passa a ser:

| Candidatos não-relação | Retorno |
|---|---|
| zero | `null` |
| exatamente um | o candidato |
| dois ou mais | `null` — ambiguidade |

Sem queda para `cands[0]` em nenhum caso. Se o helper for mantido como está para outros usos, a cardinalidade é validada **antes** da chamada e o caminho da identidade não usa o retorno dele — mas a preferência é alterar o helper, porque um contrato que devolve "algum candidato" é uma armadilha para o próximo chamador.

`destilar-teses-tcu` grava a identidade do candidato assim resolvido e **recusa-se a destilar** quando o retorno for `null` — destilar para depois descartar é gastar LLM à toa.

**Backfill:** varrer as 265 destilações atuais consultando o TCU a 1 req/s (~5 min). Isso recupera boa parte dos 39 alvos ausentes da nossa base, porque o TCU os conhece mesmo quando não os ingerimos.

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

- Enunciado com texto **idêntico** ao da versão anterior herda `veredito`, `publicado`, `vitrinePublica` **e a retirada** (`retiradoEm`, `retiradoMotivo`), e a evidência é regravada para a versão nova. Herdar a retirada é o ponto sutil: sem isso, redestilar um alvo ressuscitaria uma tese que alguém tirou do ar de propósito — o texto é o mesmo, logo o motivo da retirada continua valendo.
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
  AND e.destilacao.numeroAlvo IS NOT NULL      -- o acórdão é conhecido; o colegiado pode não ser (§4.3)
  AND EVIDENCIA_INTEGRAL(e)
```

```
EVIDENCIA_INTEGRAL(e) :=
      count(índices distintos declarados em e.trechosFonte) > 0
  AND count(TeseTrechoFonte WHERE enunciadoId = e.id)
        = count(índices distintos declarados em e.trechosFonte)
  AND todo trecho persistido tem caminho para o inteiro teor (§7.1)
```

A primeira condição não é redundante: sem ela, um enunciado que **não declara nenhum** índice satisfaria a igualdade por `0 = 0` e passaria como se tivesse evidência integral, quando na verdade não tem evidência alguma. É o caso de uma destilação em que o modelo devolveu `trechosFonte` vazio — exatamente a tese que menos deveria ser publicada.

**Alguma evidência não basta.** Se o enunciado declara três índices em `trechosFonte` e só um foi resolvido, a tese continuaria elegível com a fundamentação pela metade — e o leitor veria "os trechos que sustentam esta tese" sem saber que faltam dois. Faltando qualquer índice declarado, **o enunciado inteiro fica inelegível**. É a mesma lógica da §7.2: perder a tese é preferível a exibi-la mal sustentada.

Por consumidor:

| Consumidor | Predicado |
|---|---|
| Acervo restrito (`/area-restrita/teses`) | `ELEGIVEL_BASE AND publicado` |
| Vitrine (`/teses`) | `ELEGIVEL_BASE AND publicado AND vitrinePublica AND acordaoKey IS NOT NULL` (nível 1, §4.3) |
| Busca por IA | o predicado do consumidor, conforme a visibilidade (§9) |
| `export:elic` | `ELEGIVEL_BASE` — **sem** `publicado` |

A diferença do ELIC é deliberada: aquele destino é acervo de RAG interno, não superfície editorial. Uma tese aprovada e ainda não promovida é útil lá e não estaria exposta a ninguém de fora. O que o ELIC **não** recebe é tese não aprovada, retirada, de versão superada ou sem evidência. Identidade não resolvida **não** exclui (§4.3): o frontmatter registra o nível de procedência, e o RAG cita a tese com o colegiado qualificado ou omitido.

## 7. A evidência é volátil

`TeseEnunciado.trechosFonte` guarda **índices** para um dossiê que **não é persistido**. O dossiê é recomposto do grafo por `coletarTrechosDoAlvo`, e o grafo cresce todo dia (`sync-precedentes-tcu`).

A verificação atual (`build-folha-teses-tcu.ts:156`) compara apenas a quantidade:

```ts
const trechosConfiaveis = dossie.trechos.length === d.dossieTrechos;
```

`montarDossie` ordena por citação-no-voto e **corta em 40** (`trechos-de-citacao.ts:74,85,96`). Para um alvo saturado no teto, um citante novo entra no top-40 e desloca outro: a contagem continua 40, a verificação passa, e os índices apontam para trechos diferentes.

**Medição em 04/09/2026**, sobre os **93** enunciados `fiel` em destilações **atuais**:

| Estado do dossiê | Destilações | Enunciados |
|---|---|---|
| Abaixo do teto de 40 | 39 | 52 |
| Saturado (=40) | 27 | **41** |

Os 41 sob risco são os mais citados — as melhores teses do acervo.

(Outros 14 enunciados `fiel` vivem em versões já superadas e não são consumidos por ninguém, por `atual = false`. A contagem de 95 que circulou em 03/09 é histórica: incluía duas versões superadas desde então.)

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
  origemUrl       String?   // acórdão citante no portal do TCU
  origemLinkPDF   String?   // inteiro teor, capturado no snapshot
  origemDocumentId String?
  origemDocument   Document? @relation(fields: [origemDocumentId], references: [id], onDelete: SetNull)
  noVoto      Boolean
  capturadoEm DateTime @default(now())

  @@unique([enunciadoId, ordem])
  @@index([enunciadoId])
  @@index([origemDocumentId])
}
```

Cada trecho identifica o **acórdão citante** pela mesma tripla da §4 e liga ao `Document` dele, que é onde vive o inteiro teor. Isso importa em dois lugares: na tela, o leitor clica no trecho e vai ao inteiro teor de quem o escreveu; na conferência, quem julga a tese consegue ler o contexto em volta da citação. `coletarTrechosDoAlvo` já dispõe do `Document` do citante (`trechos-de-citacao.ts:110-120`) — hoje o descarta e guarda só uma string `origemChave`.

**O acesso ao inteiro teor não pode depender da relação com `Document`.** `onDelete: SetNull` (e a simples ausência do citante na nossa base) apagaria o caminho até a fonte, deixando o leitor com um trecho literal e nenhuma forma de conferir o contexto — evidência que não se pode verificar deixa de ser evidência. Por isso `origemUrl` e `origemLinkPDF` são **copiados no snapshot**, a partir de `Document.url`/`tcuLinkPDF` do citante, e sobrevivem à perda da relação.

Invariante: **todo `TeseTrechoFonte` consumível tem pelo menos um caminho para o inteiro teor** — `origemDocumentId` (interno, preferido) ou `origemUrl`/`origemLinkPDF` (externo, permanente). Um trecho sem nenhum dos dois não é gravado, e portanto o enunciado fica sem evidência e sai dos consumidores por §6.

`Document` recebe o lado inverso da relação (`trechosDeTese TeseTrechoFonte[]`), exigido pelo Prisma.

`retiradoMotivo` obrigatório junto de `retiradoEm` (§5) é regra de aplicação, não de schema — o Prisma não expressa obrigatoriedade condicional. Fica no script de retirada e num teste.

### 7.2 Reconstrução histórica (backfill)

1. `coletarTrechosDoAlvo` ganha `ateData?: Date`, que adiciona `criadoEm: { lt: ateData }` ao filtro de arestas.
2. A consulta de arestas ganha `orderBy` determinístico e `montarDossie` ganha desempate por `origemChave`. Sem isso a reconstrução não é reproduzível.
3. Para cada destilação `atual` com enunciado `fiel`: reconstruir o dossiê com `td.criadoEm`, conferir `dossie.trechos.length === td.dossieTrechos`, e só então resolver os índices e gravar.
4. Onde a contagem não casar, **não grava**. O enunciado fica sem evidência e, por §6, fora de todos os consumidores.
5. Resolver **todos** os índices declarados em `trechosFonte` antes de gravar qualquer um. Índice fora do intervalo do dossiê, ou trecho sem caminho para o inteiro teor, invalida o enunciado inteiro — não se grava evidência parcial.

**Gravação transacional e idempotente.** Os trechos de um enunciado são gravados numa transação: ou entram todos, ou nenhum. Uma falha no meio não pode deixar dois de três persistidos, porque `EVIDENCIA_INTEGRAL` mediria a diferença como perda permanente.

A idempotência vem de `@@unique([enunciadoId, ordem])` (§7.1) com upsert por essa chave: reexecutar o backfill sobre um enunciado já resolvido reescreve as mesmas linhas, sem duplicar nem reordenar. Índices repetidos no `trechosFonte` colapsam na mesma `ordem` em vez de gerar linha extra. Isso importa porque o backfill vai ser reexecutado — por lote interrompido, por retentativa de rede no TCU, ou depois de corrigir a resolução de identidade.

Consequência aceita: parte dos 41 saturados pode ficar de fora. Perder teses é preferível a exibir evidência trocada.

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
teses/acordao-1441-2016-plenario.md   # níveis 1 e 2 (colegiado conhecido)
teses/acordao-2298-2025.md            # nível 3 (colegiado não afirmado)
```

O colegiado entra no nome **apenas quando conhecido** (§4.3). No nível 3 o arquivo não o carrega — nomear `acordao-2298-2025-plenario.md` sem saber afirmaria no próprio caminho do arquivo o que a tese não afirma no corpo.

**Frontmatter:**

```yaml
tipo: tese-tcu
acordao: "1441/2016"
numero: 1441
ano: 2016
relator: "..."
assunto: "..."
teses: 2
citacoesNoVoto: 262
confianca: alta
vereditos: [fiel, fiel]
destilacaoId: "..."
atualizadoEm: 2026-09-04T12:00:00Z

# Procedência (§4.3) — obrigatório, um dos três valores
origemIdentidade: tcu-oficial          # | convergencia-citantes | (ausente no nível 3)

# Nível 1 apenas
colegiado: Plenário
acordaoKey: ACORDAO-COMPLETO-1234567
fonteOficial: https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-1234567

# Nível 2 apenas
# colegiado: Segunda Câmara
# citantesConcordantes: 23

# Condicional em qualquer nível: ausente quando a tese não está publicada
fonteSite: https://profbarral.com.br/teses/1441-2016-plenario
```

**Sem `publicado` nem `vitrine` no frontmatter.** O arquivo agrupa todas as teses elegíveis de um acórdão-líder, e elas podem ter estados editoriais diferentes — uma promovida à vitrine ao lado de outra ainda não publicada. Um escalar no cabeçalho teria de significar "alguma" ou "todas", e qualquer das duas leituras seria falsa para parte do conteúdo. Como esses campos não participam da elegibilidade do ELIC (§6), a saída é não exportá-los: o destino é acervo de RAG, não espelho do estado editorial do site.

**Campos por nível.** `origemIdentidade` é obrigatório e diz ao RAG com que autoridade o colegiado é afirmado. `acordaoKey`, `fonteOficial` e `colegiado` existem só no nível 1; no nível 2 há `colegiado` e `citantesConcordantes`, sem chave oficial; no nível 3 não há colegiado algum. **Medido em 04/09/2026: 156 destilações no nível 1, 70 no nível 2 e 39 no nível 3** — exigir `acordaoKey` no frontmatter, como esta seção fazia antes da §4.3, deixaria 109 arquivos inválidos.

`fonteSite` é condicional em qualquer nível: o ELIC exporta também teses ainda **não publicadas** (§6), e para essas a página do site não existe — se a URL do site fosse a única fonte de rastreabilidade, o RAG apontaria para um 404. Daí a fonte oficial ser preferida onde existe; onde não existe, a rastreabilidade repousa no par número/ano mais os acórdãos citantes, que estão no corpo.

O corpo traz cada enunciado, sua `inovacao`, e os trechos-fonte com o acórdão citante identificado e um wikilink para a nota dele quando existir no acervo — mantendo a procedência também no RAG.

**Incremental — e por que ele não funciona por delta aqui.** O estado é por destino (`sync-state.ts`), então isto não interfere no cofre do Obsidian.

A regra ingênua seria reescrever o arquivo de um acórdão-líder quando algum enunciado **elegível** seu mudou desde `lastExportAt`. Ela tem um furo: quando uma tese **deixa** de ser elegível — retirada, reprovada numa redestilação, evidência perdida, identidade que virou ambígua — ela some do conjunto consultado, então nada marca o arquivo como desatualizado. O arquivo continua no ELIC com a tese que já não vale, ao lado das que valem. O problema não é o arquivo obsoleto inteiro (esse a remoção resolve), é o arquivo **parcialmente** desatualizado, que a remoção não pega porque ele ainda deve existir.

Detectar isso por delta exigiria consultar também o que saiu, em cada uma das quatro formas de sair. Não vale: `teses/` tem algumas dezenas de arquivos pequenos. **A cada exportação, o subdiretório `teses/` inteiro é regenerado** a partir do predicado da §6, e os arquivos que não estiverem no conjunto esperado são removidos. Custo desprezível, e correto por construção — não há estado intermediário que possa divergir.

`atualizadoEm` em `TeseEnunciado` (§5) continua útil para o relatório da exportação (o que mudou desde a última), mas a corretude não depende dele.

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
| `/busca` → `/api/busca-integrada` | opcional (funciona anônimo) | **vitrine** para visitante; **acervo** para acesso ativo |
| Assistente → `/api/documents/query` | obrigatório, 401 sem auth (`route.ts:66`) | **acervo** para acesso ativo; **vitrine** para autenticado sem acesso |

A regra é a mesma nas duas superfícies, e depende do usuário, não da rota: quem tem acesso ativo vê o acervo onde estiver; quem não tem vê a vitrine. `/api/busca-integrada` já resolve `hasAnyActiveAccess` para decidir a demonstração do assistente (`route.ts:48`) — o mesmo valor escolhe a visibilidade.

> O `CLAUDE.md` lista `/api/documents/query` como rota pública; o código exige autenticação. Corrigir quando o arquivo for tocado.

**Embeddings.** Tabela `TeseEnunciadoChunk` como quarto ramo do `UNION ALL` em `vector-search.ts`, com `sourceType: 'tese'`. A tabela própria não é simetria: o ramo precisa de `JOIN` na tabela-mãe para aplicar o predicado da §6, como o ramo de `TribunalDecisionChunk` já faz para `tribunalCode` (`vector-search.ts:486`). Enunciados são curtos — um chunk cada.

**Ciclo de vida do embedding.** `TeseEnunciado` ganha `embeddingStatus String?`, no mesmo desenho de `Document` e `TribunalDecision`, e `process-index-jobs` ganha um quarto processador (`lib/embeddings/tese-processor.ts`).

- **Texto embeddado:** o enunciado, precedido do assunto da destilação e da identificação do acórdão-líder (`Acórdão 1441/2016 — Plenário`). Um chunk por enunciado. Sem esse prefixo, a súmula flutua sem o precedente e o retrieval perde o vínculo que a §9 quer preservar.
- **Entra na fila** (`embeddingStatus = 'pending'`) quando o enunciado passa a satisfazer `ELEGIVEL_BASE`: ao ganhar veredito `fiel`, ao ganhar evidência no backfill, ao ter a identidade resolvida, ou ao ser criado já elegível numa redestilação com herança.
- **Sai do índice** quando deixa de satisfazer `ELEGIVEL_BASE`: retirada, veredito alterado para `imprecisa`/`errada`, perda de `atual` numa redestilação, ou identidade que virou ambígua. Nesses casos o chunk é **apagado**, não apenas despriorizado — chunk órfão continua sendo recuperado e citado.
- **Quem apaga:** os scripts que causam transição de **elegibilidade** (retirada, backfill de evidência, backfill de identidade, redestilação) marcam o enunciado; `process-index-jobs` faz a reconciliação, apagando os chunks de enunciados inelegíveis e indexando os pendentes. Publicação e promoção **não** entram nessa lista — elas não mudam elegibilidade. A reconciliação é uma consulta pelo predicado, não uma lista de eventos — assim uma transição feita por SQL direto no banco também é capturada.
- **`publicado` e `vitrinePublica` não afetam o índice.** Eles são filtro de leitura (§6, via `JOIN`), não critério de indexação: um mesmo chunk serve vitrine e acervo, e é a consulta que decide o que enxerga. Indexar duas vezes seria duplicar o vetor para variar só o predicado.

**Opt-in, não default.** `includeTeses?: boolean` (default `false`) em `SearchOptions` e `HybridSearchOptions`, no mesmo desenho de `includeTribunalDecisions` (`hybrid-search.ts:28`). Nenhum chamador existente muda de comportamento ao subir esta feature; cada superfície liga explicitamente. Junto vai `tesesVisibilidade: 'vitrine' | 'acervo'`, que seleciona o predicado.

**Chave de cache.** `vector-search.ts:160` monta a chave concatenando cada opção que altera o resultado (`td=`, `sd=`, `sl=`, `tc=`…). A chave ganha `:ts=<off|vitrine|acervo>`. **Sem isso há vazamento:** uma consulta de um usuário com acesso ativo gravaria no cache um resultado contendo o acervo, e o próximo anônimo com a mesma pergunta receberia esse resultado. A visibilidade é parte da identidade do resultado, não um pós-filtro.

**Adaptações em `/busca`:**

- `ContentType` em `lib/types/global-search.ts` ganha `'tese'`; nova interface `TeseResult` (enunciado, acórdão-líder com colegiado, citações no voto, primeiro trecho, href).
- `/api/busca-integrada` ganha `teses` no objeto `results`, com a visibilidade decidida por `hasAnyActiveAccess` conforme a tabela acima.
- `app/busca/page.tsx`: `TabType` ganha `'teses'`, com contador na aba e no total.
- Cartão novo em `components/busca/`, exibindo enunciado, precedente e trecho-fonte — a mesma invariante de procedência da §7.

**Canibalização (risco principal).** A tese é curta, abstrata e escrita em linguagem de súmula, portanto formalmente muito parecida com uma pergunta de usuário. Tende a pontuar alto e expulsar os acórdãos do contexto, fazendo a IA responder pela síntese sem a fonte — o oposto da decisão de procedência.

**A companhia obrigatória da tese é a sua evidência, não o acórdão-líder.** Fazer o líder acompanhar a tese seria impossível em **39 das 93** teses, cujo acórdão-líder não existe como `Document` (§4.1). E seria conceitualmente errado mesmo quando possível: a tese não foi extraída do líder — foi extraída das manifestações posteriores que o citaram. Quem sustenta a afirmação é o acórdão **citante**, que é justamente o que `TeseTrechoFonte` guarda.

Regra de recuperação complementar, reaproveitando o mecanismo de `answerContext.ts:170`:

1. Tese recuperada → **pelo menos um `TeseTrechoFonte` entra no contexto**, sempre. Ele já está persistido, então não depende de recuperação nem de o citante existir na base.
2. Quando `origemDocumentId` estiver resolvido, o `Document` do **acórdão citante** entra junto, dando ao modelo o inteiro teor de onde o trecho saiu.
3. Quando `destilacao.documentId` estiver resolvido, o `Document` do **acórdão-líder** entra **adicionalmente**, como complemento.
4. A ausência do `Document` do líder **não bloqueia** a tese — preserva-se as 93.

A eficácia é medida (§11), não presumida.

**Citação:** `sourceType: 'tese'` apontando para `/teses/[chave]` com âncora do enunciado, com o trecho-fonte viajando junto na resposta.

## 10. Publicação: acervo restrito e vitrine

São duas etapas com exigências diferentes. O acervo restrito é o corpo do produto; a vitrine é o recorte público, e só ela exige conferência individual.

### 10.1 Publicação inicial do acervo restrito

`publicado` nasce `false` (§5), então nenhuma tese aparece até que alguém as publique. `scripts/publicar-acervo-teses.ts` faz essa passagem:

- **Alvo:** todos os enunciados que satisfazem `ELEGIVEL_BASE` (§6) e ainda têm `publicado = false`.
- **Dry-run por padrão**, como os demais scripts de dado desta campanha; `--executar` aplica; `--limit` para lote parcial.
- Relata quantos foram publicados e, do que ficou de fora, o motivo agregado: sem evidência, identidade ambígua, veredito ausente ou reprovado, versão superada.
- Reversível por `--despublicar`, que só desfaz o que este script fez (`publicado = true AND vitrinePublica = false`), sem tocar no que está na vitrine.

Não exige conferência individual: o acervo é material de trabalho para quem tem acesso ativo, exibido com a evidência ao lado, e a curadoria caso a caso é justamente o que não escala em 93 teses. A vitrine, que é a superfície pública sob a marca, exige.

Esta etapa é o que efetivamente liga o produto — sem ela, as rotas existem e não mostram nada.

### 10.2 Promoção da vitrine

**Conferência individual é pré-condição.** Nenhum enunciado entra na vitrine sem ter sido julgado um a um contra os trechos-fonte. Isso é verificável no dado que já existe: os 87 do lote têm `julgadoPor = 'danbarral:lote-confianca-alta'`.

Convenção, para que a regra seja mecânica e não subjetiva: **`julgadoPor` que contenha `:lote-` identifica julgamento em lote**; qualquer outro valor identifica julgamento individual. O script de promoção **recusa** promover enunciado com etiqueta de lote, e o mesmo predicado vale para o veredito herdado — um enunciado que herdou (`herdadoDe`) carrega a etiqueta de origem, então herança de veredito de lote continua sendo lote.

Consequência prática: das 93 teses `fiel` em destilações atuais, só 8 estão hoje habilitadas à vitrine — e esse conjunto ainda será filtrado pela identidade resolvida (§4). As 20 da vitrine inicial precisam ser conferidas antes — é trabalho manual, com a folha de calibração, e é o gargalo real do lançamento público. O acervo restrito e o ELIC não têm essa exigência.

**Critérios de seleção dos candidatos à conferência:**

1. Ordenar por `dossieNoVoto` decrescente entre as elegíveis.
2. **Diversidade temática:** no máximo 3 teses por assunto, para a vitrine não virar uma página só sobre prescrição.
3. **Excluir matéria estranha** ao escopo do site. Os três casos conhecidos são `1724/2025` (registro de ato de pensão) e dois enunciados de `966/2025` (aposentadoria e VBC do plano de carreira), que escaparam do filtro de matéria. A exclusão é por retirada editorial com motivo registrado, não por remoção silenciosa.

Colisões de identidade não precisam de critério aqui: `ELEGIVEL_BASE` já as barra em todos os consumidores (§4.2).

**Corte inicial:** 20 teses. Número ajustável — a promoção é script.

**Retirada** é o inverso e usa `retiradoEm`/`retiradoMotivo` (§5), propagando-se a todos os consumidores e ao próximo export.

## 11. Testes

**Elegibilidade e ciclo de vida**
- `veredito` `imprecisa` e `errada` não são elegíveis em nenhum consumidor.
- Redestilação com texto idêntico herda `veredito`, `publicado` e `vitrinePublica`; com texto alterado, zera os três.
- Versão superada (`atual = false`) sai de todos os consumidores sem ser apagada.
- `retiradoEm` torna inelegível em todos os consumidores; a URL vira `noindex` e sai do sitemap.
- Enunciado sem `TeseTrechoFonte` não aparece em nenhum consumidor.
- `acordaoKey IS NULL` (identidade ambígua ou não resolvida) exclui de **todos** os consumidores, inclusive do ELIC.
- Retirada é herdada em redestilação de texto idêntico — a tese não ressuscita.
- Resolução de identidade por cardinalidade: zero candidatos não-relação → `null`; exatamente um → resolvido; dois ou mais → `null` por ambiguidade, **sem** queda para `cands[0]`; falha de rede não grava identidade errada.
- `documentId` ausente não bloqueia nada — identidade vem do TCU, não da nossa base.

**Evidência: integralidade, idempotência e acesso ao inteiro teor**
- Todo `TeseTrechoFonte` gravado tem `origemDocumentId` **ou** `origemUrl`/`origemLinkPDF`.
- Perder a relação com `Document` (`SetNull`) preserva o caminho externo até o inteiro teor.
- Trecho sem nenhum caminho não é gravado, e o enunciado sai dos consumidores.
- **Perda parcial:** enunciado que declara 3 índices e tem 2 persistidos é inelegível em todos os consumidores.
- **Índice inexistente:** índice fora do intervalo do dossiê invalida o enunciado inteiro; nada é gravado.
- **Índices repetidos** em `trechosFonte` colapsam numa única `ordem`, sem linha duplicada.
- **Reexecução do backfill** sobre enunciado já resolvido não duplica, não reordena e não altera contagem (`@@unique([enunciadoId, ordem])` + upsert).
- **Transação:** falha no meio da gravação não deixa evidência parcial persistida.

**Publicação**
- `publicar-acervo-teses` publica só o que satisfaz `ELEGIVEL_BASE`; dry-run não escreve.
- `--despublicar` não toca em enunciado com `vitrinePublica`.
- Promoção recusa enunciado com `julgadoPor` contendo `:lote-`.

**Embeddings**
- Enunciado que passa a ser elegível entra na fila; o chunk carrega o prefixo com o acórdão-líder.
- Enunciado que deixa de ser elegível tem o chunk **apagado** — retirada, veredito alterado, versão superada e identidade perdida, cada um num teste.
- A reconciliação captura transição feita por SQL direto, sem evento.
- `publicado`/`vitrinePublica` não disparam reindexação.

**Acesso**
- Anônimo em `/busca` recebe só vitrine.
- Autenticado sem acesso ativo recebe só vitrine.
- Matrícula válida por QR code (sem assinatura) recebe o acervo — a regra é `hasAnyActiveAccess`, não assinatura.
- Assinatura ativa recebe o acervo; admin idem.
- `/api/documents/query` sem token continua 401.

**Fonte probatória na busca**
- Tese recuperada sempre traz ao menos um `TeseTrechoFonte` ao contexto.
- `Document` do citante entra quando `origemDocumentId` está resolvido.
- Tese cujo acórdão-líder não existe como `Document` **é recuperável** e vem acompanhada da evidência — as 39 não são bloqueadas.
- `Document` do líder entra adicionalmente quando `destilacao.documentId` está resolvido.

**Cache**
- Chaves de `vitrine` e `acervo` são distintas para a mesma pergunta.
- Resultado cacheado para acervo nunca é servido a requisição de vitrine (teste de vazamento).
- `includeTeses: false` produz chave e resultado idênticos ao comportamento anterior (não-regressão dos chamadores existentes).

**Exportação**
- `--full` e incremental produzem o mesmo conteúdo em `teses/` — o subdiretório é regenerado sempre.
- Acórdão-líder com duas teses, uma das quais foi retirada: o arquivo é **reescrito sem ela**, não apenas mantido (o caso parcialmente desatualizado).
- Acórdão-líder cuja última tese elegível saiu tem o arquivo **removido**.
- A remoção não toca arquivo fora de `teses/`.
- `--dry-run` não escreve nem remove.
- O estado de sincronização do ELIC não interfere no do cofre do Obsidian.

**Determinismo da evidência**
- `montarDossie` desempata de forma estável; dois runs produzem a mesma ordem.
- `coletarTrechosDoAlvo` com `ateData` exclui arestas posteriores.
- Backfill não grava quando a contagem não casa; resolve índices corretamente quando casa.
- `persistirDestilacao` grava os trechos junto da destilação nova, sem reconstrução.

**Canibalização (avaliação, não teste unitário)**

O golden set atual (`eval/golden-set.json`) associa pergunta → documentos esperados. Ele não consegue medir o que interessa aqui, porque não sabe que uma tese e seu acórdão-líder são a mesma matéria vista de dois ângulos.

**Conjunto de avaliação novo, pareado.** Para cada tese elegível sorteada, uma entrada com:

```json
{
  "query": "...",
  "tesePar": {
    "enunciadoId": "...",
    "acordaoKey": "ACORDAO-COMPLETO-...",
    "evidenciaDocumentIds": ["..."],
    "acordaoLiderDocumentId": "..."
  }
}
```

`evidenciaDocumentIds` são os `Document` dos acórdãos **citantes** ligados aos `TeseTrechoFonte` do enunciado. `acordaoLiderDocumentId` é **opcional** — ausente nas 39 teses cujo líder não está na base, e a entrada continua válida sem ele.

As três métricas:

- **Fonte probatória no contexto:** em quantas queries a tese veio acompanhada de pelo menos um trecho-fonte e, quando existente, do `Document` do citante. É o alvo — a síntese nunca sozinha.
- **Deslocamento do líder:** entre as queries cujo `acordaoLiderDocumentId` está preenchido **e** aparecia no top-5 antes de ligar `includeTeses`, em quantas ele saiu depois. Medido só onde faz sentido medir; as 39 sem líder na base não entram nesta métrica.
- **Não-regressão:** recall@5 do golden set existente, comparado ao baseline do `ROADMAP_BUSCA_QUALIDADE.md`, para garantir que as teses não empurraram para fora matéria alheia a elas.

Como as queries do conjunto pareado derivam das próprias teses, elas medem o caminho feliz; a não-regressão no golden set independente é o contrapeso. Ambas rodam antes e depois de ligar `includeTeses`.

**Critério de aceite**, em três condições independentes:

1. **Fonte probatória em 100% das queries** em que uma tese entra no contexto — sem exceção, porque é a invariante de procedência (§7) aplicada ao assistente.
2. **Deslocamento zero** do acórdão-líder, apurado apenas nas queries em que ele existe na base e já era recuperado antes.
3. **Recall@5 do golden set sem regressão** contra o baseline.

Falhar em (1) bloqueia a feature no assistente. Falhar em (2) ou (3) indica que a recuperação complementar não está compensando a canibalização, e também bloqueia. A vitrine e o acervo podem subir antes — são independentes da busca.

## 12. Riscos

| Risco | Mitigação |
|---|---|
| Evidência trocada nos 41 saturados | Reconstrução por `criadoEm` + verificação por contagem; não grava se não casar |
| Reconstrução não reproduzível | `orderBy` determinístico + desempate por `origemChave` |
| Tese atribuída ao acórdão errado | Identidade pelo identificador oficial do TCU; ambíguo fica fora de todos os consumidores |
| Tese retirada volta numa redestilação | Retirada herdada em texto idêntico |
| Arquivo do ELIC parcialmente desatualizado | Regeneração integral de `teses/` a cada exportação |
| Chunk órfão citado após retirada | Reconciliação por predicado apaga o chunk |
| Evidência sem caminho para a fonte | `origemUrl`/`origemLinkPDF` copiados no snapshot |
| Teses expulsam acórdãos do contexto | Evidência obrigatória no contexto + deslocamento medido (§11) |
| Tese citada sem fonte por líder ausente | A companhia obrigatória é o trecho-fonte, não o líder |
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

**Onda 1 — identidade e evidência** (urgente: a janela de reconstrução fecha)
1. Determinismo em `montarDossie` e `coletarTrechosDoAlvo` (+ `ateData`).
2. Migration: `TeseTrechoFonte`, identidade em `TeseDestilacao` (`acordaoKey`, `colegiadoAlvo`, `relatorAlvo`, `urlAlvo`, `documentId`), e em `TeseEnunciado` os campos de publicação, `atualizadoEm` e `embeddingStatus`.
3. `destilar-teses-tcu` grava a identidade oficial e recusa alvo ambíguo; `persistirDestilacao` grava a evidência no ato e herda publicação e retirada.
4. Backfill da identidade contra o TCU (265 alvos, 1 req/s).
5. Backfill da evidência, com relatório do que ficou sem.
6. Retirada editorial dos 3 enunciados de matéria estranha.

**Onda 2 — publicação e exportação** (independente das superfícies web)
7. `publicar-acervo-teses` — a etapa que efetivamente liga o produto.
8. Teses no `runIncrementalExport`, com regeneração integral de `teses/`.
9. `export:elic --full` inicial.

**Onda 3 — superfícies**
10. Rotas `/teses`, `/teses/[chave]`, `/area-restrita/teses` + menu + sitemap.
11. Conferência individual das candidatas à vitrine e promoção.

**Onda 4 — busca**
12. `TeseEnunciadoChunk`, `tese-processor` e o ciclo no `process-index-jobs`.
13. Quarto ramo opt-in e visibilidade na chave de cache.
14. Adaptações de `/busca` (tipos, API, aba, cartão).
15. Conjunto de avaliação pareado, recuperação complementar da evidência e medição de deslocamento antes de ligar no assistente.
