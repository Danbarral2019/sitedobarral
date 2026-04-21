# Integração dos acórdãos TCU na Jurisprudência — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a página `/area-restrita/jurisprudencia` enxergar os acórdãos TCU que vivem em `Document` (hoje invisíveis), preservando o shape da resposta da API — sem migração de dados.

**Architecture:** Helper único (`lib/jurisprudencia/unified-query.ts`) expõe SQL raw com `UNION ALL` entre `TribunalDecision` (TCEs, STJ, STF) e `Document` filtrado por TCU (`category='acordao' AND tcuNumeroAcordao IS NOT NULL`). Três rotas (`GET /api/jurisprudencia`, `GET /api/jurisprudencia/[id]`, `POST /api/jurisprudencia/query`) passam a usar o helper. Front-end intocado.

**Tech Stack:** Next.js 15 (App Router), Prisma 7 (`$queryRaw` + `Prisma.sql`), PostgreSQL (Neon), Vitest, Zod, TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-21-integracao-tcu-jurisprudencia-design.md`

---

## File Structure

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `lib/jurisprudencia/unified-query.ts` | **novo** | Types, builders de WHERE, short-circuit, funções fetch* |
| `lib/jurisprudencia/__tests__/unified-query.test.ts` | **novo** | Unit tests do módulo acima |
| `app/api/jurisprudencia/route.ts` | modificado | Usa `fetchUnifiedList` |
| `app/api/jurisprudencia/[id]/route.ts` | modificado | Usa `fetchUnifiedById` |
| `app/api/jurisprudencia/query/route.ts` | modificado | Usa `fetchUnifiedTopK` + `countUnifiedApproved` |
| `app/api/jurisprudencia/__tests__/route.test.ts` | **novo** | Integration test da listagem |
| `app/api/jurisprudencia/__tests__/detail.test.ts` | **novo** | Integration test do detalhe |
| `app/api/jurisprudencia/__tests__/query.test.ts` | **novo** | Integration test da IA (Gemini mockado) |
| `prisma/sql/2026-04-21-document-tcu-index.sql` | **novo** | Índice parcial para performance do ramo B |

---

## Task 1: Tipos compartilhados e função `mapDocumentTcuToDecision`

**Files:**
- Create: `lib/jurisprudencia/unified-query.ts`
- Create: `lib/jurisprudencia/__tests__/unified-query.test.ts`

**Contexto:** Antes de montar queries, precisamos da função que converte um registro `Document` TCU cru no shape comum (`UnifiedDecision`). É a base de toda a integração: se o mapeamento está errado, tudo a jusante está errado.

- [ ] **Step 1.1: Criar arquivo de teste com o caso "todos os campos preenchidos"**

Create: `lib/jurisprudencia/__tests__/unified-query.test.ts`

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mapDocumentTcuToDecision } from '../unified-query';

describe('mapDocumentTcuToDecision', () => {
  it('mapeia todos os campos TCU preenchidos para o shape UnifiedDecision', () => {
    const doc = {
      id: 'doc-1',
      title: 'Acórdão sobre pregão eletrônico',
      description: 'descrição do acórdão',
      content: 'conteúdo longo',
      url: 'https://tcu.gov.br/ac/1106',
      tcuNumeroAcordao: 'AC-1106/24-P',
      tcuEmentaCompleta: 'Ementa completa do acórdão sobre pregão.',
      tcuTextoCompleto: 'Texto integral do acórdão...',
      tcuRelator: 'MIN. AUGUSTO SHERMAN',
      tcuAutorTese: null,
      tcuOrgaoJulgador: 'Plenário',
      tcuDataJulgamento: new Date('2024-05-20T00:00:00Z'),
      tcuLinkPDF: 'https://tcu.gov.br/pdf/1106.pdf',
      tcuArea: 'Licitações',
      tcuTema: 'Pregão',
      tcuSubtema: 'Eletrônico',
      acordaoAno: 2024,
      themes: JSON.stringify(['pregão', 'licitação']),
      leiArticles: JSON.stringify(['17', '18']),
      summary: 'Resumo IA.',
      douData: null,
      uploadedAt: new Date('2024-06-01T00:00:00Z'),
      updatedAt: new Date('2024-06-02T00:00:00Z'),
    };

    const result = mapDocumentTcuToDecision(doc);

    expect(result).toMatchObject({
      id: 'doc-1',
      tribunalCode: 'TCU',
      tribunalName: 'Tribunal de Contas da União',
      decisionType: 'acordao',
      decisionNumber: 'AC-1106/24-P',
      title: 'Acórdão sobre pregão eletrônico',
      ementa: 'Ementa completa do acórdão sobre pregão.',
      fullText: 'Texto integral do acórdão...',
      relator: 'MIN. AUGUSTO SHERMAN',
      orgaoJulgador: 'Plenário',
      dataJulgamento: new Date('2024-05-20T00:00:00Z'),
      pdfUrl: 'https://tcu.gov.br/pdf/1106.pdf',
      year: 2024,
      themes: JSON.stringify(['pregão', 'licitação']),
      leiArticles: JSON.stringify(['17', '18']),
      summary: 'Resumo IA.',
      url: 'https://tcu.gov.br/ac/1106',
      isRelevant: true,
      relevanceScore: 0,
      approvalStatus: 'manually_approved',
      sourceType: 'document-tcu',
      fullIdentifier: 'TCU Acórdão AC-1106/24-P',
      createdAt: new Date('2024-06-01T00:00:00Z'),
      updatedAt: new Date('2024-06-02T00:00:00Z'),
      processNumber: null,
      dataPublicacao: null,
    });
  });
});
```

- [ ] **Step 1.2: Rodar teste para verificar que falha**

Run: `npx vitest run lib/jurisprudencia/__tests__/unified-query.test.ts`
Expected: FAIL com "Cannot find module '../unified-query'" ou similar.

- [ ] **Step 1.3: Criar `unified-query.ts` com tipos e a função**

Create: `lib/jurisprudencia/unified-query.ts`

```ts
/**
 * Unified Jurisprudência Query Helper
 *
 * Une TribunalDecision (TCEs, STJ, STF) + Document TCU (acórdãos) no read path
 * da página /area-restrita/jurisprudencia. Veja o spec:
 * docs/superpowers/specs/2026-04-21-integracao-tcu-jurisprudencia-design.md
 */

export interface UnifiedDecision {
  id: string;
  tribunalCode: string;
  tribunalName: string;
  decisionType: string;
  decisionNumber: string;
  title: string;
  ementa: string;
  fullText: string | null;
  summary: string | null;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: Date | null;
  dataPublicacao: Date | null;
  themes: string | null;
  leiArticles: string | null;
  url: string | null;
  pdfUrl: string | null;
  isRelevant: boolean;
  relevanceScore: number;
  approvalStatus: string;
  year: number | null;
  processNumber: string | null;
  fullIdentifier: string;
  sourceType: 'tribunal-decision' | 'document-tcu';
  createdAt: Date;
  updatedAt: Date;
}

/** Shape mínimo do `Document` necessário para o mapping. */
export interface DocumentTcuRaw {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
  tcuNumeroAcordao: string | null;
  tcuEmentaCompleta: string | null;
  tcuTextoCompleto: string | null;
  tcuRelator: string | null;
  tcuAutorTese: string | null;
  tcuOrgaoJulgador: string | null;
  tcuDataJulgamento: Date | null;
  tcuLinkPDF: string | null;
  tcuArea: string | null;
  tcuTema: string | null;
  tcuSubtema: string | null;
  acordaoAno: number | null;
  themes: string | null;
  leiArticles: string | null;
  summary: string | null;
  douData: Date | null;
  uploadedAt: Date;
  updatedAt: Date;
}

function deriveThemesFromTcu(doc: DocumentTcuRaw): string | null {
  if (doc.themes) return doc.themes;
  const parts = [doc.tcuArea, doc.tcuTema, doc.tcuSubtema].filter(
    (p): p is string => !!p && p.trim().length > 0
  );
  return parts.length > 0 ? JSON.stringify(parts) : null;
}

function deriveYear(doc: DocumentTcuRaw): number | null {
  if (typeof doc.acordaoAno === 'number') return doc.acordaoAno;
  if (doc.tcuDataJulgamento) return doc.tcuDataJulgamento.getUTCFullYear();
  return null;
}

export function mapDocumentTcuToDecision(doc: DocumentTcuRaw): UnifiedDecision {
  const decisionNumber = doc.tcuNumeroAcordao ?? doc.title;
  const ementa =
    doc.tcuEmentaCompleta ?? doc.description ?? doc.content ?? '';
  const fullText = doc.tcuTextoCompleto ?? doc.content ?? null;
  const relator = doc.tcuRelator ?? doc.tcuAutorTese ?? null;

  return {
    id: doc.id,
    tribunalCode: 'TCU',
    tribunalName: 'Tribunal de Contas da União',
    decisionType: 'acordao',
    decisionNumber,
    title: doc.title,
    ementa,
    fullText,
    summary: doc.summary,
    relator,
    orgaoJulgador: doc.tcuOrgaoJulgador,
    dataJulgamento: doc.tcuDataJulgamento,
    dataPublicacao: doc.douData,
    themes: deriveThemesFromTcu(doc),
    leiArticles: doc.leiArticles,
    url: doc.url,
    pdfUrl: doc.tcuLinkPDF,
    isRelevant: true,
    relevanceScore: 0,
    approvalStatus: 'manually_approved',
    year: deriveYear(doc),
    processNumber: null,
    fullIdentifier: `TCU Acórdão ${decisionNumber}`,
    sourceType: 'document-tcu',
    createdAt: doc.uploadedAt,
    updatedAt: doc.updatedAt,
  };
}
```

- [ ] **Step 1.4: Rodar teste para verificar que passa**

Run: `npx vitest run lib/jurisprudencia/__tests__/unified-query.test.ts`
Expected: PASS (1 teste).

- [ ] **Step 1.5: Adicionar teste para fallbacks de campos faltando**

Edit: `lib/jurisprudencia/__tests__/unified-query.test.ts` — adicionar dentro do mesmo `describe`:

```ts
  it('usa fallbacks quando campos TCU estão vazios', () => {
    const doc = {
      id: 'doc-2',
      title: 'Acórdão básico',
      description: 'só descrição',
      content: null,
      url: null,
      tcuNumeroAcordao: null,
      tcuEmentaCompleta: null,
      tcuTextoCompleto: null,
      tcuRelator: null,
      tcuAutorTese: 'AUGUSTO SHERMAN',
      tcuOrgaoJulgador: null,
      tcuDataJulgamento: new Date('2023-03-10T00:00:00Z'),
      tcuLinkPDF: null,
      tcuArea: 'Contratos',
      tcuTema: null,
      tcuSubtema: null,
      acordaoAno: null,
      themes: null,
      leiArticles: null,
      summary: null,
      douData: null,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = mapDocumentTcuToDecision(doc);

    expect(result.decisionNumber).toBe('Acórdão básico'); // fallback para title
    expect(result.ementa).toBe('só descrição'); // fallback description
    expect(result.fullText).toBeNull();
    expect(result.relator).toBe('AUGUSTO SHERMAN'); // fallback tcuAutorTese
    expect(result.year).toBe(2023); // derivado de tcuDataJulgamento
    expect(result.themes).toBe(JSON.stringify(['Contratos'])); // só tcuArea
    expect(result.fullIdentifier).toBe('TCU Acórdão Acórdão básico');
  });

  it('retorna themes null quando não há themes, area, tema nem subtema', () => {
    const doc: any = {
      id: 'doc-3',
      title: 't',
      description: null,
      content: null,
      url: null,
      tcuNumeroAcordao: 'AC-1/24',
      tcuEmentaCompleta: 'e',
      tcuTextoCompleto: null,
      tcuRelator: null,
      tcuAutorTese: null,
      tcuOrgaoJulgador: null,
      tcuDataJulgamento: null,
      tcuLinkPDF: null,
      tcuArea: null,
      tcuTema: null,
      tcuSubtema: null,
      acordaoAno: null,
      themes: null,
      leiArticles: null,
      summary: null,
      douData: null,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = mapDocumentTcuToDecision(doc);

    expect(result.themes).toBeNull();
    expect(result.year).toBeNull();
  });
```

- [ ] **Step 1.6: Rodar testes para verificar que passam**

Run: `npx vitest run lib/jurisprudencia/__tests__/unified-query.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 1.7: Commit**

```bash
git add lib/jurisprudencia/unified-query.ts lib/jurisprudencia/__tests__/unified-query.test.ts
git commit -m "feat(jurisprudencia): tipos e mapper Document TCU → UnifiedDecision"
```

---

## Task 2: Short-circuit helpers por filtro

**Files:**
- Modify: `lib/jurisprudencia/unified-query.ts`
- Modify: `lib/jurisprudencia/__tests__/unified-query.test.ts`

**Contexto:** Antes de montar SQL, decidimos se cada ramo (TribunalDecision ou Document TCU) entra. `tribunal='TCU'` exclui ramo A. `decisionType='sumula'` exclui ramo B. Duas funções puras, fáceis de testar.

- [ ] **Step 2.1: Adicionar testes do short-circuit**

Edit: `lib/jurisprudencia/__tests__/unified-query.test.ts` — adicionar no topo do import:

```ts
import {
  mapDocumentTcuToDecision,
  shouldIncludeTribunalDecisionBranch,
  shouldIncludeDocumentTcuBranch,
  type JurisprudenciaFilters,
} from '../unified-query';
```

E adicionar novo `describe` no fim do arquivo:

```ts
describe('shouldIncludeTribunalDecisionBranch', () => {
  it('inclui quando sem filtros', () => {
    expect(shouldIncludeTribunalDecisionBranch({})).toBe(true);
  });

  it('exclui quando tribunal=TCU', () => {
    expect(
      shouldIncludeTribunalDecisionBranch({ tribunal: 'TCU' })
    ).toBe(false);
  });

  it('inclui quando tribunal=TCE-SP', () => {
    expect(
      shouldIncludeTribunalDecisionBranch({ tribunal: 'TCE-SP' })
    ).toBe(true);
  });

  it('inclui com qualquer decisionType', () => {
    expect(
      shouldIncludeTribunalDecisionBranch({ decisionType: 'sumula' })
    ).toBe(true);
    expect(
      shouldIncludeTribunalDecisionBranch({ decisionType: 'acordao' })
    ).toBe(true);
  });
});

describe('shouldIncludeDocumentTcuBranch', () => {
  it('inclui quando sem filtros', () => {
    expect(shouldIncludeDocumentTcuBranch({})).toBe(true);
  });

  it('inclui quando tribunal=TCU', () => {
    expect(
      shouldIncludeDocumentTcuBranch({ tribunal: 'TCU' })
    ).toBe(true);
  });

  it('exclui quando tribunal=TCE-SP', () => {
    expect(
      shouldIncludeDocumentTcuBranch({ tribunal: 'TCE-SP' })
    ).toBe(false);
  });

  it('exclui quando decisionType não é acordao', () => {
    expect(
      shouldIncludeDocumentTcuBranch({ decisionType: 'sumula' })
    ).toBe(false);
    expect(
      shouldIncludeDocumentTcuBranch({ decisionType: 'parecer_previo' })
    ).toBe(false);
    expect(
      shouldIncludeDocumentTcuBranch({ decisionType: 'decisao' })
    ).toBe(false);
  });

  it('inclui quando decisionType=acordao ou vazio', () => {
    expect(
      shouldIncludeDocumentTcuBranch({ decisionType: 'acordao' })
    ).toBe(true);
    expect(shouldIncludeDocumentTcuBranch({})).toBe(true);
  });

  it('combina filtros: tribunal=TCU + decisionType=sumula = excluído', () => {
    expect(
      shouldIncludeDocumentTcuBranch({
        tribunal: 'TCU',
        decisionType: 'sumula',
      })
    ).toBe(false);
  });
});
```

- [ ] **Step 2.2: Rodar testes para verificar que falham**

Run: `npx vitest run lib/jurisprudencia/__tests__/unified-query.test.ts`
Expected: FAIL em ao menos um teste — `shouldIncludeTribunalDecisionBranch is not a function`.

- [ ] **Step 2.3: Implementar os helpers e o tipo de filtros**

Edit: `lib/jurisprudencia/unified-query.ts` — adicionar no fim:

```ts
export interface JurisprudenciaFilters {
  tribunal?: string;
  ano?: number;
  tema?: string;
  artigo?: string;
  decisionType?: string;
  relator?: string;
  orgao?: string;
  dataFrom?: Date;
  dataTo?: Date;
  q?: string;
}

export function shouldIncludeTribunalDecisionBranch(
  filters: JurisprudenciaFilters
): boolean {
  if (filters.tribunal === 'TCU') return false;
  return true;
}

export function shouldIncludeDocumentTcuBranch(
  filters: JurisprudenciaFilters
): boolean {
  if (filters.tribunal && filters.tribunal !== 'TCU') return false;
  if (
    filters.decisionType &&
    filters.decisionType !== 'acordao'
  )
    return false;
  return true;
}
```

- [ ] **Step 2.4: Rodar testes para verificar que passam**

Run: `npx vitest run lib/jurisprudencia/__tests__/unified-query.test.ts`
Expected: PASS (todos os testes incluindo os novos short-circuit).

- [ ] **Step 2.5: Commit**

```bash
git add lib/jurisprudencia/unified-query.ts lib/jurisprudencia/__tests__/unified-query.test.ts
git commit -m "feat(jurisprudencia): short-circuit helpers por filtro"
```

---

## Task 3: Builder do WHERE SQL por ramo

**Files:**
- Modify: `lib/jurisprudencia/unified-query.ts`
- Modify: `lib/jurisprudencia/__tests__/unified-query.test.ts`

**Contexto:** Cada ramo precisa da sua cláusula `WHERE` parametrizada. Usamos `Prisma.sql` e `Prisma.join` para composição segura — **nunca** interpolação de string. Cada filtro vira um fragmento condicional; no final, `Prisma.join(fragments, ' AND ')`.

O output desses builders é objeto `Prisma.Sql` que pode ser inspecionado no teste via `.sql` e `.values`.

- [ ] **Step 3.1: Adicionar testes do builder do ramo A**

Edit: `lib/jurisprudencia/__tests__/unified-query.test.ts` — adicionar ao import:

```ts
import {
  buildTribunalDecisionWhere,
  buildDocumentTcuWhere,
} from '../unified-query';
```

E novo `describe`:

```ts
describe('buildTribunalDecisionWhere', () => {
  it('inclui condição base sem filtros', () => {
    const where = buildTribunalDecisionWhere({});
    const sql = where.sql;
    expect(sql).toMatch(/"isRelevant"\s*=\s*\$\d+/);
    expect(sql).toMatch(/"approvalStatus"\s+IN/);
    expect(where.values).toEqual(
      expect.arrayContaining([true, 'auto_approved', 'manually_approved'])
    );
  });

  it('adiciona filtro de tribunal', () => {
    const where = buildTribunalDecisionWhere({ tribunal: 'TCE-SP' });
    expect(where.sql).toMatch(/"tribunalCode"\s*=\s*\$/);
    expect(where.values).toContain('TCE-SP');
  });

  it('adiciona filtro de ano', () => {
    const where = buildTribunalDecisionWhere({ ano: 2024 });
    expect(where.sql).toMatch(/year\s*=\s*\$/);
    expect(where.values).toContain(2024);
  });

  it('adiciona filtro de busca textual q em title OR ementa', () => {
    const where = buildTribunalDecisionWhere({ q: 'pregão' });
    expect(where.sql).toMatch(/title ILIKE/);
    expect(where.sql).toMatch(/ementa ILIKE/);
    expect(where.values).toContain('%pregão%');
  });
});

describe('buildDocumentTcuWhere', () => {
  it('inclui condição base sem filtros', () => {
    const where = buildDocumentTcuWhere({});
    expect(where.sql).toMatch(/category\s*=\s*\$/);
    expect(where.sql).toMatch(/"tcuNumeroAcordao"\s+IS NOT NULL/);
    expect(where.values).toContain('acordao');
  });

  it('filtro ano casa em acordaoAno OR EXTRACT(YEAR FROM tcuDataJulgamento)', () => {
    const where = buildDocumentTcuWhere({ ano: 2024 });
    expect(where.sql).toMatch(/"acordaoAno"\s*=\s*\$/);
    expect(where.sql).toMatch(/EXTRACT\(YEAR FROM "tcuDataJulgamento"\)/);
    // parametrizado com 2024 duas vezes (uma pra cada lado do OR)
    expect(where.values.filter(v => v === 2024)).toHaveLength(2);
  });

  it('filtro tema casa em themes, tcuArea, tcuTema, tcuSubtema', () => {
    const where = buildDocumentTcuWhere({ tema: 'pregão' });
    expect(where.sql).toMatch(/themes ILIKE/);
    expect(where.sql).toMatch(/"tcuArea" ILIKE/);
    expect(where.sql).toMatch(/"tcuTema" ILIKE/);
    expect(where.sql).toMatch(/"tcuSubtema" ILIKE/);
  });

  it('filtro relator casa em tcuRelator OR tcuAutorTese', () => {
    const where = buildDocumentTcuWhere({ relator: 'sherman' });
    expect(where.sql).toMatch(/"tcuRelator" ILIKE/);
    expect(where.sql).toMatch(/"tcuAutorTese" ILIKE/);
  });

  it('filtro q casa em title OR tcuEmentaCompleta', () => {
    const where = buildDocumentTcuWhere({ q: 'contrato' });
    expect(where.sql).toMatch(/title ILIKE/);
    expect(where.sql).toMatch(/"tcuEmentaCompleta" ILIKE/);
  });
});
```

- [ ] **Step 3.2: Rodar testes para verificar que falham**

Run: `npx vitest run lib/jurisprudencia/__tests__/unified-query.test.ts`
Expected: FAIL — `buildTribunalDecisionWhere is not a function`.

- [ ] **Step 3.3: Implementar os builders**

Edit: `lib/jurisprudencia/unified-query.ts` — adicionar `import` no topo e funções no fim:

```ts
import { Prisma } from '@prisma/client';
```

E no fim do arquivo:

```ts
/**
 * WHERE de TribunalDecision.
 * - Sempre aplica `isRelevant=true AND approvalStatus IN (...)`
 * - Filtros dinâmicos são adicionados apenas quando presentes
 */
export function buildTribunalDecisionWhere(
  filters: JurisprudenciaFilters
): Prisma.Sql {
  const fragments: Prisma.Sql[] = [
    Prisma.sql`"isRelevant" = ${true}`,
    Prisma.sql`"approvalStatus" IN (${Prisma.join([
      'auto_approved',
      'manually_approved',
    ])})`,
  ];

  if (filters.tribunal) {
    fragments.push(Prisma.sql`"tribunalCode" = ${filters.tribunal}`);
  }
  if (typeof filters.ano === 'number') {
    fragments.push(Prisma.sql`year = ${filters.ano}`);
  }
  if (filters.tema) {
    fragments.push(
      Prisma.sql`themes ILIKE ${'%' + filters.tema + '%'}`
    );
  }
  if (filters.artigo) {
    fragments.push(
      Prisma.sql`"leiArticles" ILIKE ${'%' + filters.artigo + '%'}`
    );
  }
  if (filters.decisionType) {
    fragments.push(
      Prisma.sql`"decisionType" = ${filters.decisionType}`
    );
  }
  if (filters.relator) {
    fragments.push(
      Prisma.sql`relator ILIKE ${'%' + filters.relator + '%'}`
    );
  }
  if (filters.orgao) {
    fragments.push(
      Prisma.sql`"orgaoJulgador" ILIKE ${'%' + filters.orgao + '%'}`
    );
  }
  if (filters.dataFrom) {
    fragments.push(Prisma.sql`"dataJulgamento" >= ${filters.dataFrom}`);
  }
  if (filters.dataTo) {
    fragments.push(Prisma.sql`"dataJulgamento" <= ${filters.dataTo}`);
  }
  if (filters.q) {
    const term = '%' + filters.q + '%';
    fragments.push(
      Prisma.sql`(title ILIKE ${term} OR ementa ILIKE ${term})`
    );
  }

  return Prisma.join(fragments, ' AND ');
}

/**
 * WHERE de Document TCU.
 * - Sempre aplica `category='acordao' AND tcuNumeroAcordao IS NOT NULL`
 * - Filtros mapeiam para campos tcu* quando necessário
 */
export function buildDocumentTcuWhere(
  filters: JurisprudenciaFilters
): Prisma.Sql {
  const fragments: Prisma.Sql[] = [
    Prisma.sql`category = ${'acordao'}`,
    Prisma.sql`"tcuNumeroAcordao" IS NOT NULL`,
  ];

  if (typeof filters.ano === 'number') {
    fragments.push(
      Prisma.sql`("acordaoAno" = ${filters.ano} OR EXTRACT(YEAR FROM "tcuDataJulgamento")::int = ${filters.ano})`
    );
  }
  if (filters.tema) {
    const term = '%' + filters.tema + '%';
    fragments.push(
      Prisma.sql`(themes ILIKE ${term} OR "tcuArea" ILIKE ${term} OR "tcuTema" ILIKE ${term} OR "tcuSubtema" ILIKE ${term})`
    );
  }
  if (filters.artigo) {
    fragments.push(
      Prisma.sql`"leiArticles" ILIKE ${'%' + filters.artigo + '%'}`
    );
  }
  if (filters.relator) {
    const term = '%' + filters.relator + '%';
    fragments.push(
      Prisma.sql`("tcuRelator" ILIKE ${term} OR "tcuAutorTese" ILIKE ${term})`
    );
  }
  if (filters.orgao) {
    fragments.push(
      Prisma.sql`"tcuOrgaoJulgador" ILIKE ${'%' + filters.orgao + '%'}`
    );
  }
  if (filters.dataFrom) {
    fragments.push(
      Prisma.sql`"tcuDataJulgamento" >= ${filters.dataFrom}`
    );
  }
  if (filters.dataTo) {
    fragments.push(
      Prisma.sql`"tcuDataJulgamento" <= ${filters.dataTo}`
    );
  }
  if (filters.q) {
    const term = '%' + filters.q + '%';
    fragments.push(
      Prisma.sql`(title ILIKE ${term} OR "tcuEmentaCompleta" ILIKE ${term})`
    );
  }

  return Prisma.join(fragments, ' AND ');
}
```

- [ ] **Step 3.4: Rodar testes para verificar que passam**

Run: `npx vitest run lib/jurisprudencia/__tests__/unified-query.test.ts`
Expected: PASS (todos, incluindo os novos do builder).

- [ ] **Step 3.5: Commit**

```bash
git add lib/jurisprudencia/unified-query.ts lib/jurisprudencia/__tests__/unified-query.test.ts
git commit -m "feat(jurisprudencia): builders de WHERE SQL por ramo (Prisma.sql)"
```

---

## Task 4: Funções fetch* (listagem, topK, byId, count)

**Files:**
- Modify: `lib/jurisprudencia/unified-query.ts`
- Modify: `lib/jurisprudencia/__tests__/unified-query.test.ts`

**Contexto:** As funções que efetivamente chamam o banco — montam a query unificada combinando os builders, aplicam short-circuit, e retornam `UnifiedDecision[]`. Os testes mockam `prisma.$queryRaw` / `prisma.$queryRawUnsafe` e afirmam o que foi passado + o shape do retorno.

A arquitetura da query final:

```sql
(SELECT ... FROM "TribunalDecision" WHERE <where-A>)
UNION ALL
(SELECT ... FROM "Document" WHERE <where-B>)
ORDER BY ... LIMIT ... OFFSET ...
```

Quando um ramo é pulado, sua sub-SELECT é omitida. Se ambos são pulados, retorna array vazio sem hit no banco.

- [ ] **Step 4.1: Adicionar mock de prisma no arquivo de testes**

Edit: `lib/jurisprudencia/__tests__/unified-query.test.ts` — adicionar no topo (após imports, antes dos `describe`s):

```ts
import { vi, beforeEach } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: any[]) => mockQueryRaw(...args),
  },
}));

beforeEach(() => {
  mockQueryRaw.mockReset();
});
```

- [ ] **Step 4.2: Adicionar testes de `fetchUnifiedList`**

Edit: mesmo arquivo, novo `describe` no fim:

```ts
describe('fetchUnifiedList', () => {
  it('retorna lista vazia sem chamar o banco quando ambos os ramos estão excluídos', async () => {
    const { fetchUnifiedList } = await import('../unified-query');
    const result = await fetchUnifiedList(
      { tribunal: 'TCU', decisionType: 'sumula' },
      { page: 1, pageSize: 10 }
    );
    expect(result).toEqual({ items: [], total: 0 });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('chama $queryRaw duas vezes (items + count) quando há ramos ativos', async () => {
    const { fetchUnifiedList } = await import('../unified-query');
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          id: 'td-1',
          tribunalCode: 'TCE-SP',
          tribunalName: 'Tribunal de Contas do Estado de São Paulo',
          decisionType: 'acordao',
          decisionNumber: '1234/2024',
          title: 'Acórdão TCE-SP',
          ementa: 'ementa',
          fullText: null,
          summary: null,
          relator: 'Rel.',
          orgaoJulgador: 'Pleno',
          dataJulgamento: new Date('2024-05-01'),
          dataPublicacao: null,
          themes: null,
          leiArticles: null,
          url: null,
          pdfUrl: null,
          isRelevant: true,
          relevanceScore: 50,
          approvalStatus: 'auto_approved',
          year: 2024,
          processNumber: null,
          fullIdentifier: 'TCE-SP Acórdão 1234/2024',
          sourceType: 'tribunal-decision',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }]);

    const result = await fetchUnifiedList({}, { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 4.3: Rodar testes para verificar que falham**

Run: `npx vitest run lib/jurisprudencia/__tests__/unified-query.test.ts`
Expected: FAIL — `fetchUnifiedList is not exported`.

- [ ] **Step 4.4: Implementar as funções fetch e o composer de SQL**

Edit: `lib/jurisprudencia/unified-query.ts` — adicionar `import` de `prisma` e as funções no fim:

```ts
import { prisma } from '@/lib/prisma';
```

E ao final do arquivo:

```ts
// ──────────────────────────────────────────────────────────────────────────
// Composição da query UNION ALL
// ──────────────────────────────────────────────────────────────────────────

/**
 * SELECT normalizado do ramo A (TribunalDecision) — alinha com UnifiedDecision.
 */
function tribunalDecisionSelect(where: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT
      id,
      "tribunalCode",
      "tribunalName",
      "decisionType",
      "decisionNumber",
      title,
      ementa,
      "fullText",
      summary,
      relator,
      "orgaoJulgador",
      "dataJulgamento",
      "dataPublicacao",
      themes,
      "leiArticles",
      url,
      "pdfUrl",
      "isRelevant",
      "relevanceScore",
      "approvalStatus",
      year,
      "processNumber",
      "fullIdentifier",
      'tribunal-decision' AS "sourceType",
      "createdAt",
      "updatedAt"
    FROM "TribunalDecision"
    WHERE ${where}
  `;
}

/**
 * SELECT normalizado do ramo B (Document TCU) — mesmos campos do ramo A,
 * derivando a partir dos campos tcu*.
 */
function documentTcuSelect(where: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT
      id,
      'TCU' AS "tribunalCode",
      'Tribunal de Contas da União' AS "tribunalName",
      'acordao' AS "decisionType",
      COALESCE("tcuNumeroAcordao", title) AS "decisionNumber",
      title,
      COALESCE("tcuEmentaCompleta", description, content, '') AS ementa,
      COALESCE("tcuTextoCompleto", content) AS "fullText",
      summary,
      COALESCE("tcuRelator", "tcuAutorTese") AS relator,
      "tcuOrgaoJulgador" AS "orgaoJulgador",
      "tcuDataJulgamento" AS "dataJulgamento",
      "douData" AS "dataPublicacao",
      CASE
        WHEN themes IS NOT NULL THEN themes
        WHEN "tcuArea" IS NOT NULL OR "tcuTema" IS NOT NULL OR "tcuSubtema" IS NOT NULL THEN
          to_jsonb(ARRAY_REMOVE(ARRAY["tcuArea", "tcuTema", "tcuSubtema"], NULL))::text
        ELSE NULL
      END AS themes,
      "leiArticles",
      url,
      "tcuLinkPDF" AS "pdfUrl",
      TRUE AS "isRelevant",
      0 AS "relevanceScore",
      'manually_approved' AS "approvalStatus",
      COALESCE("acordaoAno", EXTRACT(YEAR FROM "tcuDataJulgamento")::int) AS year,
      NULL::text AS "processNumber",
      'TCU Acórdão ' || COALESCE("tcuNumeroAcordao", title) AS "fullIdentifier",
      'document-tcu' AS "sourceType",
      "uploadedAt" AS "createdAt",
      "updatedAt"
    FROM "Document"
    WHERE ${where}
  `;
}

/**
 * Monta o corpo do UNION ALL baseado no short-circuit.
 * Retorna `null` quando ambos os ramos são excluídos.
 */
function composeUnifiedBody(
  filters: JurisprudenciaFilters
): Prisma.Sql | null {
  const includeA = shouldIncludeTribunalDecisionBranch(filters);
  const includeB = shouldIncludeDocumentTcuBranch(filters);

  if (!includeA && !includeB) return null;

  if (includeA && includeB) {
    return Prisma.sql`
      (${tribunalDecisionSelect(buildTribunalDecisionWhere(filters))})
      UNION ALL
      (${documentTcuSelect(buildDocumentTcuWhere(filters))})
    `;
  }
  if (includeA) {
    return tribunalDecisionSelect(buildTribunalDecisionWhere(filters));
  }
  // includeB only
  return documentTcuSelect(buildDocumentTcuWhere(filters));
}

// ──────────────────────────────────────────────────────────────────────────
// Funções fetch públicas
// ──────────────────────────────────────────────────────────────────────────

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface UnifiedListResult {
  items: UnifiedDecision[];
  total: number;
}

export async function fetchUnifiedList(
  filters: JurisprudenciaFilters,
  { page, pageSize }: PaginationOptions
): Promise<UnifiedListResult> {
  const body = composeUnifiedBody(filters);
  if (!body) return { items: [], total: 0 };

  const offset = (page - 1) * pageSize;

  const itemsSql = Prisma.sql`
    SELECT * FROM (${body}) unified
    ORDER BY "dataJulgamento" DESC NULLS LAST, id ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  const countSql = Prisma.sql`
    SELECT COUNT(*)::int AS total FROM (${body}) sub
  `;

  const [items, countRows] = await Promise.all([
    prisma.$queryRaw<UnifiedDecision[]>(itemsSql),
    prisma.$queryRaw<Array<{ total: number }>>(countSql),
  ]);

  return { items, total: countRows[0]?.total ?? 0 };
}

export async function fetchUnifiedTopK(
  filters: JurisprudenciaFilters,
  topK: number
): Promise<UnifiedDecision[]> {
  const body = composeUnifiedBody(filters);
  if (!body) return [];

  const sql = Prisma.sql`
    SELECT * FROM (${body}) unified
    ORDER BY "relevanceScore" DESC NULLS LAST, "dataJulgamento" DESC NULLS LAST
    LIMIT ${topK}
  `;

  return prisma.$queryRaw<UnifiedDecision[]>(sql);
}

export async function fetchUnifiedById(
  id: string
): Promise<UnifiedDecision | null> {
  // Tenta ramo A primeiro (filtros equivalentes ao default)
  const tribA = await prisma.$queryRaw<UnifiedDecision[]>(Prisma.sql`
    SELECT * FROM (${tribunalDecisionSelect(
      buildTribunalDecisionWhere({})
    )}) unified
    WHERE id = ${id}
    LIMIT 1
  `);
  if (tribA.length > 0) return tribA[0];

  const tribB = await prisma.$queryRaw<UnifiedDecision[]>(Prisma.sql`
    SELECT * FROM (${documentTcuSelect(
      buildDocumentTcuWhere({})
    )}) unified
    WHERE id = ${id}
    LIMIT 1
  `);
  if (tribB.length > 0) return tribB[0];

  return null;
}

export async function countUnifiedApproved(): Promise<number> {
  const body = composeUnifiedBody({});
  if (!body) return 0;
  const rows = await prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS total FROM (${body}) sub
  `);
  return rows[0]?.total ?? 0;
}
```

- [ ] **Step 4.5: Rodar testes para verificar que passam**

Run: `npx vitest run lib/jurisprudencia/__tests__/unified-query.test.ts`
Expected: PASS (todos).

- [ ] **Step 4.6: Adicionar testes de `fetchUnifiedTopK`, `fetchUnifiedById`, `countUnifiedApproved`**

Edit: `lib/jurisprudencia/__tests__/unified-query.test.ts` — adicionar mais `describe`s:

```ts
describe('fetchUnifiedTopK', () => {
  it('retorna [] sem chamar o banco quando ambos os ramos estão excluídos', async () => {
    const { fetchUnifiedTopK } = await import('../unified-query');
    const result = await fetchUnifiedTopK(
      { tribunal: 'TCU', decisionType: 'sumula' },
      5
    );
    expect(result).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('chama $queryRaw uma vez com LIMIT topK', async () => {
    const { fetchUnifiedTopK } = await import('../unified-query');
    mockQueryRaw.mockResolvedValueOnce([]);
    await fetchUnifiedTopK({}, 3);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    const callArg = mockQueryRaw.mock.calls[0][0];
    expect(callArg.sql).toMatch(/LIMIT \$\d+/);
    expect(callArg.values).toContain(3);
  });
});

describe('fetchUnifiedById', () => {
  it('tenta ramo A, retorna match se encontrar', async () => {
    const { fetchUnifiedById } = await import('../unified-query');
    mockQueryRaw.mockResolvedValueOnce([
      { id: 'td-1', sourceType: 'tribunal-decision' },
    ]);
    const result = await fetchUnifiedById('td-1');
    expect(result).toMatchObject({ id: 'td-1', sourceType: 'tribunal-decision' });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('tenta ramo B quando A não encontra', async () => {
    const { fetchUnifiedById } = await import('../unified-query');
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'doc-1', sourceType: 'document-tcu' },
      ]);
    const result = await fetchUnifiedById('doc-1');
    expect(result).toMatchObject({ id: 'doc-1', sourceType: 'document-tcu' });
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });

  it('retorna null quando nenhum ramo encontra', async () => {
    const { fetchUnifiedById } = await import('../unified-query');
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await fetchUnifiedById('inexistente');
    expect(result).toBeNull();
  });
});

describe('countUnifiedApproved', () => {
  it('retorna a soma das duas tabelas', async () => {
    const { countUnifiedApproved } = await import('../unified-query');
    mockQueryRaw.mockResolvedValueOnce([{ total: 424 }]);
    const total = await countUnifiedApproved();
    expect(total).toBe(424);
  });
});
```

- [ ] **Step 4.7: Rodar testes para verificar que passam**

Run: `npx vitest run lib/jurisprudencia/__tests__/unified-query.test.ts`
Expected: PASS (todos).

- [ ] **Step 4.8: Commit**

```bash
git add lib/jurisprudencia/unified-query.ts lib/jurisprudencia/__tests__/unified-query.test.ts
git commit -m "feat(jurisprudencia): fetchUnifiedList/TopK/ById + countUnifiedApproved"
```

---

## Task 5: Atualizar `/api/jurisprudencia/route.ts` (listagem)

**Files:**
- Modify: `app/api/jurisprudencia/route.ts`
- Create: `app/api/jurisprudencia/__tests__/route.test.ts`

**Contexto:** Refatora a rota para usar `fetchUnifiedList`. Mantém o contrato público (query string → response shape). Adiciona validação Zod dos filtros (pra recusar `tribunal` ou `decisionType` fora das listas permitidas, que com SQL raw seriam silenciosamente ignorados).

- [ ] **Step 5.1: Criar teste integration da rota**

Create: `app/api/jurisprudencia/__tests__/route.test.ts`

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetchUnifiedList } = vi.hoisted(() => ({
  mockFetchUnifiedList: vi.fn(),
}));

vi.mock('@/lib/jurisprudencia/unified-query', () => ({
  fetchUnifiedList: (...args: any[]) => mockFetchUnifiedList(...args),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '@/app/api/jurisprudencia/route';

function makeReq(qs: string): Request {
  return new Request(`http://localhost/api/jurisprudencia?${qs}`, {
    method: 'GET',
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

beforeEach(() => {
  mockFetchUnifiedList.mockReset();
});

describe('GET /api/jurisprudencia', () => {
  it('chama fetchUnifiedList com filtros parseados e paginação default', async () => {
    mockFetchUnifiedList.mockResolvedValueOnce({ items: [], total: 0 });

    const res = await GET(makeReq('tribunal=TCU&ano=2024&tema=pregão'));
    expect(res.status).toBe(200);

    expect(mockFetchUnifiedList).toHaveBeenCalledWith(
      expect.objectContaining({
        tribunal: 'TCU',
        ano: 2024,
        tema: 'pregão',
      }),
      { page: 1, pageSize: 10 }
    );
  });

  it('retorna o shape esperado (items, total, page, pageSize, totalPages)', async () => {
    mockFetchUnifiedList.mockResolvedValueOnce({
      items: [
        {
          id: 'x',
          tribunalCode: 'TCU',
          tribunalName: 'TCU',
          decisionType: 'acordao',
          decisionNumber: 'AC-1',
          title: 'T',
          ementa: 'e',
          summary: null,
          relator: null,
          orgaoJulgador: null,
          dataJulgamento: null,
          themes: null,
          leiArticles: null,
          url: null,
        },
      ],
      total: 25,
    });

    const res = await GET(makeReq('pageSize=10&page=2'));
    const body = await readJson(res);

    expect(body).toMatchObject({
      total: 25,
      page: 2,
      pageSize: 10,
      totalPages: 3,
    });
    expect(body.items).toHaveLength(1);
  });

  it('trunca ementas longas a 300 caracteres com "..."', async () => {
    const longEmenta = 'a'.repeat(500);
    mockFetchUnifiedList.mockResolvedValueOnce({
      items: [
        {
          id: 'x',
          tribunalCode: 'TCE-SP',
          tribunalName: 'TCE-SP',
          decisionType: 'acordao',
          decisionNumber: '1',
          title: 'T',
          ementa: longEmenta,
          summary: null,
          relator: null,
          orgaoJulgador: null,
          dataJulgamento: null,
          themes: null,
          leiArticles: null,
          url: null,
        },
      ],
      total: 1,
    });

    const res = await GET(makeReq(''));
    const body = await readJson(res);
    expect(body.items[0].ementa).toHaveLength(303);
    expect(body.items[0].ementa.endsWith('...')).toBe(true);
  });

  it('rejeita tribunal desconhecido com 400', async () => {
    const res = await GET(makeReq('tribunal=INVALIDO'));
    expect(res.status).toBe(400);
  });

  it('rejeita decisionType desconhecido com 400', async () => {
    const res = await GET(makeReq('decisionType=bogus'));
    expect(res.status).toBe(400);
  });

  it('clampa pageSize no máximo 50', async () => {
    mockFetchUnifiedList.mockResolvedValueOnce({ items: [], total: 0 });
    await GET(makeReq('pageSize=500'));
    expect(mockFetchUnifiedList).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ pageSize: 50 })
    );
  });
});
```

- [ ] **Step 5.2: Rodar teste para verificar que falha**

Run: `npx vitest run app/api/jurisprudencia/__tests__/route.test.ts`
Expected: FAIL — módulo `unified-query` não é usado pela rota ainda.

- [ ] **Step 5.3: Substituir o conteúdo da rota de listagem**

Edit: `app/api/jurisprudencia/route.ts` — substituir arquivo inteiro:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  fetchUnifiedList,
  type JurisprudenciaFilters,
} from '@/lib/jurisprudencia/unified-query';
import { handleApiError } from '@/lib/errors/error-handler';
import { apiLogger } from '@/lib/logger';

const TRIBUNAL_CODES = [
  'TCU',
  'TCE-SP',
  'TCE-PR',
  'TCE-MG',
  'TCE-RS',
  'TCE-SC',
  'TCE-RJ',
  'TCE-PE',
  'STJ',
  'STF',
] as const;

const DECISION_TYPES = [
  'acordao',
  'decisao',
  'parecer_previo',
  'sumula',
] as const;

const querySchema = z.object({
  tribunal: z.enum(TRIBUNAL_CODES).optional(),
  ano: z.coerce.number().int().min(1900).max(2100).optional(),
  tema: z.string().min(1).max(200).optional(),
  artigo: z.string().min(1).max(50).optional(),
  decisionType: z.enum(DECISION_TYPES).optional(),
  relator: z.string().min(1).max(200).optional(),
  orgao: z.string().min(1).max(200).optional(),
  dataFrom: z.coerce.date().optional(),
  dataTo: z.coerce.date().optional(),
  q: z.string().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = querySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, pageSize, ...filters } = parsed.data;
    const jurisFilters: JurisprudenciaFilters = filters;

    const { items, total } = await fetchUnifiedList(jurisFilters, {
      page,
      pageSize,
    });

    const formatted = items.map(item => ({
      id: item.id,
      tribunalCode: item.tribunalCode,
      tribunalName: item.tribunalName,
      decisionType: item.decisionType,
      decisionNumber: item.decisionNumber,
      title: item.title,
      ementa: truncate(item.ementa, 300),
      summary: item.summary,
      relator: item.relator,
      orgaoJulgador: item.orgaoJulgador,
      dataJulgamento: item.dataJulgamento,
      themes: item.themes,
      leiArticles: item.leiArticles,
      url: item.url,
      sourceType: item.sourceType,
    }));

    apiLogger.info(
      {
        total,
        page,
        pageSize,
        filters: jurisFilters,
      },
      'jurisprudencia/list answered'
    );

    return NextResponse.json({
      items: formatted,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 5.4: Rodar teste para verificar que passa**

Run: `npx vitest run app/api/jurisprudencia/__tests__/route.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5.5: Rodar o suite completo para garantir não-regressão**

Run: `npx vitest run lib/jurisprudencia app/api/jurisprudencia`
Expected: PASS em todos os testes dos módulos tocados.

- [ ] **Step 5.6: Commit**

```bash
git add app/api/jurisprudencia/route.ts app/api/jurisprudencia/__tests__/route.test.ts
git commit -m "feat(jurisprudencia): rota de listagem usa UNION ALL (TribunalDecision + Document TCU)"
```

---

## Task 6: Atualizar `/api/jurisprudencia/[id]/route.ts` (detalhe)

**Files:**
- Modify: `app/api/jurisprudencia/[id]/route.ts`
- Create: `app/api/jurisprudencia/__tests__/detail.test.ts`

**Contexto:** Rota de detalhe passa a aceitar IDs de ambas as origens. Usa `fetchUnifiedById`. Mantém erro 404 via `NotFoundError`.

- [ ] **Step 6.1: Criar teste integration do detalhe**

Create: `app/api/jurisprudencia/__tests__/detail.test.ts`

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetchUnifiedById } = vi.hoisted(() => ({
  mockFetchUnifiedById: vi.fn(),
}));

vi.mock('@/lib/jurisprudencia/unified-query', () => ({
  fetchUnifiedById: (...args: any[]) => mockFetchUnifiedById(...args),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '@/app/api/jurisprudencia/[id]/route';

function makeReq(): Request {
  return new Request('http://localhost/api/jurisprudencia/anything', {
    method: 'GET',
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

beforeEach(() => {
  mockFetchUnifiedById.mockReset();
});

describe('GET /api/jurisprudencia/[id]', () => {
  it('retorna 200 com o decision quando encontrado', async () => {
    mockFetchUnifiedById.mockResolvedValueOnce({
      id: 'abc',
      tribunalCode: 'TCU',
      sourceType: 'document-tcu',
    });

    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.id).toBe('abc');
    expect(body.tribunalCode).toBe('TCU');
  });

  it('retorna 404 quando não encontrado', async () => {
    mockFetchUnifiedById.mockResolvedValueOnce(null);
    const res = await GET(makeReq(), {
      params: Promise.resolve({ id: 'inexistente' }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 6.2: Rodar teste para verificar que falha**

Run: `npx vitest run app/api/jurisprudencia/__tests__/detail.test.ts`
Expected: FAIL — rota ainda usa `prisma.tribunalDecision`.

- [ ] **Step 6.3: Substituir a rota de detalhe**

Edit: `app/api/jurisprudencia/[id]/route.ts` — substituir arquivo inteiro:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchUnifiedById } from '@/lib/jurisprudencia/unified-query';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';

/**
 * GET /api/jurisprudencia/[id]
 * Detalhes de uma decisão — aceita IDs de TribunalDecision e de Document TCU.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const decision = await fetchUnifiedById(id);

    if (!decision) {
      throw new NotFoundError('Decisão não encontrada');
    }

    return NextResponse.json(decision);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 6.4: Rodar teste para verificar que passa**

Run: `npx vitest run app/api/jurisprudencia/__tests__/detail.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6.5: Commit**

```bash
git add app/api/jurisprudencia/[id]/route.ts app/api/jurisprudencia/__tests__/detail.test.ts
git commit -m "feat(jurisprudencia): rota de detalhe aceita IDs de TribunalDecision e Document TCU"
```

---

## Task 7: Atualizar `/api/jurisprudencia/query/route.ts` (IA)

**Files:**
- Modify: `app/api/jurisprudencia/query/route.ts`
- Create: `app/api/jurisprudencia/__tests__/query.test.ts`

**Contexto:** Rota IA. Substitui `prisma.tribunalDecision.findMany` por `fetchUnifiedTopK`, e o `count` de fallback por `countUnifiedApproved`. Gemini fica mockado no teste — só verificamos que: (a) `fetchUnifiedTopK` é chamado com os filtros certos; (b) `sources` sai correto no payload; (c) fallback "base vazia" vs "filtros restritivos" funciona.

- [ ] **Step 7.1: Criar teste integration da rota IA**

Create: `app/api/jurisprudencia/__tests__/query.test.ts`

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockFetchUnifiedTopK,
  mockCountUnifiedApproved,
  mockQueryGeminiText,
} = vi.hoisted(() => ({
  mockFetchUnifiedTopK: vi.fn(),
  mockCountUnifiedApproved: vi.fn(),
  mockQueryGeminiText: vi.fn(),
}));

vi.mock('@/lib/jurisprudencia/unified-query', () => ({
  fetchUnifiedTopK: (...args: any[]) => mockFetchUnifiedTopK(...args),
  countUnifiedApproved: (...args: any[]) => mockCountUnifiedApproved(...args),
}));

vi.mock('@/lib/gemini/cached-client', () => ({
  queryGeminiText: (...args: any[]) => mockQueryGeminiText(...args),
}));

vi.mock('@/lib/api-middleware', () => ({
  withAuth: (handler: any) => (req: any, ctx?: any) =>
    handler(req, {
      ...ctx,
      user: { userId: 'u1', email: 'u@x.com', role: 'student' },
    }),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

process.env.GEMINI_API_KEY = 'test-key';

import { POST } from '@/app/api/jurisprudencia/query/route';

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/jurisprudencia/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

beforeEach(() => {
  mockFetchUnifiedTopK.mockReset();
  mockCountUnifiedApproved.mockReset();
  mockQueryGeminiText.mockReset();
});

describe('POST /api/jurisprudencia/query', () => {
  it('chama fetchUnifiedTopK com os filtros do body', async () => {
    mockFetchUnifiedTopK.mockResolvedValueOnce([
      {
        id: 'doc-1',
        tribunalCode: 'TCU',
        tribunalName: 'Tribunal de Contas da União',
        decisionType: 'acordao',
        decisionNumber: 'AC-1/24',
        title: 'Acórdão TCU',
        ementa: 'e',
        summary: null,
        relator: null,
        orgaoJulgador: null,
        dataJulgamento: null,
        themes: null,
        leiArticles: null,
        url: null,
      },
    ]);
    mockQueryGeminiText.mockResolvedValueOnce({
      response: 'resposta sintetizada',
      cached: false,
      latency: 123,
    });

    const res = await POST(
      makeReq({
        query: 'sobre pregão',
        filters: { tribunal: 'TCU' },
      })
    );

    expect(res.status).toBe(200);
    expect(mockFetchUnifiedTopK).toHaveBeenCalledWith(
      expect.objectContaining({ tribunal: 'TCU' }),
      expect.any(Number)
    );

    const body = await readJson(res);
    expect(body.answer).toBe('resposta sintetizada');
    expect(body.consulted).toBe(1);
    expect(body.sources[0].tribunalCode).toBe('TCU');
  });

  it('retorna mensagem de base vazia quando countUnifiedApproved=0', async () => {
    mockFetchUnifiedTopK.mockResolvedValueOnce([]);
    mockCountUnifiedApproved.mockResolvedValueOnce(0);

    const res = await POST(makeReq({ query: 'qualquer coisa' }));
    const body = await readJson(res);

    expect(body.sources).toEqual([]);
    expect(body.consulted).toBe(0);
    expect(body.totalInDatabase).toBe(0);
    expect(body.answer).toMatch(/ainda não foi populada/);
  });

  it('retorna mensagem de filtros restritivos quando topK=[] mas count>0', async () => {
    mockFetchUnifiedTopK.mockResolvedValueOnce([]);
    mockCountUnifiedApproved.mockResolvedValueOnce(500);

    const res = await POST(makeReq({ query: 'qualquer coisa' }));
    const body = await readJson(res);

    expect(body.totalInDatabase).toBe(500);
    expect(body.answer).toMatch(/afrouxar os filtros/);
  });

  it('mantém fallback quando Gemini lança erro (retorna sources sem answer)', async () => {
    mockFetchUnifiedTopK.mockResolvedValueOnce([
      {
        id: 'td-1',
        tribunalCode: 'TCE-SP',
        tribunalName: 'TCE-SP',
        decisionType: 'acordao',
        decisionNumber: '1/24',
        title: 'T',
        ementa: 'e',
        summary: null,
        relator: null,
        orgaoJulgador: null,
        dataJulgamento: null,
        themes: null,
        leiArticles: null,
        url: null,
      },
    ]);
    mockQueryGeminiText.mockRejectedValueOnce(new Error('gemini down'));

    const res = await POST(makeReq({ query: 'pergunta' }));
    const body = await readJson(res);

    expect(body.sources).toHaveLength(1);
    expect(body.answer).toMatch(/Não consegui gerar uma síntese/);
  });
});
```

- [ ] **Step 7.2: Rodar teste para verificar que falha**

Run: `npx vitest run app/api/jurisprudencia/__tests__/query.test.ts`
Expected: FAIL — rota ainda usa `prisma.tribunalDecision.findMany`.

- [ ] **Step 7.3: Substituir a rota IA**

Edit: `app/api/jurisprudencia/query/route.ts` — substituir arquivo inteiro:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import {
  fetchUnifiedTopK,
  countUnifiedApproved,
  type JurisprudenciaFilters,
  type UnifiedDecision,
} from '@/lib/jurisprudencia/unified-query';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { handleApiError } from '@/lib/errors/error-handler';
import { apiLogger } from '@/lib/logger';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TRIBUNAL_CODES = [
  'TCU',
  'TCE-SP',
  'TCE-PR',
  'TCE-MG',
  'TCE-RS',
  'TCE-SC',
  'TCE-RJ',
  'TCE-PE',
  'STJ',
  'STF',
] as const;

const DECISION_TYPES = [
  'acordao',
  'decisao',
  'parecer_previo',
  'sumula',
] as const;

const filtersSchema = z
  .object({
    tribunal: z.enum(TRIBUNAL_CODES).optional(),
    year: z.number().int().optional(),
    theme: z.string().optional(),
    leiArticle: z.string().optional(),
    decisionType: z.enum(DECISION_TYPES).optional(),
    relator: z.string().optional(),
    orgao: z.string().optional(),
    dataFrom: z.string().optional(),
    dataTo: z.string().optional(),
    q: z.string().optional(),
  })
  .optional();

const bodySchema = z.object({
  query: z.string().min(3).max(500),
  filters: filtersSchema,
  topK: z.number().int().min(1).max(20).optional(),
});

const MAX_EMENTA_CHARS = 800;
const DEFAULT_TOP_K = 6;

type Filters = z.infer<typeof filtersSchema>;

function toJurisprudenciaFilters(filters: Filters): JurisprudenciaFilters {
  if (!filters) return {};
  return {
    tribunal: filters.tribunal,
    ano: filters.year,
    tema: filters.theme,
    artigo: filters.leiArticle,
    decisionType: filters.decisionType,
    relator: filters.relator,
    orgao: filters.orgao,
    dataFrom: filters.dataFrom ? new Date(filters.dataFrom) : undefined,
    dataTo: filters.dataTo ? new Date(filters.dataTo) : undefined,
    q: filters.q,
  };
}

function truncate(value: string | null | undefined, limit: number): string {
  if (!value) return '';
  return value.length > limit ? value.slice(0, limit) + '...' : value;
}

function buildPrompt(question: string, decisions: UnifiedDecision[]): string {
  const header = `Você é um assistente jurídico especializado em licitações, contratos públicos e Lei 14.133/2021. Responda à pergunta do aluno exclusivamente com base nos trechos de decisões de tribunais fornecidos abaixo. Cite as decisões pelo identificador (ex.: [TCE-SP Acórdão 1234/2024]). Se os trechos não forem suficientes, diga isso com clareza e sugira ajustar os filtros.`;

  const blocks = decisions
    .map((d, idx) => {
      const id = `${d.tribunalCode} ${d.decisionType} ${d.decisionNumber}`;
      const dateStr = d.dataJulgamento
        ? new Date(d.dataJulgamento).toLocaleDateString('pt-BR')
        : 'data não informada';
      return `[${idx + 1}] ${id} — ${dateStr}
Título: ${d.title}
Órgão: ${d.orgaoJulgador || 'n/d'} | Relator: ${d.relator || 'n/d'}
Temas: ${d.themes || 'n/d'} | Artigos Lei 14.133: ${d.leiArticles || 'n/d'}
Ementa: ${truncate(d.ementa, MAX_EMENTA_CHARS)}
Resumo IA: ${truncate(d.summary, 600)}`;
    })
    .join('\n\n---\n\n');

  return `${header}

PERGUNTA DO ALUNO:
${question}

DECISÕES CONSULTADAS:
${blocks}

Sua resposta (em português, estruturada, com citações no formato [Tribunal Tipo Número]):`;
}

export const POST = withAuth(
  async (request: NextRequest, context?: Record<string, unknown>) => {
    try {
      const user = context?.user as { userId: string; role?: string };

      const json = await request.json();
      const parsed = bodySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Requisição inválida', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
          {
            error:
              'Serviço de IA não está configurado neste ambiente. A pesquisa com IA requer a variável GEMINI_API_KEY — peça ao administrador para provisioná-la.',
          },
          { status: 503 }
        );
      }

      const { query, filters, topK } = parsed.data;
      const limit = topK ?? DEFAULT_TOP_K;

      const jurisFilters = toJurisprudenciaFilters(filters);
      const decisions = await fetchUnifiedTopK(jurisFilters, limit);

      if (decisions.length === 0) {
        const totalInDatabase = await countUnifiedApproved();
        const msg =
          totalInDatabase === 0
            ? 'A base de jurisprudência deste ambiente ainda não foi populada. Fale com o administrador para rodar a ingestão de decisões.'
            : 'Nenhuma decisão casou com os filtros ativos. Tente afrouxar os filtros (por exemplo, limpar tribunal, ano ou texto) e perguntar novamente.';
        return NextResponse.json({
          answer: msg,
          sources: [],
          consulted: 0,
          totalInDatabase,
        });
      }

      const prompt = buildPrompt(query, decisions);

      const sourcesPayload = decisions.map(d => ({
        id: d.id,
        tribunalCode: d.tribunalCode,
        tribunalName: d.tribunalName,
        decisionType: d.decisionType,
        decisionNumber: d.decisionNumber,
        title: d.title,
        relator: d.relator,
        orgaoJulgador: d.orgaoJulgador,
        dataJulgamento: d.dataJulgamento,
        url: d.url,
        sourceType: d.sourceType,
      }));

      let answerText: string;
      let cached = false;

      try {
        const result = await queryGeminiText(prompt, {
          temperature: 0.3,
          maxOutputTokens: 1500,
          useCache: true,
          systemInstruction:
            'Você é um assistente jurídico técnico e conciso. Fundamente tudo nas decisões citadas; nunca invente números de acórdão ou relatores.',
        });

        if (!result.response || result.response.trim().length === 0) {
          throw new Error('empty-response');
        }

        answerText = result.response;
        cached = result.cached;

        const tcuCount = decisions.filter(
          d => d.sourceType === 'document-tcu'
        ).length;
        const tribunalDecisionCount = decisions.length - tcuCount;

        apiLogger.info(
          {
            userId: user.userId,
            consulted: decisions.length,
            tcuCount,
            tribunalDecisionCount,
            cached,
            latencyMs: result.latency,
          },
          'jurisprudencia/query answered'
        );
      } catch (err) {
        apiLogger.error(
          { userId: user.userId, consulted: decisions.length, err },
          'jurisprudencia/query Gemini failed — returning sources only'
        );
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : undefined;
        answerText =
          'Não consegui gerar uma síntese agora — o modelo de IA pode estar sobrecarregado, em timeout ou indisponível. Encontrei as decisões relevantes abaixo; consulte-as diretamente ou tente perguntar de novo em alguns instantes.';

        const debug = { geminiError: errMsg, stack: errStack };
        return NextResponse.json({
          answer: answerText,
          sources: sourcesPayload,
          consulted: decisions.length,
          cached: false,
          debug,
        });
      }

      return NextResponse.json({
        answer: answerText,
        sources: sourcesPayload,
        consulted: decisions.length,
        cached,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);
```

- [ ] **Step 7.4: Rodar teste para verificar que passa**

Run: `npx vitest run app/api/jurisprudencia/__tests__/query.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 7.5: Rodar TODOS os testes de jurisprudência para garantir não-regressão**

Run: `npx vitest run lib/jurisprudencia app/api/jurisprudencia`
Expected: PASS em todos.

- [ ] **Step 7.6: Commit**

```bash
git add app/api/jurisprudencia/query/route.ts app/api/jurisprudencia/__tests__/query.test.ts
git commit -m "feat(jurisprudencia): rota IA consulta base unificada (TribunalDecision + Document TCU)"
```

---

## Task 8: Índice parcial em `Document` para performance do ramo B

**Files:**
- Create: `prisma/sql/2026-04-21-document-tcu-index.sql`

**Contexto:** Como o ramo B filtra `Document` (tabela grande com vários tipos), vale um índice parcial por categoria de acórdão TCU ordenado por data. Sem esse índice, o scan cresce conforme a tabela `Document` cresce com documentos não-TCU. `CREATE INDEX CONCURRENTLY` não trava a tabela.

- [ ] **Step 8.1: Criar arquivo SQL**

Create: `prisma/sql/2026-04-21-document-tcu-index.sql`

```sql
-- Índice parcial para acelerar o ramo B do UNION ALL da jurisprudência.
-- Ver: docs/superpowers/specs/2026-04-21-integracao-tcu-jurisprudencia-design.md
--
-- Filtragem: category='acordao' AND tcuNumeroAcordao IS NOT NULL
-- Ordenação típica: tcuDataJulgamento DESC NULLS LAST

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Document_tcu_acordao_idx"
  ON "Document" ("tcuDataJulgamento" DESC NULLS LAST)
  WHERE category = 'acordao' AND "tcuNumeroAcordao" IS NOT NULL;
```

- [ ] **Step 8.2: Testar o SQL contra um database de preview/local**

Run (local ou preview, com `DATABASE_URL` apontando para um db de teste):

```bash
npx prisma db execute --file prisma/sql/2026-04-21-document-tcu-index.sql
```

Expected: comando roda sem erros. Se já houver o índice, `IF NOT EXISTS` garante idempotência.

Nota: `CREATE INDEX CONCURRENTLY` não pode rodar dentro de transação. Prisma `db execute` executa cada statement isoladamente, então é compatível. Se falhar em produção (deployment automatizado), a alternativa é abrir conexão direta via `psql` e rodar o arquivo.

- [ ] **Step 8.3: Commit**

```bash
git add prisma/sql/2026-04-21-document-tcu-index.sql
git commit -m "perf(jurisprudencia): índice parcial em Document para acórdãos TCU"
```

---

## Task 9: Validação end-to-end e rollout

**Files:** nenhum arquivo alterado — apenas verificação.

**Contexto:** Última etapa antes do merge. Roda suite completa, build, e checagem manual via UI/curl.

- [ ] **Step 9.1: Rodar suite completa de testes**

Run: `npm test -- --run`
Expected: todos os testes do projeto passam (incluindo os novos).

- [ ] **Step 9.2: Type-check e build**

Run: `npx tsc --noEmit` (ou `npm run build`)
Expected: zero erros TS.

- [ ] **Step 9.3: Iniciar dev server e testar manualmente**

Run: `npm run dev`

Testes manuais:

1. Abrir `http://localhost:3000/area-restrita/jurisprudencia` autenticado.
2. **Contagem aumentou:** "X decisão(ões) encontrada(s)" com X > 416 (antes era 416).
3. **Filtro TCU funciona:** selecionar "TCU — Tribunal de Contas da União" no dropdown → lista mostra apenas acórdãos TCU (antes mostrava zero).
4. **Filtro TCE-SP funciona:** selecionar "TCE-SP" → só TCE-SP, nenhum TCU.
5. **Sem filtro:** mistura visível — badges de cores diferentes (TCU indigo, TCE-SP verde, STJ/STF em outras cores — o cliente já tem esse mapeamento).
6. **Paginação cross-table:** avançar páginas, conferir que decisões não se repetem.
7. **Busca textual:** digitar termo que apareça em TCU → aparece TCU. Digitar termo que só exista em TCE-SP → só TCE-SP.
8. **Pergunte à IA:** fazer pergunta típica de TCU (ex: "irregularidades em aditivo") → resposta cita pelo menos uma fonte TCU no card de fontes.
9. **Detalhe (via API):** `curl http://localhost:3000/api/jurisprudencia/<id-de-doc-tcu>` → retorna 200 com shape normalizado.

- [ ] **Step 9.4: Aplicar índice no banco de preview (Vercel Preview)**

Via Vercel dashboard ou Neon console, conectar ao DB de preview e rodar:

```bash
# Local, apontando para preview DATABASE_URL:
DATABASE_URL="<preview-url>" npx prisma db execute --file prisma/sql/2026-04-21-document-tcu-index.sql
```

- [ ] **Step 9.5: Push da branch e criar PR**

```bash
git push -u origin HEAD
gh pr create --title "Integração dos acórdãos TCU na página de Jurisprudência" --body "$(cat <<'EOF'
## Summary
- Rota `/api/jurisprudencia` (listagem, detalhe e IA) agora enxerga acórdãos TCU que vivem em `Document` (antes só olhava `TribunalDecision`)
- Sem migração de dados, sem mudanças no schema, sem mudanças no front-end — integração via `UNION ALL` no read path
- Novo índice parcial em `Document` para performance do ramo TCU

## Spec
Ver `docs/superpowers/specs/2026-04-21-integracao-tcu-jurisprudencia-design.md`

## Test plan
- [x] Testes unitários do helper (`lib/jurisprudencia/unified-query.ts`)
- [x] Integration tests das 3 rotas (listagem, detalhe, IA)
- [x] `npm run build` sem erros
- [ ] Validação manual na preview: contagem aumenta, filtro TCU retorna resultados, IA cita TCU
- [ ] Índice parcial aplicado na preview

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 9.6: Após aprovação do PR, aplicar índice na produção**

```bash
DATABASE_URL="<production-url>" npx prisma db execute --file prisma/sql/2026-04-21-document-tcu-index.sql
```

Ordem importante: índice antes do merge para que quando o código entrar, a query já use o índice.

- [ ] **Step 9.7: Merge e validação em produção**

Após merge:
1. Acessar `https://www.profdanielbarral.com/area-restrita/jurisprudencia` autenticado.
2. Confirmar aumento de contagem.
3. Testar filtro TCU e pergunta à IA em produção.
4. Monitorar `apiLogger.info` nos logs do Vercel pelas primeiras horas (procurar por `jurisprudencia/list` e `jurisprudencia/query` — não deve haver erros 500).

---

## Self-review do plano (checklist)

**Cobertura do spec:**

| Seção do spec | Task(s) |
|---|---|
| Arquitetura (camada API, UNION ALL) | Tasks 1-7 |
| Mapeamento de campos | Task 1, Task 4 (SELECT do ramo B) |
| Mapeamento de filtros | Task 3 (builders) |
| Query SQL raw (listagem, count) | Task 4 + Task 5 |
| Top-K para IA | Task 4 + Task 7 |
| Short-circuit por filtro | Task 2 |
| Segurança (Prisma.sql) | Task 3 |
| Performance (índice parcial) | Task 8 |
| Busca IA (reuso do helper) | Task 7 |
| Error handling (Zod, NotFoundError) | Task 5, 6, 7 |
| Testes (unit + integration) | Tasks 1-7 |
| Rollout | Task 9 |
| Observabilidade (apiLogger) | Task 5, 7 |

Sem gaps.

**Placeholder scan:** ✅ nenhum TBD/TODO/"fill in details". Todos os blocos de código estão completos.

**Consistência de tipos:**
- `UnifiedDecision` definido na Task 1 é referenciado em Tasks 4, 5, 6, 7. Mesmo shape.
- `JurisprudenciaFilters` definido na Task 2 é usado nas Tasks 3, 4, 5, 7 (via `toJurisprudenciaFilters`). Consistente.
- `fetchUnifiedList`/`TopK`/`ById` + `countUnifiedApproved` definidos na Task 4, consumidos nas Tasks 5, 6, 7. Nomes batem.
- `shouldIncludeTribunalDecisionBranch` / `shouldIncludeDocumentTcuBranch` definidos na Task 2, usados no `composeUnifiedBody` da Task 4. Consistente.
- `tribunalDecisionSelect` / `documentTcuSelect` são privadas da Task 4, não expostas (OK).
