# Eval de Síntese — smoke

- **runAt:** 2026-07-07T22:09:29.949Z
- **sintetizador:** default (task chat) · **juiz:** claude-sonnet-5
- **avaliadas:** 3 · **vazias (sem retrieval):** 0

## Métricas agregadas

| Dimensão | Média |
|---|---|
| Faithfulness (anti-alucinação) | 86.7% |
| Citation accuracy | 91.7% |
| Completeness | 85.0% |
| **Overall** (fidelidade pesa 2×) | **88.3%** |

## Piores casos (menor overall)

### q-inexigibilidade-notoria — overall 81.0%
_inexigibilidade notória especialização_

faith 70.0% · cit 90.0% · compl 85.0%
- issues: Não alerta que ON AGU 18/2009 e Parecer 141/2011/DECOR/AGU se baseiam no art. 25 da Lei 8.666/93 (revogada), criando falsa impressão de aplicação direta à Lei 14.133/2021; Ressalva de desatualização foi feita só para a Súmula TCU 39, tratamento inconsistente com as demais fontes na mesma situação; Lista apenas 4 dos 8 incisos do Art. 72 sem indicar que é rol parcial; Demais citações (Art. 74, §3º, §4º, Art. 72, Art. 73, Enunciado IBDA 24, Informativo 59/2011) estão corretas e fiéis ao material
- A resposta é tecnicamente correta e bem estruturada, mas mistura sem ressalva fontes baseadas na Lei 8.666/93 revogada com o regime da Lei 14.133/2021, exceto para a Súmula 39, gerando inconsistência de tratamento; a instrução do Art. 72 é apresentada de forma incompleta sem sinalizar isso.

### q-dispensa-valor — overall 88.0%
_dispensa de licitação por valor_

faith 90.0% · cit 85.0% · compl 90.0%
- issues: Atribui a preferência para ME/EPP (até R$80.000,00) ao Art. 4º da Lei 14.133/2021, mas o material só vincula essa regra ao Manual TCU, não ao art. 4º especificamente; Poderia detalhar melhor a duplicação de valores citando os números específicos (R$250.902,30 e R$125.451,18) presentes no manual, mas omite isso
- A resposta é bem fundamentada e fiel ao material, cobrindo praticamente todas as fontes relevantes disponíveis, com pequena imprecisão na atribuição da regra de ME/EPP ao art. 4º. Citações de artigos, enunciado e pareceres estão corretas e bem contextualizadas.

### q-data-a-data — overall 96.0%
_sistema data a data_

faith 100.0% · cit 100.0% · compl 80.0%
- issues: Não menciona Orientação Normativa AGU 38/2011 nem Enunciado INCP nº 15, disponíveis no material sobre prazos/prorrogação; Observação sobre 'precedente anterior à Lei 14.133' é inferência do assistente, não expressa no material, embora plausível
- A resposta é fiel ao material, com citações corretas de artigos (183, 106, 107, 110, 114) e documentos (Parecer AGU, Inf. TCU 199/2014); apenas deixou de citar duas fontes disponíveis (ON AGU 38/2011 e Enunciado INCP 15) que poderiam complementar o tema.
