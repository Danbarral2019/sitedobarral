# Eval de Síntese — bia1-baseline-n12

- **runAt:** 2026-07-09T17:51:34.678Z
- **sintetizador:** claude-sonnet-5 + Citations API · **juiz:** claude-sonnet-5
- **avaliadas:** 12 · **vazias (sem retrieval):** 0

## Métricas agregadas

| Dimensão | Média |
|---|---|
| Faithfulness (anti-alucinação) | 85.4% |
| Citation accuracy | 89.2% |
| Completeness | 87.5% |
| **Overall** (fidelidade pesa 2×) | **87.3%** |

## Piores casos (menor overall)

### q-reequilibrio-economico — overall 77.0%
_reequilíbrio econômico-financeiro do contrato_

faith 80.0% · cit 70.0% · compl 85.0%
- issues: Cita art. 103, §7º, I e II quando o dispositivo correto é o §5º (erro de numeração); Não menciona o Acórdão 25/2010-TCU-Plenário, que lista expressamente os pressupostos (a,b,c,d) do reequilíbrio presentes no material; Inferências marcadas com ⚠️ (comparação Lei 8.666/Lei 14.133 sobre periodicidade e aplicabilidade doutrinária) são extrapolações do assistente, não afirmações do material; Demais citações de artigos e acórdãos (124, 130, 131, 134, 135, 137, 92, 104, ON 61/2020, Acórdãos 3011/2014, 1466/2013, 8032/2023, 311/2011) estão corretas e bem ancoradas
- A resposta é extensa e majoritariamente fiel ao material, cobrindo quase todas as fontes relevantes, mas contém um erro de numeração (§7º em vez de §5º do art. 103) e omite o Acórdão 25/2010 sobre pressupostos do reequilíbrio, além de inserir inferências próprias não diretamente extraídas do texto.

### q-data-a-data — overall 80.0%
_sistema data a data_

faith 70.0% · cit 90.0% · compl 80.0%
- issues: A conclusão de que o art. 183 'deve prevalecer' sobre o parecer AGU 2013 é uma inferência do assistente não expressamente sustentada pelo material; Afirma que a regra do art. 183 é 'mais próxima da lógica processual' - opinião não fundamentada no texto fornecido; Assume implicitamente que o art. 183 (regra geral de prazos processuais/legais) se aplica automaticamente à contagem de vigência contratual, equiparando-o ao parecer que trata especificamente de prazo de vigência - essa equivalência não é explicitada no material; Não menciona o Enunciado INCP nº 15 nem outros dispositivos de vigência (arts. 105-114) que poderiam contextualizar melhor o tema, embora sejam menos diretamente relevantes
- As citações ao art. 183 e ao Parecer 035/2013 são fiéis e precisas, mas a resposta constrói uma narrativa de 'evolução normativa' e superação do parecer que extrapola o que o material efetivamente afirma.

### q-fiscal-contrato-responsabilidade — overall 84.0%
_responsabilidades do fiscal de contrato_

faith 80.0% · cit 90.0% · compl 80.0%
- issues: Inferência não totalmente amparada ao conectar art. 117 §2º com a comunicação de sobrecarga do Decreto 11.246/2022 (são previsões distintas no material); Inserção de nota própria do assistente ('⚠️ Precedente anterior à Lei 14.133...') sem base no material, embora seja ressalva razoável; Omite os quatro fatores de designação do Decreto 11.246/2022 (compatibilidade, complexidade, quantitativo de contratos, capacidade); Não menciona a fiscalização setorial (Decreto 11.246/2022), que é ponto relevante sobre estrutura de fiscalização
- A resposta é bem fundamentada e as citações (Art. 117, 7º, 120, Manual TCU, Inf. 57/2011, Acórdão 3053/2025, IBDA 57, INCP 45) conferem com o material, mas há pequenas extrapolações interpretativas e omissão de detalhes secundários do Decreto 11.246/2022.

### q-inexigibilidade-notoria — overall 86.0%
_inexigibilidade notória especialização_

faith 80.0% · cit 90.0% · compl 90.0%
- issues: Afirma categoricamente que a Súmula 39 foi 'incorporada' ao art. 74, III/§3º da Lei 14.133/2021, o que é uma inferência do assistente não expressamente sustentada pelo material; Mesma extrapolação ao dizer que o raciocínio do Inf. 59/2011 'permanece aplicável' sem base textual direta no material para essa conclusão; Não menciona o Enunciado IBDA nº 36, embora seja de relevância marginal ao tema central da pergunta; Vínculo entre 'razão da escolha' do art. 72 e notória especialização é inferência do assistente, apresentada sem ressalva clara de que é interpretação própria
- A resposta cita corretamente e com fidelidade textual as fontes do material (Art. 74, Súmula 39, ON 18/2009, Parecer 141/2011, Inf. 59/2011, Arts. 72 e 73), mas insere conclusões próprias sobre continuidade normativa entre a Lei 8.666/93 e a Lei 14.133/2021 que extrapolam o que o material expressamente afirma. A cobertura das fontes relevantes é ampla e bem organizada.

### q-pregao-bens-comuns — overall 86.0%
_pregão bens e serviços comuns_

faith 85.0% · cit 85.0% · compl 90.0%
- issues: A citação do Parecer AGU 21/2023 foi reconstruída em frase contínua com colchetes, dando aparência de citação literal que não corresponde ao texto original da ementa (que é uma lista de tópicos, não uma frase corrida); Afirmação de que o Inf. 50/2011 é 'precedente anterior à Lei 14.133/2021' é inferência do assistente, não expressa no material, embora factualmente correta; Demais citações (Art. 6º, 8º, 11, 17, 29 e Manual TCU) são literais e corretamente atribuídas
- A resposta é extensa, bem estruturada e majoritariamente fiel às fontes, com citações literais corretas da Lei e do Manual TCU; a única fragilidade é a reconstrução da ementa do Parecer AGU como citação contínua, que distorce levemente a fidelidade textual.

### q-dispensa-valor — overall 88.0%
_dispensa de licitação por valor_

faith 85.0% · cit 90.0% · compl 90.0%
- issues: Atribui explicitamente a atualização dos valores do Manual TCU ao Decreto 12.807/2025 sem que o material confirme essa vinculação direta; Afirma que o decreto 'atualiza periodicamente os valores' - inferência não sustentada literalmente pelo material; Pequena extrapolação ao dizer que o Parecer DECOR 00009/2021 'fundamentou' as ONs 87/2024 e 69/2021, relação não explicitada no material
- A resposta é extensa, bem organizada e cobre quase todas as fontes relevantes (Lei, Manual TCU, ON AGU 105/2026, Enunciado CJF 50, ONs AGU 87/2024 e 69/2021, Parecer DECOR, Informativo 377/2019) com citações corretas e cautela apropriada sobre precedente anterior à nova lei. Há apenas pequenas extrapolações não totalmente sustentadas sobre a origem/periodicidade da atualização de valores via decreto.

### q-sancoes-impedimento-licitar — overall 89.0%
_sanções impedimento de licitar e contratar_

faith 90.0% · cit 90.0% · compl 85.0%
- issues: Extrapola, mesmo que rotulado como inferência, a aplicação do entendimento de extensão da sanção (Inf. 399/2020, referente ao art. 7º da Lei 10.520) ao novo regime da Lei 14.133/2021, sem base explícita no material para essa equivalência; Mistura o §6º do art. 156 (aplicável apenas à declaração de inidoneidade) na seção de competência do impedimento de licitar, podendo confundir o leitor apesar da ressalva; Omite o art. 14, III, da Lei 14.133/2021, que trata do impedimento de participação de quem sofreu sanção — ponto relevante ao tema; Não menciona o Acórdão 1831/2014-TCU-Plenário sobre desconsideração da personalidade jurídica, presente no Manual TCU
- A resposta é predominantemente fiel e bem referenciada, com citações corretas e ressalvas sobre a vigência temporal dos precedentes, mas insere uma extrapolação interpretativa sobre a aplicabilidade do entendimento antigo ao novo regime sem suporte textual direto e deixa de citar algumas fontes secundárias relevantes do material.

### q-srp-adesao-carona — overall 90.0%
_adesão ata registro de preços carona_

faith 90.0% · cit 90.0% · compl 90.0%
- issues: Nota sobre Decreto 3.931/2001 'substituído por' 11.462/2023 omite o elo intermediário (Decreto 7.892/2013), simplificação imprecisa; Conexão entre Inf. TCU 242/2015 e art. 86 §2º, I e II é inferência do assistente, não afirmada expressamente no material; Não menciona explicitamente o Manual TCU 5.9.4 como fonte autônoma, embora seu conteúdo seja reproduzido via art. 86
- A resposta é bem estruturada, cita corretamente os dispositivos e fontes do material (art. 86, ON 88/2024, Enunciado IBDA 61, Parecer DECOR, Inf. TCU 242/2015), com boa cobertura dos pontos relevantes. Pequenas imprecisões históricas e uma conexão interpretativa não expressamente sustentada reduzem levemente a fidelidade e completude.

### q-habilitacao-fiscal-trabalhista — overall 90.0%
_habilitação fiscal social trabalhista documentos_

faith 90.0% · cit 90.0% · compl 90.0%
- issues: Acórdão 470/2022 citado com frase truncada do material sem completar a ressalva final ('uma vez que o...'); Não menciona habilitação social também prevista no Manual quanto a documentos específicos de PCD/reabilitado de forma mais detalhada além da declaração; Estrutura longa pode diluir foco na pergunta objetiva, mas mantém fidelidade ao material
- A resposta é extensa, bem organizada e praticamente todas as citações (artigos, enunciado, acórdãos) correspondem ao material fornecido, sem invenções aparentes. Cobre de forma completa os documentos relevantes disponíveis, inclusive reconhecendo lacunas do material de forma transparente.

### q-dialogo-competitivo — overall 91.0%
_diálogo competitivo hipóteses cabimento_

faith 90.0% · cit 90.0% · compl 95.0%
- issues: Prazo mínimo de pré-seleção descrito como 'prazo de 25 dias úteis' sem indicar que é mínimo em um trecho, embora correto em outro (pequena imprecisão); Chama ON 82/2024 de 'vinculante' e Enunciado INCP nº 8 de 'doutrinário', qualificações não presentes no material; Cita art. 62 a 70 corretamente conforme Enunciado, mas não há conferência possível de que tais artigos tratam de habilitação no material fornecido
- A resposta é fiel e bem fundamentada nas fontes do material, com citações majoritariamente corretas e cobertura completa dos pontos-chave (conceito, hipóteses, procedimento, ON, Enunciado, Parecer e aplicação em PPP/concessões). Pequenas adições qualificativas não sustentadas pelo material reduzem levemente a nota de fidelidade.
