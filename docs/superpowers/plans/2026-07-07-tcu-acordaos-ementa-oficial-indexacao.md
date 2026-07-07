# Indexação de acórdãos TCU pela ementa oficial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o indexador de embeddings usar a ementa oficial do TCU (`tcuEmentaCompleta`) como texto-fonte quando o `content` está vazio, resolvendo os 171 acórdãos metadata-only e tornando os acórdãos futuros do clipping indexáveis sem intervenção.

**Architecture:** Extrai a seleção de texto-fonte para um helper puro `selectSourceText` (`lib/embeddings/source-text.ts`), com a cadeia de prioridade `content → tcuEmentaCompleta → description`. O `document-processor` passa a usar o helper e a selecionar/filtrar por `tcuEmentaCompleta`. Um script dedicado indexa os 171 acórdãos pendentes. Valida-se com o eval framework existente.

**Tech Stack:** TypeScript, Prisma 7 (PrismaNeon), pgvector, Gemini embeddings (`gemini-embedding-001`, 768d), Vitest, eval CLI (`npm run eval:run`).

## Global Constraints

- Site em **produção** — mudanças em `document-processor.ts` (código core) devem preservar comportamento de docs com `content` real.
- Embeddings: `gemini-embedding-001`, **768 dimensões**, batch — não alterar dimensão.
- **Fonte oficial substitui o resumo-IA** como texto de indexação; não concatenar `description` (resumo Gemini) com a ementa.
- **Não** rodar `--force` global (corpus = 6.372 docs `completed`); indexar apenas o conjunto alvo.
- Baseline atual a preservar: **recall@5 63,8% · MRR 0,839 · nDCG@10 0,654** (`eval/reports/2026-07-07T18-29-54_baseline.*`).
- Fora de escopo (YAGNI): PDF/inteiro teor, paginação da API de dados abertos do TCU, alterar o cron de clipping.
- Testes rodam com **Vitest** (`npm run test:run`).
- Commits frequentes; terminar mensagens de commit com `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Helper `selectSourceText` + wiring no indexador

**Files:**
- Create: `lib/embeddings/source-text.ts`
- Create (test): `lib/embeddings/__tests__/source-text.test.ts`
- Modify: `lib/embeddings/document-processor.ts` (select ~L58-69; fallback ~L156; OR queries ~L308-313 e ~L527-532)

**Interfaces:**
- Produces: `selectSourceText(doc: SourceTextFields): string` — retorna o primeiro entre `content`, `tcuEmentaCompleta`, `description` cujo `.trim()` tenha comprimento > 0; senão `''`. `SourceTextFields = { content?: string | null; tcuEmentaCompleta?: string | null; description?: string | null }`.
- Consumes (em `processDocument`): `document.tcuEmentaCompleta` (novo no `select`).

- [ ] **Step 1: Escrever o teste que falha** (`lib/embeddings/__tests__/source-text.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { selectSourceText } from '../source-text';

describe('selectSourceText', () => {
  it('usa content quando presente (prioridade máxima)', () => {
    const doc = { content: 'Texto integral', tcuEmentaCompleta: 'EMENTA', description: 'resumo IA' };
    expect(selectSourceText(doc)).toBe('Texto integral');
  });

  it('usa a ementa oficial quando content vazio (acórdão TCU)', () => {
    const doc = { content: null, tcuEmentaCompleta: 'REPRESENTAÇÃO. LICITAÇÃO. EMENTA OFICIAL.', description: 'resumo gerado por IA' };
    expect(selectSourceText(doc)).toBe('REPRESENTAÇÃO. LICITAÇÃO. EMENTA OFICIAL.');
  });

  it('cai para description quando não há content nem ementa oficial', () => {
    const doc = { content: null, tcuEmentaCompleta: null, description: 'resumo IA' };
    expect(selectSourceText(doc)).toBe('resumo IA');
  });

  it('ignora candidatos só com espaços em branco', () => {
    const doc = { content: '   ', tcuEmentaCompleta: '', description: 'conteúdo real' };
    expect(selectSourceText(doc)).toBe('conteúdo real');
  });

  it('retorna string vazia quando nenhum campo tem conteúdo', () => {
    expect(selectSourceText({ content: null, tcuEmentaCompleta: null, description: null })).toBe('');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test:run -- source-text`
Expected: FAIL — `Cannot find module '../source-text'` (arquivo ainda não existe).

- [ ] **Step 3: Implementar o helper** (`lib/embeddings/source-text.ts`)

```ts
/**
 * Campos de um documento que podem servir de texto-fonte para indexação.
 */
export interface SourceTextFields {
  content?: string | null;
  tcuEmentaCompleta?: string | null;
  description?: string | null;
}

/**
 * Seleciona o texto-fonte de um documento sem arquivo R2, por ordem de prioridade:
 *   1. content            — texto integral real, quando existe
 *   2. tcuEmentaCompleta  — ementa OFICIAL do TCU (acórdãos captados pelo clipping)
 *   3. description        — resumo executivo gerado por IA (fallback)
 *
 * Preferir a ementa oficial ao resumo-IA cumpre a regra de "fonte com ementa"
 * (não indexar jurisprudência por texto derivado). Retorna '' se nenhum candidato
 * tiver conteúdo útil (após trim).
 */
export function selectSourceText(doc: SourceTextFields): string {
  const candidates = [doc.content, doc.tcuEmentaCompleta, doc.description];
  for (const c of candidates) {
    if (c && c.trim().length > 0) return c;
  }
  return '';
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test:run -- source-text`
Expected: PASS (5 testes verdes).

- [ ] **Step 5: Adicionar `tcuEmentaCompleta` ao `select` de `processDocument`** (`lib/embeddings/document-processor.ts`, dentro do `select` em ~L58-69)

Adicionar a linha após `description: true,`:

```ts
        content: true,
        description: true,
        tcuEmentaCompleta: true,
        leiArticlesArr: true,
```

- [ ] **Step 6: Trocar a seleção de texto pelo helper** (`document-processor.ts` ~L156)

Adicionar o import no topo do arquivo (junto aos demais imports de `./`):

```ts
import { selectSourceText } from './source-text';
```

Substituir a linha 156:

```ts
// antes
const fallbackText = document.content || document.description || '';
// depois
const fallbackText = selectSourceText(document);
```

- [ ] **Step 7: Future-proof — incluir `tcuEmentaCompleta` nas queries OR de elegibilidade**

Em `processPendingDocuments` (~L308-313), adicionar ao array `OR`:

```ts
      OR: [
        { r2Key: { not: null } },
        { content: { not: null } },
        { tcuEmentaCompleta: { not: null } },
        { description: { not: null } },
        { extractedText: { not: null } },
      ],
```

Em `getProcessingStats` (~L527-532), aplicar a mesma adição ao array `OR` do `groupBy`:

```ts
        OR: [
          { r2Key: { not: null } },
          { content: { not: null } },
          { tcuEmentaCompleta: { not: null } },
          { description: { not: null } },
          { extractedText: { not: null } },
        ],
```

- [ ] **Step 8: Verificar tipos e a suíte completa**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run test:run -- source-text`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/embeddings/source-text.ts lib/embeddings/__tests__/source-text.test.ts lib/embeddings/document-processor.ts
git commit -m "feat(embeddings): usar ementa oficial do TCU (tcuEmentaCompleta) como texto-fonte

Extrai selectSourceText (content -> tcuEmentaCompleta -> description) e passa
o indexador a preferir a ementa oficial ao resumo-IA quando content vazio.
Inclui tcuEmentaCompleta nas queries de elegibilidade (pending/stats).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Script de indexação dos 171 acórdãos pendentes

**Files:**
- Create: `scripts/index-tcu-acordaos-ementa.ts`

**Interfaces:**
- Consumes: `processDocuments(ids: string[], options?, concurrency?)` de `lib/embeddings/document-processor` (Task 1 já garante que usará a ementa oficial).

**Contexto:** o conjunto alvo é `category='acordao'` + `embeddingStatus='pending'` + `content` vazio (null ou whitespace) + **0 chunks**. Verificado em 2026-07-07: 171 documentos, todos com `tcuEmentaCompleta` preenchido. O script filtra em JS (para pegar `content` null **e** whitespace) e é **idempotente/re-executável** (cada `processDocument` reivindica o slot atomicamente; re-rodar processa só os que restarem `pending`). Suporta `--dry-run`.

- [ ] **Step 1: Criar o script** (`scripts/index-tcu-acordaos-ementa.ts`)

```ts
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { processDocuments } from '../lib/embeddings/document-processor';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const candidates = await prisma.document.findMany({
    where: { category: 'acordao', embeddingStatus: 'pending' },
    select: {
      id: true, title: true, content: true, tcuEmentaCompleta: true,
      _count: { select: { chunks: true } },
    },
  });

  // content vazio (null ou whitespace) E sem chunks E com ementa oficial disponível
  const target = candidates.filter(
    (d) => !(d.content && d.content.trim().length > 0) &&
           d._count.chunks === 0 &&
           !!(d.tcuEmentaCompleta && d.tcuEmentaCompleta.trim().length >= 50)
  );

  console.log(`Acórdãos pending: ${candidates.length}`);
  console.log(`Alvo (content vazio, 0 chunks, ementa oficial >=50 chars): ${target.length}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Nenhuma alteração. Amostra:');
    target.slice(0, 5).forEach((d) => console.log(`  - ${d.title}`));
    return;
  }

  const results = await processDocuments(target.map((d) => d.id), {}, 5);
  const ok = results.filter((r) => r.success).length;
  const fail = results.length - ok;
  console.log(`\nProcessados: ${results.length} | sucesso: ${ok} | falha: ${fail}`);
  if (fail > 0) {
    results.filter((r) => !r.success).slice(0, 10).forEach((r) => console.log(`  FALHA ${r.documentId}: ${r.error}`));
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Dry-run — confirmar que seleciona ~171**

Run: `npx tsx scripts/index-tcu-acordaos-ementa.ts --dry-run`
Expected: imprime `Alvo (...): 171` (ou o número atual de acórdãos pending metadata-only) e amostra de títulos. **Nenhuma** escrita no banco.

- [ ] **Step 3: Executar a indexação**

Run: `npx tsx scripts/index-tcu-acordaos-ementa.ts`
Expected: `Processados: 171 | sucesso: 171 | falha: 0` (ver nota de resiliência abaixo).

> **Resiliência (rede/Neon):** se houver falhas transitórias de WebSocket, **re-rodar o mesmo comando** — só os que restarem `pending` serão reprocessados. Repetir até `sucesso == alvo` e `falha == 0`.

- [ ] **Step 4: Verificar no banco que os acórdãos ficaram `completed` com chunks**

Run:
```bash
npx tsx -e "import {PrismaClient} from '@prisma/client'; import {PrismaNeon} from '@prisma/adapter-neon'; import * as d from 'dotenv'; d.config({path:'.env.local'}); const p=new PrismaClient({adapter:new PrismaNeon({connectionString:process.env.DATABASE_URL})}); (async()=>{const pend=await p.document.count({where:{category:'acordao',embeddingStatus:'pending'}}); const comp=await p.document.count({where:{category:'acordao',embeddingStatus:'completed'}}); console.log('acordao pending:',pend,'| completed:',comp); await p.\$disconnect();})();"
```
Expected: `acordao pending: 0` (ou apenas eventuais sem ementa) e `completed` aumentado em ~171.

- [ ] **Step 5: Commit do script**

```bash
git add scripts/index-tcu-acordaos-ementa.ts
git commit -m "chore(embeddings): script para indexar acórdãos TCU pela ementa oficial

Indexa acórdãos pending metadata-only usando tcuEmentaCompleta (via Task 1).
Idempotente e re-executável; suporta --dry-run.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Validação por eval + registro do baseline

**Files:**
- Create (gerado): `eval/reports/<timestamp>_acordaos-ementa.md` e `.json`

**Contexto:** confirmar que adicionar 171 acórdãos ao corpus **não** regride o recall@5 por flooding (como ocorreu no bug do boost de hierarquia) e medir eventual ganho. Baseline de referência: recall@5 63,8% / MRR 0,839 / nDCG@10 0,654.

- [ ] **Step 1: Rodar o eval com label dedicado**

Run: `npm run eval:run -- --label acordaos-ementa`
Expected: linha `[eval] recall@5=XX.X% mrr=0.XXX ndcg@10=0.XXX` e `Report written to eval/reports/<timestamp>_acordaos-ementa.md`.

- [ ] **Step 2: Comparar com o baseline anterior**

Abrir/ler `eval/reports/<timestamp>_acordaos-ementa.md` e comparar com `eval/reports/2026-07-07T18-29-54_baseline.md`.

Critério de aceitação:
- **recall@5 ≥ ~62%** (não regredir materialmente vs. 63,8%; pequena variação por ruído é aceitável).
- Se **recall@5 cair > ~2pp**, investigar flooding (systematic-debugging): checar se acórdãos genéricos passaram a inundar o top-5 de queries existentes (recall@5 vs recall@20). **Não** prosseguir com o commit de baseline até entender a causa.

- [ ] **Step 3: Commit do relatório de baseline**

```bash
git add eval/reports/
git commit -m "chore(eval): baseline após indexar acórdãos TCU pela ementa oficial

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Push (auto-deploy)**

```bash
git push origin main
```
Expected: push aceito; Vercel dispara build/deploy (~4min). A mudança no indexador vale para acórdãos futuros do clipping automaticamente.

- [ ] **Step 5: Atualizar memória**

Atualizar `C:\Users\User\.claude\projects\C--Users-User\memory\fase4-embedding-dim-e-regressao-retrieval.md`: marcar a pendência #1 (backfill dos 174) como **resolvida para os 171 acórdãos via ementa oficial** (`selectSourceText`), registrar o novo baseline e que os 3 restantes (orientações normativas gov.br, sem ementa oficial) seguem fora por decisão. Ajustar a linha correspondente em `MEMORY.md`.

---

## Notas de verificação (self-review)

- **Cobertura da spec:** Task 1 = mudança sistêmica no indexador (design §1) + testes TDD (§4); Task 2 = indexar os 171 (§2); Task 3 = validação eval (§3) + critérios de aceitação. Fora de escopo (PDF/API) não vira task. ✔
- **Ordem de dependência:** Task 1 deve estar aplicada **antes** de Task 2 (senão a indexação usaria a description-IA / falharia). Task 3 depois de Task 2.
- **Consistência de tipos:** `selectSourceText`/`SourceTextFields` usados igual em helper, teste e `processDocument`. ✔
- **Os 3 não-acórdãos** (orientações normativas gov.br) não têm `tcuEmentaCompleta` → permanecem fora, corretamente (sem fonte oficial com ementa).
