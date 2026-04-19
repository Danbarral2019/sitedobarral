# TCU Portarias Manual Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marcar as 2 Portarias TCU (3/2025, 175/2022) com `scrapeStatus: 'manual'` para que cron e scripts batch não tentem re-scrape, e para que a auditoria não as flague como suspicious falso-positivo.

**Architecture:** Introduzir sentinela `'manual'` no campo `scrapeStatus` (já é `String?` — sem migration). Atualizar documentação inline, 3 consumidores de filtragem (cron + 2 scripts batch) e o `buildProblemIdIndex` do audit. Script one-shot aplica aos 2 atos. Unit test pura no audit filter (refatorada para aceitar Set de manualIds).

**Tech Stack:** Prisma (sem migration), TypeScript, vitest.

**Spec de referência:** `docs/superpowers/specs/2026-04-19-tcu-portarias-manual-status-design.md`

---

## File Structure

**Created:**
- `scripts/mark-atos-manual.ts` — script one-off, idempotente
- `test/legislative-scrapers/manual-status.test.ts` — unit test para o filter refatorado

**Modified:**
- `prisma/schema.prisma:751` — comentário do campo `scrapeStatus`
- `app/api/cron/check-legislative-updates/route.ts` — adiciona filtro `scrapeStatus: { not: 'manual' }`
- `scripts/rescrape-affected-acts.ts` — filtra IDs com `scrapeStatus: 'manual'` do `spotCheckSuspicious`
- `scripts/rescrape-by-content-pattern.ts` — adiciona `scrapeStatus: { not: 'manual' }` à query
- `scripts/audit-legislative-acts.ts` — `buildProblemIdIndex` exclui atos `manual` de `spotCheckSuspicious`

---

### Task 1: Atualizar documentação do schema

**Files:**
- Modify: `prisma/schema.prisma:751`

- [ ] **Step 1: Atualizar o comentário**

Localizar a linha atual:

```prisma
  scrapeStatus      String?   // 'success' | 'failed' | 'pending' | 'unchanged'
```

Substituir por:

```prisma
  scrapeStatus      String?   // 'success' | 'failed' | 'pending' | 'unchanged' | 'manual'
```

Apenas comentário muda. Sem migration.

- [ ] **Step 2: Confirmar que não há migration pendente**

```bash
cd "C:/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- npx prisma format
npx dotenv -e .env.local -- npx prisma validate 2>&1 | tail -5
```

Expected: validação OK, sem migration pendente (comentário não afeta schema real).

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "docs(schema): documentar valor 'manual' em scrapeStatus"
```

---

### Task 2: Script one-off para marcar as 2 Portarias TCU

**Files:**
- Create: `scripts/mark-atos-manual.ts`

- [ ] **Step 1: Criar o script**

Criar `scripts/mark-atos-manual.ts` com o conteúdo:

```typescript
/**
 * Marca atos com scrapeStatus = 'manual' para bloqueá-los de re-scrape
 * automático (cron, scripts batch) e evitar falso-positivos na auditoria.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/mark-atos-manual.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/mark-atos-manual.ts --dry-run
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');

// Atos cujo content veio de origem externa (import, admin, PDF extraído manualmente)
// e que NÃO devem ser re-scraped automaticamente.
const MANUAL_FULL_NUMBERS: string[] = [
  'Portaria TCU 3/2025',
  'Portaria TCU 175/2022',
];

async function main() {
  console.log(`Marcando ${MANUAL_FULL_NUMBERS.length} atos como 'manual' (dry-run=${DRY_RUN})`);

  for (const fullNumber of MANUAL_FULL_NUMBERS) {
    const act = await prisma.legislativeAct.findFirst({
      where: { fullNumber },
      select: { id: true, fullNumber: true, scrapeStatus: true, content: true },
    });

    if (!act) {
      console.log(`  ✗ ${fullNumber}: ato NÃO encontrado no banco`);
      continue;
    }

    if (act.scrapeStatus === 'manual') {
      console.log(`  = ${fullNumber}: já está como 'manual' (no-op)`);
      continue;
    }

    const contentLen = act.content?.length ?? 0;
    if (contentLen < 500) {
      console.log(`  ⚠ ${fullNumber}: content length=${contentLen} (suspeito — deveria ter conteúdo substantivo). Marcando mesmo assim.`);
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] would update ${fullNumber} (${act.scrapeStatus ?? 'null'} → manual)`);
      continue;
    }

    await prisma.legislativeAct.update({
      where: { id: act.id },
      data: {
        scrapeStatus: 'manual',
        scrapeError: null,
      },
    });
    console.log(`  ✓ ${fullNumber} marcado como 'manual' (era '${act.scrapeStatus ?? 'null'}')`);
  }
}

main()
  .catch((err) => {
    console.error('ERRO:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Dry-run**

```bash
cd "C:/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- npx tsx scripts/mark-atos-manual.ts --dry-run 2>&1 | tail -10
```

Expected: lista os 2 atos, indica que passariam de `failed` para `manual`. Nenhuma escrita.

- [ ] **Step 3: Real run**

```bash
npx dotenv -e .env.local -- npx tsx scripts/mark-atos-manual.ts 2>&1 | tail -10
```

Expected: `✓ Portaria TCU 3/2025 marcado como 'manual' (era 'failed')` + mesmo para 175/2022.

- [ ] **Step 4: Verificar via query**

```bash
npx dotenv -e .env.local -- npx tsx -e "import { PrismaClient } from '@prisma/client'; import { PrismaNeon } from '@prisma/adapter-neon'; const p = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) }); p.legislativeAct.findMany({ where: { scrapeStatus: 'manual' }, select: { fullNumber: true, scrapeStatus: true } }).then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(0); });" 2>&1 | tail -10
```

Expected: JSON com 2 atos, ambos `scrapeStatus: 'manual'`.

- [ ] **Step 5: Commit**

```bash
git add scripts/mark-atos-manual.ts
git commit -m "feat(scripts): mark-atos-manual — marca atos com conteúdo externo para bloquear re-scrape"
```

---

### Task 3: Cron — filtrar atos 'manual'

**Files:**
- Modify: `app/api/cron/check-legislative-updates/route.ts`

- [ ] **Step 1: Localizar e modificar a query**

Abrir `app/api/cron/check-legislative-updates/route.ts`. Localizar a query `prisma.legislativeAct.findMany` (deve ser o primeiro findMany do arquivo, em torno da linha 32-45).

Bloco atual (`where` clause):

```typescript
      where: {
        officialUrl: { not: null },
        OR: [
          { lastScrapedAt: null },
          { lastScrapedAt: { lt: sevenDaysAgo } },
        ],
      },
```

Substituir por (adicionando `scrapeStatus: { not: 'manual' }`):

```typescript
      where: {
        officialUrl: { not: null },
        scrapeStatus: { not: 'manual' },
        OR: [
          { lastScrapedAt: null },
          { lastScrapedAt: { lt: sevenDaysAgo } },
        ],
      },
```

- [ ] **Step 2: Sanity check — tipo TypeScript válido**

```bash
cd "C:/Projeto de site do Barral/sitedobarral-stripe"
npx tsc --noEmit 2>&1 | grep -E "check-legislative-updates|route.ts" | head -5
```

Expected: sem erros para esse arquivo.

- [ ] **Step 3: Inspeção manual**

Rodar o cron LOCAL em modo dry-run? Não — o cron requer `CRON_SECRET` auth e faz scrape real. Em vez disso, validar via query direta que atos `manual` não apareceriam:

```bash
npx dotenv -e .env.local -- npx tsx -e "
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
const p = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) });
(async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const atos = await p.legislativeAct.findMany({
    where: {
      officialUrl: { not: null },
      scrapeStatus: { not: 'manual' },
      OR: [{ lastScrapedAt: null }, { lastScrapedAt: { lt: sevenDaysAgo } }],
    },
    select: { fullNumber: true, scrapeStatus: true },
    take: 20,
  });
  const hasTcu = atos.some(a => a.fullNumber.startsWith('Portaria TCU'));
  console.log('cron selection count:', atos.length);
  console.log('includes TCU Portarias?', hasTcu);
})().then(() => process.exit(0));
" 2>&1 | tail -5
```

Expected: `includes TCU Portarias? false`.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/check-legislative-updates/route.ts
git commit -m "fix(cron): excluir atos com scrapeStatus='manual' do re-scrape periódico"
```

---

### Task 4: `rescrape-by-content-pattern.ts` — filtrar 'manual'

**Files:**
- Modify: `scripts/rescrape-by-content-pattern.ts`

- [ ] **Step 1: Localizar e modificar a query**

Abrir `scripts/rescrape-by-content-pattern.ts`. Localizar a query inicial:

```typescript
  const all = await prisma.legislativeAct.findMany({
    where: { officialUrl: { not: null }, content: { not: null } },
    select: { id: true, fullNumber: true, officialUrl: true, content: true },
  });
```

Substituir por:

```typescript
  const all = await prisma.legislativeAct.findMany({
    where: {
      officialUrl: { not: null },
      content: { not: null },
      scrapeStatus: { not: 'manual' },
    },
    select: { id: true, fullNumber: true, officialUrl: true, content: true },
  });
```

- [ ] **Step 2: Dry-run confirmando exclusão**

```bash
npx dotenv -e .env.local -- npx tsx scripts/rescrape-by-content-pattern.ts --dry-run 2>&1 | tail -30
```

Expected: lista atos com padrões de ruído (se houver) sem incluir as 2 Portarias TCU. Se o output for "Encontrados 0 atos com content sujo", também é aceitável — confirma que pós-Bundle A não restou ruído.

- [ ] **Step 3: Commit**

```bash
git add scripts/rescrape-by-content-pattern.ts
git commit -m "fix(scripts): rescrape-by-content-pattern ignora atos 'manual'"
```

---

### Task 5: `rescrape-affected-acts.ts` — excluir 'manual' de spotCheckSuspicious

**Files:**
- Modify: `scripts/rescrape-affected-acts.ts`

- [ ] **Step 1: Adicionar filtro de manualIds**

Abrir `scripts/rescrape-affected-acts.ts`. Localizar o bloco onde IDs são coletados do audit JSON (depois de `const audit = JSON.parse(...)`):

```typescript
  const ids = new Set<string>();
  for (const row of audit.spotCheck ?? []) {
    if (row.verdict !== 'ok') ids.add(row.id);
  }
```

Substituir por:

```typescript
  // Atos marcados como 'manual' não devem ser re-scraped, mesmo se aparecerem
  // como suspicious no audit (falso-positivo típico: TCU SPA cujo conteúdo
  // veio de import manual).
  const manualActs = await prisma.legislativeAct.findMany({
    where: { scrapeStatus: 'manual' },
    select: { id: true },
  });
  const manualIds = new Set(manualActs.map((a) => a.id));

  const ids = new Set<string>();
  for (const row of audit.spotCheck ?? []) {
    if (row.verdict !== 'ok' && !manualIds.has(row.id)) ids.add(row.id);
  }
```

- [ ] **Step 2: Dry-run confirmando exclusão**

```bash
npx dotenv -e .env.local -- npx tsx scripts/rescrape-affected-acts.ts --dry-run 2>&1 | tail -30
```

Expected: lista os atos que seriam re-scraped. **NÃO deve incluir** `Portaria TCU 3/2025` nem `Portaria TCU 175/2022` (que estão em audit.spotCheck com verdict 'bloated').

- [ ] **Step 3: Commit**

```bash
git add scripts/rescrape-affected-acts.ts
git commit -m "fix(scripts): rescrape-affected-acts exclui atos 'manual' do spotCheckSuspicious"
```

---

### Task 6: Audit — refatorar `buildProblemIdIndex` para excluir 'manual' + unit test

**Files:**
- Modify: `scripts/audit-legislative-acts.ts`
- Create: `test/legislative-scrapers/manual-status.test.ts`

Esta task tem 2 sub-alvos: (a) o script audit em si e (b) extrair uma função pura testável.

- [ ] **Step 1: Escrever unit test primeiro (falha por ora)**

Criar `test/legislative-scrapers/manual-status.test.ts`:

```typescript
// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { filterSuspiciousExcludingManual } from '../../scripts/audit-helpers';

describe('filterSuspiciousExcludingManual', () => {
  it('inclui atos com verdict truncated e sem status manual', () => {
    const spotCheck = [
      { id: 'a', verdict: 'truncated' },
      { id: 'b', verdict: 'ok' },
    ];
    const manualIds = new Set<string>();
    expect(filterSuspiciousExcludingManual(spotCheck, manualIds)).toEqual(['a']);
  });

  it('inclui atos com verdict bloated e sem status manual', () => {
    const spotCheck = [
      { id: 'a', verdict: 'bloated' },
    ];
    const manualIds = new Set<string>();
    expect(filterSuspiciousExcludingManual(spotCheck, manualIds)).toEqual(['a']);
  });

  it('exclui atos cujo id está em manualIds, mesmo com verdict truncated/bloated', () => {
    const spotCheck = [
      { id: 'tcu-1', verdict: 'bloated' },
      { id: 'tcu-2', verdict: 'bloated' },
      { id: 'seges-1', verdict: 'truncated' },
    ];
    const manualIds = new Set(['tcu-1', 'tcu-2']);
    expect(filterSuspiciousExcludingManual(spotCheck, manualIds)).toEqual(['seges-1']);
  });

  it('ignora verdicts ok/url-dead/skipped', () => {
    const spotCheck = [
      { id: 'a', verdict: 'ok' },
      { id: 'b', verdict: 'url-dead' },
      { id: 'c', verdict: 'skipped' },
      { id: 'd', verdict: 'truncated' },
    ];
    const manualIds = new Set<string>();
    expect(filterSuspiciousExcludingManual(spotCheck, manualIds)).toEqual(['d']);
  });

  it('retorna lista vazia quando não há spotCheck suspicious', () => {
    expect(filterSuspiciousExcludingManual([], new Set())).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar teste — confirmar que falha**

```bash
cd "C:/Projeto de site do Barral/sitedobarral-stripe"
npm test -- test/legislative-scrapers/manual-status.test.ts 2>&1 | tail -10
```

Expected: erro "Cannot find module '../../scripts/audit-helpers'".

- [ ] **Step 3: Criar módulo pure `scripts/audit-helpers.ts`**

Criar `scripts/audit-helpers.ts`:

```typescript
/**
 * Helpers puros do script audit-legislative-acts, extraídos para testabilidade.
 */

export interface SpotCheckRowForFilter {
  id: string;
  verdict: string;
}

/**
 * Filtra linhas do spotCheck que devem aparecer em `spotCheckSuspicious`:
 * - verdict é 'truncated' OU 'bloated'
 * - id NÃO está em manualIds (atos com scrapeStatus='manual' são falso-positivos permanentes)
 */
export function filterSuspiciousExcludingManual(
  spotCheck: SpotCheckRowForFilter[],
  manualIds: Set<string>,
): string[] {
  return spotCheck
    .filter((r) => (r.verdict === 'truncated' || r.verdict === 'bloated') && !manualIds.has(r.id))
    .map((r) => r.id);
}
```

- [ ] **Step 4: Rodar teste — confirmar que passa**

```bash
npm test -- test/legislative-scrapers/manual-status.test.ts 2>&1 | tail -10
```

Expected: 5 passed.

- [ ] **Step 5: Refatorar `buildProblemIdIndex` para usar o helper**

Abrir `scripts/audit-legislative-acts.ts`. Localizar a função `buildProblemIdIndex` (está na seção de queries, antes de `renderMarkdown`). Dentro dela, localizar a linha que constrói `spotCheckSuspicious`:

```typescript
    spotCheckSuspicious: params.spotCheck.filter((r) => r.verdict === 'truncated' || r.verdict === 'bloated').map((r) => r.id),
```

Substituir a implementação inteira da função para buscar manualIds e delegar ao helper. Adicionar o import no topo:

```typescript
import { filterSuspiciousExcludingManual } from './audit-helpers';
```

Depois, dentro de `buildProblemIdIndex`, adicionar antes do `return`:

```typescript
  // Atos com scrapeStatus='manual' são falso-positivos permanentes em spotCheck
  // (ex: TCU Portarias cujo conteúdo veio de import, mas officialUrl é SPA).
  const manualActs = await prisma.legislativeAct.findMany({
    where: { scrapeStatus: 'manual' },
    select: { id: true },
  });
  const manualIds = new Set(manualActs.map((a) => a.id));
```

E substituir a linha final `spotCheckSuspicious: ...` por:

```typescript
    spotCheckSuspicious: filterSuspiciousExcludingManual(params.spotCheck, manualIds),
```

- [ ] **Step 6: Sanity check — audit script ainda roda**

Dry-run rápido para garantir que não quebrou:

```bash
npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --skip-fetch --dry-run --suffix=smoke 2>&1 | tail -10
```

Expected: roda até o fim sem TS error, imprime "Relatório NÃO será salvo".

- [ ] **Step 7: Rodar todos os testes do diretório**

```bash
npm test -- test/legislative-scrapers/ 2>&1 | tail -10
```

Expected: **33 passed** (28 anteriores + 5 novos de manual-status).

- [ ] **Step 8: Commit**

```bash
git add scripts/audit-helpers.ts scripts/audit-legislative-acts.ts test/legislative-scrapers/manual-status.test.ts
git commit -m "feat(audit): buildProblemIdIndex exclui atos 'manual' de spotCheckSuspicious + unit test"
```

---

### Task 7: Re-auditoria + validação final

**Files:**
- Generate: `docs/audits/2026-04-19-legislative-acts-audit-post-fix-v4.md` + `.json`
- Modify: `docs/audits/2026-04-19-diff-summary.md` (adicionar seção v4)
- Modify: `FUTURE_TASKS.md` (marcar TCU como concluído via manual status)

- [ ] **Step 1: Rodar audit com suffix v4**

```bash
cd "C:/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --suffix=post-fix-v4 2>&1 | tail -15
```

Expected: gera `docs/audits/2026-04-19-legislative-acts-audit-post-fix-v4.md` + `.json`.

- [ ] **Step 2: Verificar spotCheckSuspicious caiu**

```bash
cat docs/audits/2026-04-19-legislative-acts-audit-post-fix-v4.json | grep -oE '"spotCheckSuspicious":\[[^]]*\]' | head -1
```

Expected: lista menor que a v3 (exclui os IDs das 2 Portarias TCU).

Comparar com v3:

```bash
echo "v3 spotCheckSuspicious:"
cat docs/audits/2026-04-19-legislative-acts-audit-post-fix-v3.json | python -c "import json, sys; d = json.load(sys.stdin); print(len(d['problemIds']['spotCheckSuspicious']))"
echo "v4 spotCheckSuspicious:"
cat docs/audits/2026-04-19-legislative-acts-audit-post-fix-v4.json | python -c "import json, sys; d = json.load(sys.stdin); print(len(d['problemIds']['spotCheckSuspicious']))"
```

Se python não estiver disponível, usar `node -e`:

```bash
echo "v3:" && node -e "console.log(JSON.parse(require('fs').readFileSync('docs/audits/2026-04-19-legislative-acts-audit-post-fix-v3.json','utf-8')).problemIds.spotCheckSuspicious.length)"
echo "v4:" && node -e "console.log(JSON.parse(require('fs').readFileSync('docs/audits/2026-04-19-legislative-acts-audit-post-fix-v4.json','utf-8')).problemIds.spotCheckSuspicious.length)"
```

Expected: v3 é 10, v4 é 8 (menos 2 TCU) ou menor.

- [ ] **Step 3: Atualizar diff-summary com seção v4**

Abrir `docs/audits/2026-04-19-diff-summary.md` e acrescentar ao final:

```markdown

## Quarta passada (Bundle B — manual status marker)

Bundle B não precisou de scraper TCU — investigação revelou que as 2 Portarias TCU (3/2025, 175/2022) já tinham conteúdo correto e completo no banco (22.103 e 15.602 chars de texto real), importado de fonte externa em sessão anterior. O verdict `bloated` da auditoria era falso-positivo (compara stored 22k vs live-fetch 187 chars de SPA shell).

**Fix aplicado:** marcar `scrapeStatus: 'manual'` para essas 2 Portarias, bloqueando:
- Cron `check-legislative-updates` (re-scrape periódico)
- Script `rescrape-affected-acts.ts`
- Script `rescrape-by-content-pattern.ts`

E excluindo-as de `spotCheckSuspicious` do audit.

**Métricas v4:**

| Métrica | v3 | v4 |
|---|---:|---:|
| `spotCheckSuspicious` | 10 | <preencher com número real> |
| Atos `scrapeStatus: 'manual'` | 0 | 2 |
| Testes do diretório scrapers | 28/28 | 33/33 |

Bundle B concluído. Restantes: MPU 178/2023 (Bundle C — parser PDF), themes taxonomy (Bundle D).
```

Substituir `<preencher com número real>` pelo valor apurado no Step 2.

- [ ] **Step 4: Atualizar FUTURE_TASKS.md T1**

Abrir `FUTURE_TASKS.md`. Localizar a linha na T1 "Ações priorizadas":

```
- [ ] Adicionar parser dedicado para `pesquisa.apps.tcu.gov.br` / `btcu.apps.tcu.gov.br` — hoje cai no parser gov.br genérico, mas TCU é SPA com conteúdo JS-rendered. Avaliar: (a) endpoint JSON/API oficial do TCU, (b) rota alternativa em `portal.tcu.gov.br` com HTML estático, ou (c) Playwright headless como último recurso.
```

Substituir por:

```
- [x] ~~Adicionar parser dedicado para `pesquisa.apps.tcu.gov.br`~~ — Bundle B (2026-04-19): investigação revelou que as 2 Portarias TCU afetadas já tinham conteúdo correto no banco (import manual anterior). Solução aplicada: marcar `scrapeStatus: 'manual'` para bloquear re-scrape e excluir de falsos-positivos do audit. Parser dedicado TCU fica para quando houver Portarias TCU futuras sem conteúdo importado — cenário não presente hoje.
```

- [ ] **Step 5: Commit final**

```bash
git add docs/audits/2026-04-19-legislative-acts-audit-post-fix-v4.md \
        docs/audits/2026-04-19-legislative-acts-audit-post-fix-v4.json \
        docs/audits/2026-04-19-diff-summary.md \
        FUTURE_TASKS.md
git commit -m "docs(audit): Bundle B concluído via manual status — audit v4 + T1 atualizado"
```

---

## Self-Review

**Spec coverage:**
- ✓ Documentação schema `'manual'` → Task 1
- ✓ Script `mark-atos-manual.ts` → Task 2
- ✓ Cron filter → Task 3
- ✓ `rescrape-by-content-pattern.ts` filter → Task 4
- ✓ `rescrape-affected-acts.ts` filter (spotCheckSuspicious) → Task 5
- ✓ Audit `buildProblemIdIndex` exclui manual → Task 6
- ✓ Unit test do filter → Task 6
- ✓ Re-auditoria + diff + T1 update → Task 7
- ✓ `scrapeAndIndexAct` NÃO modificado (decidido no spec: admin pode forçar)

**Placeholder scan:**
- `<preencher com número real>` em Task 7 Step 3 é intencional — depende do valor apurado em runtime (Step 2). Instrução imediata para substituir.

**Type consistency:**
- `SpotCheckRowForFilter` em `audit-helpers.ts` tem `id: string, verdict: string` — compatível com campos usados em `SpotCheckRow` existente. Helper aceita qualquer superset.
- `manualIds: Set<string>` usado consistentemente em helper e em `buildProblemIdIndex`.

---

## Próximo passo após aprovação

Offer execução:
1. **Subagent-Driven** (recomendado) — fresh subagent por task
2. **Inline Execution** — executing-plans

Escolher uma.
