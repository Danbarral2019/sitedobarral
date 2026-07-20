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

**Decisão:** elevar a frequência a cada 10 minutos durante a campanha, e voltar ao ritmo diário quando a fila drenar.

**A tabela acima supõe 50 mil itens catalogados. Com o filtro de tipo (§5.4), a fila real é de ~10 mil**, e a campanha cai para **~2,5 dias** a cada 10 minutos. Execução desassistida em qualquer um dos ritmos — nenhuma sessão fica presa.

**Custo a nomear:** ~22 horas de execução de função na Vercel ao longo da campanha (10.000 × 8 s). É um gasto de compute pontual, na casa de poucas dezenas de dólares, não de centavos como o storage. Deve ser confirmado com o consumo real medido na onda W1 antes de liberar a campanha inteira.

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

**5.3 Não deixar os acórdãos aparecerem nas superfícies do site.** São combustível; 50 mil registros não curados afogariam a interface — e, num caso, iriam por e-mail.

Uma enumeração exaustiva das consultas a `Document` encontrou **11 superfícies que obrigatoriamente precisariam de filtro** e mais 6 prováveis. As duas mais graves:
- `lib/clipping/sources/tcu.ts:28-32` — fonte do **clipping diário enviado por e-mail e push aos assinantes**. Filtra `category: 'acordao'` e janela de `uploadedAt`. Uma importação em massa cairia direto no envio.
- `lib/obsidian/incremental-export.ts:100` — `findMany` **sem `where` nenhum**: exporta 100% da tabela.

**Um marcador booleano dedicado (`tcuCombustivel`) foi projetado e descartado.** Ele é *fail-open*: protege apenas os pontos que alguém lembrou de alterar, e toda consulta futura nasce vazando. Com 17 pontos a tocar e o produto em produção, a chance de esquecer um é alta, e o custo do esquecimento é um e-mail com lixo para a base de assinantes.

**Decisão: defesa em camadas, segura por construção.** O combustível é inserido com três marcas que as consultas existentes **já** respeitam:

| Marca | Valor no backfill | O que fecha sozinho |
|---|---|---|
| `category` | `'acordao-grafo'` (em vez de `'acordao'`) | Toda consulta que casa `category: 'acordao'` — jurisprudência unificada, clipping, listagens por categoria |
| `isPublic` | `false` (com `isCommon: false`, `courseId: null`) | Busca full-text, árvore de conteúdo, novidades, página pública `/documento/[id]`, rota de download |
| `reviewedBy` | `'backfill-grafo'` (não `'auto-sync-tcu'`) | Contador de auto-importações recentes do admin |

Com isso a superfície de vazamento colapsa de 17 pontos para os poucos que não filtram por nada — que o plano trata explicitamente e cobre com teste. O ganho decisivo é o inverso do booleano: **consulta nova nasce segura**, porque o padrão do repositório é filtrar por `category` e por visibilidade.

O preço é tocar as duas filas que devem continuar enxergando esse material — `catalog-tcu-inteiro-teor` e `sync-precedentes-tcu` passam a aceitar `category IN ('acordao', 'acordao-grafo')`. São dois pontos sob nosso controle, alterados junto com a feature e cobertos por teste, contra dezessete espalhados pelo produto.

O plano deve ainda tratar caso a caso: `lib/obsidian/incremental-export.ts` (sem `where`), os contadores de `analytics/summary` e `getCachedDocumentCountByCategory` (inflam totais de admin/hub), e `app/api/search/unified` + `area-restrita/search-all` (o ramo de admin ignora `isPublic`).

**5.4 Não ingerir acórdãos de relação.** Medido em amostra do próprio feed: são **80% dos registros**, têm de 1 a 6 kB e **nenhuma seção** — sem Relatório, Voto ou Acórdão. Como o dossiê se alimenta de trechos *no voto*, eles não rendem nada, e ingeri-los custaria download e conversão de ~40 mil documentos inúteis.

O backfill ingere apenas `tipo === 'ACÓRDÃO'`. Consequência para o alcance: caminhar o feed até dez/2023 (~50 mil posições) rende **~10 mil acórdãos aproveitáveis**, não 50 mil. Isso é uma melhora, não uma perda: são 7× o acervo atual de 1.685, com ~80% menos tempo de execução e de custo de compute. A projeção de campanha cai de ~111 h para ~22 h de função.

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

**Critério de GO, fixado agora:** os 1.000 acórdãos ingeridos (já sem os de relação, §5.4) precisam render **≥ 1.000 arestas novas com `noVoto = true`** em `AcordaoCitacao`.

A régua vem do acervo atual: 1.685 acórdãos comuns produziram 5.644 arestas no voto, ou **3,35 por acórdão**. Exigir 1,0 é **30% do rendimento histórico** — piso deliberadamente baixo, porque o acervo de hoje é uma amostra curada por relevância temática (licitações/contratos, score ≥10) e o backfill pega acórdãos comuns de qualquer assunto, que devem render menos.

Abaixo disso, a campanha não se paga e a frente C1 encerra, seguindo só a frente A.

### W2 — campanha

Elevar `catalog-tcu-inteiro-teor` para cada 10 minutos, soltar o backfill até dez/2023, acompanhar por métrica. Nenhuma sessão fica presa: o progresso vive em `BackfillCursor` e em `ScraperHealthLog`.

Entregas: mudança de schedule no `vercel.json`, rota de leitura do progresso (ou consulta documentada), e a restauração do schedule diário ao fim.

### W3 — colheita do resultado

Quando a fila drenar: remedir a distribuição de citações-no-voto e reportar quantos leading cases cruzaram o limiar. Alimenta a onda A-W4 (destilação contínua).

## 7. Riscos

**7.1 O rendimento pode ser baixo.** O risco dos acórdãos de relação foi medido e eliminado por desenho (§5.4). Resta o risco de que acórdãos comuns **fora do tema de licitações** citem menos precedentes no voto do que a amostra curada de hoje. É exatamente o que W1 mede, e por isso o portão existe antes da campanha.

**7.6 Nem todo acórdão tem RTF.** Em amostra do feed, 88% a 100% traziam `urlArquivo` conforme o trecho do histórico. Os sem link ficam com `tcuLinkPDF: null` e são descartados pela fila de `catalog-tcu-inteiro-teor` (que exige `tcuLinkPDF IS NOT NULL`), sem travar nada. W1 mede a taxa real.

**7.2 Duplicatas de ATA.** O mesmo número/ano aparece em ATAs e colegiados diferentes. A constraint inclui `tcuOrgaoJulgador`, então convivem como linhas distintas — comportamento já existente, não regressão.

**7.3 Volume de escrita no Neon.** 50 mil linhas mais ~2,5 GB de texto ao longo de 12 dias. Storage é irrelevante (~US$ 0,88/mês); o que merece atenção é o pico de CU-horas de escrita e a retenção de histórico, que infla o faturado durante a campanha.

**7.4 Superfície esquecida.** Ver §5.3 — é o risco de produto mais concreto desta frente.

**7.5 A API do TCU pode variar.** Se o feed mudar de forma ou o offset profundo passar a falhar, o cron deve registrar falha e parar de avançar o cursor, nunca avançar sem inserir.

## 8. Não-objetivos

- Indexar os ingeridos na busca ou no RAG (decisão explícita do Daniel; reabrir só com medição no eval framework).
- Enriquecer com resumo ou classificação editorial via LLM.
- Qualquer alteração no motor de destilação de teses — a frente A tem spec própria.
- Ir além de dez/2023 nesta campanha. O cursor permite estender depois sem refazer nada.
