# Eval Run — pos-reprocessamento-completo

- **Run at:** 2026-04-23T02:25:41.578Z
- **Git SHA:** `dd10632`
- **Queries:** 53 annotated / 91 total (38 skipped)

## Aggregate metrics

| Metric | Value |
|---|---|
| Recall@5 (avg) | 34.1% |
| MRR | 0.352 |
| nDCG@10 (avg) | 0.367 |

## By difficulty

| Difficulty | N | Recall@5 | MRR | nDCG@10 |
|---|---|---|---|---|
| easy | 8 | 38.0% | 0.703 | 0.642 |
| medium | 43 | 32.6% | 0.295 | 0.322 |
| hard | 2 | 50.0% | 0.167 | 0.250 |

## Per-query results

| ID | Query | Difficulty | Recall@5 | RR | nDCG@10 | Latency (ms) |
|---|---|---|---|---|---|---|
| `q-data-a-data` | sistema data a data | hard | 0.0% | 0.000 | 0.000 | 2076 |
| `q-dispensa-valor` | dispensa de licitação por valor | easy | 62.5% | 1.000 | 0.840 | 503 |
| `q-inexigibilidade-notoria` | inexigibilidade notória especialização | medium | 45.5% | 1.000 | 0.736 | 669 |
| `q-pregao-bens-comuns` | pregão bens e serviços comuns | easy | 30.0% | 0.500 | 0.583 | 487 |
| `q-dialogo-competitivo` | diálogo competitivo hipóteses cabimento | medium | 55.6% | 1.000 | 0.945 | 659 |
| `q-srp-adesao-carona` | adesão ata registro de preços carona | medium | 38.5% | 1.000 | 0.568 | 559 |
| `q-reequilibrio-economico` | reequilíbrio econômico-financeiro do contrato | medium | 41.7% | 1.000 | 0.616 | 596 |
| `q-sancoes-impedimento-licitar` | sanções impedimento de licitar e contratar | medium | 20.0% | 0.500 | 0.529 | 571 |
| `q-fiscal-contrato-responsabilidade` | responsabilidades do fiscal de contrato | easy | 40.0% | 1.000 | 0.883 | 581 |
| `q-etp-obrigatoriedade` | estudo técnico preliminar obrigatório | easy | 50.0% | 1.000 | 0.761 | 1283 |
| `q-matriz-risco` | matriz de riscos contratos | medium | 50.0% | 1.000 | 0.869 | 767 |
| `q-habilitacao-fiscal-trabalhista` | habilitação fiscal social trabalhista documentos | easy | 50.0% | 1.000 | 0.909 | 577 |
| `t-cadin-01` | inscrição da contratada no CADIN, posteriormente a 16 de setembro de 2024, impede a celebração de contratos, convênios, | medium | 100.0% | 1.000 | 1.000 | 583 |
| `t-sancao-exnunc-01` | sanções de suspensão, impedimento e declaração de inidoneidade produzem efeitos ex nunc, não afetam por si os contratos | medium | 100.0% | 0.250 | 0.431 | 713 |
| `t-garantia-modalidade-01` | garantia contratual só pode ser prestada nas modalidades de caução (em dinheiro ou títulos da dívida pública), | medium | 0.0% | 0.167 | 0.356 | 1680 |
| `t-habilitacao-manutencao-01` | contratada deve manter, durante toda a execução do contrato, as condições de habilitação exigidas na licitação, o que | easy | 71.4% | 1.000 | 0.844 | 524 |
| `t-lrf-art16-01` | Despesas qualificáveis como atividades rotineiras e ordinárias dispensam o atendimento das exigências do art. 16, I e | medium | 100.0% | 0.500 | 0.631 | 883 |
| `t-srp-contratacao-unica-01` | Sistema de Registro de Preços não se presta a contratação única e exauriente previamente definida; nesses casos, a ata | medium | 100.0% | 0.500 | 0.631 | 633 |
| `t-marca-vs-fornecedor-01` | exclusividade de marca não se confunde com a exclusividade de fornecedor e, por si só, não comprova a inviabilidade de | medium | 100.0% | 0.250 | 0.431 | 597 |
| `t-srp-pluralidade-direta-01` | Sistema de Registro de Preços em contratação direta, autorizado pelo art. 82, §6º, da Lei 14.133/2021, somente é | medium | 100.0% | 1.000 | 1.000 | 653 |
| `t-pesquisa-ferramenta-privada-01` | utilização de ferramenta privada de pesquisa de preços (Banco de Preços, Cotação Zênite, Fonte de Preços e congêneres) | easy | 0.0% | 0.000 | 0.000 | 519 |
| `t-pesquisa-precos-in65-01` | pesquisa de preços deve observar os parâmetros do art. 23, §1º, da Lei 14.133/2021 e do art. 5º da IN SEGES/ME 65/2021, | medium | 0.0% | 0.000 | 0.000 | 660 |
| `t-instrumento-substitutivo-on84-01` | substituição do termo de contrato por instrumento equivalente, autorizada pelo art. 95, I e II, da Lei 14.133/2021, é | medium | 100.0% | 0.250 | 0.431 | 540 |
| `t-eng-precos-max-unitarios-01` | Em contratos de obras e serviços de engenharia, além do preço global, é obrigatória a fixação de preços máximos | medium | 50.0% | 0.250 | 0.264 | 619 |
| `t-eng-bdi-irpj-csll-01` | vedada a inclusão das parcelas relativas ao IRPJ e à CSLL na composição do BDI e no orçamento-base de obras e serviços | medium | 0.0% | 0.083 | 0.000 | 567 |
| `t-eng-art-rrt-trt-01` | elaboração de projetos, orçamentos e a execução de obras e serviços de engenharia exigem Anotação de Responsabilidade | medium | 100.0% | 0.333 | 0.500 | 590 |
| `t-contrato-escopo-on92-01` | Contratos de escopo, cujo objeto é a entrega de produto ou resultado determinado, têm vigência adstrita ao prazo | medium | 0.0% | 0.125 | 0.315 | 575 |
| `t-terceirizacao-art48-01` | vedada a contratação, por meio de terceirização, de atividades que envolvam a tomada de decisão ou posicionamento | medium | 0.0% | 0.000 | 0.000 | 588 |
| `t-pcfp-cct-vigente-01` | planilha de custos e formação de preços, nos contratos com dedicação exclusiva de mão de obra ou com pagamento por | medium | 0.0% | 0.000 | 0.000 | 553 |
| `esp-451193-3` | acréscimos e as supressões do objeto contratual devem ser calculados sobre o valor inicial atualizado do contrato, | medium | 0.0% | 0.111 | 0.301 | 664 |
| `esp-518661-2` | contratação do remanescente de obra, serviço ou fornecimento, prevista no art. 75, III, da Lei nº 14.133/2021, deve ser | medium | 0.0% | 0.000 | 0.000 | 526 |
| `esp-518661-1` | consulta jurídica facultativa formulada em processo autônomo, desvinculada dos autos da contratação subjacente, impede | medium | 0.0% | 0.000 | 0.000 | 652 |
| `esp-640788-17` | parcelamento do objeto nas contratações de TIC é a regra, somente se admitindo a adjudicação por lote ou global quando | medium | 0.0% | 0.000 | 0.000 | 560 |
| `esp-647772-7` | adoção do SRP em inexigibilidade para capacitação exige pluralidade efetiva de órgãos ou entidades contratantes | medium | 0.0% | 0.000 | 0.000 | 619 |
| `esp-669066-13` | adjudicação por itens é regra geral nas licitações de objeto divisível; o agrupamento em lote ou grupo depende de | medium | 0.0% | 0.000 | 0.000 | 503 |
| `esp-728449-7` | fixação de preços máximos unitários e global e a definição de critérios de aceitabilidade dos preços são obrigatórias | medium | 0.0% | 0.143 | 0.204 | 629 |
| `esp-728449-12` | elaboração de plantas, planilhas orçamentárias, composições de custos unitários, cronograma físico-financeiro e demais | medium | 0.0% | 0.000 | 0.000 | 486 |
| `esp-729752-8` | edital de credenciamento e seus anexos devem ser integralmente disponibilizados no Portal Nacional de Contratações | easy | 0.0% | 0.125 | 0.315 | 696 |
| `esp-729752-3` | No edital de credenciamento é facultado fixar os valores e prever índice de reajustamento de preços nas hipóteses de | hard | 100.0% | 0.333 | 0.500 | 505 |
| `esp-761729-4` | Caracterizado o objeto como serviço comum pela Administração, mas presentes na instrução elementos típicos de serviço | medium | 0.0% | 0.000 | 0.000 | 693 |
| `esp-765940-4` | ELIC não se manifesta em consultas genéricas ou abstratas, em processos já contemplados por parecer referencial da ELIC | medium | 0.0% | 0.000 | 0.000 | 466 |
| `esp-765940-1` | cessão de uso de imóvel administrado pela União ou suas autarquias e fundações, cumulada com prestação de serviço de | medium | 100.0% | 1.000 | 1.000 | 669 |
| `esp-782120-5` | Administração não se vincula às disposições de acordos, convenções ou dissídios coletivos que tratem de matérias não | medium | 0.0% | 0.100 | 0.289 | 546 |
| `esp-782120-23` | vigência inicial da ata de registro de preços é de um ano, contado do primeiro dia útil subsequente à divulgação no | medium | 100.0% | 0.500 | 0.651 | 617 |
| `esp-785767-12` | Exigências de instalação de escritório na cidade de execução do objeto são restritivas da competitividade e somente se | medium | 100.0% | 0.333 | 0.500 | 552 |
| `esp-785767-20` | No pregão eletrônico para registro de preços, a vigência da ata é de até um ano, prorrogável por igual período desde | medium | 0.0% | 0.125 | 0.315 | 608 |
| `esp-789829-9` | Administração não se vincula a cláusulas de instrumento coletivo que tratem de matéria não trabalhista, de participação | medium | 0.0% | 0.053 | 0.000 | 500 |
| `esp-789829-8` | Nas contratações de serviços comuns de engenharia com dedicação exclusiva de mão de obra, a planilha de custos e | medium | 0.0% | 0.000 | 0.000 | 657 |
| `esp-792741-1` | limite de 25% do art. 125 da Lei 14.133/2021 aplica-se às alterações qualitativas e quantitativas, isoladamente ao | medium | 0.0% | 0.000 | 0.000 | 531 |
| `esp-795204-10` | obrigatória a juntada de documento de responsabilidade técnica (ART, RRT ou TRT) referente às peças técnicas da | medium | 0.0% | 0.125 | 0.315 | 645 |
| `esp-797806-1` | indicação de marca ou modelo no edital somente é admitida nas hipóteses taxativas do art. 41, I, da Lei 14.133/2021, | medium | 0.0% | 0.000 | 0.000 | 560 |
| `esp-800676-4` | regra do parcelamento do objeto permanece aplicável mesmo em contratações por inexigibilidade quando o objeto comportar | medium | 0.0% | 0.000 | 0.000 | 609 |
| `esp-811212-11` | Nas dispensas emergenciais que envolvam serviços com dedicação exclusiva de mão de obra, permanecem aplicáveis as | medium | 0.0% | 0.000 | 0.000 | 620 |
