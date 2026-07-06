# Eval de Síntese — baseline-gemini

- **runAt:** 2026-07-06T20:27:00.366Z
- **sintetizador:** default (task chat) · **juiz:** claude-sonnet-5
- **avaliadas:** 10 · **vazias (sem retrieval):** 0

## Métricas agregadas

| Dimensão | Média |
|---|---|
| Faithfulness (anti-alucinação) | 40.5% |
| Citation accuracy | 46.0% |
| Completeness | 54.0% |
| **Overall** (fidelidade pesa 2×) | **45.4%** |

## Piores casos (menor overall)

### q-sancoes-impedimento-licitar — overall 20.0%
_sanções impedimento de licitar e contratar_

faith 15.0% · cit 20.0% · compl 30.0%
- issues: Inventa conteúdo específico de dispositivos (Art. 156 III, §4º, incisos de Art. 155, Art. 163 com prazo de 1 ano, prazo de 3 anos) que não constam no material fornecido — apenas números de artigos foram listados como 'fontes disponíveis', sem texto; Afirma que a Lei 14.133 'supera a fragmentação' do regime anterior e unifica o alcance da sanção ao ente federativo, conclusão não sustentada pelas fontes (que tratam apenas de leis 8.666/93 e 10.520/2002); Menciona PNCP e obrigação de publicidade sem qualquer base no material; Ignora fontes disponíveis relevantes como Manual TCU 5.8 e Acórdão TCU 2530/2023, que constavam na lista de fontes; Trata dados de baixa cobertura com alto grau de detalhe e certeza, contradizendo o próprio aviso inicial de cautela
- A resposta extrapola fortemente o material, atribuindo conteúdo detalhado e específico a artigos da Lei 14.133 que não estão no contexto fornecido, e tira conclusões não sustentadas sobre a evolução do regime sancionador; além disso, omite fontes disponíveis relevantes.

### q-data-a-data — overall 28.0%
_sistema data a data_

faith 20.0% · cit 30.0% · compl 40.0%
- issues: Atribui conteúdo específico (o que 'orienta' ou 'trata') ao Manual TCU 4.3.7, ao Acórdão TCU 1727/2025 e ao Informativo 53/2011, mas o material fornecido não contém o texto/teor desses documentos - apenas seus nomes aparecem na lista de fontes disponíveis, sem conteúdo substantivo; Descreve o conteúdo dos arts. 46, 115 e 140 da Lei 14.133 sem que o material fornecido traga o texto desses dispositivos, configurando fabricação de conteúdo normativo; Ignora quase totalmente os atos normativos regulamentadores efetivamente presentes no material (Decretos 12.926/2026, 10.947/2022, 11.531/2023 etc.), tratando-os de forma superficial ou nula; Presume, sem base expressa no material, que 'sistema data a data' equivale a reajustamento em sentido estrito, apresentando essa interpretação como certeza consolidada; Cita art. 23 da Lei 14.133 corretamente ligado ao IN 65/2021, mas mistura essa menção com outras citações fabricadas, comprometendo a confiabilidade geral das referências
- A resposta fabrica conteúdo substantivo para fontes (Manual TCU, Acórdão 1727/2025, Informativo 53/2011) cujo teor não constava no material fornecido, e atribui conteúdo a artigos da lei sem base textual disponível, violando a fidelidade; a cobertura das poucas fontes genuinamente detalhadas (Enunciado INCP 14 e ON AGU 103/2026) é razoável, mas isso não compensa a fabricação extensiva.

### q-dialogo-competitivo — overall 38.0%
_diálogo competitivo hipóteses cabimento_

faith 30.0% · cit 40.0% · compl 50.0%
- issues: Inventa hipóteses de cabimento do art. 32 (complexidade técnica/jurídica, definição de estrutura financeira etc.) sem qualquer base no material fornecido, violando a regra de não inventar diante de cobertura baixa; Atribui conteúdo interpretativo ao Informativo TCU 486/2024 que não está desenvolvido no material (só há título); Omite o 'Manual TCU - 3.6.5 Diálogo competitivo', fonte explicitamente listada como disponível e pertinente; Aviso de baixa cobertura é breve e a resposta segue com tom de confiança excessiva, contrariando a cautela exigida; Mistura informações corretas (parecer, ON 82, Enunciado 8) com conteúdo especulativo sem diferenciação clara
- A resposta mistura conteúdo real do material (parecer, ON 82/2024, Enunciado INCP 8) com hipóteses de cabimento inventadas não presentes no contexto fornecido, violando a instrução de cautela para baixa cobertura. Também omite o Manual TCU listado como fonte disponível, prejudicando a completude.

### q-inexigibilidade-notoria — overall 40.0%
_inexigibilidade notória especialização_

faith 30.0% · cit 40.0% · compl 60.0%
- issues: Inventa conteúdo específico do Art. 74, III (notória especialização/natureza intelectual) sem que isso conste no material fornecido; Detalha requisitos do Art. 72 (DFD, estimativa de despesa, etc.) que não aparecem no contexto disponível; Apesar do aviso inicial de baixa cobertura, o corpo da resposta afirma conteúdo normativo com tom categórico, contrariando a cautela exigida pela regra 10f; Inclui IN SEGES 67/2021 e 91/2022 de forma forçada, sem relação clara com notória especialização; Trata jurisprudência pré-14.133 como diretamente aplicável sem reforçar adequadamente a ressalva de defasagem
- A resposta usa corretamente as fontes de jurisprudência/pareceres disponíveis, mas insere conteúdo normativo específico (texto de artigos) que não está no material fornecido, violando a regra de não inventar conteúdo em cenário de baixa cobertura.

### q-etp-obrigatoriedade — overall 40.0%
_estudo técnico preliminar obrigatório_

faith 40.0% · cit 30.0% · compl 60.0%
- issues: Atribui ao Acórdão 3266/2008 conteúdo que pertence a outro acórdão (1568/2008 ou 758/2011), configurando citação trocada; Cita 'Art. 62' para requisitos de habilitação, mas o material menciona 'art. 6º, inciso XXIII, d'; Afirma que a Portaria SEGES/ME 8.678/2021 trata especificamente do ETP na governança, o que não é sustentado literalmente pelo material; Extrapola o conteúdo do Art. 18, inciso I, sobre fase preparatória sem base literal completa no material fornecido; Omite fontes de baixa relevância (Art. 6º, Modelo de ETP) sem justificar, embora sejam de relevância marginal
- A resposta é bem estruturada e usa a maioria das fontes centrais, mas comete erros de atribuição de citações (acórdão trocado e artigo incorreto) e extrapola conteúdo não literal do material, comprometendo a fidelidade e a precisão das citações.

### q-srp-adesao-carona — overall 48.0%
_adesão ata registro de preços carona_

faith 40.0% · cit 50.0% · compl 60.0%
- issues: Atribui conteúdo específico aos Art. 82, 86, 11 e 18 da Lei 14.133/2021 (ex.: 'Art. 86 disciplina a adesão de não participantes') sem que o material forneça tal conteúdo — invenção não sustentada pelo contexto; Conecta forçadamente decretos/portarias de governança (PCA, catálogo eletrônico, PLS) ao tema de adesão/carona sem que o material estabeleça essa relação; Omite o 'Manual TCU - 5.9.4 Sistema de Registro de Preços', fonte listada como disponível e diretamente pertinente ao tema; Estrutura sugere que os artigos da Lei citados têm conteúdo textual detalhado, quando o material só lista números sem descrição
- As citações a pareceres, ON e informativo são fiéis e corretas, mas a seção final inventa conteúdo específico de artigos da Lei 14.133 não descritos no material e força relação de decretos de governança ao tema, além de omitir o Manual TCU disponível.

### q-reequilibrio-economico — overall 52.0%
_reequilíbrio econômico-financeiro do contrato_

faith 50.0% · cit 50.0% · compl 60.0%
- issues: Atribui conteúdo específico ao Art. 124 (força maior, fato do príncipe etc.) sem que o material forneça o texto desse artigo — apenas citado como número relacionado; Menciona 'matriz de riscos prevista no Art. 103' sem qualquer texto do Art. 103 no material fornecido; Omite completamente o Manual TCU 6.2.2.1.1 e o Acórdão TCU 8032/2023, listados como fontes disponíveis e relevantes ao tema; O restante (Art. 131, ON 61/2020, Inf. 50/2011, Parecer 003/2015) está bem sustentado pelo material
- A resposta é fiel e bem citada quanto a Art. 131, ON 61/2020, Inf. 50/2011 e Parecer 003/2015, mas fabrica conteúdo para Art. 124 e Art. 103 sem respaldo textual no material e ignora fontes relevantes listadas (Manual TCU, Acórdão 8032/2023).

### q-fiscal-contrato-responsabilidade — overall 54.0%
_responsabilidades do fiscal de contrato_

faith 50.0% · cit 60.0% · compl 50.0%
- issues: Atribui conteúdo específico ao Informativo TCU 57/2011 sem que o material forneça seu texto (apenas título disponível); Afirma que fiscal administrativo trata de 'obrigações trabalhistas e previdenciárias', detalhe não presente no material; Extrapola que Decreto 12.926/2026 e INs 381/2025 e 82/2025 versam sobre responsabilidade do fiscal, quando o material só traz ementas genéricas sem esse vínculo; Omite fontes relevantes disponíveis como Acórdão TCU 3053/2025 e Enunciado CJF nº 39; Atribuição confusa entre Art. 7º da Lei e Manual TCU quanto aos requisitos de designação do fiscal
- A resposta usa corretamente Art. 117, Art. 5º, Manual TCU e Enunciado IBDA 57, mas extrapola conteúdo não fornecido (Informativo 57/2011, ligação dos decretos/INs com fiscalização) e omite fontes disponíveis como Acórdão 3053/2025 e Enunciado CJF 39.

### q-pregao-bens-comuns — overall 66.0%
_pregão bens e serviços comuns_

faith 60.0% · cit 80.0% · compl 50.0%
- issues: Afirma que pregão é 'obrigatório' para bens/serviços comuns e cita 'maior desconto' como critério, sem base literal no material; Vincula Art. 46 (critério menor preço) especificamente ao pregão como 'prioritário', extrapolando o texto fornecido que apenas lista critérios gerais; Afirma que o Parecer 00021/2023 'reforça que o pregão pode ser utilizado para serviços de engenharia comuns', conteúdo não explicitado no trecho fornecido (apenas ementa); Omite fontes disponíveis e relevantes: Orientação Normativa AGU nº 96/2025 e Manual TCU 3.6.1 Pregão; Afirmações sobre Portaria SEGES e INs relacionadas ao 'planejamento de licitações por pregão' são genéricas e não sustentadas por trecho literal do material
- A resposta é majoritariamente fiel às fontes citadas, mas contém extrapolações não sustentadas literalmente (obrigatoriedade do pregão, critério 'maior desconto', vínculo direto entre Art.46 e pregão) e deixa de usar fontes relevantes disponíveis como ON 96/2025 e Manual TCU, prejudicando a completude.

### q-dispensa-valor — overall 68.0%
_dispensa de licitação por valor_

faith 70.0% · cit 60.0% · compl 80.0%
- issues: Cita 'Art. 75, § 7º da Lei 14.133/2021' para a exceção de manutenção de veículos, mas esse parágrafo específico não aparece no material fornecido (invenção de dispositivo legal); Trata 'ON 87/2024' de forma ambígua, usando-a tanto para a regra de contrato plurianual quanto para a dispensa de parecer jurídico, refletindo inconsistência do próprio material sem alertar sobre isso; Não menciona explicitamente que fontes como Inf. 377/2019 e Acórdão TCU 119/2021 constavam como disponíveis mas sem conteúdo recuperável; Aviso de baixa cobertura foi incluído, mas o texto segue com tom de certeza técnica alta, pouco cauteloso
- A resposta é majoritariamente fiel e bem estruturada, cobrindo os principais pontos do material, mas inclui uma citação de dispositivo legal (Art. 75, §7º) não confirmada no texto fornecido, e trata a ON 87/2024 de forma ambígua devido a uma inconsistência do próprio material.
