# Failure Analysis — 2026-04-23

- **Run fonte:** C:/Projeto de site do Barral/sitedobarral-stripe/eval/reports/2026-04-23T12-46-32_diag-fase0.json
- **Escopo:** 29 queries com recall@5 ≤ 20%
- **Metodologia:** `eval/scripts/analyze-failures.ts` (ver "Como reproduzir")
- **Revisão manual:** concluída em 2026-04-23 (discussão caso-a-caso dos 5 vermelhos + 7 amarelos + 1 C-parcial).

## Distribuição por bucket

| Bucket | Auto | Após review | Fase sugerida |
|---|---|---|---|
| A | 5 | 2 | Fase 1 (HyDE) + Fase 3 (embedding) |
| A' | 2 | 2 | Fase 4 (tuning FTS) |
| B | 10 | 7 | Fase 3 (embedding) ou Fase 5 (chunking) |
| C | 0 | 0 | Fix scraper / re-rodar migrate-to-embeddings |
| C-parcial | 1 | 0 | Fix scraper / re-rodar migrate-to-embeddings (parcial) |
| D | 2 | 1 | Fase 2 (rerank) ou Fase 4 (hybrid tuning) |
| D+ | 9 | 9 | Fase 2 (rerank) — alta confiança |
| E. Anotação suspeita | — | 8 | Fase 6 |

**Total:** 29 queries; 28 classificadas + 1 com tag adicional de cleanup (q-data-a-data).

## Achado principal

**28% das falhas (8 de 29) têm origem no golden set, não no retrieval.** A auditoria do golden (Fase 6) deixa de ser etapa tardia e vira **pré-requisito** — rodar experimentos de retrieval sobre um golden contaminado é desperdício.

Padrão sistemático observado: o golden aponta frequentemente para documentos "clássicos" (ONs AGU, Súmulas TCU pré-2021) quando o retriever encontra — e muitas vezes ranqueia em top-5 — a resposta moderna correspondente (Art. da Lei 14.133/2021 literal, Manual TCU, IN SEGES/ME nova). Ambos respondem à tese, mas o golden só anotou o clássico. Outro padrão: **q-data-a-data** tem 2 IDs fantasma (`96cbdacf`, `097d3cdb` — não existem mais no banco).

## Recomendação de ordem revisada das fases

1. **Fase 6 (auditoria do golden set) — prioridade máxima.** 8 queries em E + 1 cleanup = 31% do escopo. Reanotar expandindo "relevant" para incluir docs modernos equivalentes (art. literal da nova lei, Manuais TCU, INs vigentes), remover IDs fantasma, e re-rodar todo o eval sobre golden limpo. Sem isso, métricas de fases futuras são ruído.
2. **Fase 2 (cross-encoder rerank) — 2º.** 10 queries em D/D+ (34%) têm doc anotado em pos 6-20. Reranker é a intervenção de maior ROI para retrieval "real". Já há adaptador `rerankSearch` pronto em `eval/search-adapter.ts` — é rodar e medir.
3. **Fase 1 (HyDE) — 3º.** Complementar, barato, já implementado. 2 A + 2 A' + 7 B = 11 queries onde o vetor não aproxima. HyDE pode ajudar um subset sem custo de refatoração.
4. **Fase 3 (trocar modelo de embeddings) — 4º.** Ativar se Fase 2 + Fase 1 juntos não atingirem a meta de 50% recall@5. 7 queries em B (paráfrase pura, vetor distante do doc canônico) são o sinal mais forte pró-Fase 3. Custo alto de migração; só encarar depois de esgotar o barato.
5. **Fase 4 (tuning FTS) — 5º.** 2 queries em A' indicam peso FTS subótimo para termos presentes literalmente no doc. Barato e pontual.
6. **Fase 5 (chunking) — arquivar.** Zero sinal específico de que chunking é o problema nas 29 queries. Deixar fora do roadmap até nova evidência.

## Follow-ups de infraestrutura (fora do ciclo de fases)

- **Heurística de key-terms tem gap:** não captura expressões multi-palavra em caixa-baixa como "data a data", "dedicação exclusiva", "escopo". Expandir `eval/scripts/failure-analysis/key-terms.ts` com léxico jurídico ou reclassificação manual ao final de cada run.
- **Deduplicação no banco:** `esp-785767-20` evidenciou que "ON 89/2024" existe como doc duplicado com IDs distintos. Investigar se há mais pares assim (afeta tanto busca quanto golden).

## Drill-down por query

### q-data-a-data — bucket C-parcial → **A + cleanup**
- **Query:** sistema data a data
- **Difficulty:** hard
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** — (96cbdacf, chunks=0); Inf. 465/2023 — Definir marco temporal correto para reajuste contratual em licitações (ce817fb1, chunks=6); DECOR PARECER n. 00019/2024/CNLCA/CGU/AGU (ae92b5a7, chunks=1); Resposta a Consulta — Acórdão AC-1296/11-P (6c690202, chunks=1); Resposta a Consulta — Acórdão AC-0911/19-P (f29d4d7b, chunks=1); — (097d3cdb, chunks=0); Art. 132 - Lei 14.133/2021 (0eb5c8f1, chunks=1)
- **Key terms:** —
- **Posição top-100:** 29
- **Top-5 retornados:** Inf. 90/2012 || Inf. 455/2023 || Inf. 272/2016 || Inf. 24/2010 || Art. 114 - Lei 14.133/2021
- **Por que C-parcial:** alguns docs relevantes não têm chunks (indexação parcial)
- **Bucket review:** **A + cleanup.** Inspeção no DB revelou que os 2 IDs sem chunks (96cbdacf, 097d3cdb) **não existem no banco** — são anotações stale. Removê-los do golden. Com o cleanup, a query passa a ter 5 relevantes todos indexados, e a falha real é de retrieval: "sistema data a data" é jargão jurídico específico que o embedding não captura. A heurística classificou C-parcial pelos sintomas (IDs fantasma); a causa raiz é terminologia multi-palavra minúscula que o regex de key-terms não pega.

### q-sancoes-impedimento-licitar — bucket D+
- **Query:** sanções impedimento de licitar e contratar
- **Difficulty:** medium
- **recall@5 / MRR:** 20.0% / 0.500
- **Doc(s) esperado(s):** 10 docs (Manual TCU 5.8, Manual TCU 6.1.8, ON 2/2009, 7 Inf.s)
- **Posição top-100:** —
- **Top-5 retornados:** Inf. 399/2020 || **Manual TCU - 5.8** || Inf. 209/2014 || **Manual TCU - 6.1.8** || Inf. 237/2015
- **Por que D+:** doc relevante em pos 2 (ranking parcial — outros 8 relevantes fora do top-5)
- **Bucket review:** **confirmado D+.** 2 dos 10 relevantes aparecem no top-5 (pos 2 e 4), mas recall@5 segue baixo por causa dos outros 8. Rerank + expansão do limit ajudariam.

### t-garantia-modalidade-01 — bucket D+
- **Query:** garantia contratual só pode ser prestada nas modalidades de caução...
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.167
- **Doc(s) esperado(s):** Acórdão TCU 597/2023 (f71cc1cd, chunks=1)
- **Posição top-100:** —
- **Top-5 retornados:** Manual TCU 5.11.2 Garantias || Portaria-TCU 122/2023 || Inf. 99/2012 || Inf. 108/2012 || Inf. 334/2017
- **Por que D+:** doc relevante em posição 6
- **Bucket review:** **confirmado D+.** Pos 6 indica rerank resolveria. Manual TCU 5.11.2 no top-1 é contexto adjacente, mas o Acórdão 597/2023 é o doc canônico específico da tese.

### t-pesquisa-ferramenta-privada-01 — bucket B
- **Query:** utilização de ferramenta privada de pesquisa de preços (Banco de Preços, Cotação Zênite...)
- **Difficulty:** easy
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** IN SEGES/ME 65/2021 (fedc9e92, chunks=8)
- **Posição top-100:** —
- **Top-5 retornados:** Orientação Normativa CNU/CGU/AGU nº 04/2016 || 4 Inf.s sobre pesquisa de preços
- **Por que B:** doc indexado, vetor não aproxima o bastante
- **Bucket review:** **confirmado B.** IN 65/2021 é a resposta correta específica (trata de ferramentas privadas no art. 5º §1º) e não apareceu no top-100. Sinal puro de paráfrase vetorial.

### t-pesquisa-precos-in65-01 — bucket A → **E**
- **Query:** pesquisa de preços deve observar os parâmetros do art. 23, §1º, da Lei 14.133/2021 e do art. 5º da IN SEGES/ME 65/2021...
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Orientação Normativa AGU nº 17/2009 (845a2f3e, chunks=1)
- **Key terms:** 14.133/2021, art. 23, art. 5, IN SEGES/ME 65/2021, IN, SEGES, ME
- **Top-5 retornados:** **IN SEGES/ME 65/2021** (top-1) || 4 capítulos do Manual TCU sobre pesquisa de preços
- **Por que A:** key terms ausentes do content do doc esperado
- **Bucket review:** **E (anotação incompleta).** Top-1 é literalmente a IN que a query cita. Expected é ON AGU de 2009 — 12 anos mais antiga que a IN, tema afim mas fonte normativa superada. Anotar IN 65/2021 e Manual TCU como relevantes resolve a query sem mexer no retrieval.

### t-eng-bdi-irpj-csll-01 — bucket D → **E**
- **Query:** vedada a inclusão das parcelas relativas ao IRPJ e à CSLL na composição do BDI...
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.083
- **Doc(s) esperado(s):** Súmula TCU nº 254 (47f91ef1, chunks=1)
- **Key terms:** IRPJ, CSLL, BDI (todos presentes no expected e no top-5)
- **Posição top-100:** —
- **Top-5 retornados:** Inf. 279/2016 || Inf. 12/2010 || **Inf. 17/2010 — Vedação da inclusão de IRPJ e CSLL no BDI** || Inf. 44/2010 || Inf. 222/2014
- **Por que D:** doc relevante em pos 12
- **Bucket review:** **E.** Top-5 inteiro responde à tese da Súmula 254 — especialmente Inf. 17/2010 que tem ementa quase idêntica à query. Anotar esses Inf.s como relevantes elevaria recall@5 sem retrieval change.

### t-contrato-escopo-on92-01 — bucket D+
- **Query:** Contratos de escopo, cujo objeto é a entrega de produto ou resultado determinado, têm vigência adstrita ao prazo
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.125
- **Doc(s) esperado(s):** ON 92/2024 (4ce3acbb, chunks=1)
- **Posição top-100:** —
- **Top-5 retornados:** Manual TCU 5.11.5 Duração || Inf. 203/2014 || Inf. 272/2016 || DECOR PARECER sobre ON 92/2024 || Inf. 44/2010
- **Por que D+:** doc relevante em pos 8
- **Bucket review:** **confirmado D+.** Rerank resolveria. Top-5[3] é um DECOR PARECER *sobre* a ON 92/2024 — adjacente mas não é a ON em si.

### t-terceirizacao-art48-01 — bucket B → **E**
- **Query:** vedada a contratação, por meio de terceirização, de atividades que envolvam a tomada de decisão ou posicionamento
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Súmula TCU nº 269 (2b9515a0, chunks=1)
- **Posição top-100:** — (fora do top-100)
- **Top-5 retornados:** **Inf. 114/2012 — Proibir licitação para terceirização de atividade-fim administrativa** || 4 Inf.s adjacentes sobre terceirização
- **Por que B:** doc indexado, vetor não aproxima
- **Bucket review:** **E.** Top-5[0] Inf. 114/2012 responde à query com o mesmo raciocínio da Súmula 269. Anotação incompleta.

### t-pcfp-cct-vigente-01 — bucket B
- **Query:** planilha de custos e formação de preços, nos contratos com dedicação exclusiva de mão de obra...
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** ON 63/2020 (5dc5ae72, chunks=1)
- **Posição top-100:** 36
- **Top-5 retornados:** Portaria-TCU 122/2023 || Manual TCU 4.3.9.3 || Orientação nº 29 || Inf. 485/2024 || AC-1207/24-P
- **Por que B:** vetor não aproxima
- **Bucket review:** **confirmado B.** ON 63/2020 está em pos 36 — retrieval realmente não acha. Top-5 adjacente mas não equivalente.

### esp-451193-3 — bucket D+
- **Query:** acréscimos e as supressões do objeto contratual devem ser calculados sobre o valor inicial atualizado do contrato
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.111
- **Doc(s) esperado(s):** Orientação Normativa AGU nº 50/2014 (471684ee, chunks=1)
- **Posição top-100:** —
- **Top-5 retornados:** Manual TCU 6.2.1 Unilateral || 4 Inf.s sobre alterações contratuais
- **Por que D+:** doc relevante em pos 9
- **Bucket review:** **confirmado D+.** Rerank deve resolver.

### esp-518661-2 — bucket A → **E**
- **Query:** contratação do remanescente de obra, serviço ou fornecimento, prevista no art. 75, III, da Lei nº 14.133/2021, deve ser
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Orientação Normativa AGU nº 2/2009 (9add63a3, chunks=1)
- **Key terms:** 14.133/2021, art. 75, III (nenhum no doc esperado)
- **Top-5 retornados:** **Acórdão TCU 1498/2021 - Dispensa - Remanescente de contrato** || 4 Inf.s sobre remanescente de obra
- **Por que A:** key terms ausentes do content do doc esperado
- **Bucket review:** **E (anotação colada errada).** ON 2/2009 é sobre parecer jurídico obrigatório — tema diferente. Top-5 inteiro é sobre remanescente de obra, responde perfeitamente. A anotação parece ter sido replicada equivocadamente entre esta query e a esp-518661-1.

### esp-518661-1 — bucket B
- **Query:** consulta jurídica facultativa formulada em processo autônomo, desvinculada dos autos da contratação subjacente, impede
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Orientação Normativa AGU nº 2/2009 (9add63a3, chunks=1)
- **Posição top-100:** —
- **Top-5 retornados:** 5 Inf.s sobre parecer jurídico em licitações
- **Por que B:** vetor não aproxima
- **Bucket review:** **confirmado B.** ON 2/2009 é doc decisivo para a tese "consulta facultativa em processo autônomo" — top-5 traz temas adjacentes (responsabilidade do parecerista, vinculação) mas não cobre a tese específica. Retrieval falhou de verdade.

### esp-640788-17 — bucket A'
- **Query:** parcelamento do objeto nas contratações de TIC é a regra, somente se admitindo a adjudicação por lote ou global quando
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Súmula TCU nº 247 (03c1afd0, chunks=1)
- **Key terms:** TIC (presente no expected e top-5)
- **Posição top-100:** 44
- **Top-5 retornados:** 5 Inf.s sobre parcelamento/adjudicação
- **Por que A':** key terms presentes no doc, doc fora do top-100
- **Bucket review:** **confirmado A'.** Pos 44 indica que FTS deveria ter pego "TIC" + "parcelamento". Tuning de peso FTS é a jogada.

### esp-647772-7 — bucket A'
- **Query:** adoção do SRP em inexigibilidade para capacitação exige pluralidade efetiva de órgãos ou entidades contratantes
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Decreto 11.462/2023 (439bfdc0, chunks=27)
- **Key terms:** SRP (presente no expected)
- **Posição top-100:** — (fora do top-100)
- **Top-5 retornados:** Inf. 439/2022 || Inf. 508/2025 || DECOR PARECER 00039/2024 || Inf. 59/2011 || Inf. 264/2015
- **Por que A':** key terms presentes, doc fora do top-100
- **Bucket review:** **confirmado A'.** Decreto 11.462/2023 regulamenta SRP — deveria aparecer. Tuning FTS + possível bug no índice de Decretos vale investigar.

### esp-669066-13 — bucket B → **E**
- **Query:** adjudicação por itens é regra geral nas licitações de objeto divisível; o agrupamento em lote ou grupo depende de
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Súmula TCU nº 247 (03c1afd0, chunks=1)
- **Posição top-100:** 24
- **Top-5 retornados:** **Inf. 183/2014 — Adjudicar licitações por item em objetos divisíveis** || 4 Inf.s sobre adjudicação por item/lote
- **Por que B:** vetor não aproxima
- **Bucket review:** **E.** Inf.s do top-5 codificam a mesma tese da Súmula 247. Anotação incompleta.

### esp-728449-7 — bucket D+
- **Query:** fixação de preços máximos unitários e global e a definição de critérios de aceitabilidade dos preços são obrigatórias
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.143
- **Doc(s) esperado(s):** Súmula TCU nº 259 (d2831f21, chunks=1); ON AGU nº 5/2009 (c456890d, chunks=1)
- **Posição top-100:** —
- **Top-5 retornados:** 5 Inf.s sobre preços máximos / critérios de aceitabilidade
- **Por que D+:** doc relevante em pos 7
- **Bucket review:** **confirmado D+.** Rerank resolveria.

### esp-728449-12 — bucket B → **E**
- **Query:** elaboração de plantas, planilhas orçamentárias, composições de custos unitários, cronograma físico-financeiro e demais
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Súmula TCU nº 260 (17f6bcef, chunks=1)
- **Posição top-100:** — (fora do top-100)
- **Top-5 retornados:** **Manual TCU 4.4.3 Projeto Básico** || Inf. 220/2014 || Inf. 99/2012 || **Manual TCU 4.4.3.6 Orçamento detalhado** || Inf. 50/2011
- **Por que B:** vetor não aproxima
- **Bucket review:** **E.** Manual TCU 4.4.3 + 4.4.3.6 cobrem exatamente os elementos do projeto básico que a query descreve. Anotação incompleta.

### esp-729752-8 — bucket D+
- **Query:** edital de credenciamento e seus anexos devem ser integralmente disponibilizados no Portal Nacional de Contratações
- **Difficulty:** easy
- **recall@5 / MRR:** 0.0% / 0.125
- **Doc(s) esperado(s):** Decreto 11.878/2024 (c784628c, chunks=12)
- **Posição top-100:** —
- **Top-5 retornados:** Manual TCU 2.5 Transparência || Inf. 386/2020 || Manual TCU 5.9.1 Credenciamento || Inf. 162/2013 || —
- **Por que D+:** doc relevante em pos 8
- **Bucket review:** **confirmado D+.** Rerank resolveria. Top-5 cerca o tema (credenciamento + transparência) mas não traz o Decreto 11.878/2024 específico.

### esp-761729-4 — bucket B
- **Query:** Caracterizado o objeto como serviço comum pela Administração, mas presentes na instrução elementos típicos de serviço
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Súmula TCU nº 260 (17f6bcef, chunks=1)
- **Posição top-100:** —
- **Top-5 retornados:** 5 Inf.s sobre serviço comum vs. técnico em pregão
- **Por que B:** vetor não aproxima
- **Bucket review:** **confirmado B.** Tese da query (caracterização errada do objeto) é diferente das teses do top-5 (aplicação de pregão). Súmula 260 é específica e retrieval falhou.

### esp-765940-4 — bucket A
- **Query:** ELIC não se manifesta em consultas genéricas ou abstratas, em processos já contemplados por parecer referencial da ELIC
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** ON AGU nº 69/2021 (e31bc0c2); Decreto 11.246/2022 (871b05bc)
- **Key terms:** ELIC (ausente dos docs relevantes)
- **Top-5 retornados:** Inf. 218/2014 || ON 55/2014 || Inf. 218/2014 || AC-2633/14-P || ON 82/2024
- **Por que A:** key terms [ELIC] ausentes do content dos docs relevantes
- **Bucket review:** **confirmado A.** ELIC é terminologia específica (Escritório de Licitações/órgão consultivo em MG/DF). Docs federais anotados não usam a sigla. Query genuinamente difícil para retrieval genérico — HyDE pode ajudar ao expandir "ELIC" para "escritório consultivo de licitações".

### esp-782120-5 — bucket D+
- **Query:** Administração não se vincula às disposições de acordos, convenções ou dissídios coletivos que tratem de matérias não
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.100
- **Doc(s) esperado(s):** ON 63/2020 (5dc5ae72, chunks=1)
- **Posição top-100:** —
- **Top-5 retornados:** Parecer Vinculante JT-02 Repactuação || Inf. 485/2024 || Inf. 343/2018 || Inf. 216/2014 || Inf. 254/2015
- **Por que D+:** doc relevante em pos 10
- **Bucket review:** **confirmado D+.** Rerank resolveria.

### esp-785767-20 — bucket D+ (com nota dedup)
- **Query:** No pregão eletrônico para registro de preços, a vigência da ata é de até um ano, prorrogável por igual período desde
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.125
- **Doc(s) esperado(s):** ON AGU nº 89/2024 (13e9aea2, chunks=1)
- **Posição top-100:** —
- **Top-5 retornados:** Manual TCU 5.9.4 SRP || **ON 89/2024** (pos 2, ID diferente) || Inf. 188/2014 || Inf. 134/2012 || Art. 84 - Lei 14.133/2021
- **Por que D+:** doc relevante em pos 8
- **Bucket review:** **D+ mantido** com nota: ON 89/2024 existe no banco com dois IDs diferentes — a cópia em pos 2 é o mesmo documento que o expected em pos 8. Fix é deduplicação no DB, não retrieval. Vira input pra Fase 6 (auditoria inclui dedup).

### esp-789829-9 — bucket D
- **Query:** Administração não se vincula a cláusulas de instrumento coletivo que tratem de matéria não trabalhista, de participação
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.053
- **Doc(s) esperado(s):** ON 63/2020 (5dc5ae72, chunks=1)
- **Posição top-100:** —
- **Top-5 retornados:** 5 Inf.s sobre encargos/convenção coletiva em licitações
- **Por que D:** doc relevante em pos 19
- **Bucket review:** **confirmado D.** Rerank pode puxar de pos 19 para top-5, mas é caso mais marginal que os D+.

### esp-789829-8 — bucket B
- **Query:** Nas contratações de serviços comuns de engenharia com dedicação exclusiva de mão de obra, a planilha de custos e
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Decreto 12.174/2024 (3d72ba58, chunks=4); ON 63/2020 (5dc5ae72, chunks=1)
- **Posição top-100:** 39
- **Top-5 retornados:** Manual TCU 5.2 || Portaria-TCU 121/2023 || 3 Inf.s sobre planilha de custos
- **Por que B:** vetor não aproxima
- **Bucket review:** **confirmado B.** Decreto 12.174/2024 e ON 63/2020 são específicos, pos 39 no primeiro.

### esp-792741-1 — bucket A → **E**
- **Query:** limite de 25% do art. 125 da Lei 14.133/2021 aplica-se às alterações qualitativas e quantitativas, isoladamente ao
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Orientação Normativa AGU nº 50/2014 (471684ee, chunks=1)
- **Key terms:** 14.133/2021, art. 125 (ausentes do expected — ON é pré-2021)
- **Posição top-100:** 60
- **Top-5 retornados:** Acórdão TCU 2391/2025 - Aditivo - Limite || Inf. 516/2025 || Acórdão TCU 781/2021 || Inf. 476/2024 || **Art. 125 - Lei 14.133/2021**
- **Por que A:** key terms ausentes do expected
- **Bucket review:** **E.** Art. 125 literal em pos 5 + 2 Acórdãos TCU recentes sobre o limite de aditivos. Anotação aponta pra ON de 2014 (pré-Lei 14.133); top-5 tem as fontes atuais.

### esp-795204-10 — bucket D+
- **Query:** obrigatória a juntada de documento de responsabilidade técnica (ART, RRT ou TRT) referente às peças técnicas da
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.125
- **Doc(s) esperado(s):** Súmula TCU nº 260 (17f6bcef, chunks=1)
- **Key terms:** RRT, TRT (RRT presente no top-5, não no expected)
- **Posição top-100:** —
- **Top-5 retornados:** Inf. 440/2022 || Inf. 164/2013 || Inf. 379/2019 || Acórdão TCU 2353/2024 || Inf. 246/2015
- **Por que D+:** doc relevante em pos 8
- **Bucket review:** **confirmado D+.** Rerank resolveria.

### esp-797806-1 — bucket A → **E**
- **Query:** indicação de marca ou modelo no edital somente é admitida nas hipóteses taxativas do art. 41, I, da Lei 14.133/2021,
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Súmula TCU nº 270 (470a8111, chunks=1)
- **Key terms:** 14.133/2021, art. 41 (ausentes do expected; art. 41 presente no top-5)
- **Posição top-100:** —
- **Top-5 retornados:** **Art. 41 - Lei 14.133/2021** || Enunciado IBDA 27 || Enunciado IBDA 5 || Acórdão TCU 6875/2021 || Inf. 413/2021
- **Por que A:** key terms ausentes do expected
- **Bucket review:** **E.** Art. 41 literal em pos 1. Súmula 270 é pré-14.133 e foi absorvida/modernizada pelo art. 41 da nova lei. Top-5 entrega a resposta moderna correta.

### esp-800676-4 — bucket B
- **Query:** regra do parcelamento do objeto permanece aplicável mesmo em contratações por inexigibilidade quando o objeto comportar
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** Súmula TCU nº 247 (03c1afd0, chunks=1)
- **Posição top-100:** 56
- **Top-5 retornados:** 5 Inf.s sobre parcelamento de licitação
- **Por que B:** vetor não aproxima
- **Bucket review:** **confirmado B.** Query tem nuance específica ("mesmo em inexigibilidade") que os Inf.s do top-5 não cobrem — eles falam de parcelamento em licitação regular. Súmula 247 é o doc adequado e está em pos 56.

### esp-811212-11 — bucket B
- **Query:** Nas dispensas emergenciais que envolvam serviços com dedicação exclusiva de mão de obra, permanecem aplicáveis as
- **Difficulty:** medium
- **recall@5 / MRR:** 0.0% / 0.000
- **Doc(s) esperado(s):** IN SEGES/MGI 176/2024 (04a6f957, chunks=11)
- **Posição top-100:** 70
- **Top-5 retornados:** 5 docs sobre contratações continuadas / dispensa emergencial
- **Por que B:** vetor não aproxima
- **Bucket review:** **confirmado B.** IN 176/2024 é o doc correto e está em pos 70.

## Como reproduzir

```bash
npm run eval:run -- --label diag-fase0
npx dotenv -e .env.local -- tsx eval/scripts/analyze-failures.ts
# Para re-rodar sobrescrevendo: adicionar --force
```
