# Design — Ingestão retroativa de acórdãos do TCU (frente C1)

**Data:** 2026-07-20
**Status:** aprovado (brainstorming), aguarda plano de implementação
**Objetivo estratégico:** engordar os dossiês de uso dos leading cases, para que casos hoje magros cruzem o limiar e rendam tese fiel.
**Relacionado:** `2026-07-20-colheita-citantes-tcu-probe-design.md` (a colheita dirigida, **descartada** — ver `docs/audits/2026-07-20-probe-colheita-INTERROMPIDO.md`); `2026-07-19-destilacao-teses-tcu-probe-design.md` (motor de teses, **GO** em 20/07).

## 1. Contexto

A opção C2 (colher citantes pela busca do TCU) morreu nos portões: a busca é consulta de entidade por número, não full-text. Sobrou a via de volume — ingerir muitos acórdãos e deixar os dossiês engordarem como efeito colateral.

Ela é viável porque a API de dados abertos **pagina para trás no histórico** e cada item já traz a URL do RTF:

| `inicio` | Acórdão devolvido | Data da sessão |
|---|---|---|
| 0 | 1898/2026 | 15/07/2026 |
| 5.000 | 1808/2026 | 14/04/2026 |
| 50.000 | 14057/2023 | 05/12/2023 |

**Decisões do Daniel (20/07):** alcance **até dez/2023 (~50 mil acórdãos)**; os ingeridos são **combustível do grafo — fora da busca e do assistente de IA**.

## 2. O que já existe e será reusado inteiro

A cadeia a jusante está pronta e é **zero LLM**:

1. `catalog-tcu-inteiro-teor` (cron 6h30) — fila `tcuAnalise IS NULL AND tcuLinkPDF IS NOT NULL AND tcuAnaliseTentativas < 3`; baixa o RTF, converte, secciona e analisa via `lib/tcu/catalogar-acordao.ts`. `analisarAcordao` é regex e casamento de termos — **não chama modelo**.
2. `sync-precedentes-tcu` (cron 6h45) — fila `tcuTextoCompleto IS NOT NULL AND (precedentesVersao IS NULL OR < PRECEDENTES_VERSAO)`; extrai as arestas para `AcordaoCitacao`.

Ambas as filas são **auto-drenantes por estado em coluna** e sem cursor externo. Logo, **o trabalho novo é só colocar as linhas `Document` na frente da esteira**; o resto anda sozinho.

Isso também significa que o custo de LLM da frente C1 inteira é **zero**. O modelo só entra na destilação de tese, uma vez por leading case, na frente A.

## 3. O gargalo real, que dita o desenho

O feed é rápido: uma requisição devolve até 500 itens de metadado. Inserir 50 mil linhas leva minutos.

O gargalo é o **download do RTF** em `catalog-tcu-inteiro-teor`: `LOTE = 30` por execução, `TIME_BUDGET_MS = 250_000`, `maxDuration = 300`, cron **diário**. São ~8 s por acórdão (arquivos de 227 kB a 14,5 MB). No ritmo atual, 30 por dia — 50 mil acórdãos levariam mais de quatro anos.

**Portanto o desenho não é "escrever um importador", é "destravar a esteira".** Com ~8 s por item e 250 s de orçamento, cada execução comporta ~30 itens; a alavanca disponível é a **frequência do cron**, não o tamanho do lote.

| Frequência de `catalog-tcu-inteiro-teor` | Itens/dia | 50 mil em |
|---|---|---|
| diária (hoje) | 30 | 4,5 anos |
| de hora em hora | 720 | 69 dias |
| a cada 10 min | 4.320 | 12 dias |
| a cada 5 min | 8.640 | 6 dias |

**Decisão:** elevar a frequência a cada 10 minutos durante a campanha, e voltar ao ritmo diário quando a fila drenar. 12 dias de execução desassistida é compatível com o "aguardo o tempo que for necessário" do Daniel, sem prender nenhuma sessão.

**Custo a nomear:** ~111 horas de execução de função na Vercel ao longo da campanha (50.000 × 8 s). É um gasto de compute pontual, na casa de dezenas de dólares, não de centavos como o storage. Deve ser confirmado com o consumo real medido na onda W1 antes de liberar a campanha inteira.

## 4. Arquitetura

### 4.1 O que se constrói

Um único cron novo, `backfill-tcu-retroativo`, que caminha o feed de dados abertos **para trás** e insere linhas `Document` — nada além disso. Ele **não** baixa RTF, **não** enriquece, **não** embeda.

```
backfill-tcu-retroativo (novo)  →  insere Document (metadado + tcuLinkPDF)
        ↓ estado: cursor de offset no feed
catalog-tcu-inteiro-teor (existe, acelerado)  →  tcuTextoCompleto + tcuAnalise
        ↓
sync-precedentes-tcu (existe)  →  arestas em AcordaoCitacao
        ↓
dossiês engordam  →  frente A destila teses novas
```

### 4.2 O cursor

Este é o único ponto sem precedente no repositório. Os backfills existentes derivam a fila de colunas do próprio `Document` (`precedentesVersao`, `tcuAnalise`, `embeddingStatus`) — funciona porque a fila é sobre **nossas** linhas. Aqui o cursor é um **offset num feed externo**, que não é derivável do nosso estado: o feed é ordenado por recência, e a quantidade de acórdãos já ingeridos não corresponde ao offset.

**Decisão: um model novo e mínimo, `BackfillCursor`**, com uma linha por campanha:

```prisma
model BackfillCursor {
  id            String   @id                   // 'tcu-retroativo'
  offset        Int      @default(0)           // próxima posição a ler no feed
  ultimoAcordao String?                        // "14057/2023" — para conferência humana
  ultimaData    String?                        // "2023-12-05" — critério de parada
  totalInserido Int      @default(0)
  concluido     Boolean  @default(false)
  atualizadoEm  DateTime @updatedAt
}
```

Alternativas descartadas: guardar o offset em `ScraperHealthLog.metadata` (o log é telemetria por execução, e ler "a última execução bem-sucedida" quebra se uma execução falhar no meio); e derivar o offset por contagem (impreciso, porque o feed tem duplicatas de ATA e o acervo já tem acórdãos ingeridos por outra via).

Aditivo, uma linha, sem impacto em nada existente.

### 4.3 Critério de parada

O cron para quando `ultimaData < '2023-12-01'` — a data alvo da decisão do Daniel — e marca `concluido: true`. Parar por data, e não por offset fixo, torna a campanha robusta a mudanças no tamanho do feed.

### 4.4 Idempotência

Gratuita e já provada: a constraint `@@unique([acordaoNumero, acordaoAno, tcuOrgaoJulgador])` faz o `create` duplicado estourar `P2002`, que o `sync-tcu-acordaos` já trata como `skippedDuplicates` sem erro. O backfill reusa o mesmo tratamento. Rodar duas vezes o mesmo offset não corrompe nada.

## 5. As três exclusões — o que o backfill NÃO faz

Cada uma destas é uma armadilha real, não higiene teórica.

**5.1 Não chamar `enrichNewDocuments`.** O `sync-tcu-acordaos` dispara, por documento novo, indexação da Lei 14.133 mais **duas chamadas ao Gemini** (resumo executivo e classificação editorial), condicionadas apenas a `GEMINI_API_KEY` estar presente. Em 50 mil acórdãos isso seriam ~100 mil chamadas de modelo não orçadas. O backfill **não** compartilha esse caminho de código.

**5.2 Não marcar `embeddingStatus: 'pending'`.** O `sync-tcu-acordaos` marca assim. Hoje é inócuo, porque `process-index-jobs` não está agendado no `vercel.json` — mas deixar 50 mil documentos marcados como "pendentes de embedding" é plantar uma mina para quem reativar aquele cron um dia. O backfill grava **`embeddingStatus: 'skipped'`**, que é uma declaração explícita de intenção e não entra em nenhuma fila.

**5.3 Não deixar os acórdãos aparecerem nas superfícies do site.** São combustível; 50 mil acórdãos não curados nas listagens afogariam a interface. Marcador dedicado:

```prisma
tcuCombustivel Boolean @default(false)   // em Document
```

`true` para tudo que o backfill inserir. As superfícies que listam documentos filtram `tcuCombustivel: false`; as filas dos crons de catalogação e de precedentes **não** filtram — é justamente esse material que elas devem processar.

Não se usa `category` diferente de `'acordao'` para isso: a fila do `sync-precedentes-tcu` casa exatamente por `category: 'acordao'`, e mudar a categoria excluiria os documentos do grafo — que é o único motivo de eles existirem.

O plano de implementação deve **enumerar as superfícies** que precisam do filtro (listagens de documentos, busca global, jurisprudência, contadores do admin) e cobrir cada uma com teste. Uma superfície esquecida é um vazamento de 50 mil registros na interface.

## 6. As ondas

### W1 — medição e portão (uma sessão)

Ingerir um lote pequeno e medir o rendimento **real**, antes de liberar a campanha. Sem isso, C1 é aposta.

Entregas: model `BackfillCursor`, campo `tcuCombustivel`, cron `backfill-tcu-retroativo`, filtros nas superfícies, tudo mergeado. Depois: rodar o backfill até ~1.000 acórdãos e deixar a esteira processá-los.

**Métricas do portão**, medidas sobre os 1.000:
| Métrica | Por que |
|---|---|
| Acórdãos inseridos / duplicados | Confirma o alcance real do feed |
| % que rendeu `tcuTextoCompleto` com sucesso | Se o RTF falhar muito, a campanha rende menos |
| Arestas novas em `AcordaoCitacao` | O produto direto |
| **Citações no voto por mil acórdãos ingeridos** | **A métrica que decide** |
| Casos da faixa magra (2–4 no voto) que subiram de faixa | O efeito que se quer |
| Tempo médio por acórdão e consumo de função | Valida a projeção de 12 dias e o custo |

**Critério de GO, fixado agora:** os 1.000 acórdãos precisam render **≥ 400 citações novas no voto** (o acervo atual tem 9.208 no voto em 1.685 acórdãos, ou ~5,5 por acórdão; exigir ≥0,4 por acórdão é ~7% do rendimento histórico, um piso deliberadamente baixo, já que o backfill pega acórdãos de qualquer natureza, não a amostra curada de hoje). Abaixo disso, a campanha não se paga e a frente C1 encerra, seguindo só a frente A.

### W2 — campanha

Elevar `catalog-tcu-inteiro-teor` para cada 10 minutos, soltar o backfill até dez/2023, acompanhar por métrica. Nenhuma sessão fica presa: o progresso vive em `BackfillCursor` e em `ScraperHealthLog`.

Entregas: mudança de schedule no `vercel.json`, rota de leitura do progresso (ou consulta documentada), e a restauração do schedule diário ao fim.

### W3 — colheita do resultado

Quando a fila drenar: remedir a distribuição de citações-no-voto e reportar quantos leading cases cruzaram o limiar. Alimenta a onda A-W4 (destilação contínua).

## 7. Riscos

**7.1 O rendimento pode ser baixo.** Acórdãos de relação e decisões simplificadas quase não citam precedente em voto. É exatamente o que W1 mede, e por isso o portão existe antes da campanha.

**7.2 Duplicatas de ATA.** O mesmo número/ano aparece em ATAs e colegiados diferentes. A constraint inclui `tcuOrgaoJulgador`, então convivem como linhas distintas — comportamento já existente, não regressão.

**7.3 Volume de escrita no Neon.** 50 mil linhas mais ~2,5 GB de texto ao longo de 12 dias. Storage é irrelevante (~US$ 0,88/mês); o que merece atenção é o pico de CU-horas de escrita e a retenção de histórico, que infla o faturado durante a campanha.

**7.4 Superfície esquecida.** Ver §5.3 — é o risco de produto mais concreto desta frente.

**7.5 A API do TCU pode variar.** Se o feed mudar de forma ou o offset profundo passar a falhar, o cron deve registrar falha e parar de avançar o cursor, nunca avançar sem inserir.

## 8. Não-objetivos

- Indexar os ingeridos na busca ou no RAG (decisão explícita do Daniel; reabrir só com medição no eval framework).
- Enriquecer com resumo ou classificação editorial via LLM.
- Qualquer alteração no motor de destilação de teses — a frente A tem spec própria.
- Ir além de dez/2023 nesta campanha. O cursor permite estender depois sem refazer nada.
