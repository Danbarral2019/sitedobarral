# Eval de Síntese — verify-claude-opusjudge

- **runAt:** 2026-07-06T21:39:35.004Z
- **sintetizador:** claude-sonnet-5 · **juiz:** claude-opus-4-8
- **avaliadas:** 5 · **vazias (sem retrieval):** 0

## Métricas agregadas

| Dimensão | Média |
|---|---|
| Faithfulness (anti-alucinação) | 89.0% |
| Citation accuracy | 92.0% |
| Completeness | 96.0% |
| **Overall** (fidelidade pesa 2×) | **91.6%** |

## Piores casos (menor overall)

### q-data-a-data — overall 68.0%
_sistema data a data_

faith 70.0% · cit 60.0% · compl 80.0%
- issues: Cita 'Súmula TCU nº 45' que não consta do material (citação externa, embora ressalvada como não presente); Conceituação de 'sistema data a data' é extrapolação doutrinária não sustentada literalmente pelo Enunciado INCP nº 14; Excesso de inferências sobre contagem 'dia a dia' não presentes no contexto
- A resposta usa corretamente o Enunciado INCP nº 14 como base e é transparente sobre limitações, mas introduz conceitos e citações externas (Súmula TCU 45) não constantes do material.

### q-dialogo-competitivo — overall 96.0%
_diálogo competitivo hipóteses cabimento_

faith 90.0% · cit 100.0% · compl 100.0%
- issues: Afirma que o Parecer DECOR fixa entendimento 'vinculante', qualificação não presente no material; Atribui critérios de pré-seleção ao inciso II ao citar o Enunciado INCP 8, mas o enunciado refere-se ao inciso II do §1º do art. 32 — consistente, porém a resposta mistura com 'critérios de habilitação' de forma levemente ampliada
- A resposta é fiel e completa, cobrindo todas as fontes relevantes com citações corretas; o único desvio relevante é a atribuição de caráter 'vinculante' ao parecer, não amparada pelo material.

### q-dispensa-valor — overall 98.0%
_dispensa de licitação por valor_

faith 95.0% · cit 100.0% · compl 100.0%
- issues: Afirma que Decreto 12.807/2025 é o vigente e sugere que Manual reflete 2024, mas o material não confirma qual valor corresponde a qual decreto - leve especulação; Duplicação: cita R$125.451,18 para consórcio em outros serviços, replicando possível erro do Manual (deveria ser ~R$125.451,15)
- Resposta altamente fiel e completa, cobrindo todas as fontes relevantes do material com citações corretas. Pequena especulação sobre correspondência entre decretos e valores atualizados, mas devidamente sinalizada como recomendação de conferência.

### q-inexigibilidade-notoria — overall 98.0%
_inexigibilidade notória especialização_

faith 95.0% · cit 100.0% · compl 100.0%
- issues: Afirma que o requisito da singularidade 'tende a permanecer relevante' sob a nova lei — inferência não sustentada pelo material, embora bem sinalizada como ressalva
- A resposta é fiel ao material, cita corretamente todos os artigos, súmula, acórdão, parecer e enunciado presentes, e cobre todas as fontes relevantes. Faz ressalvas adequadas sobre precedentes formados sob a Lei 8.666/93.

### q-pregao-bens-comuns — overall 98.0%
_pregão bens e serviços comuns_

faith 95.0% · cit 100.0% · compl 100.0%
- issues: Art. 29 caput é citado no material apenas de forma truncada; a resposta atribui a ele detalhes de rito/inversão de fases que no material vêm do Manual TCU, não do texto do Art. 29
- A resposta é altamente fiel e usa corretamente todas as fontes relevantes do material, com citações precisas. Pequena imprecisão ao vincular ao Art. 29 detalhes procedimentais que o material atribui ao Manual TCU.
