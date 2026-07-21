# Handoff — 21/07/2026 — sistema de teses do TCU (frentes A e C1)

**Este arquivo está versionado de propósito.** O ledger que usei durante a sessão (`.superpowers/sdd/progress.md`) está no `.gitignore` e **não viaja entre máquinas**. Este documento é a fonte da verdade para retomar em outro computador.

---

## 0. LEIA ISTO PRIMEIRO — o que fazer ao retomar

```bash
git pull
npx dotenv-cli -e .env.local -- npx tsx scripts/status-campanha-tcu.ts
```

Compare a saída com o §3 abaixo. Três decisões possíveis:

| O que o status mostra | O que fazer |
|---|---|
| `concluído: SIM` **e** `chegou até` uma data de **dez/2023 ou anterior** | Campanha terminou de verdade. **Reverter os schedules** (§4) e seguir para a onda A-W2 (§5). |
| `concluído: SIM` mas `chegou até` uma data **posterior** a dez/2023 | ⚠️ Parada prematura de novo — mesmo defeito do §2. Investigar antes de qualquer coisa; a correção do §2 deveria ter impedido. |
| `concluído: não`, cursor avançando | Campanha em andamento. Não mexer nos schedules. Pode tocar a frente A em paralelo. |

**Pré-requisito na máquina nova:** o `.env.local` não está no git. Ele precisa existir com pelo menos `DATABASE_URL`, `CRON_SECRET`, `ANTHROPIC_API_KEY` e `GEMINI_API_KEY`. Ver `.env.example` e `SETUP.md`.

---

## 1. Onde as duas frentes chegaram

**Frente C1 — ingestão retroativa (em produção).** PRs #162 (mecanismo) e #163 (aceleração). O portão da onda W1 deu **GO**: 2.389 arestas novas no voto contra critério de 1.000. Cron `backfill-tcu-retroativo` caminha o feed de dados abertos para trás; `catalog-tcu-inteiro-teor` baixa o inteiro teor; `sync-precedentes-tcu` extrai as arestas. Tudo desassistido.

**Frente A — sistema de teses (em produção).** PR #164, onda A-W1. Schema versionado (`TeseDestilacao`, `TeseEnunciado`, `TeseDivergencia`), o módulo `lib/tcu/carregar-veredito.ts`, o núcleo `lib/tcu/persistir-tese.ts` e o cron `destilar-teses-tcu` (7h15, lote 5). **Termina sem teses no banco de propósito** — ver §5.

O motor de destilação (`lib/tcu/destilar-tese.ts`) recebeu **GO do Daniel em 20/07**: 4/4 teses julgadas fiéis, 2/2 divergências procedem. Não alterar prompt nem parâmetros sem novo julgamento dele.

---

## 2. ⚠️ Defeito encontrado e corrigido no fim da sessão — leia antes de confiar no cursor

A campanha **parou sozinha e prematuramente**. O status mostrava `concluído: SIM` com o cursor no offset 16500, ainda em **12/08/2025** — muito longe do alvo de 01/12/2023. Como `concluido` era terminal, ela nunca mais voltaria a andar.

**Causa:** o cron tratava resposta vazia ou não-array do feed como "fim do feed" e marcava `concluido: true` em definitivo. Diagnóstico: os offsets 16000 e 16500 devolvem 500 itens normais de 2025, nenhum anterior ao alvo — ou seja, não foi a data. Foi um soluço transitório da API (HTTP 200 com corpo vazio/inesperado).

**Origem do defeito:** uma revisão apontou, corretamente, que `concluido` não estava sendo persistido nesse caminho. A correção aplicada resolveu persistindo — e escolheu a direção que falha de forma destrutiva. O comportamento seguro era não avançar e não concluir.

**O que foi feito (21/07):**
1. `BackfillCursor.concluido` voltou para `false` no banco — a campanha foi reaberta e retomou do offset 16500.
2. O cron foi corrigido: resposta vazia agora **para o run sem concluir e sem avançar o cursor**. O único sinal de fim aceito é a **data** (`atingiuAlvo`), que é determinística. Um contador `respostaVazia` foi acrescentado ao corpo e à telemetria, para uma parada por esse motivo ficar visível no histórico de execuções.

**Lição para o resto do sistema:** em processo longo desassistido, um estado terminal só deve ser gravado a partir de sinal determinístico vindo do dado. "Não recebi nada" é ambíguo — falha visível é melhor que falha terminal.

---

## 3. Estado medido em 21/07 (após a reabertura)

| | |
|---|---|
| Cursor no feed | offset 16.500, chegou a 12/08/2025 · alvo 01/12/2023 |
| Ingeridos (`category = 'acordao-grafo'`) | 4.820 · descartados 9.961 (acórdãos de relação, 80% do feed) |
| Fila de catalogação | 2.918 pendentes · 3.739 catalogados · 19 desistidos |
| Grafo | 25.381 arestas · 8.033 no voto (31,6%) |
| **Faixa aproveitável (≥5 citações no voto)** | **126 leading cases** (era ~38 antes da campanha) |

Distribuição: ≥20 → 18 casos · 10-19 → 19 · 5-9 → 89 · 2-4 → 1.003 · <2 → 9.311.

---

## 4. Pendência operacional (tarefa do assistente, não do Daniel)

Dois crons em `vercel.json` estão acelerados **temporariamente** para a campanha. Quando ela concluir de verdade (§0), voltar:

| Cron | Ritmo da campanha | Voltar para |
|---|---|---|
| `catalog-tcu-inteiro-teor` | `*/10 * * * *` | `30 6 * * *` |
| `backfill-tcu-retroativo` | `15 */3 * * *` | `15 6 * * *` |

**O Daniel decidiu em 21/07 que não vai acompanhar isto — não cobrar dele.** Magnitude honesta: com a fila vazia cada execução encerra em ~1s, então o desperdício é de centavos. É higiene, não emergência. O motivo de arrumar é que o repositório já tem esse histórico (`FUTURE_TASKS.md` registra o `process-index-jobs` rodando de 15 em 15 min sem dado novo por meses).

---

## 5. Próxima onda: A-W2 (o backfill das teses)

A onda A-W1 entregou o mecanismo e **nenhuma tese no banco**, deliberadamente: os dossiês engordam de hora em hora, e destilar durante a campanha devolveria à fila do Daniel enunciados recém-aprovados.

**Quando a campanha assentar, a A-W2 é:**

1. Rodar a destilação nos casos da faixa aproveitável (126 hoje, provavelmente mais). Custo estimado **~US$ 4,50** (Claude Sonnet 5 a US$ 2/US$ 10 por milhão em preço introdutório até 31/08/2026; ~10k tokens de entrada e ~1,5k de saída por caso).
2. Gerar uma **folha de calibração** para o Daniel julgar, no formato que ele aprovou e pediu para repetir: card por item, tese em destaque, trecho-fonte literal, veredito de três vias, resumo que volta no export.
3. Classificação de assuntos em escala (hoje `assunto` é texto livre do motor).

Depois vêm A-W3 (a tela navegável de dois níveis) e A-W4 (o cron de fluxo contínuo já está no ar; a onda é o ajuste fino).

**Dois números escolhidos com pouca evidência, abertos para calibrar com o dado da A-W2:** o limiar de **5 citações-no-voto** para entrar na fila (`MIN_NO_VOTO` em `lib/tcu/persistir-tese.ts`) e o **lote de 5 casos/dia** no cron (`LOTE` em `app/api/cron/destilar-teses-tcu/route.ts`).

---

## 6. Decisões de desenho que NÃO devem ser desfeitas sem falar com o Daniel

| Decisão | Por quê |
|---|---|
| **Comparação de enunciado por igualdade EXATA** (`lib/tcu/carregar-veredito.ts`) | Normalizar espaços/pontuação/caixa seria o sistema decidindo que duas redações são a mesma tese. Esse julgamento é do Daniel — a tese sai com a assinatura dele. Um review provavelmente vai sugerir normalizar "para reduzir retrabalho": levar a ele, não aplicar. |
| **Versionar a destilação inteira, não a tese individual** | O motor pode reordenar, fundir ou dividir teses entre rodadas; "a tese 2 do acórdão" não é identidade estável. |
| **Invisibilidade do combustível por construção** (`category: 'acordao-grafo'`, `isPublic: false`, `reviewedBy: 'backfill-grafo'`) | Um marcador booleano seria fail-open: 17 superfícies a tocar, incluindo o clipping que vai por e-mail a assinantes. Nunca usar `CATEGORIAS_ACORDAO` numa superfície do site — ela é só para filas de processamento. |
| **Não ingerir acórdãos de relação** | Medido: 1 a 6 kB, nenhuma seção, sem voto. São 80% do feed e não rendem trecho nenhum. |
| **Não indexar o combustível na busca/RAG** | Decisão explícita do Daniel. Reabrir só com medição no eval framework. |

---

## 7. Documentos de referência

- Specs: `docs/superpowers/specs/2026-07-{19,20,21}-*.md`
- Planos: `docs/superpowers/plans/2026-07-{20,21}-*.md`
- Resultado do portão da campanha: `docs/audits/2026-07-21-w1-ingestao-retroativa.md`
- Probe descartado (a busca do TCU não é full-text): `docs/audits/2026-07-20-probe-colheita-INTERROMPIDO.md`
- Status ao vivo: `npx dotenv-cli -e .env.local -- npx tsx scripts/status-campanha-tcu.ts`
