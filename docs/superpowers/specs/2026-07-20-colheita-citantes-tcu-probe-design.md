# Design — Probe de gate da colheita de citantes (Fase 2-B, opção C)

**Data:** 2026-07-20
**Status:** aprovado (brainstorming), aguarda plano de implementação
**Antecede:** a decisão entre lançar o sistema de teses com profundidade curada (opção A) ou ampliar a base antes (opção C)
**Relacionado:** `2026-07-19-destilacao-teses-tcu-probe-design.md` (Fase 2-A, motor de destilação — **GO concedido pelo Daniel em 2026-07-20**); `2026-07-18-rede-precedentes-tcu-fase1-grafo-design.md` (grafo `AcordaoCitacao`); `2026-07-18-rede-precedentes-tcu-fase2-importar-design.md` (**não é o caminho desta spec** — ver §1.2).

## 1. Contexto e problema

### 1.1 O GO da Fase 2-A e o limite que ele não testou

Em 2026-07-20 o Daniel julgou a folha de calibração da Fase 2-A (artifact `11045e96`) com resultado limpo: **4/4 teses "fiel"** (1441/2016, 2622/2013, 2914/2019, 414/2018) e **2/2 divergências "procede"**. O motor de destilação (`lib/tcu/destilar-tese.ts`) está calibrado e aprovado.

O que esse julgamento **não** testou: os 4 casos julgados estão todos na faixa de dossiê gordo. A distribuição real do grafo é brutalmente desigual — dos 100 maiores leading cases:

| Citações **no voto** | Casos |
|---|---|
| ≥ 50 | 1 |
| 20–49 | 1 |
| 10–19 | 7 |
| 5–9 | 29 |
| < 5 | 62 |

O grafo tem 40.107 citações extraídas, das quais apenas **9.208 estão no voto**, sobre **1.685 acórdãos com inteiro teor**. Abaixo de ~5 citações-no-voto o dossiê fica magro e o motor tende a se calar (`teses: []`, comportamento conservador correto) ou a produzir tese frágil.

Isso divide o caminho em duas opções de produto:
- **A — profundidade curada:** lançar com os ~40 casos de dossiê gordo, todos com a qualidade já aprovada.
- **C — ampliar a base antes:** engordar os dossiês e só então lançar, cobrindo mais casos.

**Esta spec não escolhe entre A e C. Ela projeta o experimento que decide.**

### 1.2 Correção de premissa: o que engorda o dossiê

O dossiê de uso de um leading case é formado pelos **trechos dos votos dos acórdãos que o citam**. Logo, quem engorda o dossiê são os **citantes**, não o citado.

O plano `2026-07-18-rede-precedentes-tcu-fase2-importar-design.md` importa os 100 leading cases **ausentes**. Isso melhora a metade "ementa do próprio acórdão" da destilação híbrida, mas **não move a metade do dossiê** — que é justamente a que sustenta a tese, conforme o prompt do motor ("baseie-se SOBRETUDO em como os votos posteriores invocam o precedente"). Aquele plano continua válido para o seu próprio fim; não é o caminho da opção C.

### 1.3 Como colher citantes

A API de busca do TCU é full-text e aceita o termo cru no corpo com `Content-Type: text/plain` (descoberta de 2026-07-19, já implementada em `lib/tcu/buscar-acordao-tcu.ts`; `application/json` retorna HTTP 415). Buscar `"1441/2016"` retorna acórdãos que **mencionam** aquele acórdão — isto é, seus citantes.

Isso permite **colheita dirigida**: em vez de importar milhares de acórdãos ao acaso torcendo para que citem os casos certos, colhe-se exatamente os citantes de cada leading case. O dossiê engorda por construção.

### 1.4 O que já foi descartado como restrição

Storage no Neon custa **US$ 0,35/GB-mês**. Com 70 kB de texto bruto por acórdão (medido) e a compressão do TOAST, 8.000 citantes novos ocupam ~0,4 GB — **~US$ 0,14/mês**. O banco inteiro hoje tem 459 MB. **Custo de disco não é restrição deste projeto** e não deve pesar em nenhuma decisão de desenho.

Os custos reais da opção C, em ordem: (1) tempo de ingestão, limitado pelo rate limit de 1 req/s do TCU; (2) efeito sobre a qualidade do retrieval, **se** os citantes forem indexados como `Document` — decisão que esta spec não toma e não precisa tomar; (3) CU-horas do Neon durante a carga.

## 2. Objetivo do probe (escopo desta spec)

Responder **uma** pergunta, com evidência julgável pelo Daniel:

> Colher os citantes de um leading case **magro** engorda o dossiê o bastante para o motor sair do silêncio e produzir uma tese que o Daniel julgue **fiel**?

**Entregável:** uma folha de calibração (artifact) com julgamento **cego** (§6), mais um conjunto de métricas duras automáticas (§5.5). O veredito é **GO/NO-GO para a opção C**.

**Não-objetivos (YAGNI deste probe):** persistir citantes no banco; indexar citantes como `Document`; embeddings; schema de teses; a tela de dois níveis; classificação de assuntos; cron de fluxo contínuo. Nada disso entra antes do GO. O probe grava em arquivo, como o da Fase 2-A.

## 3. Portões baratos — antes de qualquer LLM

Ambos são pré-condições. Se qualquer um falhar, o probe **para** e reporta; não se gasta destilação.

### 3.1 Portão 1 — a busca devolve citantes em volume?

`POST https://pesquisa.apps.tcu.gov.br/api/publico/entidades/busca` com o termo cru, medindo: quantas entidades retornam por consulta, se há paginação e como paginar.

**Reprova o portão se** a busca não permitir recuperar **mais de 20 citantes distintos** para nenhum dos 3 casos — seja por teto de resultados sem paginação, seja por paginação que não avança. Nesse caso a colheita dirigida morre como desenhada, e a resposta passa a ser A (ou a variante de volume cego, fora do escopo).

### 3.2 Portão 2 — quantos citantes colhidos são novos?

Cruzar as chaves dos citantes retornados contra os acórdãos já no acervo (`Document` com `tcuNumeroAcordao`).

**Reprova o portão se**, nos 3 casos somados, **menos de 30% dos citantes colhidos forem novos** (isto é, ≥70% já estarem no acervo): significa que o grafo já está próximo do completo e a opção C não tem de onde extrair ganho.

O limiar de 30% não é arbitrário: abaixo dele, mesmo uma colheita perfeita aumentaria o dossiê em menos da metade, o que não muda a faixa de 2–4 citações-no-voto o suficiente para tirar o motor do silêncio.

Este é o número mais informativo do probe inteiro e custa uma consulta HTTP mais um `SELECT`. Precisa ser medido e reportado **antes** de qualquer destilação, para os três casos.

### 3.3 Portão 3 — dá para obter o inteiro teor de um citante arbitrário?

**Descoberto ao detalhar o plano de implementação (2026-07-20); o desenho original assumia que sim, sem base.**

O download do inteiro teor (`lib/tcu/inteiro-teor-fetch.ts`) exige a URL guardada em `Document.tcuLinkPDF`, que aponta para `contas.tcu.gov.br/sagas/SvlVisualizarRelVotoAcRtf?...&item0=910941` (ou `ObterDocumentoSisdoc?...&codArqCatalogado=…`). Esse identificador é **interno e opaco**: não é derivável de número/ano.

Ele chega ao banco pela API de dados abertos (`dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos`, campo `urlArquivoPDF`/`urlArquivo`), que o cron `sync-tcu-acordaos` consome como **feed dos mais recentes** (`?inicio=0&quantidade=500`) — sem consulta por número/ano. Para um citante histórico arbitrário, portanto, **não há rota conhecida hoje** para chegar ao RTF.

Duas rotas candidatas, a testar nesta ordem:
1. **Payload da busca** — a entidade retornada pela busca pode já trazer campos além dos que `parseEntidade` consome (que hoje usa só `titulo`, `subtitulo`, `texto`, `link`). Mais barato de verificar.
2. **Página do documento** — `https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-NNNN` tem botão de download do RTF; extrair a URL de lá.

**Reprova o portão se** nenhuma das duas rotas produzir o inteiro teor de um acórdão histórico escolhido ao acaso. Sem inteiro teor do citante não há seccionamento, não há recorte de trecho e não há dossiê — a opção C fica sem meio de execução, independentemente dos portões 1 e 2.

Este é o portão mais provável de reprovar e o mais barato de testar. Deve ser o **primeiro** a rodar.

## 4. Seleção dos casos — regra mecânica, travada antes do resultado

A regra foi fixada e executada contra o grafo **antes** de qualquer destilação, e os casos resultantes estão nomeados abaixo. Nomear os casos na spec elimina a possibilidade de re-selecionar depois de ver o resultado — é a lição de `feedback_eval_ground_truth_bias` aplicada a este experimento: escolher os casos depois de saber quais funcionam transforma o probe em profecia autorrealizável.

**Regra:** agrupar `AcordaoCitacao` por `(numeroAlvo, anoAlvo)`; manter os que têm `citadoPor ≥ 20` **e** `citadoNoVoto` entre 2 e 4; ordenar por `citadoPor` decrescente; tomar os 3 primeiros.

**Resultado (12 candidatos no total; os 3 selecionados):**

| # | Caso | Citado por | No voto |
|---|---|---|---|
| 1 | **2219/2023** | 121 | 2 |
| 2 | **1009/2018** | 114 | 3 |
| 3 | **3648/2013** | 105 | 4 |

Se um caso for tecnicamente inviável (não resolve na busca do TCU, inteiro teor indisponível), substitui-se pelo **próximo da lista ordenada** — nunca por escolha discricionária. A lista de reserva, na ordem: 1019/2008, 11762/2018, 2012/2022.

## 5. Pipeline

Todo o encadeamento já existe em `lib/tcu/`; o probe é um script que orquestra os módulos, sem código de produção novo além do colhedor (§7).

### 5.1 Baseline "antes"

Destilar os 3 casos com o dossiê atual, via o mesmo caminho da Fase 2-A: `trechos-de-citacao.ts` (recorte + `montarDossie`) → `buscar-acordao-tcu.ts` (ementa própria) → `destilar-tese.ts`.

Resultado esperado: `teses: []` ou `confianca: "baixa"`. **Isso é resultado, não falha** — é o termo de comparação.

### 5.2 Colheita dirigida

Para cada caso, para cada citante retornado pela busca: baixar o inteiro teor (`inteiro-teor-fetch.ts`) → `rtf-to-text.ts` → `seccionar-acordao.ts` → `extrair-arestas-precedentes.ts` → `trechos-de-citacao.ts`.

Restrições: **1 req/s** contra o TCU; texto e trechos em arquivo sob `docs/audits/`, **nada no banco**; idempotente por chave de acórdão (re-execução não rebaixa nem duplica).

### 5.3 Destilação "depois"

Redestilar os 3 casos com o dossiê engordado — mesmo prompt, mesmos parâmetros da Fase 2-A. `maxTokens: 4096` (2048 trunca o JSON em dossiê rico — lição da Fase 2-A) e **sem `temperature`** (o modelo de `enhancement` a depreciou; passá-la retorna HTTP 400).

### 5.4 Controle de variável

A única coisa que muda entre "antes" e "depois" é o **conteúdo do dossiê**. Prompt, modelo, parâmetros e ementa própria permanecem idênticos. Qualquer outra alteração invalida a comparação.

### 5.5 Métricas duras (automáticas, por caso, antes → depois)

| Métrica | Por que importa |
|---|---|
| Citantes colhidos / novos / já no acervo | Mede o portão 2 |
| Citantes **no voto** antes → depois | O insumo real da tese |
| Trechos no dossiê antes → depois | Volume do insumo |
| **Taxa de citação-no-voto entre os colhidos** | Separa subamostrado de ornamental (§8.1) |
| Teses produzidas antes → depois | Saída do motor |
| `confianca` antes → depois | Autoavaliação do motor |

## 6. Folha de calibração — julgamento cego

Formato de card aprovado pelo Daniel (`feedback-formato-golden-julgamento`): um card por tese, enunciado em destaque, trecho-fonte literal, veredito de três vias, resumo que volta no export.

**Mudança em relação à folha da Fase 2-A:** os cards de "antes" e "depois" aparecem **embaralhados e sem rótulo de origem**. O Daniel julga cada tese em termos absolutos — fiel / imprecisa / errada — sem saber qual dossiê a gerou. A revelação só acontece depois do export.

Na Fase 2-A os cards vinham rotulados e isso era inofensivo, porque não havia comparação em jogo. Aqui há: saber que um card é "a versão com mais dados" enviesa o julgamento a favor dele. A ordem do embaralhamento é derivada de uma semente fixa registrada no relatório, para que o mapeamento card→origem seja reconstituível na revelação.

## 7. Componentes e limites

| Componente | Responsabilidade | Estado |
|---|---|---|
| `lib/tcu/colher-citantes.ts` | **Novo.** Dada a chave de um acórdão, consultar a busca do TCU, paginar e devolver as chaves dos citantes. Puro na formatação, I/O isolado e testável com resposta gravada. ⚠️ **Não pode reusar `buscarAcordaoPorNumero`**: aquela função filtra o resultado por `numero === alvo && ano === alvo`, descartando exatamente as outras entidades — que são os citantes. | a criar |
| `lib/tcu/inteiro-teor-por-chave.ts` | **Novo.** Dada a chave/link de um acórdão, resolver a URL do RTF pela rota aprovada no portão 3 (§3.3) e devolver o texto. Só existe se o portão 3 passar. | a criar |
| `lib/tcu/buscar-acordao-tcu.ts` | Busca na API do TCU (`text/plain`) | existe |
| `lib/tcu/inteiro-teor-fetch.ts`, `rtf-to-text.ts`, `seccionar-acordao.ts` | Obter e seccionar o inteiro teor | existe |
| `lib/tcu/extrair-arestas-precedentes.ts` | Extrair citações do texto seccionado | existe |
| `lib/tcu/trechos-de-citacao.ts` | Recortar contexto e montar o dossiê | existe |
| `lib/tcu/destilar-tese.ts` | Destilar a tese via LLM | existe |
| `scripts/probe-colheita-citantes.ts` | **Novo.** Orquestra portões → baseline → colheita → redestilação → JSON de resultados | a criar |
| `scripts/build-folha-colheita.mjs` | **Novo.** Gera a folha cega a partir do JSON | a criar |

O único módulo de produção novo é `colher-citantes.ts`; ele tem uma responsabilidade só (chave → lista de citantes) e não conhece destilação, dossiê nem banco.

## 8. Riscos

### 8.1 Ornamental vs. subamostrado — o risco principal

Os 3 casos selecionados têm perfil chamativo: **muito citados (100+) e quase nunca no voto**. Há duas explicações concorrentes:

- **Subamostrado:** existem votos que o invocam como fundamento, mas os acórdãos que os contêm não estão no nosso acervo. A colheita resolve.
- **Ornamental:** o caso é genuinamente citado de passagem (listagens, relatório, notas), e quase nunca é razão de decidir. A colheita traz mais menções ornamentais e nada muda.

É o mesmo "ornamental vs. substancial" que já apareceu na análise de princípios e no seccionamento. A métrica que separa os dois é a **taxa de citação-no-voto entre os citantes colhidos**, comparada com a taxa atual do caso: se a colheita traz 30 citantes novos e a proporção no voto continua ~2%, o caso é ornamental, não subamostrado.

Isso pode produzir um resultado legítimo em que a colheita funciona tecnicamente (traz citantes novos) e mesmo assim não gera tese. O relatório deve distinguir os dois diagnósticos explicitamente, porque eles levam a conclusões opostas sobre a opção C.

### 8.2 Alucinação por volume

Mais trechos podem levar o motor a fabricar tese onde antes se calava — o oposto do ganho pretendido. Coberto pelo critério de NO-GO (§9): teses julgadas imprecisas/erradas no "depois" são um resultado **pior** que silêncio.

### 8.3 Ruído da busca full-text

Buscar `"2219/2023"` pode retornar documentos que contêm os números por outro motivo. Mitigação: cada citante colhido só entra no dossiê depois que `extrair-arestas-precedentes` confirma a citação no texto seccionado — a mesma extração que sustenta o grafo, com 0 falso positivo medido no probe da Fase 0.

### 8.4 Desambiguação de colegiado

O mesmo número/ano pode corresponder a acórdãos de colegiados diferentes. Já é limitação conhecida do grafo (`colegiadoAlvo` é opcional). O probe herda a limitação e a registra; não a resolve.

## 9. Critério de GO/NO-GO — fixado antes da execução

- **GO para a opção C:** em **pelo menos 2 dos 3 casos**, o "depois" produz ao menos uma tese julgada **fiel** onde o "antes" não produzia nenhuma tese fiel.
- **NO-GO:** o "depois" não melhora; **ou** melhora em quantidade produzindo teses julgadas **imprecisa/errada** (§8.2), o que mataria a opção C de forma definitiva.
- **Resultado intermediário** (1 de 3): não é GO. Reporta-se como tal e a decisão volta ao Daniel com o diagnóstico de §8.1, sem reinterpretar o critério.

Qualquer portão de §3 reprovado encerra o probe antes da destilação, com o motivo registrado.

## 10. O que este probe não responde

- **A cauda profunda.** Os 62 casos com menos de 2 citações-no-voto não são testados. O probe cobre a faixa de 2 a 4, onde a virada é plausível. GO aqui **não** autoriza extrapolar para a cauda profunda.
- **O custo de escalar.** Tempo e volume da colheita para 100 casos são estimados a partir dos 3, não medidos.
- **Se os citantes devem virar `Document` indexado.** Decisão de retrieval, deliberadamente fora do escopo (§1.4).

## 11. Custo estimado do probe

6 destilações de LLM (3 antes + 3 depois) — trocados. Colheita: 3 casos × N citantes a 1 req/s. Nenhuma escrita no banco. Cabe em uma sessão.
