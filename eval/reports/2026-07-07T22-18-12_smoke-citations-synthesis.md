# Eval de Síntese — smoke-citations

- **runAt:** 2026-07-07T22:18:12.432Z
- **sintetizador:** claude-sonnet-5 + Citations API · **juiz:** claude-sonnet-5
- **avaliadas:** 3 · **vazias (sem retrieval):** 0

## Métricas agregadas

| Dimensão | Média |
|---|---|
| Faithfulness (anti-alucinação) | 88.3% |
| Citation accuracy | 95.0% |
| Completeness | 93.3% |
| **Overall** (fidelidade pesa 2×) | **92.0%** |

## Piores casos (menor overall)

### q-inexigibilidade-notoria — overall 90.0%
_inexigibilidade notória especialização_

faith 90.0% · cit 90.0% · compl 90.0%
- issues: Completa a citação truncada da ON/AGU 18/2009 com a palavra 'singularidade', que não aparece literalmente no trecho fornecido (cortado); Pequenos comentários interpretativos do assistente (ex.: sobre subcontratação e justificativa de preço) não são citações diretas, mas estão devidamente distinguidos do texto legal; Não há erros de atribuição de citações a fontes erradas
- A resposta é fiel e bem fundamentada, com citações corretas dos artigos, súmula, informativo, parecer e enunciado, cobrindo todas as fontes relevantes do material com boas ressalvas sobre a vigência da Lei 8.666/1993.

### q-data-a-data — overall 92.0%
_sistema data a data_

faith 85.0% · cit 100.0% · compl 90.0%
- issues: Afirma que a Lei 14.133 'internalizou'/'absorveu' a lógica do parecer da AGU, conexão não expressamente sustentada pelo material; Tabela comparativa é construção interpretativa do assistente, apresentada como fato consolidado sem ressalva de que é dedução própria; Rótulo de 'precedente histórico' e observações de aplicabilidade são inferências razoáveis mas extrapolam o texto fornecido
- A resposta cita corretamente art. 183 e o Parecer 035/2013/DECOR/CGU/AGU, sem inventar dispositivos, mas constrói comparações e conclusões de 'evolução normativa' que são inferências do assistente não expressamente respaldadas pelo material. Cobertura das fontes relevantes é boa e focada no tema perguntado.

### q-dispensa-valor — overall 94.0%
_dispensa de licitação por valor_

faith 90.0% · cit 95.0% · compl 100.0%
- issues: Atribui ao Decreto 12.807/2025 a origem exata dos valores atualizados do Manual TCU, conexão causal não explicitada no material; Resposta extensa, mas sem afirmações claramente inventadas ou fora do contexto
- A resposta é extremamente completa, cobrindo praticamente todas as fontes relevantes do material (Lei, Manual TCU, Enunciado CJF 50, ONs AGU 69/2021, 87/2024, 105/2026, Parecer CGU/AGU, Informativo 377/2019, IN Seges/ME 65/2021 e 67/2021) com citações fiéis e corretamente atribuídas. A única fragilidade é uma inferência causal não comprovada explicitamente sobre a origem dos valores atualizados via Decreto 12.807/2025.
