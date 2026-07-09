# Eval de Síntese — bia1-baseline-13a30

- **runAt:** 2026-07-09T18:37:44.734Z
- **sintetizador:** claude-sonnet-5 + Citations API · **juiz:** claude-sonnet-5
- **avaliadas:** 18 · **vazias (sem retrieval):** 0

## Métricas agregadas

| Dimensão | Média |
|---|---|
| Faithfulness (anti-alucinação) | 79.2% |
| Citation accuracy | 85.8% |
| Completeness | 78.3% |
| **Overall** (fidelidade pesa 2×) | **81.7%** |

## Piores casos (menor overall)

### t-minuta-cnmlc-01 — overall 48.0%
_instrumentos contratuais e seus aditivos devem adotar, com os ajustes necessários ao caso concreto, as minutas_

faith 40.0% · cit 50.0% · compl 60.0%
- issues: Atribui ao Manual do TCU a expressão entre aspas 'ajustes necessários ao caso concreto', que não consta literalmente no material fornecido - citação fabricada; Trata a expressão da pergunta como se refletisse literalmente o Art. 25 §1º c/c Art. 19, IV, mas nenhum desses dispositivos usa essa formulação; Não reconhece que a fonte exata da expressão da pergunta pode não estar disponível no material, criando falsa impressão de origem normativa; Uso do Informativo 57/2011 (regime da Lei 8.666/93) é relevante mas a ressalva sobre aplicabilidade é elaboração própria, não extraída do material; Resposta prolixa, com repetição da mesma citação do Manual TCU sobre minutas padronizadas em múltiplos trechos sem agregar precisão à pergunta
- A resposta usa corretamente diversas fontes do material (Art. 25, 19, 89, 91, 95, 132, ON 2/2009, Inf. 57/2011), mas fabrica uma citação entre aspas atribuída ao Manual do TCU que não existe literalmente no texto, comprometendo fidelidade e precisão das citações centrais à pergunta.

### t-lrf-art16-01 — overall 62.0%
_Despesas qualificáveis como atividades rotineiras e ordinárias dispensam o atendimento das exigências do art. 16, I e_

faith 50.0% · cit 70.0% · compl 70.0%
- issues: Descreve o conteúdo específico dos incisos I e II do art. 16 da LC 101/2000 (estimativa de impacto orçamentário e declaração de adequação) sem que esse texto conste no material fornecido — é conhecimento externo apresentado como se decorresse do contexto; A distinção entre os dois 'art. 16' é útil, mas a explicação detalhada sobre a LRF extrapola a única fonte disponível (ON 52/2014), que não define o conteúdo dos incisos; Não há problema na citação da ON 52/2014 nem do art. 16 da Lei 14.133/2021 em si, mas a fundamentação da 'racionalidade' da dispensa é elaborada sem lastro textual no material
- A resposta identifica corretamente a ON 52/2014 e distingue-a do art. 16 da Lei 14.133/2021, mas insere conteúdo detalhado sobre os incisos I e II do art. 16 da LRF que não consta no material fornecido, comprometendo a fidelidade estrita ao contexto.

### t-me-epp-80k-01 — overall 64.0%
_processo licitatório deve ser destinado exclusivamente à participação de microempresas, empresas de pequeno porte e_

faith 60.0% · cit 60.0% · compl 80.0%
- issues: Cita 'Decreto nº 11.462/2023' como regulamentador do SRP na Lei 14.133/2021, mas esse decreto não consta em nenhum lugar do material fornecido — informação externa inventada; Trata o 'Acórdão TCU 533/2026 - Plenário' como jurisprudência real e vigente sem notar a inconsistência temporal (data futura, sem número de processo/relator), incorporando-o acriticamente à síntese; Afirma que o entendimento do Inf. 85/2011 'foi construído no regime da Lei 8.666/1993', inferência não sustentada literalmente pelo texto do informativo (que cita apenas Decreto 3.931/2001); Estrutura e citações da LC 123/2006, Lei 14.133/2021 e ON AGU 47/2014 são fiéis e bem reproduzidas
- A resposta é majoritariamente fiel e bem referenciada quanto aos dispositivos legais, mas introduz uma fonte externa não presente no material (Decreto 11.462/2023) e trata acriticamente um acórdão com data futura suspeita como jurisprudência vigente, prejudicando fidelidade e precisão das citações.

### t-sancao-abrangencia-01 — overall 76.0%
_penalidade de suspensão temporária do art. 87, III, da Lei 8.666/1993 restringe seus efeitos ao ente responsável pela_

faith 70.0% · cit 90.0% · compl 60.0%
- issues: Omite o Acórdão TCU 2530/2023, fonte diretamente pertinente e recente sobre o mesmo tema (suspensão do Exército só vale para si mesmo); Extrapola a conclusão do parecer da AGU sobre 'toda a estrutura orgânica da mesma Força' sem ressalvar que é interpretação específica ao caso das Forças Armadas; Inclui ON AGU 49/2014, tema conexo mas não central à pergunta (efeitos temporais, não abrangência subjetiva), desviando parcialmente o foco; Apresenta tabela comparativa 'órgão/entidade' vs 'ente federativo' como mudança normativa assentada, sem indicar que essa leitura é inferência própria do assistente, não expressamente afirmada pelo material
- Citações e trechos entre aspas conferem com o material, sem fabricação evidente, mas há extrapolações interpretativas apresentadas com certo grau de certeza excessivo. A resposta deixa de usar o Acórdão TCU 2530/2023, fonte claramente pertinente e recente sobre o mesmo tema, prejudicando a completude.

### t-bpc5-nao-fiscalizacao-01 — overall 79.0%
_manifestação da ELIC limita-se ao exame da minuta e dos elementos jurídicos do ato submetido a parecer, não lhe_

faith 85.0% · cit 85.0% · compl 55.0%
- issues: Omite o Parecer 051/2010/DECOR/CGU/AGU, que trata exatamente da limitação da atuação das consultorias jurídicas à manifestação jurídica - fonte mais pertinente à pergunta; Aplica lógica do RDC (Lei 12.462/2011, Inf. 417/2021) à Lei 14.133/2021 por analogia sem base normativa expressa, embora sinalize a ressalva; Não localizou a fonte exata do enunciado citado na pergunta, mas isso foi honestamente admitido; Resposta extensa que dilui o foco específico da pergunta truncada
- As citações usadas (Art. 53, ON 54/2014, Inf. 417/2021, Art. 10, Acórdão 1521/2025) são fiéis ao material e corretamente atribuídas, mas a resposta deixou de citar o Parecer 051/2010/DECOR/CGU/AGU, que é a fonte mais diretamente relevante ao tema da limitação da manifestação jurídica.

### t-competencia-elic-bpc7-01 — overall 80.0%
_análise jurídica da ELIC restringe-se aos aspectos estritamente jurídicos do procedimento, excluídas as questões de_

faith 70.0% · cit 90.0% · compl 80.0%
- issues: A conclusão central (exclusão de mérito administrativo, técnico e econômico-financeiro) é uma inferência do assistente, não uma citação literal do material fornecido; A resposta tenta reconstruir uma pergunta truncada sem confirmar o enunciado exato, ainda que ressalve isso ao final; Não há citações inventadas; todos os artigos e acórdãos citados constam no material
- As citações usadas (Art. 53, 8, 10, 169, Acórdãos) são fiéis ao material, mas a conclusão final sobre o que fica 'excluído' da análise jurídica é extrapolação do assistente, não extraída literalmente das fontes. A cobertura das fontes relevantes é boa, mas a resposta central à pergunta específica permanece especulativa.

### t-atestados-limites-01 — overall 80.0%
_exigências de qualificação técnica por meio de atestados submetem-se a limites cumulativos: quantitativos mínimos até_

faith 70.0% · cit 85.0% · compl 90.0%
- issues: Seção 'Vedações Complementares no Mesmo Artigo' mistura texto do art. 67 (Lei 14.133) com jurisprudência do Inf. 346/2018 sob a Lei 8.666/1993, sugerindo indevidamente que a vedação de limites de atestados consta do próprio art. 67, quando na verdade o §2º do art. 67 permite exigir quantidade mínima até 50%; O aviso sobre a jurisprudência ser da lei revogada é dado, mas a organização do texto ainda gera confusão entre regimes normativos distintos; Poderia ter citado a Súmula-TCU 263 mencionada no Acórdão 924/2022, presente no material, para reforçar o histórico jurisprudencial
- A resposta identifica corretamente os limites cumulativos do art. 67 (§1º 4% e §2º 50%) com citações fiéis, mas mistura de forma pouco clara jurisprudência da Lei 8.666/1993 sob o rótulo de 'mesmo artigo' da Lei 14.133/2021, gerando leve imprecisão conceitual; ainda assim é bastante completa quanto às fontes relevantes do material.

### t-srp-contratacao-unica-01 — overall 84.0%
_Sistema de Registro de Preços não se presta a contratação única e exauriente previamente definida; nesses casos, a ata_

faith 90.0% · cit 80.0% · compl 80.0%
- issues: Cita 'art. 4º, inc. II, do Decreto 11.462/2023' - verificar se corresponde exatamente ao original (material usa mesma citação, ok); Não menciona o Acórdão 546/2024-TCU-Plenário como origem do caso Unifesp de forma explícita separada do Inf.508, mesclando fontes sem citar o número do acórdão 546/2024 diretamente no corpo; Poderia ter citado também os Acórdãos 1443/2015 e 1712/2015 mencionados como precedentes, mas apenas os reproduz via citação indireta sem tratá-los como fontes próprias; Não menciona o Decreto 11.462/2023 art. 3º como fundamento normativo direto na síntese final, embora citado no corpo; Resposta é longa mas fiel; pequena redundância entre seções não compromete a fidelidade
- A resposta é fiel ao material, com citações corretas de Inf. 508/2025, Acórdão 1351/2025 e Manual TCU 5.9.4, cobrindo os pontos centrais da pergunta; falta apenas maior integração explícita dos acórdãos citados como precedentes (1443/2015 e 1712/2015).

### t-cadin-01 — overall 86.0%
_inscrição da contratada no CADIN, posteriormente a 16 de setembro de 2024, impede a celebração de contratos, convênios,_

faith 80.0% · cit 90.0% · compl 90.0%
- issues: Item 8 afirma que o entendimento do Inf. TCU 40/2010 está 'superado' como conclusão apresentada quase como extraída do parecer, mas é inferência do assistente não expressa no material; Item 7 conecta o art. 91 §4º da Lei 14.133/2021 ao tema CADIN como 'integração sistêmica', conexão não feita explicitamente no parecer; Corrige tacitamente a data da Portaria Conjunta (de '202' para '2023') sem indicar que se trata de ajuste/correção de digitação do material; Pequena reformulação da frase final do item VI (parafraseia 'sem se descuidar' como 'sem prejuízo') sem alterar sentido, mas mistura citação e paráfrase sem aspas claras
- A resposta é predominantemente fiel e bem estruturada, cobrindo quase todos os pontos do Parecer 00063/2024 e citando corretamente os dispositivos, mas insere pequenas inferências e conexões próprias apresentadas com pouca distinção do texto-fonte.

### t-lgpd-signatarios-01 — overall 86.0%
_minutas de contratos e aditivos não devem conter números de documentos pessoais dos signatários, cabendo a_

faith 80.0% · cit 90.0% · compl 90.0%
- issues: Explicação 'já que este particular não possui matrícula funcional...' é inferência do assistente, não está no material; Conexão com art. 19, IV da Lei 14.133/2021 ao tema de documentos pessoais é extrapolação não fundamentada no contexto original; Observação sobre 'contextualização histórica/comparativa' do art. 61 da Lei 8.666/93 é interpretação própria não extraída do parecer
- A resposta reproduz corretamente as citações e trechos literais do PARECER 00004/2022 e do art. 89, §1º, mas acrescenta pequenas inferências e conexões (art. 19, IV; justificativa sobre matrícula) não explicitamente sustentadas pelo material. Cobertura dos pontos relevantes à pergunta específica é adequada.
