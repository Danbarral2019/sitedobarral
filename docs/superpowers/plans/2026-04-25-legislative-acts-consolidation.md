# Consolidação de Atos Normativos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manter atos normativos sincronizados com consolidações dos portais oficiais E construir grafo navegável de relações (revoga/altera/regulamenta/complementa/modifica) entre atos, com detecção automática heurística + IA opcional.

**Architecture:** 5 camadas independentes que entregam valor incremental: (1) garantir cron de re-scrape semanal já existente; (2) novo schema `LegislativeActRelation` com source/target/type/confidence; (3) detector heurístico baseado em regex sobre ementa+content rodando pós-import e pós-scrape; (4) UI mostrando "este ato altera X" e "este ato foi alterado por Y"; (5) detector via IA (Gemini) opcional pra casos sutis.

**Tech Stack:** Next.js 15 App Router · Prisma + `@prisma/adapter-neon` · vitest · Tailwind · Gemini SDK (opcional) · reusa `scrapeAndIndexAct` de `lib/legislative-scrapers/scrape-and-index.ts` e `processLegislativeAct` de `lib/embeddings/legislative-act-processor.ts`.

**Estimativa:** 14 tasks bite-sized · MVP em camadas 0-3 (5 dias) · completo com 4-5 (10 dias).

---

## File Structure (decomposição)

### Novos arquivos
- `lib/legislative-acts/amendment-detector.ts` — detector heurístico regex
- `lib/legislative-acts/__tests__/amendment-detector.test.ts`
- `lib/legislative-acts/relations.ts` — CRUD de relações + integração com detector
- `lib/legislative-acts/__tests__/relations.test.ts`
- `components/acervo/RelationHistory.tsx` — UI do histórico de alterações
- `components/acervo/__tests__/RelationHistory.test.tsx`
- `lib/legislative-acts/amendment-detector-ai.ts` — detector via Gemini (Camada 5)
- `lib/legislative-acts/__tests__/amendment-detector-ai.test.ts`
- `scripts/backfill-relations.ts` — popular relações pra atos já existentes

### Arquivos modificados
- `prisma/schema.prisma` — novo model `LegislativeActRelation` + relations no `LegislativeAct`
- `vercel.json` — confirma agendamento do cron `check-legislative-updates` se faltar
- `app/api/cron/check-legislative-updates/route.ts` — chama detector pós-scrape quando content muda
- `scripts/import-legislative-acts-batch.ts` — chama detector pós-create/update
- `app/(acervo)/legislacao/[id]/page.tsx` — embute `<RelationHistory>`

---

## Task 0: Pré-requisitos — confirmar cron de re-scrape (Camada 1)

**Files:**
- Modify: `vercel.json` (raiz do repo)

- [ ] **Step 1: Verificar se cron já está cadastrado**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
grep -A 1 "check-legislative-updates" vercel.json
```

Se retornar vazio: faltava agendar (cron existia em código mas não no schedule). Continuar com Step 2.
Se retornar entry: pular pra Task 1.

- [ ] **Step 2: Adicionar entry no vercel.json**

Editar `vercel.json` adicionando a entry no array `crons` (mantendo as existentes):

```json
{
  "path": "/api/cron/check-legislative-updates",
  "schedule": "0 3 * * 1"
}
```

Schedule: toda segunda-feira às 3h UTC. Cron já tem rate limit interno (10 atos/run, 2s delay).

- [ ] **Step 3: Validar JSON**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))" && echo OK
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "chore(cron): agendar check-legislative-updates semanal (segundas 3h UTC)"
```

---

## Task 1: Schema — model LegislativeActRelation + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar model + relations**

Adicionar ao final de `prisma/schema.prisma` (depois do model `LegislativeAct`):

```prisma
model LegislativeActRelation {
  id            String   @id @default(uuid())

  sourceActId   String   // ato que CAUSA a alteração (ex: Decreto 100 que altera Decreto 99)
  sourceAct     LegislativeAct @relation("RelationSource", fields: [sourceActId], references: [id], onDelete: Cascade)

  targetActId   String   // ato que É AFETADO (ex: Decreto 99)
  targetAct     LegislativeAct @relation("RelationTarget", fields: [targetActId], references: [id], onDelete: Cascade)

  // Tipo da relação
  // 'revoga'        — revoga total ou parcialmente (ex: "Revoga a Lei 8.666/93")
  // 'altera'        — altera/modifica/dá nova redação (ex: "Altera o art. 75...")
  // 'regulamenta'   — regulamenta dispositivo (ex: "Regulamenta o art. 8º da Lei 14.133")
  // 'complementa'   — complementa sem alterar (ex: anexos, planilhas)
  // 'modifica'      — modifica de forma genérica (fallback se outros não casam)
  relationType  String

  // Origem da detecção: 'heuristica' | 'ia' | 'manual'
  source        String

  // 0..1 — confiança da detecção (heurística sempre 0.7-0.9, IA varia, manual=1.0)
  confidence    Float

  // Trecho do texto (ementa ou content) que originou a detecção. Útil pra debug e pra UI mostrar "por quê"
  excerpt       String   @db.Text

  detectedAt    DateTime @default(now())
  confirmedBy   String?  // email do admin que confirmou (ou marcou como falso positivo)
  confirmedAt   DateTime?
  // 'pending' | 'confirmed' | 'rejected' — workflow simples de revisão admin
  reviewStatus  String   @default("pending")

  @@unique([sourceActId, targetActId, relationType])
  @@index([targetActId])
  @@index([sourceActId])
  @@index([reviewStatus])
}
```

- [ ] **Step 2: Adicionar relations no model LegislativeAct**

Achar `model LegislativeAct {` e dentro dele, antes do `}` de fechamento, adicionar:

```prisma
  // Relações com outros atos (alterações, revogações, etc.)
  relationsAsSource LegislativeActRelation[] @relation("RelationSource")
  relationsAsTarget LegislativeActRelation[] @relation("RelationTarget")
```

- [ ] **Step 3: Validar schema**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Gerar migration**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- npx prisma migrate dev --name add_legislative_act_relation
```

Expected: cria `prisma/migrations/<timestamp>_add_legislative_act_relation/migration.sql`. Confirma `Y` quando perguntar.

- [ ] **Step 5: Verificar tabela no DB**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- npx tsx -e "import {PrismaClient} from '@prisma/client'; import {PrismaNeon} from '@prisma/adapter-neon'; const p = new PrismaClient({adapter: new PrismaNeon({connectionString: process.env.DATABASE_URL})}); p.legislativeActRelation.count().then(c => console.log('OK count:', c)).finally(() => p.\$disconnect());"
```

Expected: `OK count: 0`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): adiciona LegislativeActRelation pra grafo de alterações"
```

---

## Task 2: Detector heurístico — escrever testes (TDD)

**Files:**
- Create: `lib/legislative-acts/__tests__/amendment-detector.test.ts`

- [ ] **Step 1: Criar pasta + escrever testes que falham**

```bash
mkdir -p "/c/Projeto de site do Barral/sitedobarral-stripe/lib/legislative-acts/__tests__"
```

Criar `lib/legislative-acts/__tests__/amendment-detector.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { detectAmendments } from '../amendment-detector';

describe('detectAmendments', () => {
  it('detecta REVOGA de Lei explícita', () => {
    const result = detectAmendments('Revoga a Lei nº 8.666, de 21 de junho de 1993.', '');
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'revoga',
      targetFullNumber: 'Lei 8.666/1993',
    }));
  });

  it('detecta REVOGA de Decreto', () => {
    const result = detectAmendments('Revoga o Decreto nº 7.892/2013.', '');
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'revoga',
      targetFullNumber: 'Decreto 7.892/2013',
    }));
  });

  it('detecta ALTERA com nova redação', () => {
    const result = detectAmendments(
      'Dá nova redação ao art. 75 da Lei nº 14.133, de 1º de abril de 2021.',
      ''
    );
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'altera',
      targetFullNumber: 'Lei 14.133/2021',
      excerpt: expect.stringContaining('art. 75'),
    }));
  });

  it('detecta REGULAMENTA artigo da Lei 14.133', () => {
    const result = detectAmendments(
      'Regulamenta o art. 8º da Lei nº 14.133, de 1º de abril de 2021.',
      ''
    );
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'regulamenta',
      targetFullNumber: 'Lei 14.133/2021',
    }));
  });

  it('detecta ACRESCE artigo (vira ALTERA)', () => {
    const result = detectAmendments(
      'Acresce o art. 12-A à Lei nº 12.456, de 4 de maio de 2011.',
      ''
    );
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'altera',
      targetFullNumber: 'Lei 12.456/2011',
    }));
  });

  it('detecta IN com formato SEGES/MGI', () => {
    const result = detectAmendments(
      'Altera a Instrução Normativa SEGES/MGI nº 5/2017.',
      ''
    );
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'altera',
      targetFullNumber: expect.stringMatching(/IN.*5\/2017/),
    }));
  });

  it('extrai múltiplas relações da mesma ementa', () => {
    const result = detectAmendments(
      'Altera a Lei nº 14.133/2021 e revoga o Decreto nº 7.892/2013.',
      ''
    );
    expect(result).toHaveLength(2);
    expect(result.find(r => r.relationType === 'altera')?.targetFullNumber).toBe('Lei 14.133/2021');
    expect(result.find(r => r.relationType === 'revoga')?.targetFullNumber).toBe('Decreto 7.892/2013');
  });

  it('deduplica relações idênticas (mesmo target+type)', () => {
    const result = detectAmendments(
      'Altera a Lei nº 14.133/2021. Esta IN também altera a Lei nº 14.133/2021 em outros pontos.',
      ''
    );
    const altera14133 = result.filter(r => r.relationType === 'altera' && r.targetFullNumber === 'Lei 14.133/2021');
    expect(altera14133).toHaveLength(1);
  });

  it('detecta no content quando ementa não tem', () => {
    const result = detectAmendments(
      'Dispõe sobre fiscalização de contratos.',
      'Considerando o disposto na Lei nº 14.133, de 1º de abril de 2021, especialmente o art. 117, esta IN regulamenta...'
    );
    expect(result).toContainEqual(expect.objectContaining({
      relationType: 'regulamenta',
      targetFullNumber: 'Lei 14.133/2021',
    }));
  });

  it('confidence é 0.7-0.9 pra heurística', () => {
    const result = detectAmendments('Revoga a Lei nº 8.666/93.', '');
    expect(result[0].confidence).toBeGreaterThanOrEqual(0.7);
    expect(result[0].confidence).toBeLessThanOrEqual(0.9);
  });

  it('retorna [] pra ementa sem indicadores', () => {
    const result = detectAmendments('Designa o servidor João Silva.', '');
    expect(result).toEqual([]);
  });

  it('normaliza ano de 2 dígitos pra 4 dígitos (93 → 1993)', () => {
    const result = detectAmendments('Revoga a Lei nº 8.666/93.', '');
    expect(result[0].targetFullNumber).toBe('Lei 8.666/1993');
  });

  it('inclui excerpt com contexto da menção', () => {
    const result = detectAmendments(
      'Esta portaria altera profundamente a Lei nº 14.133/2021 em vários dispositivos.',
      ''
    );
    expect(result[0].excerpt).toContain('Lei nº 14.133/2021');
    expect(result[0].excerpt.length).toBeLessThanOrEqual(200);
  });
});
```

- [ ] **Step 2: Rodar testes — devem falhar**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx vitest run lib/legislative-acts/__tests__/amendment-detector.test.ts 2>&1 | tail -10
```

Expected: 13 testes falhando com `Cannot find module '../amendment-detector'`.

---

## Task 3: Detector heurístico — implementação

**Files:**
- Create: `lib/legislative-acts/amendment-detector.ts`

- [ ] **Step 1: Implementar detector**

Criar `lib/legislative-acts/amendment-detector.ts`:

```typescript
/**
 * Detector heurístico de relações entre atos normativos.
 *
 * Lê ementa + content e identifica menções a outros atos com verbos como
 * "revoga", "altera", "dá nova redação", "regulamenta", "acresce", "complementa".
 *
 * Retorna lista de candidatos com targetFullNumber normalizado pro mesmo padrão
 * usado em LegislativeAct.fullNumber. NÃO grava no banco — quem grava é
 * `lib/legislative-acts/relations.ts` (que faz lookup por fullNumber e ignora
 * candidatos sem ato cadastrado).
 */

export type RelationType = 'revoga' | 'altera' | 'regulamenta' | 'complementa' | 'modifica';

export interface DetectedRelation {
  relationType: RelationType;
  targetFullNumber: string;   // ex: "Lei 14.133/2021", "Decreto 7.892/2013", "IN SEGES 5/2017"
  excerpt: string;            // até 200 chars, contexto da menção
  confidence: number;         // 0.7-0.9 pra heurística
}

// ── Mapeamento de verbo → relationType ─────────────────────────────────────

const VERB_PATTERNS: Array<{ regex: RegExp; type: RelationType; conf: number }> = [
  { regex: /\brevoga(?:m|do|da|dos|das)?\b/i, type: 'revoga', conf: 0.9 },
  { regex: /\bd[áa]\s+nova\s+reda[çc][ãa]o\b/i, type: 'altera', conf: 0.9 },
  { regex: /\bacresce(?:m)?\b/i, type: 'altera', conf: 0.85 },
  { regex: /\baltera(?:m|do|da|dos|das)?\b/i, type: 'altera', conf: 0.85 },
  { regex: /\bmodifica(?:m|do|da|dos|das)?\b/i, type: 'modifica', conf: 0.8 },
  { regex: /\bregulamenta(?:m|do|da|dos|das)?\b/i, type: 'regulamenta', conf: 0.85 },
  { regex: /\bcomplementa(?:m|do|da|dos|das)?\b/i, type: 'complementa', conf: 0.7 },
];

// Tipos de ato a detectar — mapeia label encontrado pro prefixo do fullNumber
const ACT_TYPE_LABELS: Array<{ regex: RegExp; prefix: string }> = [
  { regex: /\bLei\s+(?:Complementar\s+)?(?:n[ºo°.]?\s*)?/i, prefix: 'Lei' },
  { regex: /\bDecreto(?:-Lei)?\s+(?:n[ºo°.]?\s*)?/i, prefix: 'Decreto' },
  { regex: /\bMedida\s+Provis[óo]ria\s+(?:n[ºo°.]?\s*)?/i, prefix: 'MP' },
  // INs: detecta também "Instrução Normativa SEGES/MGI nº X/ANO"
  { regex: /\bInstru[çc][ãa]o\s+Normativa\s+(?:(SEGES(?:\/[A-Z]+)?)\s+)?(?:n[ºo°.]?\s*)?/i, prefix: 'IN' },
  { regex: /\bIN\s+(?:(SEGES(?:\/[A-Z]+)?)\s+)?(?:n[ºo°.]?\s*)?/i, prefix: 'IN' },
  { regex: /\bPortaria\s+(?:([A-Z]+(?:\/[A-Z]+)?)\s+)?(?:n[ºo°.]?\s*)?/i, prefix: 'Portaria' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeYear(yr: string): number {
  const n = parseInt(yr, 10);
  if (n < 100) return n + (n < 50 ? 2000 : 1900); // 93 → 1993, 21 → 2021
  return n;
}

/**
 * Constrói o fullNumber no padrão exato usado em LegislativeAct.
 * Ex: ("Lei", "8.666", "93", undefined) → "Lei 8.666/1993"
 *     ("IN", "5", "2017", "SEGES")     → "IN SEGES 5/2017"
 *     ("IN", "94", "2022", "SEGES/MGI") → "IN SGD/MGI nº 94/2022" (NÃO — preserva o issuer detectado)
 *
 * Pra IN, se issuer detectado, formato é "IN <ISSUER> <num>/<year>". Senão "IN <num>/<year>".
 */
function buildFullNumber(prefix: string, num: string, year: number, issuer?: string): string {
  if (prefix === 'IN' && issuer) return `IN ${issuer} ${num}/${year}`;
  if (prefix === 'Portaria' && issuer) return `Portaria ${issuer} ${num}/${year}`;
  return `${prefix} ${num}/${year}`;
}

function buildExcerpt(text: string, matchStart: number, matchEnd: number): string {
  const ctx = 80;
  const start = Math.max(0, matchStart - ctx);
  const end = Math.min(text.length, matchEnd + ctx);
  let s = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (s.length > 200) s = s.slice(0, 197) + '...';
  return s;
}

// ── Main ───────────────────────────────────────────────────────────────────

export function detectAmendments(ementa: string, content: string): DetectedRelation[] {
  const text = `${ementa}\n${content}`;
  const out: DetectedRelation[] = [];
  const seen = new Set<string>(); // dedup key: type|targetFullNumber

  for (const verb of VERB_PATTERNS) {
    let m: RegExpExecArray | null;
    const verbRegex = new RegExp(verb.regex.source, 'gi');
    while ((m = verbRegex.exec(text)) !== null) {
      const verbStart = m.index;
      const verbEnd = m.index + m[0].length;

      // Janela de 300 chars após o verbo pra encontrar o ato referenciado
      const window = text.slice(verbEnd, verbEnd + 300);

      for (const actType of ACT_TYPE_LABELS) {
        const actMatch = actType.regex.exec(window);
        if (!actMatch) continue;
        const issuer = actMatch[1] || undefined;

        // Após o label, buscar o número e o ano
        const afterLabel = window.slice(actMatch.index + actMatch[0].length);
        // Padrão: número (com pontos opcionais) seguido de , vírgula ou /
        // Ex: "8.666, de 21 de junho de 1993" ou "14.133/2021" ou "5/2017"
        const numYearMatch = afterLabel.match(
          /^([\d.]+)(?:[\s,/]+(?:de\s+\d+\s+(?:de\s+)?\w+\s+de\s+|\/))?(\d{2,4})/
        );
        if (!numYearMatch) continue;

        const num = numYearMatch[1].replace(/\.$/, '');
        const year = normalizeYear(numYearMatch[2]);
        const targetFullNumber = buildFullNumber(actType.prefix, num, year, issuer);

        const dedupKey = `${verb.type}|${targetFullNumber}`;
        if (seen.has(dedupKey)) break; // já registrado, próximo verbo
        seen.add(dedupKey);

        out.push({
          relationType: verb.type,
          targetFullNumber,
          excerpt: buildExcerpt(text, verbStart, verbEnd + actMatch.index + actMatch[0].length + numYearMatch[0].length),
          confidence: verb.conf,
        });
        break; // achou o ato pra esse verbo, pula pra próximo verbo
      }
    }
  }

  return out;
}
```

- [ ] **Step 2: Rodar testes — devem passar**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx vitest run lib/legislative-acts/__tests__/amendment-detector.test.ts 2>&1 | tail -10
```

Expected: 13 passed.

Se algum falhar, ajustar regex/lógica e rerodar até verde.

- [ ] **Step 3: Commit**

```bash
git add lib/legislative-acts/amendment-detector.ts lib/legislative-acts/__tests__/amendment-detector.test.ts
git commit -m "feat(legislative): detector heurístico de alterações entre atos"
```

---

## Task 4: CRUD de relações — escrever testes (TDD)

**Files:**
- Create: `lib/legislative-acts/__tests__/relations.test.ts`

- [ ] **Step 1: Escrever testes**

Criar `lib/legislative-acts/__tests__/relations.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique, mockUpsert, mockFindMany, mockDelete } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
  mockFindMany: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    legislativeAct: { findUnique: mockFindUnique },
    legislativeActRelation: {
      upsert: mockUpsert,
      findMany: mockFindMany,
      delete: mockDelete,
    },
  },
}));

import { saveDetectedRelations, getRelationsForAct } from '../relations';

describe('saveDetectedRelations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cria relação quando target existe no DB', async () => {
    mockFindUnique.mockResolvedValue({ id: 'target-id-1' });
    mockUpsert.mockResolvedValue({ id: 'rel-id-1' });

    const result = await saveDetectedRelations('source-id-1', [
      { relationType: 'altera', targetFullNumber: 'Lei 14.133/2021', excerpt: 'altera...', confidence: 0.85 },
    ]);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { fullNumber: 'Lei 14.133/2021' },
      select: { id: true },
    });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { sourceActId_targetActId_relationType: { sourceActId: 'source-id-1', targetActId: 'target-id-1', relationType: 'altera' } },
      create: expect.objectContaining({ sourceActId: 'source-id-1', targetActId: 'target-id-1', relationType: 'altera', source: 'heuristica' }),
      update: expect.objectContaining({ confidence: 0.85, excerpt: 'altera...' }),
    });
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('pula candidato sem target no DB (orphan)', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await saveDetectedRelations('source-id-1', [
      { relationType: 'altera', targetFullNumber: 'Lei 99.999/9999', excerpt: 'x', confidence: 0.85 },
    ]);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.skippedTargets).toContain('Lei 99.999/9999');
  });

  it('NÃO cria self-relation (source == target)', async () => {
    mockFindUnique.mockResolvedValue({ id: 'source-id-1' });

    const result = await saveDetectedRelations('source-id-1', [
      { relationType: 'altera', targetFullNumber: 'Lei 14.133/2021', excerpt: 'x', confidence: 0.85 },
    ]);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('upsert idempotente — segunda execução não duplica', async () => {
    mockFindUnique.mockResolvedValue({ id: 'target-id-1' });
    mockUpsert.mockResolvedValue({ id: 'rel-id-1' });

    await saveDetectedRelations('source-id-1', [
      { relationType: 'altera', targetFullNumber: 'Lei 14.133/2021', excerpt: 'x', confidence: 0.85 },
    ]);
    await saveDetectedRelations('source-id-1', [
      { relationType: 'altera', targetFullNumber: 'Lei 14.133/2021', excerpt: 'y', confidence: 0.85 },
    ]);

    expect(mockUpsert).toHaveBeenCalledTimes(2); // 2 calls, mas Prisma upsert garante 1 row
  });
});

describe('getRelationsForAct', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna alterações que este ato faz e que sofre', async () => {
    mockFindMany
      .mockResolvedValueOnce([
        { id: 'r1', relationType: 'altera', targetAct: { fullNumber: 'Lei 14.133/2021', title: 't' }, excerpt: 'x', confidence: 0.85, reviewStatus: 'confirmed' },
      ])
      .mockResolvedValueOnce([
        { id: 'r2', relationType: 'altera', sourceAct: { fullNumber: 'Decreto 12.926/2026', title: 't' }, excerpt: 'y', confidence: 0.85, reviewStatus: 'pending' },
      ]);

    const result = await getRelationsForAct('act-id-1');

    expect(result.alters).toHaveLength(1);
    expect(result.alters[0].targetAct.fullNumber).toBe('Lei 14.133/2021');
    expect(result.alteredBy).toHaveLength(1);
    expect(result.alteredBy[0].sourceAct.fullNumber).toBe('Decreto 12.926/2026');
  });

  it('filtra por reviewStatus se solicitado', async () => {
    mockFindMany.mockResolvedValue([]);

    await getRelationsForAct('act-id-1', { onlyConfirmed: true });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ reviewStatus: 'confirmed' }),
      })
    );
  });
});
```

- [ ] **Step 2: Rodar — falham**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx vitest run lib/legislative-acts/__tests__/relations.test.ts 2>&1 | tail -10
```

Expected: erros tipo `Cannot find module '../relations'`.

---

## Task 5: CRUD de relações — implementação

**Files:**
- Create: `lib/legislative-acts/relations.ts`

- [ ] **Step 1: Implementar**

Criar `lib/legislative-acts/relations.ts`:

```typescript
/**
 * Camada de persistência das relações entre atos normativos.
 *
 * Recebe candidatos detectados (heurística ou IA), faz lookup do target por
 * fullNumber, e grava em LegislativeActRelation via upsert. Pula candidatos
 * sem target cadastrado e self-relations.
 */
import { prisma } from '@/lib/prisma';
import type { DetectedRelation } from './amendment-detector';

export interface SaveResult {
  created: number;
  skipped: number;
  skippedTargets: string[];
}

export async function saveDetectedRelations(
  sourceActId: string,
  detected: DetectedRelation[],
  source: 'heuristica' | 'ia' | 'manual' = 'heuristica',
): Promise<SaveResult> {
  const result: SaveResult = { created: 0, skipped: 0, skippedTargets: [] };

  for (const rel of detected) {
    const target = await prisma.legislativeAct.findUnique({
      where: { fullNumber: rel.targetFullNumber },
      select: { id: true },
    });

    if (!target) {
      result.skipped++;
      result.skippedTargets.push(rel.targetFullNumber);
      continue;
    }

    if (target.id === sourceActId) {
      // Self-relation: ato menciona a si mesmo (raro, mas possível)
      result.skipped++;
      continue;
    }

    await prisma.legislativeActRelation.upsert({
      where: {
        sourceActId_targetActId_relationType: {
          sourceActId,
          targetActId: target.id,
          relationType: rel.relationType,
        },
      },
      create: {
        sourceActId,
        targetActId: target.id,
        relationType: rel.relationType,
        source,
        confidence: rel.confidence,
        excerpt: rel.excerpt,
        reviewStatus: 'pending',
      },
      update: {
        confidence: rel.confidence,
        excerpt: rel.excerpt,
        // detectedAt não atualiza — preserva primeira detecção
      },
    });
    result.created++;
  }

  return result;
}

export interface RelationView {
  id: string;
  relationType: string;
  excerpt: string;
  confidence: number;
  reviewStatus: string;
  sourceAct?: { fullNumber: string; title: string };
  targetAct?: { fullNumber: string; title: string };
}

export interface RelationsForAct {
  alters: RelationView[];      // este ato altera estes outros
  alteredBy: RelationView[];   // este ato é alterado por estes outros
}

export async function getRelationsForAct(
  actId: string,
  opts: { onlyConfirmed?: boolean } = {},
): Promise<RelationsForAct> {
  const reviewFilter = opts.onlyConfirmed ? { reviewStatus: 'confirmed' } : {};

  const [alters, alteredBy] = await Promise.all([
    prisma.legislativeActRelation.findMany({
      where: { sourceActId: actId, ...reviewFilter },
      include: { targetAct: { select: { fullNumber: true, title: true } } },
      orderBy: { detectedAt: 'desc' },
    }),
    prisma.legislativeActRelation.findMany({
      where: { targetActId: actId, ...reviewFilter },
      include: { sourceAct: { select: { fullNumber: true, title: true } } },
      orderBy: { detectedAt: 'desc' },
    }),
  ]);

  return {
    alters: alters as unknown as RelationView[],
    alteredBy: alteredBy as unknown as RelationView[],
  };
}
```

- [ ] **Step 2: Rodar testes — verde**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx vitest run lib/legislative-acts/__tests__/relations.test.ts 2>&1 | tail -10
```

Expected: 6 passed.

- [ ] **Step 3: Commit**

```bash
git add lib/legislative-acts/relations.ts lib/legislative-acts/__tests__/relations.test.ts
git commit -m "feat(legislative): camada de persistência das relações entre atos"
```

---

## Task 6: Integração detector + persistência no batch import

**Files:**
- Modify: `scripts/import-legislative-acts-batch.ts`

- [ ] **Step 1: Adicionar imports e chamada após create/update**

No topo de `scripts/import-legislative-acts-batch.ts`, adicionar imports:

```typescript
import { detectAmendments } from '../lib/legislative-acts/amendment-detector';
import { saveDetectedRelations } from '../lib/legislative-acts/relations';
```

Achar o ponto onde o create/update é feito (dentro do loop `for (const act of acts)`), e **após o `stats.criados++` e após o `stats.atualizados++`**, adicionar a chamada do detector:

```typescript
// Após criar ou atualizar com sucesso, detectar relações na ementa+content do ato
if (!DRY_RUN) {
  const sourceActId = existing ? existing.id : (await prisma.legislativeAct.findUnique({
    where: { fullNumber: act.fullNumber }, select: { id: true },
  }))?.id;
  if (sourceActId) {
    const detected = detectAmendments(act.ementa, act.content || '');
    if (detected.length > 0) {
      const r = await saveDetectedRelations(sourceActId, detected, 'heuristica');
      console.log(`   🔗 Relações: ${r.created} criadas, ${r.skipped} puladas (${r.skippedTargets.length > 0 ? `targets ausentes: ${r.skippedTargets.slice(0, 3).join(', ')}${r.skippedTargets.length > 3 ? '...' : ''}` : 'self/dup'})`);
    }
  }
}
```

- [ ] **Step 2: Smoke test em dry-run**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- npx tsx scripts/import-legislative-acts-batch.ts atos-pendentes-2026-04.json --dry-run 2>&1 | tail -10
```

Expected: continua mostrando os 5 inalterados (dry-run não toca relações). Sem erros.

- [ ] **Step 3: Commit**

```bash
git add scripts/import-legislative-acts-batch.ts
git commit -m "feat(legislative): batch import detecta e persiste relações pós-create/update"
```

---

## Task 7: Integração no cron de check + script de backfill

**Files:**
- Modify: `app/api/cron/check-legislative-updates/route.ts`
- Create: `scripts/backfill-relations.ts`

- [ ] **Step 1: Adicionar imports no cron**

No topo de `app/api/cron/check-legislative-updates/route.ts`, adicionar:

```typescript
import { detectAmendments } from '@/lib/legislative-acts/amendment-detector';
import { saveDetectedRelations } from '@/lib/legislative-acts/relations';
```

- [ ] **Step 2: Chamar detector quando content muda no cron**

Dentro do cron, achar o bloco que chama `scrapeAndIndexAct` com sucesso (resultado `success` e changed=true). Logo após, adicionar:

```typescript
// Re-detectar relações quando o content mudou
const updated = await prisma.legislativeAct.findUnique({
  where: { id: act.id },
  select: { id: true, ementa: true, content: true },
});
if (updated) {
  const detected = detectAmendments(updated.ementa, updated.content || '');
  if (detected.length > 0) {
    const r = await saveDetectedRelations(updated.id, detected, 'heuristica');
    console.log(`[Cron Legislative] ${act.fullNumber}: ${r.created} relações novas, ${r.skipped} puladas`);
  }
}
```

- [ ] **Step 3: Criar script de backfill pra atos já existentes**

Criar `scripts/backfill-relations.ts`:

```typescript
/**
 * Backfill de relações pra todos os atos já existentes no DB.
 * Roda detectAmendments em (ementa + content) e persiste via saveDetectedRelations.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-relations.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-relations.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-relations.ts --limit 10
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { detectAmendments } from '../lib/legislative-acts/amendment-detector';
import { saveDetectedRelations } from '../lib/legislative-acts/relations';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArgIdx = args.indexOf('--limit');
const LIMIT = limitArgIdx >= 0 ? parseInt(args[limitArgIdx + 1] ?? '0', 10) : 0;

async function main() {
  console.log(`\n=== Backfill de relações ${DRY_RUN ? '[DRY-RUN]' : '[EXEC]'} ===\n`);

  const acts = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, ementa: true, content: true },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
  });
  console.log(`Atos a processar: ${acts.length}\n`);

  let totalDetected = 0;
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const act of acts) {
    const detected = detectAmendments(act.ementa, act.content || '');
    if (detected.length === 0) continue;

    totalDetected += detected.length;

    if (DRY_RUN) {
      console.log(`${act.fullNumber}: ${detected.length} candidatos`);
      for (const d of detected) console.log(`  - ${d.relationType} → ${d.targetFullNumber} (conf=${d.confidence})`);
      continue;
    }

    const r = await saveDetectedRelations(act.id, detected, 'heuristica');
    totalCreated += r.created;
    totalSkipped += r.skipped;
    if (r.created > 0 || r.skipped > 0) {
      console.log(`${act.fullNumber}: +${r.created} criadas, ${r.skipped} puladas`);
    }
  }

  console.log(`\n=== Total ===`);
  console.log(`Candidatos detectados: ${totalDetected}`);
  console.log(`Relações criadas:      ${totalCreated}`);
  console.log(`Pulados (orphan/self): ${totalSkipped}`);

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 4: Smoke test backfill em dry-run com --limit 10**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- npx tsx scripts/backfill-relations.ts --dry-run --limit 10 2>&1 | tail -30
```

Expected: lista de 10 atos com seus candidatos detectados (ou aviso "0 candidatos" pra atos sem menções). Sem erros.

- [ ] **Step 5: Backfill real completo (todos os atos do DB)**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- npx tsx scripts/backfill-relations.ts 2>&1 | tail -20
```

Expected: log com totais. Pra a base atual (~112 atos), espera-se 30-80 relações criadas (típico: cada Decreto/IN regulamenta a Lei 14.133/2021).

- [ ] **Step 6: Validar no DB**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- npx tsx -e "import {PrismaClient} from '@prisma/client'; import {PrismaNeon} from '@prisma/adapter-neon'; const p = new PrismaClient({adapter: new PrismaNeon({connectionString: process.env.DATABASE_URL})}); (async () => { const total = await p.legislativeActRelation.count(); const byType = await p.legislativeActRelation.groupBy({by:['relationType'], _count: true}); console.log('Total:', total); for (const t of byType) console.log(t.relationType, t._count); await p.\$disconnect(); })();"
```

Expected: `Total: > 0` com breakdown por tipo.

- [ ] **Step 7: Commit**

```bash
git add app/api/cron/check-legislative-updates/route.ts scripts/backfill-relations.ts
git commit -m "feat(legislative): cron de check + backfill detectam relações automaticamente"
```

---

## Task 8: UI — RelationHistory component (TDD)

**Files:**
- Create: `components/acervo/__tests__/RelationHistory.test.tsx`

- [ ] **Step 1: Escrever testes**

Criar `components/acervo/__tests__/RelationHistory.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RelationHistory } from '../RelationHistory';

const baseRel = {
  id: 'r1',
  relationType: 'altera' as const,
  excerpt: 'altera o art. 75 da Lei nº 14.133',
  confidence: 0.85,
  reviewStatus: 'confirmed' as const,
};

describe('RelationHistory', () => {
  it('mostra placeholder quando não há relações', () => {
    render(<RelationHistory alters={[]} alteredBy={[]} />);
    expect(screen.getByText(/sem relações detectadas/i)).toBeTruthy();
  });

  it('renderiza atos que este ato altera', () => {
    render(<RelationHistory
      alters={[{ ...baseRel, targetAct: { fullNumber: 'Lei 14.133/2021', title: 'Nova Lei de Licitações' } }]}
      alteredBy={[]}
    />);
    expect(screen.getByText(/este ato altera/i)).toBeTruthy();
    expect(screen.getByText('Lei 14.133/2021')).toBeTruthy();
    expect(screen.getByText(/nova lei de licitações/i)).toBeTruthy();
  });

  it('renderiza atos que alteram este ato', () => {
    render(<RelationHistory
      alters={[]}
      alteredBy={[{ ...baseRel, sourceAct: { fullNumber: 'Decreto 12.926/2026', title: 'Atualização' } }]}
    />);
    expect(screen.getByText(/foi alterado por/i)).toBeTruthy();
    expect(screen.getByText('Decreto 12.926/2026')).toBeTruthy();
  });

  it('mostra badge "pending" pra relações não-confirmadas', () => {
    render(<RelationHistory
      alters={[{ ...baseRel, reviewStatus: 'pending', targetAct: { fullNumber: 'Lei X', title: 't' } }]}
      alteredBy={[]}
    />);
    expect(screen.getByText(/pendente/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar — falham**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx vitest run components/acervo/__tests__/RelationHistory.test.tsx 2>&1 | tail -10
```

Expected: erro `Cannot find module '../RelationHistory'`.

---

## Task 9: UI — RelationHistory implementação

**Files:**
- Create: `components/acervo/RelationHistory.tsx`

- [ ] **Step 1: Implementar**

Criar `components/acervo/RelationHistory.tsx`:

```typescript
import Link from 'next/link';
import type { RelationView } from '@/lib/legislative-acts/relations';

const TYPE_LABELS: Record<string, string> = {
  revoga: 'revoga',
  altera: 'altera',
  regulamenta: 'regulamenta',
  complementa: 'complementa',
  modifica: 'modifica',
};

const TYPE_COLORS: Record<string, string> = {
  revoga: 'bg-red-100 text-red-700 border-red-300',
  altera: 'bg-amber-100 text-amber-700 border-amber-300',
  regulamenta: 'bg-blue-100 text-blue-700 border-blue-300',
  complementa: 'bg-green-100 text-green-700 border-green-300',
  modifica: 'bg-purple-100 text-purple-700 border-purple-300',
};

export interface RelationHistoryProps {
  alters: RelationView[];
  alteredBy: RelationView[];
}

export function RelationHistory({ alters, alteredBy }: RelationHistoryProps) {
  if (alters.length === 0 && alteredBy.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 my-6">
        <p className="text-sm text-gray-500 italic">
          Sem relações detectadas com outros atos normativos da base.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 my-6 space-y-6">
      {alters.length > 0 && (
        <section>
          <h3 className="font-cinzel font-semibold text-lg text-gray-900 mb-3">
            ✏️ Este ato altera:
          </h3>
          <ul className="space-y-3">
            {alters.map((rel) => (
              <RelationItem key={rel.id} rel={rel} otherAct={rel.targetAct!} />
            ))}
          </ul>
        </section>
      )}

      {alteredBy.length > 0 && (
        <section>
          <h3 className="font-cinzel font-semibold text-lg text-gray-900 mb-3">
            📌 Este ato foi alterado por:
          </h3>
          <ul className="space-y-3">
            {alteredBy.map((rel) => (
              <RelationItem key={rel.id} rel={rel} otherAct={rel.sourceAct!} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RelationItem({
  rel,
  otherAct,
}: {
  rel: RelationView;
  otherAct: { fullNumber: string; title: string };
}) {
  const typeColor = TYPE_COLORS[rel.relationType] ?? 'bg-gray-100 text-gray-700 border-gray-300';
  return (
    <li className="border border-gray-200 rounded-lg p-3 hover:border-brand-300 transition-colors">
      <div className="flex items-start gap-2 flex-wrap">
        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${typeColor}`}>
          {TYPE_LABELS[rel.relationType] ?? rel.relationType}
        </span>
        {rel.reviewStatus === 'pending' && (
          <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded border bg-yellow-50 text-yellow-700 border-yellow-300">
            ⏳ pendente revisão
          </span>
        )}
        <Link
          href={`/legislacao/${encodeURIComponent(otherAct.fullNumber)}`}
          className="font-poppins font-semibold text-brand-700 hover:underline"
        >
          {otherAct.fullNumber}
        </Link>
      </div>
      <p className="text-sm text-gray-700 mt-1 font-poppins">{otherAct.title}</p>
      <p className="text-xs text-gray-500 italic mt-1 font-poppins">&ldquo;{rel.excerpt}&rdquo;</p>
    </li>
  );
}
```

- [ ] **Step 2: Rodar testes — verde**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx vitest run components/acervo/__tests__/RelationHistory.test.tsx 2>&1 | tail -10
```

Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add components/acervo/RelationHistory.tsx components/acervo/__tests__/RelationHistory.test.tsx
git commit -m "feat(legislative-ui): componente RelationHistory mostra alterações entre atos"
```

---

## Task 10: Integração na página de detalhe do ato

**Files:**
- Modify: `app/(acervo)/legislacao/[id]/page.tsx`

- [ ] **Step 1: Inspecionar página atual**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
head -30 "app/(acervo)/legislacao/[id]/page.tsx"
```

Identificar:
- Como busca o ato (Prisma findUnique?)
- Onde renderiza o conteúdo (depois do hero, antes de conteúdo extra?)

- [ ] **Step 2: Adicionar fetch das relações + render do componente**

Adicionar imports no topo:

```typescript
import { getRelationsForAct } from '@/lib/legislative-acts/relations';
import { RelationHistory } from '@/components/acervo/RelationHistory';
```

No componente (que é async pelo padrão Server Component), depois de buscar o ato e antes do `return`, adicionar:

```typescript
const relations = await getRelationsForAct(act.id);
```

No JSX, em local apropriado (depois de "Conteúdo" / antes de "Anexos" — adapte ao layout existente), adicionar:

```tsx
<RelationHistory alters={relations.alters} alteredBy={relations.alteredBy} />
```

- [ ] **Step 3: Smoke test local**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npm run dev &
sleep 5
curl -s http://localhost:3000/legislacao/Lei%2014.133%2F2021 2>&1 | grep -E '(altera|alterado por)' | head -3
```

Expected: ao menos uma das strings aparece (assumindo backfill criou relações pra Lei 14.133). Se não tiver server local rodando, pular pra step 4.

- [ ] **Step 4: Validar build**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx tsc --noEmit 2>&1 | grep -E "(legislacao|RelationHistory)" | head -5
```

Expected: sem erros nos arquivos tocados. (Erros pré-existentes em outros files são OK.)

- [ ] **Step 5: Commit**

```bash
git add "app/(acervo)/legislacao/[id]/page.tsx"
git commit -m "feat(legislative-ui): plug RelationHistory na página de detalhe do ato"
```

---

## Task 11: API admin — confirmar/rejeitar relações pendentes

**Files:**
- Create: `app/api/admin/legislative-relations/[id]/route.ts`
- Create: `app/api/admin/legislative-relations/__tests__/route.test.ts`

- [ ] **Step 1: Escrever testes**

Criar `app/api/admin/legislative-relations/__tests__/route.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpdate, mockDelete, mockAuth } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockAuth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { legislativeActRelation: { update: mockUpdate, delete: mockDelete } },
}));

vi.mock('@/lib/auth', () => ({
  requireAdmin: (...args: any[]) => mockAuth(...args),
}));

import { PATCH, DELETE } from '../[id]/route';

function makeRequest(body: object): Request {
  return new Request('http://localhost/api/admin/legislative-relations/r1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/admin/legislative-relations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ email: 'admin@test.com' });
  });

  it('confirma relação', async () => {
    mockUpdate.mockResolvedValue({ id: 'r1', reviewStatus: 'confirmed' });
    const res = await PATCH(makeRequest({ action: 'confirm' }) as any, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ reviewStatus: 'confirmed', confirmedBy: 'admin@test.com' }),
    });
  });

  it('rejeita relação (delete)', async () => {
    mockDelete.mockResolvedValue({ id: 'r1' });
    const res = await DELETE(makeRequest({}) as any, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it('exige autenticação admin', async () => {
    mockAuth.mockRejectedValue(new Error('Unauthorized'));
    const res = await PATCH(makeRequest({ action: 'confirm' }) as any, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Rodar — falham**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx vitest run app/api/admin/legislative-relations/__tests__/route.test.ts 2>&1 | tail -10
```

Expected: erro de import.

- [ ] **Step 3: Implementar route**

Criar `app/api/admin/legislative-relations/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let admin: { email: string };
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json();

  if (body.action !== 'confirm' && body.action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const reviewStatus = body.action === 'confirm' ? 'confirmed' : 'rejected';

  const updated = await prisma.legislativeActRelation.update({
    where: { id },
    data: { reviewStatus, confirmedBy: admin.email, confirmedAt: new Date() },
  });

  return NextResponse.json({ ok: true, relation: updated });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  await prisma.legislativeActRelation.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Confirmar que `requireAdmin` existe em `@/lib/auth`**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
grep -E "export.*requireAdmin" lib/auth.ts lib/auth/*.ts 2>/dev/null
```

Se não existir, identificar a helper de auth de admin existente (procurar em `lib/admin-auth.ts`, `lib/api-auth.ts`, ou checar como outras rotas admin fazem) e ajustar o import + os mocks dos testes.

- [ ] **Step 5: Rodar testes — verde**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx vitest run app/api/admin/legislative-relations/__tests__/route.test.ts 2>&1 | tail -10
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/legislative-relations/
git commit -m "feat(legislative-admin): API pra confirmar ou rejeitar relações pendentes"
```

---

## Task 12: Detector via IA (Camada 5, opcional)

**Files:**
- Create: `lib/legislative-acts/__tests__/amendment-detector-ai.test.ts`
- Create: `lib/legislative-acts/amendment-detector-ai.ts`

- [ ] **Step 1: Escrever testes (mockando Gemini SDK)**

Criar `lib/legislative-acts/__tests__/amendment-detector-ai.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerate };
  },
}));

import { detectAmendmentsAI } from '../amendment-detector-ai';

describe('detectAmendmentsAI', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extrai relações do JSON retornado pelo Gemini', async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        relations: [
          { type: 'revoga', target: 'Lei 8.666/1993', excerpt: 'Revoga a Lei 8.666/93', confidence: 0.95 },
          { type: 'regulamenta', target: 'Lei 14.133/2021', excerpt: 'regulamenta o art. 12', confidence: 0.9 },
        ],
      }),
    });

    const result = await detectAmendmentsAI('Revoga a Lei 8.666/93 e regulamenta o art. 12 da Lei 14.133/2021.', '');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      relationType: 'revoga',
      targetFullNumber: 'Lei 8.666/1993',
      excerpt: 'Revoga a Lei 8.666/93',
      confidence: 0.95,
    });
  });

  it('retorna [] se Gemini retornar JSON inválido', async () => {
    mockGenerate.mockResolvedValue({ text: 'não é JSON' });
    const result = await detectAmendmentsAI('texto', '');
    expect(result).toEqual([]);
  });

  it('retorna [] em erro de API', async () => {
    mockGenerate.mockRejectedValue(new Error('rate limit'));
    const result = await detectAmendmentsAI('texto', '');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Implementar**

Criar `lib/legislative-acts/amendment-detector-ai.ts`:

```typescript
/**
 * Detector de relações via Gemini. Usado como fallback/expansão da heurística
 * pra casos sutis que regex não pega (ex: "no que tange aos prazos da norma anterior").
 *
 * Roda só se opt-in (caller passa decisão de quando chamar). Retorna mesma forma
 * que detectAmendments. Modelo: gemini-2.5-flash com response JSON.
 */
import { GoogleGenAI } from '@google/genai';
import type { DetectedRelation, RelationType } from './amendment-detector';

const PROMPT = `Você é um classificador jurídico. Analise o texto abaixo (ementa + parte do conteúdo) de um ato normativo brasileiro e identifique se ele REVOGA, ALTERA, REGULAMENTA, COMPLEMENTA ou MODIFICA outros atos normativos brasileiros (Leis, Decretos, Portarias, Instruções Normativas, MPs).

Retorne APENAS um JSON no formato:
{"relations": [{"type": "revoga|altera|regulamenta|complementa|modifica", "target": "<fullNumber no padrão 'Lei 14.133/2021' ou 'Decreto 7.892/2013' ou 'IN SEGES 5/2017'>", "excerpt": "<trecho que justifica até 200 chars>", "confidence": <0.5-1.0>}]}

Se não detectar nenhuma, retorne {"relations": []}.

Texto:
---
{TEXT}
---`;

const VALID_TYPES: RelationType[] = ['revoga', 'altera', 'regulamenta', 'complementa', 'modifica'];

export async function detectAmendmentsAI(ementa: string, content: string): Promise<DetectedRelation[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const text = `${ementa}\n\n${content.slice(0, 8000)}`; // Limita pra evitar custo
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: PROMPT.replace('{TEXT}', text),
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    });

    const raw = response.text || '';
    const parsed = JSON.parse(raw) as { relations?: Array<{ type: string; target: string; excerpt: string; confidence: number }> };
    const relations = parsed.relations ?? [];

    return relations
      .filter((r) => VALID_TYPES.includes(r.type as RelationType))
      .map((r) => ({
        relationType: r.type as RelationType,
        targetFullNumber: r.target,
        excerpt: r.excerpt.slice(0, 200),
        confidence: Math.min(1, Math.max(0.5, r.confidence)),
      }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: Rodar testes — verde**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx vitest run lib/legislative-acts/__tests__/amendment-detector-ai.test.ts 2>&1 | tail -10
```

Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add lib/legislative-acts/amendment-detector-ai.ts lib/legislative-acts/__tests__/amendment-detector-ai.test.ts
git commit -m "feat(legislative): detector via IA (Gemini) como fallback opt-in"
```

---

## Task 13: Suite completa + lint + commit final

**Files:**
- (validação geral)

- [ ] **Step 1: Rodar suite completa**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx vitest run 2>&1 | tail -10
```

Expected: todas verdes (incluindo as ~14-16 novas dessa feature).

- [ ] **Step 2: Rodar lint**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx next lint --dir lib/legislative-acts --dir components/acervo --dir app/api/admin/legislative-relations 2>&1 | tail -15
```

Expected: 0 errors. Warnings de imports não-usados são aceitáveis em tests.

- [ ] **Step 3: Type check**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx tsc --noEmit 2>&1 | grep -E "(legislative-acts|RelationHistory|legislative-relations)" | head -10 && echo "---END---"
```

Expected: `---END---` sem erros antes (erros pré-existentes em outros arquivos podem aparecer mas não bloqueiam).

- [ ] **Step 4: Push**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
git push
```

- [ ] **Step 5: Atualizar memória + ROADMAP**

Atualizar `MEMORY.md` adicionando entry sobre a feature, e adicionar/atualizar entry no `FUTURE_TASKS.md` listando o que sobra (UI admin pra fila de pendentes, integração com IA opt-in nos crons, etc).

```bash
git add MEMORY.md FUTURE_TASKS.md
git commit -m "docs: registra feature de consolidação de atos normativos"
git push
```

---

## Notas de execução

- **TDD rigoroso** em Tasks 2, 4, 8, 11, 12 — sempre teste falhando primeiro.
- **Não rodar Task 7 Step 5 (backfill real) sem pelo menos `--limit 5` antes** — é única operação que escreve em massa no DB.
- **Decisão arquitetural — fullNumber lookup**: o detector heurístico tenta gerar o `fullNumber` no formato canônico, mas pequenas variações entre fontes podem causar misses (ex: "IN SGD/MGI 86" vs "IN SGD/MGI nº 86/2025"). Tasks 6 e 7 já mitigam isso (skip silencioso de orphans), e Task 11 permite admin criar relação manualmente. Em sessão futura, considerar normalização mais agressiva no `relations.ts` (busca por `number+year+type` em vez de `fullNumber` exato).
- **Camada 5 (IA)** está implementada mas não plugada ao cron/import — fica como ferramenta sob demanda. Plug futuro: chamar `detectAmendmentsAI` em paralelo com `detectAmendments` se a heurística pegou ≥1 match (sinaliza ato relevante), e mesclar resultados deduplicando por `(type, target)`.
- **Performance:** detectAmendments é regex-only — milissegundos por ato. Backfill de 112 atos roda em <5s. Cron semanal toca 10 atos × ~10s scrape = 1.5min total, sem impacto.

---

## Self-review checklist (executado antes de merge)

- [x] Spec coverage: 5 camadas → Tasks 0 (cron), 1 (schema), 2-3 (detector heurístico), 4-5 (relations), 6-7 (integração + backfill), 8-10 (UI), 11 (admin), 12 (IA)
- [x] No placeholders: todo step tem código completo, comandos exatos, expected output
- [x] Type consistency: `DetectedRelation`, `RelationType`, `RelationView`, `RelationHistoryProps` definidos uma vez e referenciados consistentemente
- [x] TDD em todos os módulos novos
- [x] Commits frequentes (1 commit por task ou subtask)
