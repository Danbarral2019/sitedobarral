# Eval Run — pos-dedup-conuni

- **Run at:** 2026-07-07T21:46:33.158Z
- **Git SHA:** `03a4c90d`
- **Queries:** 55 annotated / 93 total (38 skipped)

## Aggregate metrics

| Metric | Value |
|---|---|
| Recall@5 (avg) | 65.2% |
| MRR | 0.830 |
| nDCG@10 (avg) | 0.653 |

## By difficulty

| Difficulty | N | Recall@5 | MRR | nDCG@10 |
|---|---|---|---|---|
| easy | 8 | 51.2% | 1.000 | 0.714 |
| medium | 43 | 66.9% | 0.842 | 0.660 |
| hard | 4 | 75.0% | 0.362 | 0.454 |

## Per-query results

| ID | Query | Difficulty | Recall@5 | RR | nDCG@10 | Latency (ms) |
|---|---|---|---|---|---|---|
| `q-data-a-data` | sistema data a data | hard | 0.0% | 0.000 | 0.000 | 5138 |
| `q-dispensa-valor` | dispensa de licitação por valor | easy | 50.0% | 1.000 | 0.634 | 576 |
| `q-inexigibilidade-notoria` | inexigibilidade notória especialização | medium | 45.5% | 1.000 | 0.727 | 637 |
| `q-pregao-bens-comuns` | pregão bens e serviços comuns | easy | 41.7% | 1.000 | 0.726 | 560 |
| `q-dialogo-competitivo` | diálogo competitivo hipóteses cabimento | medium | 50.0% | 1.000 | 0.776 | 617 |
| `q-srp-adesao-carona` | adesão ata registro de preços carona | medium | 41.7% | 1.000 | 0.623 | 524 |
| `q-reequilibrio-economico` | reequilíbrio econômico-financeiro do contrato | medium | 50.0% | 1.000 | 0.763 | 654 |
| `q-sancoes-impedimento-licitar` | sanções impedimento de licitar e contratar | medium | 38.5% | 1.000 | 0.870 | 566 |
| `q-fiscal-contrato-responsabilidade` | responsabilidades do fiscal de contrato | easy | 45.5% | 1.000 | 0.922 | 590 |
| `q-etp-obrigatoriedade` | estudo técnico preliminar obrigatório | easy | 40.0% | 1.000 | 0.656 | 587 |
| `q-matriz-risco` | matriz de riscos contratos | medium | 50.0% | 1.000 | 0.876 | 571 |
| `q-habilitacao-fiscal-trabalhista` | habilitação fiscal social trabalhista documentos | easy | 50.0% | 1.000 | 0.905 | 550 |
| `t-cadin-01` | inscrição da contratada no CADIN, posteriormente a 16 de setembro de 2024, impede a celebração de contratos, convênios, | medium | 100.0% | 1.000 | 1.000 | 578 |
| `t-sancao-exnunc-01` | sanções de suspensão, impedimento e declaração de inidoneidade produzem efeitos ex nunc, não afetam por si os contratos | medium | 100.0% | 1.000 | 0.936 | 552 |
| `t-garantia-modalidade-01` | garantia contratual só pode ser prestada nas modalidades de caução (em dinheiro ou títulos da dívida pública), | medium | 60.0% | 1.000 | 0.844 | 682 |
| `t-habilitacao-manutencao-01` | contratada deve manter, durante toda a execução do contrato, as condições de habilitação exigidas na licitação, o que | easy | 57.1% | 1.000 | 0.651 | 558 |
| `t-lrf-art16-01` | Despesas qualificáveis como atividades rotineiras e ordinárias dispensam o atendimento das exigências do art. 16, I e | medium | 100.0% | 1.000 | 1.000 | 648 |
| `t-srp-contratacao-unica-01` | Sistema de Registro de Preços não se presta a contratação única e exauriente previamente definida; nesses casos, a ata | medium | 100.0% | 1.000 | 0.963 | 583 |
| `t-marca-vs-fornecedor-01` | exclusividade de marca não se confunde com a exclusividade de fornecedor e, por si só, não comprova a inviabilidade de | medium | 100.0% | 1.000 | 0.913 | 480 |
| `t-srp-pluralidade-direta-01` | Sistema de Registro de Preços em contratação direta, autorizado pelo art. 82, §6º, da Lei 14.133/2021, somente é | medium | 66.7% | 1.000 | 0.839 | 787 |
| `t-pesquisa-ferramenta-privada-01` | utilização de ferramenta privada de pesquisa de preços (Banco de Preços, Cotação Zênite, Fonte de Preços e congêneres) | easy | 75.0% | 1.000 | 0.667 | 529 |
| `t-pesquisa-precos-in65-01` | pesquisa de preços deve observar os parâmetros do art. 23, §1º, da Lei 14.133/2021 e do art. 5º da IN SEGES/ME 65/2021, | medium | 75.0% | 1.000 | 0.709 | 675 |
| `t-instrumento-substitutivo-on84-01` | substituição do termo de contrato por instrumento equivalente, autorizada pelo art. 95, I e II, da Lei 14.133/2021, é | medium | 80.0% | 1.000 | 0.691 | 573 |
| `t-eng-precos-max-unitarios-01` | Em contratos de obras e serviços de engenharia, além do preço global, é obrigatória a fixação de preços máximos | medium | 83.3% | 1.000 | 0.720 | 650 |
| `t-eng-bdi-irpj-csll-01` | vedada a inclusão das parcelas relativas ao IRPJ e à CSLL na composição do BDI e no orçamento-base de obras e serviços | medium | 80.0% | 1.000 | 0.566 | 587 |
| `t-eng-art-rrt-trt-01` | elaboração de projetos, orçamentos e a execução de obras e serviços de engenharia exigem Anotação de Responsabilidade | medium | 75.0% | 1.000 | 0.898 | 556 |
| `t-contrato-escopo-on92-01` | Contratos de escopo, cujo objeto é a entrega de produto ou resultado determinado, têm vigência adstrita ao prazo | medium | 75.0% | 1.000 | 0.594 | 679 |
| `t-terceirizacao-art48-01` | vedada a contratação, por meio de terceirização, de atividades que envolvam a tomada de decisão ou posicionamento | medium | 66.7% | 0.500 | 0.444 | 577 |
| `t-pcfp-cct-vigente-01` | planilha de custos e formação de preços, nos contratos com dedicação exclusiva de mão de obra ou com pagamento por | medium | 66.7% | 0.250 | 0.311 | 607 |
| `esp-451193-3` | acréscimos e as supressões do objeto contratual devem ser calculados sobre o valor inicial atualizado do contrato, | medium | 83.3% | 1.000 | 0.804 | 649 |
| `esp-518661-2` | contratação do remanescente de obra, serviço ou fornecimento, prevista no art. 75, III, da Lei nº 14.133/2021, deve ser | medium | 100.0% | 1.000 | 1.000 | 554 |
| `esp-518661-1` | consulta jurídica facultativa formulada em processo autônomo, desvinculada dos autos da contratação subjacente, impede | medium | 0.0% | 0.000 | 0.000 | 613 |
| `esp-640788-17` | parcelamento do objeto nas contratações de TIC é a regra, somente se admitindo a adjudicação por lote ou global quando | medium | 62.5% | 1.000 | 0.599 | 614 |
| `esp-647772-7` | adoção do SRP em inexigibilidade para capacitação exige pluralidade efetiva de órgãos ou entidades contratantes | medium | 66.7% | 0.500 | 0.274 | 537 |
| `esp-669066-13` | adjudicação por itens é regra geral nas licitações de objeto divisível; o agrupamento em lote ou grupo depende de | medium | 83.3% | 1.000 | 0.756 | 652 |
| `esp-728449-7` | fixação de preços máximos unitários e global e a definição de critérios de aceitabilidade dos preços são obrigatórias | medium | 66.7% | 1.000 | 0.597 | 484 |
| `esp-728449-12` | elaboração de plantas, planilhas orçamentárias, composições de custos unitários, cronograma físico-financeiro e demais | medium | 80.0% | 1.000 | 0.752 | 758 |
| `esp-729752-8` | edital de credenciamento e seus anexos devem ser integralmente disponibilizados no Portal Nacional de Contratações | easy | 50.0% | 1.000 | 0.551 | 612 |
| `esp-729752-3` | No edital de credenciamento é facultado fixar os valores e prever índice de reajustamento de preços nas hipóteses de | hard | 100.0% | 0.250 | 0.431 | 578 |
| `esp-761729-4` | Caracterizado o objeto como serviço comum pela Administração, mas presentes na instrução elementos típicos de serviço | medium | 80.0% | 1.000 | 0.518 | 630 |
| `esp-765940-4` | ELIC não se manifesta em consultas genéricas ou abstratas, em processos já contemplados por parecer referencial da ELIC | medium | 50.0% | 1.000 | 0.424 | 584 |
| `esp-765940-1` | cessão de uso de imóvel administrado pela União ou suas autarquias e fundações, cumulada com prestação de serviço de | medium | 80.0% | 1.000 | 0.985 | 651 |
| `esp-782120-5` | Administração não se vincula às disposições de acordos, convenções ou dissídios coletivos que tratem de matérias não | medium | 75.0% | 0.500 | 0.565 | 592 |
| `esp-782120-23` | vigência inicial da ata de registro de preços é de um ano, contado do primeiro dia útil subsequente à divulgação no | medium | 100.0% | 1.000 | 0.842 | 641 |
| `esp-785767-12` | Exigências de instalação de escritório na cidade de execução do objeto são restritivas da competitividade e somente se | medium | 100.0% | 1.000 | 0.906 | 557 |
| `esp-785767-20` | No pregão eletrônico para registro de preços, a vigência da ata é de até um ano, prorrogável por igual período desde | medium | 0.0% | 0.125 | 0.315 | 675 |
| `esp-789829-9` | Administração não se vincula a cláusulas de instrumento coletivo que tratem de matéria não trabalhista, de participação | medium | 80.0% | 1.000 | 0.616 | 571 |
| `esp-789829-8` | Nas contratações de serviços comuns de engenharia com dedicação exclusiva de mão de obra, a planilha de custos e | medium | 60.0% | 0.333 | 0.212 | 636 |
| `esp-792741-1` | limite de 25% do art. 125 da Lei 14.133/2021 aplica-se às alterações qualitativas e quantitativas, isoladamente ao | medium | 83.3% | 1.000 | 0.798 | 787 |
| `esp-795204-10` | obrigatória a juntada de documento de responsabilidade técnica (ART, RRT ou TRT) referente às peças técnicas da | medium | 60.0% | 1.000 | 0.743 | 621 |
| `esp-797806-1` | indicação de marca ou modelo no edital somente é admitida nas hipóteses taxativas do art. 41, I, da Lei 14.133/2021, | medium | 60.0% | 1.000 | 0.615 | 674 |
| `esp-800676-4` | regra do parcelamento do objeto permanece aplicável mesmo em contratações por inexigibilidade quando o objeto comportar | medium | 0.0% | 0.000 | 0.000 | 668 |
| `esp-811212-11` | Nas dispensas emergenciais que envolvam serviços com dedicação exclusiva de mão de obra, permanecem aplicáveis as | medium | 0.0% | 0.000 | 0.000 | 579 |
| `q-dragagem-licenciamento-ambiental` | dragagem sem licenciamento ambiental prévio e consulta a povos tradicionais | hard | 100.0% | 1.000 | 1.000 | 623 |
| `q-fraude-pesquisa-precos-segregacao` | fraude na pesquisa de preços e ausência de segregação de funções | hard | 100.0% | 0.200 | 0.387 | 626 |
