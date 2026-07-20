# Ingestão retroativa do TCU — Onda W1 (mecanismo + portão) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o mecanismo de ingestão retroativa de acórdãos do TCU e medir, sobre 1.000 acórdãos reais, se ele rende citações-no-voto suficientes para justificar a campanha completa.

**Architecture:** Um cron novo caminha o feed de dados abertos para trás e insere linhas `Document` marcadas como combustível de grafo. Tudo a jusante já existe e é reusado sem alteração de lógica: `catalog-tcu-inteiro-teor` baixa o inteiro teor, `sync-precedentes-tcu` extrai as arestas. As duas filas apenas passam a enxergar a categoria nova. A proteção contra vazamento nas superfícies do site é feita por marcas que as consultas existentes já respeitam, não por um filtro novo espalhado.

**Tech Stack:** Next.js App Router (route handlers de cron), Prisma 7 / Neon, TypeScript, Vitest, tsx.

**Spec:** `docs/superpowers/specs/2026-07-20-ingestao-retroativa-tcu-design.md`

## Global Constraints

- **Categoria do combustível: `'acordao-grafo'`.** Nunca `'acordao'`.
- **Marcas obrigatórias em todo registro inserido pelo backfill:** `isPublic: false`, `isCommon: false`, `courseId: null`, `reviewedBy: 'backfill-grafo'`, `embeddingStatus: 'skipped'`.
- **Proibido no backfill:** chamar `enrichNewDocuments` ou qualquer LLM; gravar `embeddingStatus: 'pending'`; fazer o dual-write em `TribunalDecision` (é a superfície `/jurisprudencia`); gravar `tcuEnriquecimentoStatus: 'success'` (seria mentira — o `sync-tcu-acordaos` faz isso e é um defeito conhecido; aqui grava-se `'skipped'`).
- **Só `tipo === 'ACÓRDÃO'`.** Acórdãos de relação (80% do feed) são descartados na ingestão.
- **Alcance da campanha:** parar quando a data da sessão for anterior a `2023-12-01`.
- **Rate limit:** 1 requisição por segundo contra `dados-abertos.apps.tcu.gov.br`. Uma página de 500 itens leva ~20 s.
- **Schema:** o repositório usa `prisma db push` (ver `vercel-build` no `package.json`), **não** migrations. Alterar `prisma/schema.prisma` e rodar `npx prisma db push`.
- **Crons:** autenticar com `verifyCronAuth(request)` no topo do `GET` e envolver a lógica em `withCronTelemetry('<nome>', async () => ({ itemsFound, itemsNew, itemsError, metadata }))`.
- **Testes:** `npx vitest run <arquivo>`. Nenhum teste toca rede ou banco — lógica pura isolada e injetada.
- **Scripts:** `npx dotenv-cli -e .env.local -- npx tsx <script>`.
- **Commits** em português, sem acentos no assunto, padrão `feat(tcu):` / `test(tcu):` / `fix(tcu):`.

---

### Task 1: Model `BackfillCursor`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: model `BackfillCursor` com id fixo `'tcu-retroativo'`, consumido pelas Tasks 3 e 6.

- [ ] **Step 1: Acrescentar o model ao schema**

Adicionar ao final de `prisma/schema.prisma`:

```prisma
/// Cursor de campanhas de backfill que caminham um feed EXTERNO paginado.
/// Os demais backfills do repo derivam a fila de colunas do próprio Document
/// (precedentesVersao, tcuAnalise, embeddingStatus); aqui o estado é um offset
/// numa API de terceiro, que não é derivável do nosso acervo.
model BackfillCursor {
  id            String   @id
  offset        Int      @default(0)
  ultimoAcordao String?
  ultimaData    String?
  totalInserido Int      @default(0)
  totalIgnorado Int      @default(0)
  concluido     Boolean  @default(false)
  atualizadoEm  DateTime @updatedAt
}
```

- [ ] **Step 2: Aplicar e gerar o client**

Run: `npx dotenv-cli -e .env.local -- npx prisma db push && npx prisma generate`
Expected: `Your database is now in sync with your Prisma schema.` e `Generated Prisma Client`.

Se der erro de engine, matar processos Node e repetir `npx prisma generate` (ver `docs/TROUBLESHOOTING.md`).

- [ ] **Step 3: Confirmar que a tabela existe**

Run: `npx dotenv-cli -e .env.local -- npx prisma studio` não — em vez disso:
```bash
npx dotenv-cli -e .env.local -- npx tsx -e "import {prisma} from './lib/prisma'; prisma.backfillCursor.count().then(n=>{console.log('BackfillCursor ok, linhas:',n); return prisma.\$disconnect()})"
```
Expected: `BackfillCursor ok, linhas: 0`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(tcu): model BackfillCursor para campanhas sobre feed externo"
```

---

### Task 2: Núcleo puro do backfill

Toda a decisão fica aqui, sem rede e sem banco, para ser testável de verdade. A rota da Task 3 vira casca.

**Files:**
- Create: `lib/tcu/backfill-retroativo.ts`
- Test: `lib/tcu/backfill-retroativo.test.ts`

**Interfaces:**
- Produces:
  - `export interface ItemFeed { tipo?: string; numeroAcordao?: string; anoAcordao?: string; titulo?: string; sumario?: string; colegiado?: string; relator?: string; dataSessao?: string; urlArquivo?: string; urlArquivoPDF?: string }`
  - `export const CATEGORIA_GRAFO = 'acordao-grafo'`
  - `export const DATA_ALVO = '2023-12-01'`
  - `export function parseDataSessao(d: string | undefined): string | null` — `"05/12/2023"` → `"2023-12-05"`
  - `export function ehAproveitavel(item: ItemFeed): boolean`
  - `export function montarDadosDocument(item: ItemFeed): Record<string, unknown> | null`
  - `export function atingiuAlvo(item: ItemFeed, dataAlvo?: string): boolean`

- [ ] **Step 1: Escrever os testes que falham**

```typescript
import { describe, it, expect } from 'vitest';
import { parseDataSessao, ehAproveitavel, montarDadosDocument, atingiuAlvo, CATEGORIA_GRAFO } from './backfill-retroativo';

const comum = {
  tipo: 'ACÓRDÃO', numeroAcordao: '3148', anoAcordao: '2025',
  titulo: 'ACÓRDÃO 3148/2025 - Segunda Câmara', sumario: 'Ementa qualquer.',
  colegiado: 'Segunda Câmara', relator: 'FULANO', dataSessao: '10/06/2025',
  urlArquivo: 'https://contas.tcu.gov.br/sagas/Rtf?item0=1',
};

describe('parseDataSessao', () => {
  it('converte dd/mm/aaaa em ISO', () => expect(parseDataSessao('05/12/2023')).toBe('2023-12-05'));
  it('devolve null para vazio', () => expect(parseDataSessao(undefined)).toBeNull());
  it('devolve null para formato inesperado', () => expect(parseDataSessao('2023-12-05')).toBeNull());
});

describe('ehAproveitavel', () => {
  it('aceita acordao comum com RTF', () => expect(ehAproveitavel(comum)).toBe(true));
  it('rejeita acordao de relacao (80% do feed, sem secao de voto)', () =>
    expect(ehAproveitavel({ ...comum, tipo: 'ACÓRDÃO DE RELAÇÃO' })).toBe(false));
  it('rejeita item sem link de RTF', () =>
    expect(ehAproveitavel({ ...comum, urlArquivo: undefined, urlArquivoPDF: undefined })).toBe(false));
  it('rejeita item sem numero ou ano', () =>
    expect(ehAproveitavel({ ...comum, numeroAcordao: undefined })).toBe(false));
});

describe('montarDadosDocument', () => {
  const d = montarDadosDocument(comum)!;

  it('usa a categoria do grafo, nunca acordao', () => {
    expect(d.category).toBe(CATEGORIA_GRAFO);
    expect(d.category).not.toBe('acordao');
  });

  it('nasce invisivel nas superficies do site', () => {
    expect(d.isPublic).toBe(false);
    expect(d.isCommon).toBe(false);
    expect(d.courseId).toBeNull();
  });

  it('nao entra em fila de embedding nem no contador de auto-importacoes', () => {
    expect(d.embeddingStatus).toBe('skipped');
    expect(d.reviewedBy).toBe('backfill-grafo');
  });

  it('nao mente sobre enriquecimento', () => {
    expect(d.tcuEnriquecimentoStatus).toBe('skipped');
  });

  it('leva o link do RTF, que e o insumo da catalogacao', () => {
    expect(d.tcuLinkPDF).toBe('https://contas.tcu.gov.br/sagas/Rtf?item0=1');
  });

  it('preenche as chaves de deduplicacao', () => {
    expect(d.acordaoNumero).toBe(3148);
    expect(d.acordaoAno).toBe(2025);
    expect(d.tcuOrgaoJulgador).toBe('Segunda Câmara');
  });

  it('devolve null para item nao aproveitavel', () => {
    expect(montarDadosDocument({ ...comum, tipo: 'ACÓRDÃO DE RELAÇÃO' })).toBeNull();
  });
});

describe('atingiuAlvo', () => {
  it('para quando a sessao e anterior a dez/2023', () =>
    expect(atingiuAlvo({ ...comum, dataSessao: '30/11/2023' })).toBe(true));
  it('nao para dentro do alvo', () =>
    expect(atingiuAlvo({ ...comum, dataSessao: '05/12/2023' })).toBe(false));
  it('nao para com data ausente', () =>
    expect(atingiuAlvo({ ...comum, dataSessao: undefined })).toBe(false));
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run lib/tcu/backfill-retroativo.test.ts`
Expected: FAIL — `Failed to resolve import "./backfill-retroativo"`.

- [ ] **Step 3: Implementar**

```typescript
/**
 * Núcleo puro do backfill retroativo de acórdãos do TCU (spec 2026-07-20).
 * Decide o que entra e com quais marcas; não toca rede nem banco.
 *
 * Duas regras não óbvias, ambas medidas:
 * - Acórdão DE RELAÇÃO é 80% do feed e não tem seção de voto (1-6 kB, sem
 *   Relatório/Voto/Acórdão). Como o dossiê de precedentes se alimenta de
 *   trechos NO VOTO, ele é combustível morto e é descartado aqui.
 * - As marcas de invisibilidade (categoria própria, isPublic false,
 *   reviewedBy próprio) existem porque as consultas do site já filtram por
 *   elas. É proteção por construção, não um filtro novo a espalhar.
 */

export interface ItemFeed {
  tipo?: string;
  numeroAcordao?: string;
  anoAcordao?: string;
  titulo?: string;
  sumario?: string;
  colegiado?: string;
  relator?: string;
  dataSessao?: string;
  urlArquivo?: string;
  urlArquivoPDF?: string;
}

export const CATEGORIA_GRAFO = 'acordao-grafo';
export const DATA_ALVO = '2023-12-01';

export function parseDataSessao(d: string | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((d ?? '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function linkRtf(item: ItemFeed): string | null {
  return item.urlArquivoPDF || item.urlArquivo || null;
}

function mapearColegiado(colegiado: string | null | undefined): string {
  const c = (colegiado ?? '').trim();
  if (/1[ªa]\s*c/i.test(c) || /primeira/i.test(c)) return 'Primeira Câmara';
  if (/2[ªa]\s*c/i.test(c) || /segunda/i.test(c)) return 'Segunda Câmara';
  return 'Plenário';
}

export function ehAproveitavel(item: ItemFeed): boolean {
  const tipo = (item.tipo ?? '').toUpperCase();
  if (tipo.includes('RELAÇÃO') || tipo.includes('RELACAO')) return false;
  if (!linkRtf(item)) return false;
  const num = Number(item.numeroAcordao);
  const ano = Number(item.anoAcordao);
  return Number.isFinite(num) && num > 0 && Number.isFinite(ano) && ano > 1990;
}

export function montarDadosDocument(item: ItemFeed): Record<string, unknown> | null {
  if (!ehAproveitavel(item)) return null;
  const num = Number(item.numeroAcordao);
  const ano = Number(item.anoAcordao);
  const colegiado = mapearColegiado(item.colegiado);
  const iso = parseDataSessao(item.dataSessao);

  return {
    title: item.titulo || `ACÓRDÃO ${num}/${ano} - ${colegiado}`,
    description: item.sumario || item.titulo || '',
    url: `https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/${num}/${ano}/${encodeURIComponent(colegiado)}`,
    type: 'link',
    category: CATEGORIA_GRAFO,
    courseId: null,
    isCommon: false,
    isPublic: false,
    reviewed: true,
    reviewedAt: new Date(),
    reviewedBy: 'backfill-grafo',
    tags: JSON.stringify(['TCU', 'Acórdão', 'grafo', colegiado, `${ano}`]),
    acordaoNumero: num,
    acordaoAno: ano,
    tcuNumeroAcordao: `${num}/${ano}`,
    tcuEmentaCompleta: item.sumario || null,
    tcuRelator: item.relator || null,
    tcuOrgaoJulgador: colegiado,
    tcuLinkPDF: linkRtf(item),
    tcuDataJulgamento: iso ? new Date(`${iso}T00:00:00Z`) : null,
    tcuEnriquecimentoStatus: 'skipped',
    embeddingStatus: 'skipped',
  };
}

export function atingiuAlvo(item: ItemFeed, dataAlvo: string = DATA_ALVO): boolean {
  const iso = parseDataSessao(item.dataSessao);
  return iso !== null && iso < dataAlvo;
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run lib/tcu/backfill-retroativo.test.ts`
Expected: PASS — 16 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/backfill-retroativo.ts lib/tcu/backfill-retroativo.test.ts
git commit -m "feat(tcu): nucleo puro do backfill retroativo (filtro de tipo + marcas de invisibilidade)"
```

---

### Task 3: Cron `backfill-tcu-retroativo`

**Files:**
- Create: `app/api/cron/backfill-tcu-retroativo/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `montarDadosDocument`, `atingiuAlvo`, `ItemFeed`, `DATA_ALVO` (Task 2); model `BackfillCursor` (Task 1).
- Produces: a rota `GET /api/cron/backfill-tcu-retroativo`, usada manualmente na Task 6.

- [ ] **Step 1: Escrever a rota**

```typescript
/**
 * Caminha o feed de dados abertos do TCU PARA TRÁS e insere os acórdãos
 * aproveitáveis como combustível do grafo de precedentes (spec 2026-07-20).
 *
 * Só isso: NÃO baixa RTF (é o catalog-tcu-inteiro-teor), NÃO enriquece com
 * LLM (seriam ~100 mil chamadas), NÃO embeda, NÃO escreve em TribunalDecision
 * (é a superfície /jurisprudencia).
 *
 * Idempotente: a constraint @@unique([acordaoNumero, acordaoAno,
 * tcuOrgaoJulgador]) faz o create duplicado estourar P2002, tratado como
 * ignorado. Repetir um offset não corrompe nada.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { montarDadosDocument, atingiuAlvo, DATA_ALVO, type ItemFeed } from '@/lib/tcu/backfill-retroativo';

export const maxDuration = 300;

const API = 'https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos';
const UA = 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)';
const CURSOR_ID = 'tcu-retroativo';
const PAGINA = 500;
const TIME_BUDGET_MS = 230_000; // uma pagina leva ~20s; folga sob o maxDuration de 300s

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let corpo: Record<string, unknown> = {};

  await withCronTelemetry('backfill-tcu-retroativo', async () => {
    const inicio = Date.now();
    const cursor =
      (await prisma.backfillCursor.findUnique({ where: { id: CURSOR_ID } })) ??
      (await prisma.backfillCursor.create({ data: { id: CURSOR_ID } }));

    if (cursor.concluido) {
      corpo = { concluido: true, totalInserido: cursor.totalInserido };
      return { itemsFound: 0, itemsNew: 0, itemsError: 0, metadata: { concluido: true } };
    }

    let offset = cursor.offset;
    let inseridos = 0, ignorados = 0, duplicados = 0, erros = 0, lidos = 0;
    let ultimoAcordao = cursor.ultimoAcordao, ultimaData = cursor.ultimaData;
    let concluido = false;

    while (Date.now() - inicio < TIME_BUDGET_MS && !concluido) {
      const res = await fetch(`${API}?inicio=${offset}&quantidade=${PAGINA}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        // Falha da fonte: NÃO avança o cursor, para não pular acórdãos.
        erros++;
        break;
      }
      const itens = (await res.json()) as ItemFeed[];
      if (!Array.isArray(itens) || itens.length === 0) {
        concluido = true;
        break;
      }
      lidos += itens.length;

      for (const item of itens) {
        if (atingiuAlvo(item, DATA_ALVO)) { concluido = true; break; }
        const dados = montarDadosDocument(item);
        if (!dados) { ignorados++; continue; }
        try {
          // Unchecked: passamos `courseId` como escalar, não como relação.
          await prisma.document.create({ data: dados as Prisma.DocumentUncheckedCreateInput });
          inseridos++;
          ultimoAcordao = `${dados.acordaoNumero}/${dados.acordaoAno}`;
          ultimaData = String(item.dataSessao ?? '');
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') duplicados++;
          else erros++;
        }
      }

      offset += itens.length;
      await prisma.backfillCursor.update({
        where: { id: CURSOR_ID },
        data: {
          offset,
          concluido,
          ultimoAcordao,
          ultimaData,
          totalInserido: { increment: inseridos },
          totalIgnorado: { increment: ignorados },
        },
      });
      inseridos = 0; ignorados = 0; // já contabilizados no cursor
      await new Promise((r) => setTimeout(r, 1000)); // rate limit 1 req/s
    }

    const final = await prisma.backfillCursor.findUnique({ where: { id: CURSOR_ID } });
    corpo = {
      offset: final?.offset, concluido: final?.concluido,
      totalInserido: final?.totalInserido, totalIgnorado: final?.totalIgnorado,
      ultimoAcordao: final?.ultimoAcordao, ultimaData: final?.ultimaData,
      lidosNesteRun: lidos, duplicados, erros,
    };
    return {
      itemsFound: lidos,
      itemsNew: final?.totalInserido ?? 0,
      itemsError: erros,
      metadata: { offset: final?.offset, duplicados, concluido: final?.concluido },
    };
  });

  return NextResponse.json(corpo);
}
```

⚠️ Nota sobre o contador: `inseridos`/`ignorados` são zerados após cada `increment` porque o total acumulado vive no cursor. `itemsNew` reporta o total da campanha, não o do run — é o número que interessa acompanhar.

- [ ] **Step 2: Registrar no `vercel.json`**

Acrescentar ao array `crons`, mantendo o formato dos vizinhos. Schedule diário às 6h15 (antes do `catalog-tcu-inteiro-teor` das 6h30, para que o material novo já pegue a esteira do mesmo dia):

```json
    {
      "path": "/api/cron/backfill-tcu-retroativo",
      "schedule": "15 6 * * *"
    },
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: nenhum erro apontando para `app/api/cron/backfill-tcu-retroativo/route.ts` nem para `lib/tcu/backfill-retroativo.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/backfill-tcu-retroativo/route.ts vercel.json
git commit -m "feat(tcu): cron de backfill retroativo com cursor persistido"
```

---

### Task 4: Abrir as filas a jusante para a categoria nova

Sem isto o material entra e não anda: as três filas casam `category: 'acordao'` exatamente.

**Files:**
- Modify: `app/api/cron/catalog-tcu-inteiro-teor/route.ts:47`
- Modify: `app/api/cron/sync-precedentes-tcu/route.ts:40`
- Modify: `scripts/backfill-tcu-inteiro-teor.ts:119`
- Modify: `scripts/backfill-precedentes-tcu.ts` (a linha com `category: 'acordao'`)
- Create: `lib/tcu/categorias.ts`
- Test: `lib/tcu/categorias.test.ts`

**Interfaces:**
- Produces: `export const CATEGORIAS_ACORDAO = ['acordao', 'acordao-grafo'] as const` — constante única, para que as quatro filas não divirjam.

- [ ] **Step 1: Escrever o teste da constante**

```typescript
import { describe, it, expect } from 'vitest';
import { CATEGORIAS_ACORDAO } from './categorias';
import { CATEGORIA_GRAFO } from './backfill-retroativo';

describe('CATEGORIAS_ACORDAO', () => {
  it('cobre o acervo curado e o combustivel do grafo', () => {
    expect([...CATEGORIAS_ACORDAO]).toEqual(['acordao', 'acordao-grafo']);
  });
  it('inclui exatamente a categoria que o backfill grava', () => {
    expect([...CATEGORIAS_ACORDAO]).toContain(CATEGORIA_GRAFO);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run lib/tcu/categorias.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Criar a constante**

```typescript
/**
 * Categorias que as FILAS de processamento do TCU devem enxergar.
 *
 * 'acordao'       = acervo curado por relevância temática, visível no site.
 * 'acordao-grafo' = combustível do grafo de precedentes, invisível ao usuário.
 *
 * As superfícies do site NÃO devem usar esta constante — elas filtram
 * 'acordao' e é justamente assim que o combustível fica fora delas.
 */
export const CATEGORIAS_ACORDAO = ['acordao', 'acordao-grafo'] as const;
```

- [ ] **Step 4: Trocar as quatro filas**

Em `app/api/cron/catalog-tcu-inteiro-teor/route.ts`, importar `CATEGORIAS_ACORDAO` de `@/lib/tcu/categorias` e trocar `category: 'acordao',` por:
```typescript
        category: { in: [...CATEGORIAS_ACORDAO] },
```

Em `app/api/cron/sync-precedentes-tcu/route.ts`, no objeto `filaWhere`, trocar `category: 'acordao' as const,` por:
```typescript
  category: { in: [...CATEGORIAS_ACORDAO] },
```

Em `scripts/backfill-tcu-inteiro-teor.ts:119`, trocar `where: { category: 'acordao', tcuLinkPDF: { not: null } },` por:
```typescript
    where: { category: { in: [...CATEGORIAS_ACORDAO] }, tcuLinkPDF: { not: null } },
```

Em `scripts/backfill-precedentes-tcu.ts`, aplicar a mesma troca na cláusula que casa `category: 'acordao'`.

- [ ] **Step 5: Rodar os testes e verificar tipos**

Run: `npx vitest run lib/tcu/categorias.test.ts && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: 2 testes PASS; nenhum erro de tipo nos quatro arquivos alterados.

- [ ] **Step 6: Commit**

```bash
git add lib/tcu/categorias.ts lib/tcu/categorias.test.ts app/api/cron/catalog-tcu-inteiro-teor/route.ts app/api/cron/sync-precedentes-tcu/route.ts scripts/backfill-tcu-inteiro-teor.ts scripts/backfill-precedentes-tcu.ts
git commit -m "feat(tcu): filas de catalogacao e precedentes enxergam a categoria do grafo"
```

---

### Task 5: Fechar as superfícies que não ficam seguras por construção

As marcas da Task 2 (`category`, `isPublic`, `reviewedBy`) já cobrem a maioria das consultas. Sobram quatro que não filtram por nada disso. Cada uma é tratada aqui — nenhuma fica para depois.

**Files:**
- Modify: `lib/obsidian/incremental-export.ts:100`
- Modify: `app/api/admin/analytics/summary/route.ts:55-58`
- Modify: `lib/cached-queries.ts:120-140`
- Modify: `app/api/search/unified/route.ts:242` e `app/api/area-restrita/search-all/route.ts:47`
- Test: `lib/tcu/invisibilidade-combustivel.test.ts`

**Interfaces:**
- Consumes: `CATEGORIA_GRAFO` (Task 2).

- [ ] **Step 1: Escrever o teste de regressão das cláusulas**

O teste não bate no banco: verifica que os `where` construídos excluem a categoria do grafo. Criar `lib/tcu/invisibilidade-combustivel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CATEGORIA_GRAFO } from './backfill-retroativo';

/**
 * Guarda de regressão. Estas quatro superfícies consultam Document sem
 * filtrar por category nem por isPublic, então a invisibilidade do
 * combustível depende de uma exclusão EXPLÍCITA em cada uma. Se alguém
 * remover a exclusão, este teste quebra antes de 10 mil registros vazarem
 * para um export, um contador ou o e-mail dos assinantes.
 */
const ARQUIVOS = [
  'lib/obsidian/incremental-export.ts',
  'app/api/admin/analytics/summary/route.ts',
  'lib/cached-queries.ts',
  'app/api/search/unified/route.ts',
  'app/api/area-restrita/search-all/route.ts',
];

describe('invisibilidade do combustivel do grafo', () => {
  it.each(ARQUIVOS)('%s exclui a categoria do grafo', (arquivo) => {
    expect(readFileSync(arquivo, 'utf8')).toContain(CATEGORIA_GRAFO);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run lib/tcu/invisibilidade-combustivel.test.ts`
Expected: FAIL nos 5 arquivos — nenhum menciona `acordao-grafo` ainda.

- [ ] **Step 3: Excluir a categoria em cada superfície**

Em cada arquivo, importar a constante e acrescentar a exclusão à cláusula `where` da consulta a `Document`:

```typescript
import { CATEGORIA_GRAFO } from '@/lib/tcu/backfill-retroativo';
// ...
  where: {
    // ...cláusulas existentes...
    category: { not: CATEGORIA_GRAFO },   // combustível do grafo nunca sai daqui
  },
```

Detalhe por arquivo:
- `lib/obsidian/incremental-export.ts:100` — o `findMany` hoje **não tem `where` nenhum**; acrescentar `where: { category: { not: CATEGORIA_GRAFO } }`, preservando o `select: EXPORT_DOC_SELECT` e qualquer paginação existente.
- `app/api/admin/analytics/summary/route.ts:55-58` — acrescentar a exclusão aos três `count` (`totalDocuments`, `publicDocuments`, `privateDocuments`), para os cards do dashboard não pularem em 10 mil.
- `lib/cached-queries.ts:120-140` (`getCachedDocumentCountByCategory`) — excluir do `groupBy`, para o hub `/base-conhecimento` não ganhar um card fantasma nem inflar o total do hero.
- `app/api/search/unified/route.ts:242` e `app/api/area-restrita/search-all/route.ts:47` — nestes o ramo de administrador ignora `isPublic`, então a exclusão por categoria é a única proteção; acrescentar em ambos os ramos, não só no público.

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run lib/tcu/invisibilidade-combustivel.test.ts && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: 5 testes PASS; sem erros de tipo.

- [ ] **Step 5: Rodar a suíte inteira, que é o que protege o produto**

Run: `npx vitest run 2>&1 | tail -20`
Expected: nenhuma regressão. Se algum teste existente quebrar por causa das cláusulas novas, **corrigir a cláusula**, não o teste.

- [ ] **Step 6: Commit**

```bash
git add lib/obsidian/incremental-export.ts app/api/admin/analytics/summary/route.ts lib/cached-queries.ts app/api/search/unified/route.ts app/api/area-restrita/search-all/route.ts lib/tcu/invisibilidade-combustivel.test.ts
git commit -m "fix(tcu): excluir combustivel do grafo do export, dos contadores e das buscas soltas"
```

---

### Task 6: Executar a W1 e medir o portão

Esta tarefa não escreve código de produção: executa o mecanismo sobre 1.000 acórdãos e produz o relatório que decide a campanha.

**Files:**
- Create: `scripts/medir-portao-w1.ts`
- Create: `docs/audits/2026-07-20-w1-ingestao-retroativa.md`

- [ ] **Step 1: Medir a linha de base ANTES de ingerir**

```bash
npx dotenv-cli -e .env.local -- npx tsx -e "
import {prisma} from './lib/prisma';
(async()=>{
  const docs = await prisma.document.count({ where: { category: { in: ['acordao','acordao-grafo'] } } });
  const comTexto = await prisma.document.count({ where: { category: { in: ['acordao','acordao-grafo'] }, tcuTextoCompleto: { not: null } } });
  const arestas = await prisma.acordaoCitacao.count();
  const noVoto = await prisma.acordaoCitacao.count({ where: { noVoto: true } });
  console.log(JSON.stringify({ docs, comTexto, arestas, noVoto }, null, 1));
  await prisma.\$disconnect();
})()"
```
Expected: algo próximo de `{docs: 1946, comTexto: 1685, arestas: 16833, noVoto: 5644}`. **Anotar os quatro números** — são a linha de base do portão.

- [ ] **Step 2: Ingerir ~1.000 acórdãos**

Rodar a rota de cron localmente com o `CRON_SECRET` do `.env.local`:
```bash
npm run dev   # em outro terminal
curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '\"')" \
  http://localhost:3000/api/cron/backfill-tcu-retroativo
```
Repetir até `totalInserido` passar de 1.000 (cada execução consome ~230 s de orçamento). Parar quando passar — **não** deixar rodar até o alvo de dez/2023 nesta onda.

Expected: JSON com `offset` crescente e `totalInserido` subindo. `totalIgnorado` deve ser ~4× o `totalInserido` (os 80% de acórdãos de relação).

- [ ] **Step 3: Catalogar o inteiro teor dos ingeridos**

O cron faria 30 por dia; para medir agora, rodar o backfill local, que não tem limite de tempo:
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-tcu-inteiro-teor.ts --execute --limit=1000
```
Expected: progresso item a item; leva algumas horas a ~8 s por acórdão. Pode ser interrompido e retomado — a fila é auto-drenante por `tcuAnalise IS NULL`.

- [ ] **Step 4: Extrair as arestas**

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-precedentes-tcu.ts --execute
```
Expected: processa os acórdãos com `tcuTextoCompleto` e `precedentesVersao` nula.

- [ ] **Step 5: Escrever o medidor e rodá-lo**

Criar `scripts/medir-portao-w1.ts`:

```typescript
/**
 * Mede o portão da onda W1 (spec §6). Compara o estado atual com a linha de
 * base anotada no Step 1 e aplica o critério de GO sem reinterpretá-lo.
 */
import { prisma } from '../lib/prisma';
import { CATEGORIA_GRAFO } from '../lib/tcu/backfill-retroativo';

// Linha de base do Step 1 — SUBSTITUIR pelos números realmente medidos.
const BASE = { docs: 1946, comTexto: 1685, arestas: 16833, noVoto: 5644 };

async function main() {
  const grafo = { category: CATEGORIA_GRAFO };
  const ingeridos = await prisma.document.count({ where: grafo });
  const comTexto = await prisma.document.count({ where: { ...grafo, tcuTextoCompleto: { not: null } } });
  const semLink = await prisma.document.count({ where: { ...grafo, tcuLinkPDF: null } });
  const arestas = await prisma.acordaoCitacao.count();
  const noVoto = await prisma.acordaoCitacao.count({ where: { noVoto: true } });

  const novasNoVoto = noVoto - BASE.noVoto;
  const porAcordao = ingeridos === 0 ? 0 : novasNoVoto / ingeridos;

  console.log(JSON.stringify({
    ingeridos, comTexto, semLink,
    taxaCatalogacao: ingeridos ? +(comTexto / ingeridos).toFixed(3) : 0,
    arestasNovas: arestas - BASE.arestas,
    arestasNovasNoVoto: novasNoVoto,
    porAcordaoIngerido: +porAcordao.toFixed(2),
    reguaHistorica: 3.35,
    criterioGO: 'arestasNovasNoVoto >= 1000 sobre ~1000 ingeridos (>= 1,0 por acordao)',
    veredito: novasNoVoto >= 1000 ? 'GO' : 'NO-GO',
  }, null, 1));

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `npx dotenv-cli -e .env.local -- npx tsx scripts/medir-portao-w1.ts`
Expected: JSON com o veredito.

- [ ] **Step 6: Escrever o relatório**

`docs/audits/2026-07-20-w1-ingestao-retroativa.md` com: linha de base e estado final; a saída do medidor; a taxa real de acórdãos de relação descartados; a taxa de catalogação com sucesso (quantos renderam `tcuTextoCompleto`); o tempo médio por acórdão observado no Step 3 e a projeção de campanha revista; o veredito **GO/NO-GO aplicado literalmente**, sem reinterpretar o limiar; e, se GO, a estimativa de quantos dias e de quanto compute a campanha completa consumirá.

- [ ] **Step 7: Commit e PR**

```bash
git add scripts/medir-portao-w1.ts docs/audits/2026-07-20-w1-ingestao-retroativa.md
git commit -m "docs(tcu): medicao do portao da onda W1 e veredito"
git push -u origin feat/ingestao-retroativa-tcu
```

Abrir PR "Ingestão retroativa do TCU — onda W1 (mecanismo + portão)" com o veredito no corpo.

---

## Notas de execução

- **O portão é de parada real.** NO-GO encerra a frente C1 e a frente A segue sozinha. Não se ajusta o limiar depois de ver o número.
- **A W1 não roda a campanha.** Ela para em ~1.000 acórdãos de propósito. Elevar a frequência do `catalog-tcu-inteiro-teor` para cada 10 minutos é trabalho da W2, e só depois do GO.
- **Nenhuma tarefa altera o motor de teses nem o `sync-tcu-acordaos`.** O cron diário do acervo curado continua exatamente como está, gravando `category: 'acordao'`.
- **Se a suíte quebrar na Task 5**, a cláusula nova é que está errada, não o teste existente. Uma superfície que passou a excluir demais é tão defeito quanto uma que vaza.
