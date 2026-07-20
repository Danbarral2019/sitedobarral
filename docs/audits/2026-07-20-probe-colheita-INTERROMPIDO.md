# Probe de colheita de citantes — INTERROMPIDO nos portões (Task 1)

**Data:** 2026-07-20
**Spec:** `docs/superpowers/specs/2026-07-20-colheita-citantes-tcu-probe-design.md`
**Plano:** `docs/superpowers/plans/2026-07-20-colheita-citantes-tcu-probe.md`
**Resultado:** portões 1 e 3 **reprovados**. O probe encerrou na Task 1, antes de qualquer chamada de LLM, conforme previsto. Custo gasto: zero em LLM.

## O que reprovou

### Portão 1 (spec §3.1) — REPROVADO

A busca do TCU **não é full-text sobre o inteiro teor**. O endpoint `POST https://pesquisa.apps.tcu.gov.br/api/publico/entidades/busca` é uma **consulta de entidade por número**: devolve o próprio acórdão procurado e suas variantes de ATA/colegiado — nunca os acórdãos que o citam.

Medido nos 3 casos da spec, com resultado idêntico:

| Caso | Entidades | O que são |
|---|---|---|
| 2219/2023 | 3 | ACÓRDÃO 2219/2023 ATA 46/2023-Plenário · ACÓRDÃO DE RELAÇÃO 2219/2023 · ACÓRDÃO 2219/2023 ATA 7/2023 |
| 1009/2018 | 3 | ACÓRDÃO 1009/2018 ATA 9/2018 · ACÓRDÃO DE RELAÇÃO 1009/2018 · ACÓRDÃO 1009/2018 ATA 3/2018 |
| 3648/2013 | 3 | ACÓRDÃO 3648/2013 ATA 49/2013 · ACÓRDÃO 3648/2013 ATA 21/2013 · ACÓRDÃO DE RELAÇÃO 3648/2013 |

Zero citantes em qualquer um dos três. O limiar da spec era **>20 citantes distintos em ao menos um caso**. Paginação (`?inicio=10&quantidade=10`) não altera o resultado: mesmo primeiro título, mesmas 3 entidades.

O 2219/2023 é citado por 121 acórdãos segundo o nosso grafo. A busca devolve 3 registros dele mesmo. Não há ambiguidade no diagnóstico.

### Portão 3 (spec §3.3) — REPROVADO

- **Rota 1 (payload da busca):** a entidade tem exatamente 4 campos — `titulo`, `subtitulo`, `texto`, `link`. Nenhum campo de arquivo, RTF, PDF ou download.
- **Rota 2 (página do documento):** nenhuma URL candidata. A página é um **SPA Angular** (22 kB de casca, `runtime.*.js`, `polyfills.*.js`, `main.*.js`; sem "inteiro teor" e sem "VOTO" no HTML servido). O link do RTF só existe depois que o JavaScript roda.

⚠️ O spike marcou `rota2_htmlEhSpa: false` — **falso negativo da heurística**, que procurava marcadores de React/Next (`<div id="root"`, `__NEXT_DATA__`) numa aplicação Angular. A página **é** SPA. A conclusão do portão não muda; a heurística é que estava errada.

## De onde veio a premissa errada

A spec §1.3 afirmava que a busca é full-text e que buscar `"1441/2016"` retorna os acórdãos que o mencionam. Isso **nunca foi verificado**. A descoberta de 2026-07-19 (`Content-Type: text/plain`) provou outra coisa: que dá para achar **o próprio acórdão** por número — que é exatamente o que `lib/tcu/buscar-acordao-tcu.ts` faz, e faz bem. O salto de "acha o acórdão" para "acha quem cita o acórdão" foi suposição, e a arquitetura inteira da colheita dirigida (opção C2) foi desenhada sobre ela.

**Nada disso afeta a Fase 2-A.** `buscarAcordaoPorNumero` usa o endpoint para o fim correto (obter ementa/relator/colegiado do próprio acórdão) e continua válido, assim como o GO da calibração de teses.

## O que a interrupção NÃO significa

**A opção C não está morta — a rota dirigida (C2) está.** Um teste adicional de 3 requisições mostrou que a API de dados abertos **pagina para trás no histórico**, e cada item já vem com a URL do RTF:

| `inicio` | Acórdãos devolvidos | Tem `urlArquivo` |
|---|---|---|
| 0 | 1898/2026, 1897/2026, 1896/2026 (15/07/2026) | sim |
| 5.000 | 1808/2026, 1807/2026 (14/04/2026) | sim |
| 50.000 | 14057/2023, 14056/2023, 14055/2023 (05/12/2023) | sim |

Isso tem duas consequências:

1. **O portão 3 deixa de existir por essa rota.** O id opaco do RTF vem de graça no item do feed — não é preciso resolvê-lo.
2. **A opção C1 (volume) é viável**, e é a única forma restante de ampliar a base. Ela não permite mirar os citantes de um caso específico: engorda os dossiês como efeito colateral de ingerir muitos acórdãos.

Ordem de grandeza, a confirmar: `inicio=50.000` chega a dez/2023, então são ~50 mil acórdãos por ~2,6 anos. O custo dominante continua sendo tempo — a 1 req/s, dezenas de milhares de downloads são dezenas de horas de relógio. Storage segue irrelevante (~US$ 0,35/GB-mês).

## Recomendação

A decisão volta ao Daniel, com três caminhos:

1. **Opção A — profundidade curada.** Lançar o sistema de teses com os ~40 leading cases de dossiê gordo, todos na faixa de qualidade que ele já julgou fiel. Independe de tudo isto.
2. **Opção C1 — ampliar por volume.** Novo spec e novo plano: ingestão em massa pelo feed de dados abertos paginado, medindo antes, num lote pequeno, quanto de citação-no-voto cada mil acórdãos ingeridos realmente rende. Sem essa medição, C1 é aposta.
3. **A e C1 em paralelo.** A entrega visível não fica refém da ingestão.

## Artefatos

- `docs/audits/2026-07-20-portoes-colheita.json` — saída bruta do spike.
- `scripts/spike-rota-inteiro-teor.ts` — spike (mantido como evidência; seria removido na Task 3, que não ocorreu).
- Tarefas 2 a 8 do plano: **não executadas**.
