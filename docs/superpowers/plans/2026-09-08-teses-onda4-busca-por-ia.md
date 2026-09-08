# Teses do TCU — Onda 4: busca por IA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer as teses publicadas serem recuperáveis pela busca semântica, sem que a súmula expulse do contexto o acórdão que a sustenta.

**Architecture:** Um chunk por enunciado numa tabela própria (`TeseEnunciadoChunk`), indexado por um processador no desenho de `tribunal-decision-processor.ts`, e um quarto ramo **opt-in** no `UNION ALL` de `vector-search.ts`. A elegibilidade não é replicada à mão: o ramo faz `JOIN` na tabela-mãe e aplica o predicado canônico, como o ramo de `TribunalDecisionChunk` já faz para `tribunalCode`. A visibilidade (vitrine ou acervo) é decidida pelo chamador a partir do acesso do usuário, entra na chave de cache e nunca é pós-filtro.

**Tech Stack:** TypeScript, Prisma 7 (PrismaNeon), PostgreSQL/Neon + pgvector, Next.js 15 (App Router), React 19, Vitest, embeddings Gemini (`gemini-embedding-2-preview`, 768d).

**Spec:** `docs/superpowers/specs/2026-09-04-publicacao-teses-tcu-design.md` — §9 (busca por IA) e §14, itens 12 a 15.

## Global Constraints

- **Diretório de trabalho:** `C:\Users\User\projetos\sitedobarral`. Rodar tudo da raiz.
- **Idioma:** comentários, mensagens de commit, saída de script e **todo texto de interface** em português, com acentuação correta — nunca "nao" por "não", "acordao" por "acórdão". Um commit da Onda 1 precisou ser refeito por violar isto.
- **Verificação obrigatória antes de reportar qualquer tarefa:** `npx vitest run` (suíte inteira) **e** `npx tsc --noEmit -p tsconfig.json`. Linha de base desta onda: **3.037 testes passando, zero erros de tipo** (medido em 08/09/2026, após o merge do #206). O vitest usa esbuild e não checa tipos — suíte verde não prova compilação.
- **Site em produção.** Desde 08/09/2026 o CI tem testes de navegador funcionando (banco descartável na Neon, criado e apagado a cada execução); eles rodam sozinhos em toda PR contra `main`.
- **Predicado canônico:** `WHERE_ELEGIVEL_BASE`, `WHERE_ELEGIVEL_VITRINE` e `evidenciaIntegral` vivem em `lib/tcu/elegibilidade-tese.ts`. Nenhuma tarefa reescreve a regra; o ramo SQL a traduz uma única vez, na Task 3, com o comentário apontando para a fonte.
- **Migrações:** o deploy roda `prisma migrate deploy`. Gerar a migração **offline** com `prisma migrate diff` e **não aplicar** contra produção — a execução fica com o usuário.
- **Embeddings custam dinheiro.** Nenhuma tarefa dispara indexação em massa; a fila é processada pelo cron, em lotes. Scripts de dado nascem em dry-run.
- **Vocabulário de veredito:** `fiel | imprecisa | errada` (`lib/tcu/parsear-veredito.ts`). Só `fiel` é aprovação.
- **Números medidos em 08/09/2026:** 88 enunciados publicados, em 62 acórdãos-líderes; **0 na vitrine** (a promoção é editorial e não é objeto desta onda); 265 destilações atuais; 341 enunciados com evidência; 5.462 trechos.
- **Três arquivos são do usuário e não entram em commit algum:** `docs/audits/folha-teses-tcu-licitacoes.html`, `catalogacao-fontes-tcu-licitacoes.docx`, `.claude/settings.json`.
- **Staging explícito** — nunca `git add -A`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `prisma/schema.prisma` | Model `TeseEnunciadoChunk` (Task 1) |
| `lib/embeddings/tese-texto.ts` | Função pura: enunciado → texto embeddável, com o prefixo de procedência (Task 1) |
| `lib/embeddings/tese-processor.ts` | Indexação de um enunciado, com o gate fino da §6 (Task 1) |
| `lib/embeddings/tese-reconciliacao.ts` | Ciclo de vida: indexa o elegível, apaga o chunk do inelegível (Task 2) |
| `lib/embeddings/vector-search.ts` | Quarto ramo do `UNION ALL`, opções e chave de cache (Task 3) |
| `lib/embeddings/hybrid-search.ts` | Repasse das opções novas (Task 4) |
| `lib/types/global-search.ts` | `ContentType` ganha `'tese'`; interface `TeseResult` (Task 5) |
| `app/api/busca-integrada/visibilidade-teses.ts` | A regra de visibilidade, num lugar só (Task 5) |
| `components/busca/CartaoTeseBusca.tsx` | Cartão do resultado: enunciado, precedente e trecho (Task 5) |
| `lib/rag/evidencia-da-tese.ts` | A evidência viaja com a tese para o contexto da IA (Task 6) |
| `eval/teses/pareado.ts` | Medição do deslocamento dos acórdãos (Task 7) |

A separação entre `tese-texto.ts` e `tese-processor.ts` existe pelo mesmo motivo que levou a Onda 3 a isolar `lib/teses/consultas.ts`: a regra do prefixo é testável sem instanciar o Prisma, e é ela que carrega a decisão da §4.3 — nunca afirmar colegiado que não se sabe.

---

### Task 1: Tabela, texto embeddável e processador

Sem tabela própria não há onde indexar. E sem o prefixo correto a súmula flutua sem o precedente, perdendo o vínculo que a §9 quer preservar.

**Files:**
- Create: `lib/embeddings/tese-texto.ts`
- Create: `lib/embeddings/tese-processor.ts`
- Modify: `prisma/schema.prisma` (novo model, após `TeseTrechoFonte`; relação inversa em `TeseEnunciado`)
- Create: `prisma/migrations/<timestamp>_add_tese_enunciado_chunk/migration.sql`
- Test: `lib/embeddings/__tests__/tese-texto.test.ts`
- Test: `lib/embeddings/__tests__/tese-processor.test.ts`

**Interfaces:**
- Consumes: `generateBatchEmbeddings` e `embeddingToSql` de `lib/embeddings/gemini-embeddings.ts`; `evidenciaIntegral` de `lib/tcu/elegibilidade-tese.ts`.
- Produces:
  - `interface EntradaTexto { enunciado: string; assunto: string; numeroAlvo: number; anoAlvo: number; colegiadoAlvo: string | null; acordaoKey: string | null; origemIdentidade: string | null }`
  - `textoEmbeddavel(e: EntradaTexto): string`
  - `interface ResultadoTese { success: boolean; enunciadoId: string; error?: string; stats?: { chunkCount: number; processingTime: number } }`
  - `processTeseEnunciado(enunciadoId: string): Promise<ResultadoTese>`

- [ ] **Step 1: Escrever o teste do texto embeddável**

Criar `lib/embeddings/__tests__/tese-texto.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { textoEmbeddavel } from '../tese-texto';

const base = {
  enunciado: 'A exigência de atestado de capacidade técnica deve guardar pertinência com o objeto.',
  assunto: 'Qualificação técnica em licitações',
  numeroAlvo: 1441,
  anoAlvo: 2016,
  colegiadoAlvo: 'Plenário',
  acordaoKey: 'ACORDAO-COMPLETO-123',
  origemIdentidade: 'tcu-oficial',
};

describe('textoEmbeddavel', () => {
  it('prefixa o assunto e o acórdão-líder com colegiado quando ele é sabido', () => {
    expect(textoEmbeddavel(base)).toBe(
      'Qualificação técnica em licitações\nAcórdão 1441/2016 — Plenário\n\n' +
        'A exigência de atestado de capacidade técnica deve guardar pertinência com o objeto.',
    );
  });

  it('mantém o colegiado quando ele vem da convergência dos citantes', () => {
    const texto = textoEmbeddavel({ ...base, acordaoKey: null, origemIdentidade: 'convergencia-citantes' });
    expect(texto).toContain('Acórdão 1441/2016 — Plenário');
  });

  // §4.3: nunca afirmar colegiado que não se sabe. No nível 3 a linha do
  // acórdão termina no ano, e não ganha "colegiado desconhecido" — isso poria
  // a palavra "desconhecido" dentro do vetor, competindo com o conteúdo.
  it('omite o colegiado quando não se sabe qual é', () => {
    const texto = textoEmbeddavel({ ...base, colegiadoAlvo: null, acordaoKey: null, origemIdentidade: null });
    expect(texto).toContain('Acórdão 1441/2016\n');
    expect(texto).not.toContain('—');
  });

  it('não deixa assunto vazio virar linha em branco no começo', () => {
    const texto = textoEmbeddavel({ ...base, assunto: '   ' });
    expect(texto.startsWith('Acórdão')).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/embeddings/__tests__/tese-texto.test.ts`
Expected: FAIL — `Failed to resolve import "../tese-texto"`.

- [ ] **Step 3: Implementar o texto embeddável**

Criar `lib/embeddings/tese-texto.ts`:

```typescript
/**
 * Texto que vira vetor para uma tese (spec §9).
 *
 * O enunciado sozinho é uma frase de súmula: abstrata, curta e sem âncora no
 * precedente. Sem o prefixo, o retrieval perde o vínculo com o acórdão-líder
 * que a §9 quer preservar, e o leitor recebe afirmação sem procedência.
 *
 * O colegiado só entra quando é sabido (§4.3).
 */
export interface EntradaTexto {
  enunciado: string;
  assunto: string;
  numeroAlvo: number;
  anoAlvo: number;
  colegiadoAlvo: string | null;
  acordaoKey: string | null;
  origemIdentidade: string | null;
}

export function textoEmbeddavel(e: EntradaTexto): string {
  const linhas: string[] = [];

  const assunto = e.assunto?.trim();
  if (assunto) linhas.push(assunto);

  const colegiado = e.colegiadoAlvo?.trim();
  linhas.push(
    colegiado
      ? `Acórdão ${e.numeroAlvo}/${e.anoAlvo} — ${colegiado}`
      : `Acórdão ${e.numeroAlvo}/${e.anoAlvo}`,
  );

  return `${linhas.join('\n')}\n\n${e.enunciado.trim()}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/embeddings/__tests__/tese-texto.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Acrescentar o model ao schema**

Em `prisma/schema.prisma`, logo após o model `TeseTrechoFonte`:

```prisma
/// Um chunk por enunciado (spec §9). Enunciados são curtos — não há divisão a
/// fazer, e dividir separaria a súmula do seu próprio prefixo de procedência.
/// A tabela é separada de DocumentChunk porque o ramo da busca precisa de JOIN
/// na tabela-mãe para aplicar o predicado da §6.
model TeseEnunciadoChunk {
  id          String        @id @default(uuid())
  enunciadoId String        @unique
  enunciado   TeseEnunciado @relation(fields: [enunciadoId], references: [id], onDelete: Cascade)
  content     String        @db.Text
  embedding   Unsupported("vector(768)")
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([enunciadoId])
}
```

E, no model `TeseEnunciado`, junto de `trechos`:

```prisma
  chunk   TeseEnunciadoChunk?
```

O `@unique` em `enunciadoId` é o que faz de "um chunk por enunciado" uma regra do banco, e não uma convenção do processador.

- [ ] **Step 6: Gerar a migração offline e o client**

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-head.prisma
npx prisma migrate diff --from-schema-datamodel /tmp/schema-head.prisma --to-schema-datamodel prisma/schema.prisma --script > /tmp/migration.sql
```

Criar `prisma/migrations/<AAAAMMDDHHMMSS>_add_tese_enunciado_chunk/migration.sql` com esse conteúdo. Conferir que o SQL contém `CREATE TABLE "TeseEnunciadoChunk"` e **não** contém nenhum `DROP`. Depois rodar `npx prisma generate`.

Expected: `Generated Prisma Client`.

- [ ] **Step 7: Escrever o teste do processador**

Criar `lib/embeddings/__tests__/tese-processor.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique, mockUpdate, mockExecuteRaw, mockEmbeddings } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockEmbeddings: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teseEnunciado: { findUnique: mockFindUnique, update: mockUpdate },
    $executeRawUnsafe: mockExecuteRaw,
  },
}));
vi.mock('../gemini-embeddings', () => ({
  generateBatchEmbeddings: mockEmbeddings,
  embeddingToSql: (v: number[]) => `[${v.join(',')}]`,
}));

import { processTeseEnunciado } from '../tese-processor';

const elegivel = {
  id: 'e1',
  enunciado: 'Enunciado de teste com tamanho suficiente para virar vetor.',
  veredito: 'fiel',
  retiradoEm: null,
  trechosFonte: [0],
  trechos: [{ ordem: 0, origemDocumentId: 'd1', origemUrl: null, origemLinkPDF: null }],
  destilacao: {
    atual: true,
    assunto: 'Assunto',
    numeroAlvo: 1441,
    anoAlvo: 2016,
    colegiadoAlvo: 'Plenário',
    acordaoKey: 'ACORDAO-COMPLETO-1',
    origemIdentidade: 'tcu-oficial',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEmbeddings.mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] });
});

describe('processTeseEnunciado', () => {
  it('indexa um enunciado elegível e marca completed', async () => {
    mockFindUnique.mockResolvedValue(elegivel);
    const r = await processTeseEnunciado('e1');
    expect(r.success).toBe(true);
    expect(r.stats?.chunkCount).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ embeddingStatus: 'completed' }) }),
    );
  });

  // O gate fino da §6: a contagem de índices declarados contra os persistidos
  // não é expressável em SQL, então é aqui que ela roda. Sem isto entraria no
  // índice tese cuja evidência ninguém consegue conferir.
  it('recusa enunciado com evidência incompleta, sem gastar embedding', async () => {
    mockFindUnique.mockResolvedValue({ ...elegivel, trechosFonte: [0, 1] });
    const r = await processTeseEnunciado('e1');
    expect(r.success).toBe(false);
    expect(mockEmbeddings).not.toHaveBeenCalled();
  });

  it('recusa enunciado reprovado', async () => {
    mockFindUnique.mockResolvedValue({ ...elegivel, veredito: 'imprecisa' });
    const r = await processTeseEnunciado('e1');
    expect(r.success).toBe(false);
    expect(mockEmbeddings).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `npx vitest run lib/embeddings/__tests__/tese-processor.test.ts`
Expected: FAIL — módulo `../tese-processor` não existe.

- [ ] **Step 9: Implementar o processador**

Criar `lib/embeddings/tese-processor.ts`:

```typescript
/**
 * Indexação de uma tese para a busca semântica (spec §9).
 *
 * A elegibilidade é conferida AQUI, antes de gastar embedding, com o mesmo
 * predicado dos outros três consumidores. O ramo SQL da busca repete a parte
 * grosseira; a integralidade da evidência não cabe em SQL e é este gate que a
 * garante — um chunk só existe para enunciado íntegro.
 */
import { prisma } from '@/lib/prisma';
import { generateBatchEmbeddings, embeddingToSql } from './gemini-embeddings';
import { evidenciaIntegral } from '@/lib/tcu/elegibilidade-tese';
import { textoEmbeddavel } from './tese-texto';
import { apiLogger } from '@/lib/logger';

export interface ResultadoTese {
  success: boolean;
  enunciadoId: string;
  error?: string;
  stats?: { chunkCount: number; processingTime: number };
}

export async function processTeseEnunciado(enunciadoId: string): Promise<ResultadoTese> {
  const inicio = Date.now();

  try {
    const e = await prisma.teseEnunciado.findUnique({
      where: { id: enunciadoId },
      select: {
        id: true,
        enunciado: true,
        veredito: true,
        retiradoEm: true,
        trechosFonte: true,
        trechos: {
          select: { ordem: true, origemDocumentId: true, origemUrl: true, origemLinkPDF: true },
        },
        destilacao: {
          select: {
            atual: true,
            assunto: true,
            numeroAlvo: true,
            anoAlvo: true,
            colegiadoAlvo: true,
            acordaoKey: true,
            origemIdentidade: true,
          },
        },
      },
    });

    if (!e) return { success: false, enunciadoId, error: 'Enunciado não encontrado' };

    const elegivel =
      e.veredito === 'fiel' &&
      e.retiradoEm === null &&
      e.destilacao.atual &&
      e.trechos.length > 0 &&
      evidenciaIntegral({ trechosFonte: e.trechosFonte, trechos: e.trechos });

    if (!elegivel) {
      await prisma.teseEnunciado.update({
        where: { id: enunciadoId },
        data: { embeddingStatus: 'skipped' },
      });
      return { success: false, enunciadoId, error: 'Enunciado inelegível (spec §6)' };
    }

    const conteudo = textoEmbeddavel({
      enunciado: e.enunciado,
      assunto: e.destilacao.assunto,
      numeroAlvo: e.destilacao.numeroAlvo,
      anoAlvo: e.destilacao.anoAlvo,
      colegiadoAlvo: e.destilacao.colegiadoAlvo,
      acordaoKey: e.destilacao.acordaoKey,
      origemIdentidade: e.destilacao.origemIdentidade,
    });

    const { embeddings } = await generateBatchEmbeddings([conteudo]);
    const vetor = embeddingToSql(embeddings[0]);

    // Upsert pela coluna @unique: reindexar reescreve a mesma linha em vez de
    // acumular chunk órfão, que continuaria sendo recuperado e citado.
    await prisma.$executeRawUnsafe(
      `INSERT INTO "TeseEnunciadoChunk" (id, "enunciadoId", content, embedding, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, '${vetor}'::vector, NOW(), NOW())
       ON CONFLICT ("enunciadoId") DO UPDATE
       SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, "updatedAt" = NOW()`,
      enunciadoId,
      conteudo,
    );

    await prisma.teseEnunciado.update({
      where: { id: enunciadoId },
      data: { embeddingStatus: 'completed' },
    });

    return {
      success: true,
      enunciadoId,
      stats: { chunkCount: 1, processingTime: Date.now() - inicio },
    };
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : String(erro);
    apiLogger.error({ enunciadoId, erro: msg }, 'falha ao indexar tese');
    await prisma.teseEnunciado
      .update({ where: { id: enunciadoId }, data: { embeddingStatus: 'failed' } })
      .catch(() => {});
    return { success: false, enunciadoId, error: msg };
  }
}
```

- [ ] **Step 10: Rodar e ver passar**

Run: `npx vitest run lib/embeddings/__tests__/tese-processor.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 11: Verificação e commit**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
git add prisma/schema.prisma prisma/migrations lib/embeddings/tese-texto.ts lib/embeddings/tese-processor.ts lib/embeddings/__tests__/tese-texto.test.ts lib/embeddings/__tests__/tese-processor.test.ts
git commit -m "feat(teses): tabela e processador do embedding da tese"
```

---

### Task 2: Ciclo de vida do embedding

A §9 é explícita: quem sai da elegibilidade tem o chunk **apagado**, não despriorizado — chunk órfão continua sendo recuperado e citado. E a reconciliação é uma consulta pelo predicado, não uma lista de eventos, para que uma transição feita por SQL direto no banco também seja capturada.

**Files:**
- Create: `lib/embeddings/tese-reconciliacao.ts`
- Modify: `app/api/cron/process-index-jobs/route.ts` (após o bloco que processa `pendingDecisions`, ~linha 450)
- Test: `lib/embeddings/__tests__/tese-reconciliacao.test.ts`

**Interfaces:**
- Consumes: `processTeseEnunciado` da Task 1; `WHERE_ELEGIVEL_BASE` de `lib/tcu/elegibilidade-tese.ts`.
- Produces: `reconciliarTeses(opcoes?: { limite?: number }): Promise<{ indexados: number; apagados: number; falhas: number }>`

- [ ] **Step 1: Escrever o teste da reconciliação**

Criar `lib/embeddings/__tests__/tese-reconciliacao.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockDeleteMany, mockProcess } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockProcess: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teseEnunciado: { findMany: mockFindMany },
    teseEnunciadoChunk: { deleteMany: mockDeleteMany },
  },
}));
vi.mock('../tese-processor', () => ({ processTeseEnunciado: mockProcess }));

import { reconciliarTeses } from '../tese-reconciliacao';

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteMany.mockResolvedValue({ count: 0 });
});

describe('reconciliarTeses', () => {
  it('indexa os elegíveis que ainda não têm chunk', async () => {
    mockFindMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
    mockProcess.mockResolvedValue({ success: true, enunciadoId: 'x' });
    const r = await reconciliarTeses();
    expect(r.indexados).toBe(2);
  });

  // A garantia central da §9: quem perdeu elegibilidade some do índice.
  it('apaga o chunk de quem deixou de ser elegível', async () => {
    mockFindMany.mockResolvedValue([]);
    mockDeleteMany.mockResolvedValue({ count: 3 });
    const r = await reconciliarTeses();
    expect(r.apagados).toBe(3);
  });

  it('conta falha sem derrubar o lote', async () => {
    mockFindMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
    mockProcess
      .mockResolvedValueOnce({ success: false, enunciadoId: 'e1', error: 'quota' })
      .mockResolvedValueOnce({ success: true, enunciadoId: 'e2' });
    const r = await reconciliarTeses();
    expect(r).toMatchObject({ indexados: 1, falhas: 1 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/embeddings/__tests__/tese-reconciliacao.test.ts`
Expected: FAIL — módulo `../tese-reconciliacao` não existe.

- [ ] **Step 3: Implementar a reconciliação**

Criar `lib/embeddings/tese-reconciliacao.ts`:

```typescript
/**
 * Reconciliação do índice das teses (spec §9).
 *
 * NÃO é uma lista de eventos: é uma consulta pelo predicado canônico, dos dois
 * lados. Indexa o elegível sem chunk e apaga o chunk de quem deixou de ser
 * elegível — assim uma transição feita por SQL direto no banco, ou por um
 * script que esqueceu de marcar `embeddingStatus`, também é capturada.
 *
 * `publicado` e `vitrinePublica` NÃO entram aqui: são filtro de leitura, não
 * critério de indexação. Um mesmo chunk serve vitrine e acervo, e é a consulta
 * que decide o que enxerga. Indexar duas vezes duplicaria o vetor só para
 * variar o predicado.
 */
import { prisma } from '@/lib/prisma';
import { WHERE_ELEGIVEL_BASE } from '@/lib/tcu/elegibilidade-tese';
import { processTeseEnunciado } from './tese-processor';

const LOTE_PADRAO = 50;

export async function reconciliarTeses(
  opcoes: { limite?: number } = {},
): Promise<{ indexados: number; apagados: number; falhas: number }> {
  const limite = opcoes.limite ?? LOTE_PADRAO;

  const pendentes = await prisma.teseEnunciado.findMany({
    where: { ...WHERE_ELEGIVEL_BASE, chunk: { is: null } },
    select: { id: true },
    take: limite,
  });

  let indexados = 0;
  let falhas = 0;
  for (const p of pendentes) {
    const r = await processTeseEnunciado(p.id);
    if (r.success) indexados++;
    else falhas++;
  }

  const { count: apagados } = await prisma.teseEnunciadoChunk.deleteMany({
    where: { enunciado: { NOT: WHERE_ELEGIVEL_BASE } },
  });

  return { indexados, apagados, falhas };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/embeddings/__tests__/tese-reconciliacao.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Ligar no cron de indexação**

Em `app/api/cron/process-index-jobs/route.ts`, importar no topo:

```typescript
import { reconciliarTeses } from '@/lib/embeddings/tese-reconciliacao';
```

E, após o laço que processa `pendingDecisions`:

```typescript
    // 8. Reconciliação do índice das teses (spec §9). Fica por último porque é
    // barata — no máximo 50 embeddings de uma frase — e porque o delete precisa
    // acontecer mesmo quando o orçamento de tempo acabou para os demais: chunk
    // órfão continua sendo recuperado e citado.
    const teses = await reconciliarTeses();
    console.log(
      `🧾 Teses: ${teses.indexados} indexadas, ${teses.apagados} chunks apagados, ${teses.falhas} falhas`,
    );
```

- [ ] **Step 6: Verificação e commit**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
git add lib/embeddings/tese-reconciliacao.ts lib/embeddings/__tests__/tese-reconciliacao.test.ts app/api/cron/process-index-jobs/route.ts
git commit -m "feat(teses): reconciliação do índice no cron de indexação"
```

---

### Task 3: Quarto ramo na busca vetorial

**Files:**
- Modify: `lib/embeddings/vector-search.ts` (`SearchResult.sourceType`; `SearchOptions`; chave de cache na linha ~160; novo CTE após o ramo C, ~linha 495)
- Modify: `scripts/criar-indice-vetorial.ts` (índice HNSW da tabela nova)
- Test: `lib/embeddings/__tests__/vector-search-teses.test.ts`

**Interfaces:**
- Consumes: a tabela criada na Task 1.
- Produces: `SearchOptions.includeTeses?: boolean` (default `false`); `SearchOptions.tesesVisibilidade?: 'vitrine' | 'acervo'` (default `'vitrine'`); `chaveVisibilidadeTeses(o): 'off' | 'vitrine' | 'acervo'`; `sourceType` passa a aceitar `'tese'`.

- [ ] **Step 1: Escrever o teste da chave de cache**

Criar `lib/embeddings/__tests__/vector-search-teses.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { chaveVisibilidadeTeses } from '../vector-search';

describe('chaveVisibilidadeTeses', () => {
  // Sem isto há vazamento: a consulta de quem tem acesso ativo gravaria no
  // cache um resultado com o acervo, e o próximo anônimo com a mesma pergunta
  // receberia esse resultado (spec §9).
  it('distingue desligado, vitrine e acervo', () => {
    expect(chaveVisibilidadeTeses({})).toBe('off');
    expect(chaveVisibilidadeTeses({ includeTeses: true })).toBe('vitrine');
    expect(chaveVisibilidadeTeses({ includeTeses: true, tesesVisibilidade: 'vitrine' })).toBe('vitrine');
    expect(chaveVisibilidadeTeses({ includeTeses: true, tesesVisibilidade: 'acervo' })).toBe('acervo');
  });

  it('ignora a visibilidade quando o ramo está desligado', () => {
    expect(chaveVisibilidadeTeses({ tesesVisibilidade: 'acervo' })).toBe('off');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/embeddings/__tests__/vector-search-teses.test.ts`
Expected: FAIL — `chaveVisibilidadeTeses` não é exportada.

- [ ] **Step 3: Implementar opções, helper e chave de cache**

Em `lib/embeddings/vector-search.ts`, ampliar `sourceType` em `SearchResult`:

```typescript
  sourceType: 'document' | 'legislative-act' | 'tribunal-decision' | 'tese';
```

Acrescentar a `SearchOptions`, junto de `includeTribunalDecisions`:

```typescript
  /**
   * Inclui o ramo TeseEnunciadoChunk. Opt-in, no mesmo desenho de
   * includeTribunalDecisions: nenhum chamador existente muda de comportamento
   * ao subir esta feature.
   */
  includeTeses?: boolean;
  /**
   * Recorte visível das teses. 'vitrine' = só as promovidas ao público;
   * 'acervo' = tudo que está publicado. Quem decide é o chamador, a partir do
   * acesso do usuário — não da rota (spec §9).
   */
  tesesVisibilidade?: 'vitrine' | 'acervo';
```

Exportar o helper junto de `resolveEmbeddingColumn`:

```typescript
/**
 * Componente de visibilidade das teses na chave de cache. É parte da
 * identidade do resultado, não um pós-filtro.
 */
export function chaveVisibilidadeTeses(
  o: { includeTeses?: boolean; tesesVisibilidade?: 'vitrine' | 'acervo' },
): 'off' | 'vitrine' | 'acervo' {
  if (!o.includeTeses) return 'off';
  return o.tesesVisibilidade === 'acervo' ? 'acervo' : 'vitrine';
}
```

E acrescentar à `cacheKey` (linha ~160), antes de `:tb=`:

```typescript
:ts=${chaveVisibilidadeTeses(options)}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/embeddings/__tests__/vector-search-teses.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Acrescentar o ramo D ao SQL**

Desestruturar as opções novas onde as demais são lidas:

```typescript
  const includeTeses = options.includeTeses ?? false;
  const tesesVisibilidade = options.tesesVisibilidade ?? 'vitrine';
```

E, após o bloco `// ---- Ramo C: TribunalDecisionChunk ----` e antes de `// ---- Final limit ----`:

```typescript
  // ---- Ramo D: TeseEnunciadoChunk ----
  if (includeTeses) {
    // O predicado da §6 traduzido uma única vez (fonte: lib/tcu/elegibilidade-tese.ts).
    // A integralidade da evidência NÃO cabe em SQL — compara contagem contra
    // campo Json — e por isso é o gate da indexação que a garante: um chunk só
    // existe para enunciado íntegro. Este WHERE é a segunda tranca, para o dado
    // que mudou entre a indexação e a leitura.
    let teseWhere = `te.veredito = 'fiel' AND te."retiradoEm" IS NULL AND td.atual = true AND te.publicado = true`;
    if (tesesVisibilidade !== 'acervo') {
      teseWhere += ` AND te."vitrinePublica" = true AND td."acordaoKey" IS NOT NULL`;
    }

    const teseThresholdIdx = nextParam();
    params.push(threshold);
    const teseLimitIdx = nextParam();
    params.push(limit * 2);

    ctes.push(`tese_scores AS (
      SELECT
        te.id as document_id,
        CONCAT('Acórdão ', td."numeroAlvo", '/', td."anoAlvo") as document_title,
        'tese' as category,
        tec.content as chunk_content,
        0 as chunk_index,
        1 - (tec.${vcol} <=> '${embeddingStr}'::vector) as similarity,
        NULL as url,
        NULL as course_id,
        true as is_common,
        NULL as tags,
        NULL as lei_articles,
        NULL::int as hierarchy_level,
        'tese' as source_type,
        te."atualizadoEm" as uploaded_at
      FROM "TeseEnunciadoChunk" tec
      JOIN "TeseEnunciado" te ON tec."enunciadoId" = te.id
      JOIN "TeseDestilacao" td ON te."destilacaoId" = td.id
      WHERE ${teseWhere}
    )`);

    unions.push(`(SELECT * FROM tese_scores WHERE similarity >= $${teseThresholdIdx} ORDER BY similarity DESC LIMIT $${teseLimitIdx})`);
  }
```

- [ ] **Step 6: Criar o índice vetorial da tabela nova**

Acrescentar `TeseEnunciadoChunk` à lista de tabelas percorrida por `scripts/criar-indice-vetorial.ts` (mergeado no #206), no mesmo formato das demais. Sem índice HNSW o ramo faz varredura sequencial, e a latência cresce com o acervo. O script é dry-run por padrão; a execução contra produção fica com o usuário.

- [ ] **Step 7: Verificação e commit**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
git add lib/embeddings/vector-search.ts lib/embeddings/__tests__/vector-search-teses.test.ts scripts/criar-indice-vetorial.ts
git commit -m "feat(teses): quarto ramo opt-in na busca vetorial"
```

---

### Task 4: Repasse no hybrid-search

**Files:**
- Modify: `lib/embeddings/hybrid-search.ts` (`HybridSearchOptions` e os objetos passados a `semanticSearch`/`multiQuerySearch`)
- Test: `lib/embeddings/__tests__/hybrid-search.test.ts` (acrescentar ao arquivo existente)

**Interfaces:**
- Consumes: `SearchOptions.includeTeses` e `.tesesVisibilidade` da Task 3.
- Produces: as mesmas duas opções em `HybridSearchOptions`, repassadas sem alteração.

- [ ] **Step 1: Escrever o teste do repasse**

Acrescentar ao final de `lib/embeddings/__tests__/hybrid-search.test.ts`:

```typescript
describe('hybridSearch — repasse das opções de teses', () => {
  it('encaminha includeTeses e tesesVisibilidade ao vector search', async () => {
    const spy = vi.mocked(semanticSearch);
    spy.mockResolvedValue({ results: [], query: 'q', totalFound: 0, latency: 1, cached: false });

    await hybridSearch({ query: 'q', includeTeses: true, tesesVisibilidade: 'acervo', skipFts: true });

    expect(spy).toHaveBeenCalledWith(
      'q',
      expect.objectContaining({ includeTeses: true, tesesVisibilidade: 'acervo' }),
    );
  });

  it('não liga o ramo quando o chamador não pede', async () => {
    const spy = vi.mocked(semanticSearch);
    spy.mockResolvedValue({ results: [], query: 'q', totalFound: 0, latency: 1, cached: false });

    await hybridSearch({ query: 'q', skipFts: true });

    expect(spy).toHaveBeenCalledWith('q', expect.not.objectContaining({ includeTeses: true }));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/embeddings/__tests__/hybrid-search.test.ts`
Expected: FAIL no primeiro teste — as opções não chegam ao `semanticSearch`.

- [ ] **Step 3: Implementar o repasse**

Em `HybridSearchOptions`, junto de `includeTribunalDecisions`:

```typescript
  /** Inclui o ramo TeseEnunciadoChunk no vector search. Default false. */
  includeTeses?: boolean;
  /** Recorte visível das teses. Encaminhado para vector-search.SearchOptions. */
  tesesVisibilidade?: 'vitrine' | 'acervo';
```

E, em cada objeto de opções montado para `semanticSearch` e `multiQuerySearch`:

```typescript
      includeTeses: options.includeTeses,
      tesesVisibilidade: options.tesesVisibilidade,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/embeddings/__tests__/hybrid-search.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificação e commit**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
git add lib/embeddings/hybrid-search.ts lib/embeddings/__tests__/hybrid-search.test.ts
git commit -m "feat(teses): repasse das opções de teses no hybrid-search"
```

---

### Task 5: A tese na busca `/busca`

**Files:**
- Create: `app/api/busca-integrada/visibilidade-teses.ts`
- Create: `components/busca/CartaoTeseBusca.tsx`
- Modify: `lib/types/global-search.ts` (`ContentType`, `CONTENT_TYPE_CONFIG`, `TeseResult`)
- Modify: `app/api/busca-integrada/route.ts` (`teses` em `results`)
- Modify: `app/busca/page.tsx` (`TabType` na linha 101, contadores, seção)
- Test: `app/api/busca-integrada/__tests__/teses-visibilidade.test.ts`
- Test: `components/busca/__tests__/CartaoTeseBusca.test.tsx`

**Interfaces:**
- Consumes: `hybridSearch` com `includeTeses`/`tesesVisibilidade` (Task 4); `chaveUrl` de `lib/teses/consultas.ts`.
- Produces: `visibilidadeDasTeses(temAcessoAtivo: boolean): 'vitrine' | 'acervo'`; `interface TeseResult { enunciadoId: string; enunciado: string; assunto: string; acordao: string; colegiado: string | null; citacoesNoVoto: number; trecho: string; href: string }`

- [ ] **Step 1: Escrever o teste da visibilidade**

Criar `app/api/busca-integrada/__tests__/teses-visibilidade.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { visibilidadeDasTeses } from '../visibilidade-teses';

describe('visibilidadeDasTeses', () => {
  // A regra é a mesma nas duas superfícies e depende do usuário, não da rota
  // (spec §9): quem tem acesso ativo vê o acervo onde estiver.
  it('dá acervo a quem tem acesso ativo', () => {
    expect(visibilidadeDasTeses(true)).toBe('acervo');
  });

  it('dá vitrine a visitante e a autenticado sem acesso', () => {
    expect(visibilidadeDasTeses(false)).toBe('vitrine');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run app/api/busca-integrada/__tests__/teses-visibilidade.test.ts`
Expected: FAIL — módulo `../visibilidade-teses` não existe.

- [ ] **Step 3: Implementar o helper**

Criar `app/api/busca-integrada/visibilidade-teses.ts`:

```typescript
/**
 * Recorte de teses visível a um usuário (spec §9).
 *
 * Módulo próprio, e não expressão inline na rota, porque a mesma regra vale
 * para `/api/documents/query` — e regra duplicada é regra que diverge.
 */
export function visibilidadeDasTeses(temAcessoAtivo: boolean): 'vitrine' | 'acervo' {
  return temAcessoAtivo ? 'acervo' : 'vitrine';
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run app/api/busca-integrada/__tests__/teses-visibilidade.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Escrever o teste do cartão**

Criar `components/busca/__tests__/CartaoTeseBusca.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CartaoTeseBusca } from '../CartaoTeseBusca';

const tese = {
  enunciadoId: 'e1',
  enunciado: 'A exigência de atestado deve guardar pertinência com o objeto.',
  assunto: 'Qualificação técnica',
  acordao: 'Acórdão 1441/2016',
  colegiado: 'Plenário',
  citacoesNoVoto: 39,
  trecho: 'O relator consignou que a exigência...',
  href: '/teses/1441-2016-plenario',
};

describe('CartaoTeseBusca', () => {
  it('mostra o enunciado, o precedente e o trecho que o sustenta', () => {
    render(<CartaoTeseBusca tese={tese} />);
    expect(screen.getByText(/pertinência com o objeto/)).toBeInTheDocument();
    expect(screen.getByText(/Acórdão 1441\/2016/)).toBeInTheDocument();
    expect(screen.getByText(/O relator consignou/)).toBeInTheDocument();
  });

  // §4.3: nunca afirmar colegiado que não se sabe.
  it('omite o colegiado quando não se sabe qual é', () => {
    render(<CartaoTeseBusca tese={{ ...tese, colegiado: null }} />);
    expect(screen.queryByText(/Plenário/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run components/busca/__tests__/CartaoTeseBusca.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 7: Implementar o cartão**

Criar `components/busca/CartaoTeseBusca.tsx`, no padrão visual de `components/teses/CartaoTese.tsx` (Onda 3), mantendo a mesma invariante — enunciado, precedente e trecho, sempre juntos:

```tsx
import Link from 'next/link';
import type { TeseResult } from '@/lib/types/global-search';

export function CartaoTeseBusca({ tese }: { tese: TeseResult }) {
  return (
    <Link
      href={tese.href}
      className="block rounded-lg border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/40"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{tese.assunto}</p>
      <p className="mt-2 text-slate-900">{tese.enunciado}</p>
      <p className="mt-3 text-sm text-slate-600">
        {tese.acordao}
        {tese.colegiado ? ` — ${tese.colegiado}` : ''} · {tese.citacoesNoVoto} citações no voto
      </p>
      <blockquote className="mt-3 border-l-2 border-slate-300 pl-3 text-sm italic text-slate-700">
        {tese.trecho}
      </blockquote>
    </Link>
  );
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run components/busca/__tests__/CartaoTeseBusca.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 9: Ligar tipos, rota e aba**

Em `lib/types/global-search.ts`: acrescentar `'tese'` a `ContentType` (linha 4), a entrada correspondente em `CONTENT_TYPE_CONFIG` (label `'Tese'`, labelPlural `'Teses do TCU'`) e a interface `TeseResult` descrita acima.

Em `app/api/busca-integrada/route.ts`: chamar `hybridSearch` com `includeTeses: true` e `tesesVisibilidade: visibilidadeDasTeses(hasAiAccess)` — `hasAiAccess` já é resolvido na linha ~45 — e acrescentar `teses` ao objeto `results` (linha ~119), montando cada item no formato de `TeseResult`, com `href` vindo de `chaveUrl`.

Em `app/busca/page.tsx`: acrescentar `'teses'` a `TabType` (linha 101), o contador na aba e no total, e a seção que renderiza `CartaoTeseBusca`.

O `href` é `/teses/${chaveUrl(destilacao)}#${enunciadoId}` — a âncora do enunciado, exigida pela §9, leva o leitor à tese específica dentro da página do acórdão, que pode ter mais de uma.

- [ ] **Step 10: Verificação e commit**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
git add lib/types/global-search.ts app/api/busca-integrada/route.ts app/api/busca-integrada/visibilidade-teses.ts app/api/busca-integrada/__tests__/teses-visibilidade.test.ts components/busca/CartaoTeseBusca.tsx components/busca/__tests__/CartaoTeseBusca.test.tsx app/busca/page.tsx
git commit -m "feat(teses): as teses na busca integrada"
```

---

### Task 6: A evidência viaja com a tese

O risco principal da §9: a tese é curta, abstrata e escrita em linguagem de súmula, portanto formalmente muito parecida com uma pergunta de usuário. Tende a pontuar alto e expulsar os acórdãos do contexto, fazendo a IA responder pela síntese sem a fonte — o oposto da decisão de procedência.

**A companhia obrigatória da tese é a sua evidência, não o acórdão-líder.** O líder não existe como `Document` em 39 das 93 teses, e a tese não foi extraída dele — foi extraída das manifestações posteriores que o citaram. Quem sustenta a afirmação é o acórdão **citante**, que é o que `TeseTrechoFonte` guarda.

**Files:**
- Create: `lib/rag/evidencia-da-tese.ts`
- Modify: `lib/rag/answerContext.ts` (após o bloco de recuperação complementar, ~linha 170)
- Test: `lib/rag/__tests__/evidencia-da-tese.test.ts`

**Interfaces:**
- Consumes: `SearchResult` com `sourceType: 'tese'` (Task 3).
- Produces: `anexarEvidenciaDasTeses(resultados: SearchResult[]): Promise<{ trechos: TrechoDeTese[]; documentIdsCitantes: string[] }>`

- [ ] **Step 1: Escrever o teste**

Criar `lib/rag/__tests__/evidencia-da-tese.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTrechos } = vi.hoisted(() => ({ mockTrechos: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { teseTrechoFonte: { findMany: mockTrechos } } }));

import { anexarEvidenciaDasTeses } from '../evidencia-da-tese';

beforeEach(() => vi.clearAllMocks());

describe('anexarEvidenciaDasTeses', () => {
  it('traz ao menos um trecho por tese recuperada', async () => {
    mockTrechos.mockResolvedValue([
      { enunciadoId: 'e1', ordem: 0, trecho: 'trecho', origemDocumentId: 'd1', origemUrl: null, origemLinkPDF: null },
    ]);
    const r = await anexarEvidenciaDasTeses([{ documentId: 'e1', sourceType: 'tese' } as never]);
    expect(r.trechos).toHaveLength(1);
    expect(r.documentIdsCitantes).toEqual(['d1']);
  });

  it('não consulta nada quando nenhuma tese foi recuperada', async () => {
    const r = await anexarEvidenciaDasTeses([{ documentId: 'd9', sourceType: 'document' } as never]);
    expect(mockTrechos).not.toHaveBeenCalled();
    expect(r.trechos).toHaveLength(0);
  });

  // A ausência do Document do citante NÃO bloqueia a tese — preservar as 93 é
  // requisito explícito da §9.
  it('mantém a tese quando o citante não existe como Document', async () => {
    mockTrechos.mockResolvedValue([
      { enunciadoId: 'e1', ordem: 0, trecho: 'trecho', origemDocumentId: null, origemUrl: 'https://tcu', origemLinkPDF: null },
    ]);
    const r = await anexarEvidenciaDasTeses([{ documentId: 'e1', sourceType: 'tese' } as never]);
    expect(r.trechos).toHaveLength(1);
    expect(r.documentIdsCitantes).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/rag/__tests__/evidencia-da-tese.test.ts`
Expected: FAIL — módulo `../evidencia-da-tese` não existe.

- [ ] **Step 3: Implementar**

Criar `lib/rag/evidencia-da-tese.ts`:

```typescript
/**
 * A evidência acompanha a tese no contexto da IA (spec §9).
 *
 * Regra de recuperação complementar, no mecanismo de answerContext.ts:
 *   1. tese recuperada → ao menos um TeseTrechoFonte entra no contexto, sempre;
 *   2. com origemDocumentId resolvido, o Document do CITANTE entra junto;
 *   3. a ausência desse Document não bloqueia a tese.
 */
import { prisma } from '@/lib/prisma';
import type { SearchResult } from '@/lib/embeddings/vector-search';

export interface TrechoDeTese {
  enunciadoId: string;
  ordem: number;
  trecho: string;
  origemDocumentId: string | null;
  origemUrl: string | null;
  origemLinkPDF: string | null;
}

export async function anexarEvidenciaDasTeses(
  resultados: SearchResult[],
): Promise<{ trechos: TrechoDeTese[]; documentIdsCitantes: string[] }> {
  const idsDeTeses = resultados
    .filter((r) => r.sourceType === 'tese')
    .map((r) => r.documentId);

  if (idsDeTeses.length === 0) return { trechos: [], documentIdsCitantes: [] };

  const trechos = await prisma.teseTrechoFonte.findMany({
    where: { enunciadoId: { in: idsDeTeses } },
    orderBy: [{ enunciadoId: 'asc' }, { ordem: 'asc' }],
    distinct: ['enunciadoId'],
    select: {
      enunciadoId: true,
      ordem: true,
      trecho: true,
      origemDocumentId: true,
      origemUrl: true,
      origemLinkPDF: true,
    },
  });

  const documentIdsCitantes = [
    ...new Set(trechos.map((t) => t.origemDocumentId).filter((id): id is string => !!id)),
  ];

  return { trechos, documentIdsCitantes };
}
```

Em `lib/rag/answerContext.ts`, após o bloco de recuperação complementar existente, chamar `anexarEvidenciaDasTeses(searchResponse.results)` e somar `documentIdsCitantes` ao conjunto que vira contexto, e `trechos` ao material citável.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/rag/__tests__/evidencia-da-tese.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Verificação e commit**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
git add lib/rag/evidencia-da-tese.ts lib/rag/__tests__/evidencia-da-tese.test.ts lib/rag/answerContext.ts
git commit -m "feat(teses): a evidência acompanha a tese no contexto da IA"
```

---

### Task 7: Medir o deslocamento antes de ligar no assistente

A §9 fecha com a frase que governa esta tarefa: **a eficácia é medida, não presumida.** O assistente (`/api/documents/query`) só recebe `includeTeses` depois desta medição.

**Files:**
- Create: `eval/teses/pareado.ts`
- Create: `eval/teses/README.md`
- Modify: `package.json` (script `eval:teses`)
- Modify: `docs/superpowers/specs/2026-09-04-publicacao-teses-tcu-design.md` (registrar o resultado na §9)

**Interfaces:**
- Consumes: `hybridSearch` com e sem `includeTeses` (Task 4).
- Produces: relatório em `eval/reports/teses-<data>.json` com, por query: posição dos acórdãos antes e depois, e quantos saíram do top-5.

- [ ] **Step 1: Escrever o conjunto pareado**

Criar `eval/teses/pareado.ts`:

```typescript
import { readFileSync, writeFileSync } from 'fs';
import { hybridSearch } from '@/lib/embeddings/hybrid-search';

interface Medida {
  query: string;
  deslocados: string[];
  posicaoMediaAntes: number;
  posicaoMediaDepois: number;
  tesesNoTopo: number;
}

const TOP = 5;
const media = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);

async function main() {
  const golden = JSON.parse(readFileSync('eval/golden-set.json', 'utf8')) as Array<{ query: string }>;
  const medidas: Medida[] = [];

  for (const { query } of golden) {
    // Tudo idêntico entre as duas execuções, exceto o ramo das teses — é o que
    // torna a comparação pareada, e não duas medições soltas.
    const base = { query, limit: 20, useCache: false as const };
    const sem = await hybridSearch({ ...base });
    const com = await hybridSearch({ ...base, includeTeses: true, tesesVisibilidade: 'acervo' });

    const topSem = sem.results.slice(0, TOP).map((r) => r.documentId);
    const topCom = com.results.slice(0, TOP).map((r) => r.documentId);

    medidas.push({
      query,
      deslocados: topSem.filter((id) => !topCom.includes(id)),
      posicaoMediaAntes: media(
        sem.results.map((r, i) => (r.sourceType !== 'tese' ? i + 1 : 0)).filter(Boolean),
      ),
      posicaoMediaDepois: media(
        com.results.map((r, i) => (r.sourceType !== 'tese' ? i + 1 : 0)).filter(Boolean),
      ),
      tesesNoTopo: com.results.slice(0, 3).filter((r) => r.sourceType === 'tese').length,
    });
  }

  const pior = Math.max(...medidas.map((m) => m.deslocados.length));
  const arquivo = `eval/reports/teses-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(arquivo, JSON.stringify({ medidas, pior }, null, 2));
  console.log(`Relatório em ${arquivo}. Pior deslocamento numa única query: ${pior}`);
}

main();
```

`useCache: false` é obrigatório aqui: com cache ligado, a segunda execução poderia devolver o resultado da primeira e a medição mediria nada.

Acrescentar a `package.json`:

```json
    "eval:teses": "dotenv -e .env.local -- tsx eval/teses/pareado.ts",
```

- [ ] **Step 2: Rodar a medição**

Run: `npm run eval:teses`
Custo: só embeddings e FTS, sem LLM — R$ 0, como o `eval:run`.

- [ ] **Step 3: Decidir com o número na mão**

Critério de aceitação, a confirmar com o usuário antes de ligar no assistente: **nenhuma query pode perder mais de um acórdão do top-5** para a entrada das teses. Se perder, o caminho não é desligar a feature — é reduzir o `limit` do ramo D (hoje `limit * 2`, Task 3) ou aplicar fator de desconto na `similarity` do ramo, como o `hierarchy_level` já faz para atos normativos.

- [ ] **Step 4: Registrar o resultado e commitar**

Acrescentar à §9 do spec um parágrafo com a data, o número medido e a decisão tomada.

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
git add eval/teses package.json docs/superpowers/specs/2026-09-04-publicacao-teses-tcu-design.md
git commit -m "eval(teses): mede o deslocamento dos acórdãos antes de ligar no assistente"
```

---

## Fora do escopo, por desenho

- **Ligar as teses no assistente** (`/api/documents/query`). A §9 exige a medição da Task 7 antes, e a decisão é do usuário. O helper `visibilidadeDasTeses` (Task 5) já existe para quando ela for tomada.
- **A promoção à vitrine.** Enquanto ela não acontece, `tesesVisibilidade: 'vitrine'` devolve zero resultados — comportamento correto, não defeito: em 08/09/2026 há 88 teses no acervo e nenhuma na vitrine.
- **A coluna `embedding1536`.** As outras tabelas de chunk a têm por causa do A/B da Fase 4.1, que não está em curso. A tabela nova nasce só com `vector(768)`; acrescentá-la depois é migração de uma linha.
- **Reindexação em massa.** A reconciliação processa 50 por rodada do cron; 88 teses levam duas rodadas.
