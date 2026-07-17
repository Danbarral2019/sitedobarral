# Catalogação contínua dos acórdãos do TCU — cron de varredura

**Data:** 2026-07-16
**Autor:** Daniel Barral + Claude
**Status:** 🟡 PROPOSTA — aguarda revisão
**Depende de:** `feat/tcu-inteiro-teor` (o pipeline `lib/tcu/` e os campos do schema já existem nessa branch)

**Origem:** o Daniel perguntou se os acórdãos novos captados pelo cron passam pela mesma catalogação que fizemos no acervo. **Não passam** — o `sync-tcu-acordaos` grava `tcuLinkPDF` mas nunca busca o inteiro teor nem chama `lib/tcu/`. Sem isso, a base volta a crescer descatalogada.

---

## 1. O problema

`app/api/cron/sync-tcu-acordaos/route.ts` importa acórdãos novos com resumo (Gemini) e vínculo de artigos (LLM), mas **não** faz o seccionamento nem a análise de princípios do inteiro teor. Consequência:

- Todo acórdão importado a partir de agora entra sem `tcuAnalise`, sem `leiArticlesDebated`, sem `tcuTextoCompleto`.
- Em semanas, a base fica heterogênea de novo — parte catalogada (o backfill), parte não.
- Os **154 acórdãos que falharam no backfill** (68 timeouts recuperáveis + 86 limites reais) também ficam órfãos.

Além disso, o cron de import ainda grava `tcuEnriquecimentoStatus: 'success'` hardcoded (linhas 350/361) — dívida pré-existente, fora do escopo deste spec, mas anotada.

## 2. Decisão de arquitetura

**Cron separado de varredura** (não inline no import), confirmado pelo Daniel.

Motivo: import precisa ser confiável e rápido; catalogação é lenta (download+parse de RTF, de 1 a 15s cada) e falha (timeout, ata >20 MB). Empilhar catalogação no import de volume alto estouraria o `maxDuration=300s`. Separar as duas responsabilidades:
- Nunca estoura o limite (lote fixo por execução).
- Auto-recupera: a mesma fila cobre acórdãos novos, spikes e os 154 que falharam.
- Reaproveita a lógica do backfill (a função `processar()` já é isto).
- Segue o padrão existente do projeto: `process-index-jobs` varre `embeddingStatus: pending` em lotes de 10.

## 3. A fila e o contador de tentativas

**Fila (o que catalogar):**
```sql
tcuAnalise IS NULL
AND tcuLinkPDF IS NOT NULL
AND tcuAnaliseTentativas < MAX_TENTATIVAS
```

`tcuAnalise IS NULL` é o sinal natural de "não catalogado" — independente do `tcuEnriquecimentoStatus` sobrecarregado (que o import usa para o enriquecimento Gemini). Não criamos campo de "pending"; a ausência da análise já é a fila, como o `process-index-jobs` usa `pending`.

**Novo campo — `Document.tcuAnaliseTentativas Int @default(0)`:**

Resolve a retentativa infinita que o backfill (one-shot) podia ignorar mas um cron diário não pode: uma ata de 181 MB tem `tcuAnalise IS NULL` para sempre e seria retentada todo dia, consumindo o lote. O contador incrementa a cada falha; após `MAX_TENTATIVAS` (= **3**), o acórdão sai da fila.

- **Timeout** (transitório) → tenta de novo em execuções seguintes até 3×; a maioria dos 68 recupera na 1ª ou 2ª.
- **Ata >20 MB / não-RTF / encoding** (permanente) → falha 3× e sai; nunca mais desperdiça lote.
- **Fix de código que melhora a extração** (como o do hífen inquebrável hoje) → é o evento deliberado em que resetamos o contador (`UPDATE ... SET tcuAnaliseTentativas = 0 WHERE tcuEnriquecimentoErro ILIKE '%<causa corrigida>%'`), para os afetados voltarem à fila. Documentar no cabeçalho do cron.

Sucesso zera implicitamente o problema (o registro passa a ter `tcuAnalise`, sai da fila pela primeira condição).

## 4. Arquitetura de código

### 4.1 Extrair o núcleo para `lib/tcu/`

Hoje a lógica per-documento vive no script `scripts/backfill-tcu-inteiro-teor.ts` (função `processar`). Extrair para um módulo reutilizável:

**`lib/tcu/catalogar-acordao.ts`** (novo)
```ts
interface AcordaoParaCatalogar {
  id: string; title: string; tcuLinkPDF: string | null; leiArticlesArr: string[];
}
interface ResultadoCatalogacao {
  status: 'ok' | 'ok-sem-secoes' | 'falha';
  erro?: string;
  debatidos?: string[];
  chars?: number;
}
// Baixa, extrai, analisa e PERSISTE um acórdão. Nunca lança: falha vira
// { status: 'falha', erro } + incremento de tentativas. Reusa fetchInteiroTeor,
// rtfToText, analisarAcordao, artigosDebatidos.
async function catalogarAcordao(doc: AcordaoParaCatalogar): Promise<ResultadoCatalogacao>
```

Esta função encapsula: fetch → rtfToText → truncagem → analisarAcordao → persistência (`tcuTextoCompleto`, `tcuAnalise`, `leiArticlesDebated`, status) + incremento de `tcuAnaliseTentativas` em falha. É a única escritora dessa análise, usada por dois chamadores:
- **o backfill** (`scripts/backfill-tcu-inteiro-teor.ts`) passa a chamá-la em vez de ter `processar` própria;
- **o cron novo**.

O retry de conexão (`comRetryDB`) e o padrão de escalonamento (delay entre downloads) ficam no chamador, não no núcleo — cada um tem sua política (o backfill roda em loop shell; o cron tem um lote pequeno e o `maxDuration`).

### 4.2 O cron

**`app/api/cron/catalog-tcu-inteiro-teor/route.ts`** (novo)
- `maxDuration = 300`
- `verifyCronAuth` + `withCronTelemetry('catalog-tcu-inteiro-teor', …)` (padrão do projeto)
- Busca a fila (§3), `take: LOTE` (§5), `orderBy: { tcuAnaliseTentativas: 'asc' }, { id: 'asc' }` — prioriza quem nunca tentou.
- Processa em série ou concorrência baixa (§5), com delay entre downloads (educado com o TCU, 1 req/s).
- Retorna JSON com `{ processados, ok, semSecoes, falha, restamNaFila }`.

**Agendamento em `vercel.json`:** logo após o `sync-tcu-acordaos` (que roda 6h). Proposta: **6h30** (`30 6 * * *`), diário. Assim o cron pega os importados de manhã no mesmo dia.

### 4.3 O que NÃO muda

- `sync-tcu-acordaos` fica como está (só anotamos a dívida do status hardcoded).
- O pipeline `lib/tcu/*` (fetch, rtf, seccionar, análise) não muda — só ganha um novo chamador.
- `tcuTextoCompleto` continua **fora** do RAG (constraint global).

## 5. Dimensionamento do lote e do tempo

Do backfill: ~1 req/s, cada acórdão de 1 a 15s (download + parse). Com `maxDuration=300s`, orçamento conservador:

- **LOTE = 30** documentos por execução, série com delay de 1s.
- Pior caso realista: 30 × ~8s = 240s < 300s, com margem.
- Volume diário real de acórdãos novos relevantes: um punhado a algumas dezenas. LOTE=30/dia absorve o fluxo normal e, nos primeiros dias, drena os 154 do backfill (~6 dias para zerar, sem pressa).
- Se um dia sobrar fila, o próximo run continua — é o ponto da varredura.

Constantes no topo do cron, comentadas, fáceis de ajustar após observar os primeiros runs.

## 6. Testes

| Alvo | Como |
|---|---|
| `catalogarAcordao` — sucesso | mock de `fetchInteiroTeor` (buffer RTF válido pequeno) → persiste `tcuAnalise`, `leiArticlesDebated`, status ok |
| `catalogarAcordao` — falha incrementa tentativas | mock retorna `{ok:false}` → `tcuAnaliseTentativas` +1, status falha, **não** lança |
| `catalogarAcordao` — sem seções | RTF só com dispositivo → `status: 'ok-sem-secoes'`, `leiArticlesDebated: []` |
| cron — fila e limite | mock do Prisma: confirma o `where` (nulo + link + tentativas<3) e o `take: LOTE` |
| cron — auth | sem `CRON_SECRET` → 401 (reusa `verifyCronAuth`) |
| backfill continua verde | após extrair `catalogarAcordao`, a suíte de `lib/tcu/` e o dry-run do backfill seguem passando |

Sem LLM em nenhum critério (constraint global). Mocks de Prisma no padrão do projeto (`vi.hoisted`).

## 7. Migration

`Document.tcuAnaliseTentativas Int @default(0)` — aditivo, seguro (default 0, retroativo nos 154 failed = 0, entram na fila). `npx dotenv -e .env.local -- npx prisma db push`. Sem índice novo: a fila filtra por `tcuAnalise IS NULL` que é seletivo, e o `take` limita.

⚠️ Os 154 que já falharam no backfill têm `tcuEnriquecimentoStatus: 'failed'` mas `tcuAnaliseTentativas = 0` (campo novo, default) — então entram na fila com prioridade. Correto: queremos que o cron os retente (os 68 timeouts recuperam; os 86 permanentes falham 3× e saem).

## 8. Fora de escopo (YAGNI)

- **Consertar o `tcuEnriquecimentoStatus` hardcoded** do import — dívida pré-existente, não introduzida aqui. Anotar, não corrigir junto.
- **Rede de precedentes** — feature separada ([[rede-precedentes-tcu-ideia]]), spec própria.
- **Reprocessar por mudança de `ANALISE_VERSAO`** no cron — o cron cataloga o que está `NULL`; bumps de versão são reprocessamento deliberado via backfill/`--force`, não trabalho de rotina do cron.
- **Alertas/observabilidade além do `withCronTelemetry`** — o telemetry do projeto já cobre.

## 9. Sequência de implementação

```
1. Migration: tcuAnaliseTentativas
2. Extrair lib/tcu/catalogar-acordao.ts + testes  ← núcleo compartilhado
3. Refatorar o backfill para usar catalogarAcordao ← prova que o núcleo serve aos 2
4. Cron catalog-tcu-inteiro-teor + testes
5. Agendar em vercel.json (6h30 diário)
6. Deploy → observar 1-2 runs reais → ajustar LOTE se preciso
```

O passo 3 é a validação barata de que a extração ficou correta: se o backfill continua verde usando o núcleo compartilhado, o cron herda a mesma correção (incluindo o fix do hífen inquebrável de hoje).
