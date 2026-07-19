# Rede de precedentes do TCU — Fase 0 (Probe) — Design

**Data:** 2026-07-18
**Status:** aprovado (brainstorming) — pronto para plano de implementação
**Autor:** brainstorming Daniel + Claude
**Escopo deste spec:** SÓ a Fase 0 (probe de medição, R$0, nada persistido). As Fases 1-3 estão esboçadas como roadmap e ganharão specs próprios após os números do probe.

---

## 1. Contexto e objetivo

Nos acórdãos do TCU, a área técnica e o relator aludem a **precedentes** — outros acórdãos que fixaram a tese sobre um assunto. Agora que o **inteiro teor já está armazenado e seccionado** (campanha de jul/2026, merge `51ba4e05`), é barato extrair essas citações ("Acórdão N/AAAA") e montar uma **rede dirigida de precedentes**: `este acórdão → cita aqueles`.

**Valor pretendido (três frentes, aprovadas pelo Daniel):**
1. **Autoridade / linhagem** — "este acórdão é citado por N outros" identifica o *leading case*.
2. **Retrieval** — a busca (do Daniel e da IA) pode seguir a cadeia de citações e trazer o leading case junto.
3. **Navegação / curadoria editorial** — o Daniel visualiza a cadeia de precedentes de um assunto/artigo.

**Sequência técnica (decidida por: "as três frentes, na sequência que ficar melhor para o sistema"):**

```
Fase 0 — Probe (mede, não constrói)   ← ESTE SPEC
Fase 1 — Autoridade (persiste o grafo + contagem de entrada)
Fase 2 — Navegação (tela de curadoria)
Fase 3 — Retrieval (usa o grafo na busca/IA, com eval)
```

**Por que probe primeiro (lição do handoff):** o [[bia-8-graphrag-gate]] (GraphRAG) foi NO-GO porque construímos a intuição mas medimos o valor com uma sonda R$0 **antes** de erguer infra de grafo — e a sonda matou o projeto barato. A regra vale aqui: **provar valor com evidência antes de construir a infra de grafo.** A rede de precedentes NÃO é o GraphRAG arquivado (aquele era multi-hop de *legislação*; este é sinal de autoridade entre *julgados*), mas herda o método.

## 2. Decisões de design tomadas no brainstorming

- **Ponderação por seção = "tudo conta, voto pesa mais".** Toda citação vira uma aresta, mas cada aresta guarda **em que seção caiu** (voto / relatório / dispositivo) e a autoridade pondera com peso maior para as do voto. Nada é descartado. O **peso exato é calibrado depois**, olhando a distribuição que o probe reporta (mesmo método que validou a razão de decidir — ver [[feedback-formato-golden-julgamento]]).
- **Fase 0 não persiste nada.** Só lê `tcuTextoCompleto` e produz um relatório. Sem migração, sem escrita no banco, sem rede (não re-baixa RTF).
- **Decomposição por sub-spec.** Fase 0 é autocontida e é um *gate*. Persistência (Json em `tcuAnalise` vs. model de arestas), tratamento de nós externos e superfícies de UI são decisões da Fase 1+, informadas pelos números — não desenhadas no escuro agora.
- **Fluxo contínuo é requisito de primeira classe (não opcional).** A extração de citações tem de funcionar tanto para o **passivo** (acervo já existente, catalogado ou não) quanto para as **futuras inclusões** de acórdãos — a base não pode voltar a crescer descatalogada, do mesmo modo que fechamos o fluxo no inteiro teor do TCU (ver [[rede-precedentes-tcu-ideia]] item 2 e a catalogação contínua). Isso é responsabilidade da **Fase 1** (a Fase 0 não persiste), mas condiciona uma decisão tomada **já na Fase 0**: o extrator é **um único módulo** (`lib/tcu/acordao-citation-extractor.ts`), usado no probe e depois reaproveitado no núcleo — o que é provado no probe é exatamente o que roda em produção, sem divergência probe↔prod.

## 3. Infraestrutura existente reaproveitada (mapa verificado no código)

| Necessidade | Onde já existe | Nota |
|---|---|---|
| Acórdãos + inteiro teor | `Document` (`category='acordao'`), campo `tcuTextoCompleto @db.Text` (`prisma/schema.prisma`) | Acórdãos são `Document`, **não** `TribunalDecision`. `tcuTextoCompleto` é "NÃO INDEXAR" — existe só p/ análise. |
| Padrão de extração de citações | `lib/lei-14133/citation-extractor.ts` → `extractCitations(text): Citation[]` | Regex + janela de contexto (`WINDOW=250`) + `index` do match. `BIND_OUTRA_NORMA` mostra como uma norma amarrada logo após vence a proximidade. |
| Seccionamento | `lib/tcu/seccionar-acordao.ts` → `seccionarAcordao(texto): Secoes` e `secaoDe(secoes, pos)` | `Secoes = { relatorio, voto, acordao }`, cada um offsets `[início, fim)`. `secaoDe(offset)` diz a seção de um match. |
| Contagem por seção (referência) | `lib/tcu/analise-relevancia.ts:122-131` | Já itera `extractCitations` e usa `secaoDe(c.index)` — replicar o padrão para acórdãos. |
| Normalização de nº de acórdão | `lib/tribunal-scrapers/utils.ts` → `normalizeDecisionNumber(raw)` | Remove prefixo/"nº" e **pontos de milhar** ("4.851/2017" → "4851/2017"). |
| Identificadores casáveis | `Document.acordaoNumero Int`, `acordaoAno Int` (índice `[category, acordaoNumero, acordaoAno]`); colegiado em `tcuOrgaoJulgador` | Unique de dedup = `(acordaoNumero, acordaoAno, tcuOrgaoJulgador)` — par nº/ano pode colidir entre colegiados. |
| Leitura em lote sem rede | `scripts/reanalyze-tcu.ts` | Molde do script do probe: lê `tcuTextoCompleto` já guardado, idempotente. |

**Não existe ainda:** extrator de "Acórdão N/AAAA", nenhum model de arestas, nenhum normalizador de nº de acórdão específico de `lib/tcu/` (usar o genérico de `tribunal-scrapers`).

## 4. Fase 0 — o Probe (escopo deste spec)

### 4.1 Componentes

**a) Extrator de citações de acórdão** — novo módulo `lib/tcu/acordao-citation-extractor.ts` (clone do padrão de `citation-extractor.ts`).
- Regex que casa as variantes de "Acórdão N/AAAA": `Acórdão`/`Acordão`/`AC`, `nº`/`n.`/`n°`/nada, número com pontos de milhar, `/AAAA`, e opcionalmente `-Plenário` / `-1ª Câmara` / `-TCU`. Ex. a cobrir: `"Acórdão 4851/2017"`, `"AC 4.851/2017-TCU"`, `"Acórdão nº 4.851/2017-Plenário"`, `"Acórdãos 1/2020 e 2/2020"` (cauda de lista).
- Retorna `Citation[]` com `{ numeroRaw, numero, ano, colegiado?, index }` (o `index` é o offset no texto, para o `secaoDe`).
- **Testes** (`acordao-citation-extractor.test.ts`) com um corpus de formatos reais + casos que NÃO devem casar (ex.: "acórdão recorrido", "o presente acórdão", datas soltas).
- **Guarda contra auto-citação:** descartar citações cujo `(numero, ano[, colegiado])` = o próprio acórdão sendo analisado.
- **Módulo único, reaproveitado na Fase 1.** Este é o mesmo módulo que o núcleo `lib/tcu/catalogar-acordao.ts` chamará em produção (ver §5, Fase 1). Ele nasce puro (recebe texto, devolve `Citation[]`, sem acesso a banco/rede) justamente para servir aos dois consumidores — probe e pipeline — sem divergir. **O que o probe validar é o que rodará no fluxo contínuo.**

**b) Script do probe** — `scripts/probe-precedentes-tcu.ts` (molde `reanalyze-tcu.ts`, sem escrita).
- Lê os `Document` com `category='acordao'` e `tcuTextoCompleto not null` (~1.685).
- Para cada um: `extractCitations` → para cada citação, `secaoDe(index)` para a seção → `normalizeDecisionNumber` + split `/` → tenta casar `(numero, ano)` contra a base (com e sem colegiado).
- Acumula em memória: densidade, distribuição por seção, casamento interno vs. externo, contagem de entrada por acórdão (autoridade preliminar), e uma amostra estratificada de citações com trecho real.
- Saída: um JSON em `docs/audits/` **e** os dados para o relatório de calibração (artifact).

### 4.2 O relatório do probe (folha de calibração — artifact)

Segue [[feedback-formato-golden-julgamento]]. Cinco blocos:

1. **Densidade** — citações/acórdão (média, mediana, histograma); % de acórdãos que citam ≥1 outro.
2. **Distribuição por seção** — % das citações em voto / relatório / dispositivo. *(É o que calibra o "voto pesa mais".)*
3. **Taxa de casamento** — citações que apontam para um acórdão na base vs. "externas" (não temos). Revela **lacunas do acervo**.
4. **Amostra para julgar a regex** — ~30-40 citações com o trecho real ao redor, incluindo casos ambíguos, para validar precisão/recall da extração (o Daniel julga qualidade).
5. **Ranking preliminar de leading cases** — acórdãos mais citados por outros (incluindo externos) — o Daniel fareja se a autoridade "faz sentido juridicamente".

### 4.3 Critério de decisão (gate para a Fase 1)

O probe é conclusivo quando o relatório responde, com número na mão:
- **A extração é confiável?** (a amostra do bloco 4 mostra precisão alta, sem inventar nem perder citações óbvias).
- **Há sinal de autoridade?** (o ranking do bloco 5 tem leading cases plausíveis; a densidade do bloco 1 não é ~zero).
- **Vale persistir o grafo?** Decisão explícita GO / NO-GO / adiado, registrada como o BIA-8 foi.

Se GO, a Fase 1 abre com seu próprio spec (modelo de dados: nós externos, arestas com seção/peso, onde persistir).

## 5. Roadmap das fases seguintes (esboço — NÃO neste spec)

- **Fase 1 — Autoridade + fluxo contínuo.** Persistir o grafo (decisão Json-em-`tcuAnalise` vs. model relacional de arestas fica para o spec da fase, conforme o probe). Contagem de entrada ponderada por seção. Tratar nós externos (acórdãos citados que não temos) — o probe diz se valem a pena.

  **Fluxo contínuo (obrigatório — espelha a catalogação contínua do inteiro teor):** a extração entra **no núcleo compartilhado** `lib/tcu/catalogar-acordao.ts`, que já é o caminho único de cron e backfill. Um só ponto de escrita cobre os três casos:
  - **Passivo já catalogado** (`tcuAnalise` numa versão antiga): bumpar `ANALISE_VERSAO` e rodar `scripts/reanalyze-tcu.ts` uma vez — reprocessa do `tcuTextoCompleto` já guardado, sem rede.
  - **Passivo ainda não catalogado** (`tcuAnalise IS NULL`): já é a fila do cron `catalog-tcu-inteiro-teor`; com a extração no núcleo, sai catalogado **com** as citações na primeira passada.
  - **Futuras inclusões:** o cron `sync-tcu-acordaos` cria o `Document`; o `catalog-tcu-inteiro-teor` cataloga — e agora extrai as citações no mesmo passo. Nada entra descatalogado.

  ⚠️ **Armadilha conhecida (já anotada):** o cron filtra `tcuAnalise IS NULL`; ao subir a `ANALISE_VERSAO`, os acórdãos já catalogados em versão anterior **não** são repescados pelo cron — **só o backfill reprocessa por versão**. Por isso o `reanalyze-tcu.ts` do passivo é passo obrigatório do rollout, não opcional. Cobrir com os auditores nos dois sentidos (ver [[feedback-auditores-cegos]]).
- **Fase 2 — Navegação/curadoria.** Superfície para o Daniel ver a cadeia de precedentes (por acórdão e/ou por artigo).
- **Fase 3 — Retrieval.** Usar o grafo na busca/IA, provado por `eval:run`/`eval:synthesis` (a trilha de retrieval está "fechada com evidência" — só reabre com ganho medido).

## 6. Riscos

- **Falsos positivos da regex** — "acórdão recorrido/embargado", "o presente acórdão", números que são datas ou processos. Mitigação: corpus de testes com casos negativos + bloco 4 do relatório para julgamento humano.
- **Ornamental vs. substancial** — citar não é fundamentar. Mitigado por design (seção registrada; voto pesa mais) e medido no bloco 2.
- **Colisão de identificador** — par `(nº, ano)` pode existir em colegiados diferentes; a citação textual nem sempre traz o colegiado. Mitigação: casar por `(nº, ano)` e, quando a citação trouxer colegiado, refinar; reportar taxa de ambiguidade no probe.
- **Auto-citação e citação da própria série** (embargos, pedido de reexame que transcreve o acórdão recorrido) — descartar auto-citação; a assimetria de seccionamento já corrigida ajuda.

## 7. Fora de escopo (YAGNI para a Fase 0)

- Qualquer escrita no banco, migração de schema ou model de arestas.
- Qualquer UI ou mudança na Lei Comentada / busca.
- Re-download de inteiro teor (usa só o `tcuTextoCompleto` já guardado).
- Citações a normas, súmulas ou outros tribunais — só "Acórdão N/AAAA" do próprio TCU nesta fase.
