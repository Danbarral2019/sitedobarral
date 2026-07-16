# Catalogação contínua dos acórdãos do TCU — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um cron de varredura cataloga os acórdãos do TCU com `tcuAnalise` nulo (novos + os que falharam no backfill), para a base parar de crescer descatalogada.

**Architecture:** A lógica per-documento sai do script de backfill para `lib/tcu/catalogar-acordao.ts`, compartilhada por backfill e cron. Um cron novo (`catalog-tcu-inteiro-teor`, diário 6h30) varre a fila `tcuAnalise IS NULL AND tcuLinkPDF NOT NULL AND tcuAnaliseTentativas < 3`, cataloga um lote de 30 e para. Um contador `tcuAnaliseTentativas` impede retentativa infinita das falhas permanentes.

**Tech Stack:** TypeScript · Next.js 15 (App Router, route handler) · Prisma 7.4 (PrismaNeon) · Vitest

**Spec:** `docs/superpowers/specs/2026-07-16-tcu-catalogacao-continua-design.md`

## Global Constraints

- **Nunca indexar `tcuTextoCompleto`.** `lib/embeddings/source-text.ts` lê `[content, tcuEmentaCompleta, description]`; o inteiro teor não entra nessa lista.
- **Sem LLM em qualquer critério.** A análise é 100% determinística.
- `description` (resumo de IA) nunca é fonte de evidência.
- Comentários e mensagens de commit em **português**.
- Rota de cron: `verifyCronAuth(request)` no topo (retorna 401/500 ou null), corpo dentro de `withCronTelemetry('<nome>', async () => {...})`. Padrão de `app/api/cron/process-index-jobs/route.ts`.
- `catalogarAcordao` **nunca lança** — falha vira `{ status: 'falha', erro }`. Um acórdão problemático não pode derrubar o lote.

---

### Task 1: Migration — contador de tentativas

**Files:**
- Modify: `prisma/schema.prisma` (model `Document`, junto de `leiArticlesDebated`/`tcuAnalise` já existentes)

**Interfaces:**
- Consumes: nada
- Produces: `Document.tcuAnaliseTentativas Int @default(0)`

- [ ] **Step 1: Acrescentar o campo**

Em `prisma/schema.prisma`, no model `Document`, logo abaixo de `tcuAnalise Json?` (criado na branch atual):

```prisma
  /// Quantas vezes a catalogação do inteiro teor falhou para este acórdão.
  /// O cron catalog-tcu-inteiro-teor exclui da fila quem chega a 3 — impede
  /// retentar eternamente falhas permanentes (ata >20 MB, não-RTF). Um fix de
  /// extração que possa recuperar os afetados reseta o contador deles.
  tcuAnaliseTentativas Int @default(0)
```

- [ ] **Step 2: Aplicar no banco e gerar o client**

Run:
```bash
npx dotenv -e .env.local -- npx prisma db push --schema=prisma/schema.prisma
npx prisma generate
```
Expected: `Your database is now in sync with your Prisma schema.` Se mencionar perda de dado ou pedir `--accept-data-loss`, PARE e relate (o campo é aditivo com default, não deveria).

- [ ] **Step 3: Confirmar que os 154 failed entram na fila com contador zerado**

Run:
```bash
npx tsx -e "import {prisma} from './lib/prisma'; prisma.document.count({where:{category:'acordao',tcuLinkPDF:{not:null},tcuAnalise:{equals:null},tcuAnaliseTentativas:{lt:3}}}).then(n=>{console.log('na fila:',n);return prisma.\$disconnect()})"
```
Expected: um número > 100 (os 154 que falharam + os que o backfill nunca alcançou, todos com `tcuAnaliseTentativas = 0`).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): tcuAnaliseTentativas para o cron de catalogação

Contador de falhas de catalogação do inteiro teor. O cron de varredura
exclui da fila quem chega a 3 tentativas, para não retentar eternamente as
falhas permanentes (ata >20 MB, não-RTF) todo dia. Aditivo, default 0 — os
154 que falharam no backfill entram na fila zerados.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Núcleo compartilhado — `catalogarAcordao`

**Files:**
- Create: `lib/tcu/catalogar-acordao.ts`
- Create: `lib/tcu/catalogar-acordao.test.ts`

**Interfaces:**
- Consumes: `fetchInteiroTeor` (`lib/tcu/inteiro-teor-fetch`), `rtfToText` (`lib/tcu/rtf-to-text`), `analisarAcordao`/`artigosDebatidos`/`ANALISE_VERSAO` (`lib/tcu/analise-relevancia`), `prisma` (`lib/prisma`)
- Produces:
```ts
interface AcordaoParaCatalogar { id: string; title: string; tcuLinkPDF: string | null; leiArticlesArr: string[] }
interface ResultadoCatalogacao { status: 'ok' | 'ok-sem-secoes' | 'falha'; erro?: string; debatidos?: string[]; chars?: number }
const TETO_CHARS_CATALOGO = 500_000
async function catalogarAcordao(doc: AcordaoParaCatalogar): Promise<ResultadoCatalogacao>
```

**Contexto:** hoje a função `processar()` em `scripts/backfill-tcu-inteiro-teor.ts:86-140` faz fetch → rtfToText → truncagem → analisarAcordao → persistência. Esta task extrai o núcleo dela (sem o `EXECUTE`/`FORCE`/`comRetryDB`/log de console do backfill, que são política do chamador) para um módulo reutilizável. Na falha, além de gravar `status/erro`, **incrementa `tcuAnaliseTentativas`** (novidade que o backfill não tinha).

- [ ] **Step 1: Escrever os testes que falham**

Criar `lib/tcu/catalogar-acordao.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetch, mockRtfToText, mockUpdate } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockRtfToText: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/lib/tcu/inteiro-teor-fetch', () => ({ fetchInteiroTeor: (...a: unknown[]) => mockFetch(...a) }));
vi.mock('@/lib/tcu/rtf-to-text', () => ({ rtfToText: (...a: unknown[]) => mockRtfToText(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: { document: { update: (...a: unknown[]) => mockUpdate(...a) } },
}));

import { catalogarAcordao } from './catalogar-acordao';

const doc = { id: 'd1', title: 'Acórdão TCU 1/2026', tcuLinkPDF: 'https://x/y.rtf', leiArticlesArr: ['5'] };

// Um acórdão com Relatório/Voto/Acórdão e o princípio da economicidade no voto.
const TEXTO_COM_SECOES = [
  'RELATÓRIO', 'A parte alega ofensa.',
  'VOTO', 'O princípio da economicidade foi desrespeitado. A economicidade exige zelo. Reitero: economicidade.',
  'ACÓRDÃO Nº 1/2026 – TCU – Plenário', 'VISTOS. ACORDAM.',
].join('\n');

describe('catalogarAcordao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it('sucesso: persiste análise, texto e debatidos; status ok', async () => {
    mockFetch.mockResolvedValue({ ok: true, buf: Buffer.from('rtf') });
    mockRtfToText.mockResolvedValue(TEXTO_COM_SECOES);

    const r = await catalogarAcordao(doc);

    expect(r.status).toBe('ok');
    expect(r.debatidos).toContain('5');
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.tcuAnalise).toBeDefined();
    expect(data.leiArticlesDebated).toContain('5');
    expect(data.tcuTextoCompleto).toBe(TEXTO_COM_SECOES);
    expect(data.tcuEnriquecimentoStatus).toBe('success');
  });

  it('acórdão só com dispositivo: status ok-sem-secoes, debatidos vazio', async () => {
    mockFetch.mockResolvedValue({ ok: true, buf: Buffer.from('rtf') });
    mockRtfToText.mockResolvedValue('ACÓRDÃO Nº 2/2026 – TCU – Plenário\nMulta aplicada.');

    const r = await catalogarAcordao(doc);

    expect(r.status).toBe('ok-sem-secoes');
    expect(r.debatidos).toEqual([]);
  });

  it('falha de download: status falha, NÃO lança, incrementa tentativas', async () => {
    mockFetch.mockResolvedValue({ ok: false, erro: 'timeout' });

    const r = await catalogarAcordao(doc);

    expect(r.status).toBe('falha');
    expect(r.erro).toBe('timeout');
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.tcuEnriquecimentoStatus).toBe('failed');
    expect(data.tcuAnaliseTentativas).toEqual({ increment: 1 });
    expect(data.tcuTextoCompleto).toBeUndefined(); // não grava texto em falha
  });

  it('falha de extração RTF: status falha, incrementa tentativas, não lança', async () => {
    mockFetch.mockResolvedValue({ ok: true, buf: Buffer.from('rtf') });
    mockRtfToText.mockRejectedValue(new Error('empty control word'));

    const r = await catalogarAcordao(doc);

    expect(r.status).toBe('falha');
    expect(r.erro).toContain('empty control word');
    expect(mockUpdate.mock.calls[0][0].data.tcuAnaliseTentativas).toEqual({ increment: 1 });
  });

  it('trunca texto acima do teto e marca no JSON', async () => {
    mockFetch.mockResolvedValue({ ok: true, buf: Buffer.from('rtf') });
    mockRtfToText.mockResolvedValue('VOTO\n' + 'x'.repeat(600_000));

    const r = await catalogarAcordao(doc);

    expect(r.status).not.toBe('falha');
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.tcuTextoCompleto.length).toBe(500_000);
    expect(data.tcuAnalise.truncado).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/tcu/catalogar-acordao.test.ts`
Expected: FAIL — `Failed to resolve import "./catalogar-acordao"`

- [ ] **Step 3: Implementar**

Criar `lib/tcu/catalogar-acordao.ts`:

```ts
/**
 * Cataloga UM acórdão do TCU: baixa o inteiro teor (RTF), extrai, secciona,
 * conta os princípios por seção e persiste (`tcuTextoCompleto`, `tcuAnalise`,
 * `leiArticlesDebated`). Núcleo compartilhado pelo backfill
 * (scripts/backfill-tcu-inteiro-teor.ts) e pelo cron catalog-tcu-inteiro-teor.
 *
 * NUNCA lança: falha vira { status: 'falha', erro } + incremento de
 * tcuAnaliseTentativas, para um acórdão problemático não derrubar o lote.
 *
 * A política do chamador (retry de conexão, delay entre downloads, log) fica
 * FORA daqui — o backfill roda em loop shell, o cron tem lote e maxDuration.
 *
 * Ref.: docs/superpowers/specs/2026-07-16-tcu-catalogacao-continua-design.md
 */
import { fetchInteiroTeor } from './inteiro-teor-fetch';
import { rtfToText } from './rtf-to-text';
import { analisarAcordao, artigosDebatidos } from './analise-relevancia';
import { prisma } from '../prisma';

/** Acima disto trunca e marca `truncado: true` no JSON (o de 14,5 MB do spike). */
export const TETO_CHARS_CATALOGO = 500_000;

export interface AcordaoParaCatalogar {
  id: string;
  title: string;
  tcuLinkPDF: string | null;
  leiArticlesArr: string[];
}

export interface ResultadoCatalogacao {
  status: 'ok' | 'ok-sem-secoes' | 'falha';
  erro?: string;
  debatidos?: string[];
  chars?: number;
}

async function marcarFalha(id: string, erro: string): Promise<void> {
  await prisma.document.update({
    where: { id },
    data: {
      tcuEnriquecimentoStatus: 'failed',
      tcuEnriquecimentoErro: erro,
      tcuAnaliseTentativas: { increment: 1 },
    },
  });
}

export async function catalogarAcordao(doc: AcordaoParaCatalogar): Promise<ResultadoCatalogacao> {
  const r = await fetchInteiroTeor(doc.tcuLinkPDF!);
  if (!r.ok) {
    await marcarFalha(doc.id, r.erro);
    return { status: 'falha', erro: r.erro };
  }

  let texto: string;
  try {
    texto = await rtfToText(r.buf);
  } catch (e) {
    const erro = `extração RTF: ${(e as Error).message.slice(0, 80)}`;
    await marcarFalha(doc.id, erro);
    return { status: 'falha', erro };
  }

  const truncado = texto.length > TETO_CHARS_CATALOGO;
  const final = truncado ? texto.slice(0, TETO_CHARS_CATALOGO) : texto;
  const analise = analisarAcordao(final, doc.leiArticlesArr, { truncado });
  const debatidos = artigosDebatidos(analise);

  await prisma.document.update({
    where: { id: doc.id },
    data: {
      tcuTextoCompleto: final,
      tcuAnalise: analise as never,
      leiArticlesDebated: debatidos,
      tcuEnriquecimentoStatus: 'success',
      tcuEnriquecimentoErro: null,
      tcuEnriquecidoEm: new Date(),
    },
  });

  return {
    status: analise.secoes === null ? 'ok-sem-secoes' : 'ok',
    debatidos,
    chars: final.length,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/tcu/catalogar-acordao.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/catalogar-acordao.ts lib/tcu/catalogar-acordao.test.ts
git commit -m "feat(tcu): extrair catalogarAcordao como núcleo compartilhado

A lógica per-documento (fetch RTF → extrai → secciona → analisa → persiste)
sai do script de backfill para lib/tcu/, para o cron de catalogação e o
backfill usarem a MESMA extração — um não pode divergir do outro.

Nunca lança: falha vira { status: falha } + incremento de
tcuAnaliseTentativas. Retry de conexão, delay e log ficam no chamador.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Backfill passa a usar o núcleo

**Files:**
- Modify: `scripts/backfill-tcu-inteiro-teor.ts` (função `processar`, ~linhas 86-142)

**Interfaces:**
- Consumes: `catalogarAcordao`, `TETO_CHARS_CATALOGO` (Task 2)
- Produces: nada novo (o backfill mantém sua CLI e comportamento)

**Contexto:** o backfill tem sua própria `processar()` que duplica agora o que `catalogarAcordao` faz. Trocar a duplicação por uma chamada ao núcleo é a prova barata de que a extração ficou idêntica — se o dry-run continuar igual, backfill e cron herdam a mesma correção (incluindo o fix do hífen inquebrável). O backfill mantém: `--force` (reprocessar quem já tem `v`), `comRetryDB` (retry de conexão em volta da chamada), o log de console, o sumário do run.

- [ ] **Step 1: Reescrever `processar` para delegar ao núcleo**

Em `scripts/backfill-tcu-inteiro-teor.ts`, substituir o corpo de `processar` (após a checagem de `jaFeito`) por uma chamada a `catalogarAcordao`, mantendo o `comRetryDB` em volta e o log. Nova versão da função (o topo, com `jaFeito`, permanece):

```ts
async function processar(d: Alvo): Promise<Resultado> {
  const jaFeito = (d.tcuAnalise as { v?: number } | null)?.v === ANALISE_VERSAO;
  if (jaFeito && !FORCE) return 'pulado';

  if (!EXECUTE) {
    // Dry-run: baixa e analisa para o log, sem persistir. Reusa o núcleo? Não —
    // catalogarAcordao persiste sempre. No dry-run só reportamos a intenção.
    const r = await fetchInteiroTeor(d.tcuLinkPDF!);
    if (!r.ok) { console.log(`   ❌ ${d.title.slice(0, 40)} — ${r.erro}`); return 'falha'; }
    let texto: string;
    try { texto = await rtfToText(r.buf); }
    catch (e) { console.log(`   ❌ ${d.title.slice(0, 40)} — extração RTF: ${(e as Error).message.slice(0, 80)}`); return 'falha'; }
    const truncado = texto.length > TETO_CHARS_CATALOGO;
    const analise = analisarAcordao(truncado ? texto.slice(0, TETO_CHARS_CATALOGO) : texto, d.leiArticlesArr, { truncado });
    const debatidos = artigosDebatidos(analise);
    console.log(`   ✅ ${d.title.slice(0, 40)} — ${Math.min(texto.length, TETO_CHARS_CATALOGO)} chars${analise.secoes ? '' : ' (sem seções)'}${debatidos.length ? ` → debate: ${debatidos.join(',')}` : ''}`);
    return analise.secoes === null ? 'ok-sem-secoes' : 'ok';
  }

  // Execução real: o núcleo persiste; comRetryDB reconecta em queda do WebSocket.
  const res = await comRetryDB(() => catalogarAcordao(d), `catalogar ${d.id}`);
  if (res.status === 'falha') {
    console.log(`   ❌ ${d.title.slice(0, 40)} — ${res.erro}`);
    return 'falha';
  }
  console.log(`   ✅ ${d.title.slice(0, 40)} — ${res.chars} chars${res.status === 'ok-sem-secoes' ? ' (sem seções)' : ''}${res.debatidos?.length ? ` → debate: ${res.debatidos.join(',')}` : ''}`);
  return res.status;
}
```

Ajustar os imports do topo: acrescentar `import { catalogarAcordao, TETO_CHARS_CATALOGO } from '../lib/tcu/catalogar-acordao';` e remover a constante local `TETO_CHARS` (agora vem do núcleo). `fetchInteiroTeor`, `rtfToText`, `analisarAcordao`, `artigosDebatidos` continuam importados (usados no ramo dry-run).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep backfill-tcu`
Expected: vazio (sem erro no arquivo).

- [ ] **Step 3: Dry-run pequeno — prova que a extração não mudou**

Run: `npx tsx scripts/backfill-tcu-inteiro-teor.ts --limit=5`
Expected: 5 linhas de resultado (✅/❌ conforme o estado), `🔵 DRY-RUN — nada gravado.` — sem erro de import nem exceção.

- [ ] **Step 4: Confirmar que o dry-run não escreveu**

Run:
```bash
npx tsx -e "import {prisma} from './lib/prisma'; prisma.document.count({where:{tcuAnalise:{not:null}}}).then(n=>{console.log('analisados:',n);return prisma.\$disconnect()})"
```
Expected: o mesmo número de antes (o backfill já rodou; o dry-run não altera). Anote o número; ele não pode ter subido por causa do dry-run.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-tcu-inteiro-teor.ts
git commit -m "refactor(backfill-tcu): usar o núcleo catalogarAcordao

O backfill passa a delegar a catalogação a lib/tcu/catalogar-acordao em vez
de duplicar a lógica. Backfill e cron agora extraem pela mesma função — um
não pode divergir do outro. O backfill mantém --force, o retry de conexão
(comRetryDB) em volta da chamada, o log e o sumário; o ramo dry-run segue
reportando sem persistir.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: O cron de varredura

**Files:**
- Create: `app/api/cron/catalog-tcu-inteiro-teor/route.ts`
- Create: `app/api/cron/catalog-tcu-inteiro-teor/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `catalogarAcordao` (Task 2), `verifyCronAuth` (`lib/cron-auth`), `withCronTelemetry` (`lib/cron-telemetry`), `prisma`
- Produces: `GET` handler que retorna `{ processados, ok, semSecoes, falha, restamNaFila }`

- [ ] **Step 1: Escrever os testes que falham**

Criar `app/api/cron/catalog-tcu-inteiro-teor/__tests__/route.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyAuth, mockFindMany, mockCount, mockCatalogar } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockCatalogar: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: (...a: unknown[]) => mockVerifyAuth(...a) }));
vi.mock('@/lib/cron-telemetry', () => ({
  withCronTelemetry: async (_n: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('@/lib/tcu/catalogar-acordao', () => ({ catalogarAcordao: (...a: unknown[]) => mockCatalogar(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      count: (...a: unknown[]) => mockCount(...a),
    },
  },
}));
vi.mock('@/lib/logger', () => ({ apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { GET } from '../route';
import { NextRequest } from 'next/server';

const req = () => new NextRequest('http://localhost/api/cron/catalog-tcu-inteiro-teor');
const alvo = (id: string) => ({ id, title: `Acórdão ${id}`, tcuLinkPDF: `https://x/${id}.rtf`, leiArticlesArr: ['5'] });

describe('cron catalog-tcu-inteiro-teor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockReturnValue(null); // autenticado
    mockCount.mockResolvedValue(0);
  });

  it('sem CRON_SECRET válido: devolve o 401 do verifyCronAuth', async () => {
    const resp401 = { status: 401 } as unknown;
    mockVerifyAuth.mockReturnValue(resp401);
    const r = await GET(req());
    expect(r).toBe(resp401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('a fila filtra por análise nula + link + tentativas < 3, com take limitado', async () => {
    mockFindMany.mockResolvedValue([]);
    await GET(req());
    const arg = mockFindMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      category: 'acordao',
      tcuAnalise: null,
      tcuLinkPDF: { not: null },
      tcuAnaliseTentativas: { lt: 3 },
    });
    expect(typeof arg.take).toBe('number');
    expect(arg.take).toBeGreaterThan(0);
    // prioriza quem tentou menos
    expect(arg.orderBy).toEqual([{ tcuAnaliseTentativas: 'asc' }, { id: 'asc' }]);
  });

  it('cataloga cada alvo e agrega o resultado', async () => {
    mockFindMany.mockResolvedValue([alvo('a'), alvo('b'), alvo('c')]);
    mockCatalogar
      .mockResolvedValueOnce({ status: 'ok', debatidos: ['5'] })
      .mockResolvedValueOnce({ status: 'ok-sem-secoes', debatidos: [] })
      .mockResolvedValueOnce({ status: 'falha', erro: 'timeout' });
    mockCount.mockResolvedValue(7);

    const r = await GET(req());
    const body = await r.json();

    expect(mockCatalogar).toHaveBeenCalledTimes(3);
    expect(body).toMatchObject({ processados: 3, ok: 1, semSecoes: 1, falha: 1, restamNaFila: 7 });
  });

  it('uma falha não interrompe o lote', async () => {
    mockFindMany.mockResolvedValue([alvo('a'), alvo('b')]);
    mockCatalogar
      .mockResolvedValueOnce({ status: 'falha', erro: 'x' })
      .mockResolvedValueOnce({ status: 'ok', debatidos: [] });
    const r = await GET(req());
    const body = await r.json();
    expect(mockCatalogar).toHaveBeenCalledTimes(2); // seguiu para o 2º
    expect(body.ok).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run app/api/cron/catalog-tcu-inteiro-teor/__tests__/route.test.ts`
Expected: FAIL — `Failed to resolve import "../route"`

- [ ] **Step 3: Implementar**

Criar `app/api/cron/catalog-tcu-inteiro-teor/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { catalogarAcordao } from '@/lib/tcu/catalogar-acordao';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { apiLogger } from '@/lib/logger';

/**
 * Cron: catalogação contínua do inteiro teor dos acórdãos do TCU.
 *
 * Fecha o fluxo que o sync-tcu-acordaos deixa aberto: ele importa o acórdão
 * com o tcuLinkPDF mas não busca o inteiro teor. Este cron varre a fila de
 * acórdãos ainda não catalogados e processa um lote por execução.
 *
 * Fila: tcuAnalise IS NULL + tcuLinkPDF NOT NULL + tcuAnaliseTentativas < 3.
 * O limite de tentativas impede retentar eternamente falhas permanentes (ata
 * >20 MB, não-RTF). Ao corrigir a extração (ex.: um bug do parser), resetar o
 * contador dos afetados os traz de volta à fila:
 *   UPDATE "Document" SET "tcuAnaliseTentativas" = 0
 *   WHERE "tcuEnriquecimentoErro" ILIKE '%<causa corrigida>%';
 *
 * Ref.: docs/superpowers/specs/2026-07-16-tcu-catalogacao-continua-design.md
 */

// Lote conservador para caber em maxDuration: pior caso ~30 × 8s = 240s < 300s.
export const maxDuration = 300;

const LOTE = 30;
const MAX_TENTATIVAS = 3;
const DELAY_MS = 1000; // 1 req/s — educado com o TCU (sem rate limit documentado)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown> = {};

  await withCronTelemetry('catalog-tcu-inteiro-teor', async () => {
    const alvos = await prisma.document.findMany({
      where: {
        category: 'acordao',
        tcuAnalise: null,
        tcuLinkPDF: { not: null },
        tcuAnaliseTentativas: { lt: MAX_TENTATIVAS },
      },
      select: { id: true, title: true, tcuLinkPDF: true, leiArticlesArr: true },
      orderBy: [{ tcuAnaliseTentativas: 'asc' }, { id: 'asc' }],
      take: LOTE,
    });

    let ok = 0, semSecoes = 0, falha = 0;
    for (const alvo of alvos) {
      const res = await catalogarAcordao(alvo);
      if (res.status === 'ok') ok++;
      else if (res.status === 'ok-sem-secoes') { ok++; semSecoes++; }
      else falha++;
      await sleep(DELAY_MS);
    }

    const restamNaFila = await prisma.document.count({
      where: {
        category: 'acordao',
        tcuAnalise: null,
        tcuLinkPDF: { not: null },
        tcuAnaliseTentativas: { lt: MAX_TENTATIVAS },
      },
    });

    apiLogger.info(
      { processados: alvos.length, ok, semSecoes, falha, restamNaFila },
      '[catalog-tcu] lote concluído'
    );
    body = { processados: alvos.length, ok, semSecoes, falha, restamNaFila };
  });

  return NextResponse.json(body);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run app/api/cron/catalog-tcu-inteiro-teor/__tests__/route.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep catalog-tcu`
Expected: vazio.

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/catalog-tcu-inteiro-teor/
git commit -m "feat(cron): catalog-tcu-inteiro-teor varre acórdãos não catalogados

Fecha o fluxo que o sync-tcu-acordaos deixa aberto. Varre a fila (tcuAnalise
nulo + tcuLinkPDF + tentativas < 3) e cataloga um lote de 30 por execução —
cabe em maxDuration=300s (~30×8s=240s). Cobre num só mecanismo os acórdãos
novos, os spikes e os 154 que falharam no backfill. Uma falha não derruba o
lote. Mesmo padrão do process-index-jobs.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Agendar o cron

**Files:**
- Modify: `vercel.json` (array `crons`)

**Interfaces:**
- Consumes: a rota da Task 4
- Produces: agendamento diário

- [ ] **Step 1: Acrescentar o bloco de agendamento**

Em `vercel.json`, no array `crons`, logo após o bloco do `sync-tcu-acordaos` (que roda `0 6 * * *`), acrescentar:

```json
    {
      "path": "/api/cron/catalog-tcu-inteiro-teor",
      "schedule": "30 6 * * *"
    },
```

Rodar 6h30 (30 min depois do import das 6h) garante que os acórdãos importados de manhã já entrem na fila no mesmo dia. Cuidar da vírgula: o bloco anterior precisa terminar em `},` e este também, se não for o último do array.

- [ ] **Step 2: Validar o JSON**

Run: `npx tsx -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json OK')"`
Expected: `vercel.json OK` (se der erro de parse, corrigir a vírgula).

- [ ] **Step 3: Confirmar que o path aparece uma vez**

Run: `grep -c "catalog-tcu-inteiro-teor" vercel.json`
Expected: `1`

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "chore(cron): agenda catalog-tcu-inteiro-teor às 6h30 diário

30 min após o sync-tcu-acordaos (6h), para os acórdãos importados de manhã
entrarem na fila de catalogação no mesmo dia.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Verificação end-to-end e suíte

**Files:** nenhum (verificação)

**Interfaces:**
- Consumes: tudo acima

- [ ] **Step 1: Suíte das áreas afetadas verde**

Run: `npx vitest run lib/tcu/ app/api/cron/catalog-tcu-inteiro-teor/`
Expected: todos passam (5 de catalogar-acordao + 4 do cron + os pré-existentes de lib/tcu/).

- [ ] **Step 2: Build de produção**

Run: `npm run build 2>&1 | grep -E "Compiled|Failed|catalog-tcu"`
Expected: `✓ Compiled successfully`. A rota `/api/cron/catalog-tcu-inteiro-teor` deve aparecer na lista de rotas do build.

- [ ] **Step 3: Exercitar o cron de verdade, em pequeno**

O cron não tem `--limit`, mas dá para invocá-lo com `LOTE` reduzido via um teste de fumaça, OU confiar no lote real (30) uma vez — como o backfill já drenou a maioria, restam ~154. Rodar o cron uma vez processa 30 deles.

Invocar localmente com o CRON_SECRET:
```bash
npx tsx -e "
import { GET } from './app/api/cron/catalog-tcu-inteiro-teor/route';
import { NextRequest } from 'next/server';
const req = new NextRequest('http://localhost/api/cron/catalog-tcu-inteiro-teor', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } });
GET(req).then(async r => { console.log(await r.json()); process.exit(0); });
" 2>&1 | tail -5
```
Expected: um JSON `{ processados: 30, ok: N, semSecoes: M, falha: K, restamNaFila: ... }`. Como sobraram os 68 timeouts (recuperáveis) e ~86 permanentes, esperar `ok` > 0 e `restamNaFila` menor que antes. Se `CRON_SECRET` não estiver no `.env.local`, pular este step e confiar nos testes + no primeiro run em produção.

- [ ] **Step 4: Registrar no ledger e concluir**

Sem commit (verificação). Anotar no relatório: resultado do Step 3 (se rodado), e que o cron entra em produção no próximo deploy.

---

## Fora deste plano

- **Consertar o `tcuEnriquecimentoStatus: 'success'` hardcoded** do `sync-tcu-acordaos` — dívida pré-existente, anotada no spec §1, não introduzida aqui.
- **Rede de precedentes** — feature separada, spec própria.
- **Merge da branch `feat/tcu-inteiro-teor`** — depende da Task 8 do plano anterior (calibração do limiar pelo Daniel), fora deste plano.

## Self-review

**Cobertura do spec:** §3 fila + contador → Task 1 (campo) + Task 4 (fila) · §4.1 catalogarAcordao → Task 2 · §4.1 backfill compartilha → Task 3 · §4.2 cron → Task 4 · §4.2 agendamento → Task 5 · §5 lote/tempo → Task 4 (LOTE=30, maxDuration) · §6 testes → Tasks 2/4 · §7 migration → Task 1 · §8 YAGNI (status hardcoded, precedentes) → "Fora deste plano".

**Consistência de tipos:** `AcordaoParaCatalogar`/`ResultadoCatalogacao`/`catalogarAcordao`/`TETO_CHARS_CATALOGO` definidos na Task 2 e consumidos nas Tasks 3 e 4 · o `where` da fila é idêntico na Task 1 (Step 3), Task 4 (impl) e Task 4 (teste) · status `'ok'|'ok-sem-secoes'|'falha'` consistente entre núcleo e cron.

**Ponto de atenção declarado:** a Task 3 introduz um ramo dry-run que NÃO usa o núcleo (porque `catalogarAcordao` sempre persiste). É duplicação pequena e consciente — o dry-run existe só para reportar sem escrever. Alternativa (passar um flag `persistir` ao núcleo) foi rejeitada por poluir a assinatura do núcleo com uma preocupação só do backfill.
