# Onda 5 — Podar features mortas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover ~1500 LOC de código vestigial em 3 frentes: flag DOU + fluxo legacy (~444 LOC), pages AGU admin duplicadas (~545 LOC), AGU scraper v1 (~496 LOC).

**Architecture:** 3 PRs sequenciais em `main`, ordem de risco crescente (DOU flag → consolidar pages AGU → migrar cron AGU v1→v4). Cada PR é independente, mergeável separadamente. Sem novos testes (são deleções/consolidação); validação via TS check + telemetria pós-deploy.

**Tech Stack:** Next.js 15 App Router • TypeScript 5 • Prisma 7 (PrismaNeon) • Vitest 4 (sem novos testes) • Pino logger (`@/lib/logger`) • Sentry (`@sentry/nextjs`)

**Spec:** [docs/superpowers/specs/2026-05-18-onda5-podar-features-design.md](../specs/2026-05-18-onda5-podar-features-design.md)

---

## File Structure

**Arquivos modificados:**

| Arquivo | PR | Mudança |
|---|---|---|
| `app/api/cron/sync-dou-atos-normativos/route.ts` | 5.1 | Remove flag + dropa fluxo legacy (~444 LOC removidas) |
| `app/admin/scraper-agu/ScraperAGUClient.tsx` | 5.2 | Adiciona seção "Acervo AGU" + tipo `AGUStats` + estado + `useEffect` |
| `app/api/cron/import-documents/route.ts` | 5.3 | Substitui import de v1 por v4 + adapta mapping de Document.create |

**Arquivos deletados:**

| Arquivo | PR | LOC |
|---|---|---|
| `app/admin/agu-import/` (diretório inteiro) | 5.2 | 545 |
| `lib/agu-scraper.ts` (v1) | 5.3 | 496 |
| `lib/agu-types.ts` (se órfão pós-drop v1) | 5.3 | ~50 |

**Total LOC removidas líquidas:** ~1500 (após adições mínimas em scraper-agu e import-documents).

---

## Convenções

- **Path:** comandos rodam de `/Users/danba/Site do Barral/sitedobarral/`
- **Commits:** padrão Onda 4 — `<tipo>(<scope>): <descrição> [Onda 5 PR 5.X]`
- **Co-Authored-By:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- **Git author/committer (CRÍTICO):** SEMPRE Daniel Barral <danbarral@gmail.com>. Forma exata:
  ```bash
  git -c user.email=danbarral@gmail.com -c user.name="Daniel Barral" commit -m "..."
  ```
  NUNCA modificar git config. NUNCA push até a task de push explícita.
- **Branches:** `chore/remove-dou-clipping-v2-flag` (5.1), `refactor/consolidate-agu-admin-pages` (5.2), `refactor/agu-scraper-v1-to-v4` (5.3)
- **Cada PR criada de `main` atualizado pós-merge da anterior.**

---

## PR 5.1 — Remove flag DOU + dropa fluxo legacy

Branch: `chore/remove-dou-clipping-v2-flag`

### Task 1: Criar branch + commit do spec/plan

**Files:**
- Already on disk (untracked): `docs/superpowers/specs/2026-05-18-onda5-podar-features-design.md`, `docs/superpowers/plans/2026-05-18-onda5-podar-features.md`

- [ ] **Step 1: Garantir main atualizado**

```bash
git status --short
git checkout main 2>/dev/null
git pull origin main
```

Expected: working tree clean exceto pelos 2 docs untracked.

- [ ] **Step 2: Criar branch**

```bash
git checkout -b chore/remove-dou-clipping-v2-flag
```

- [ ] **Step 3: Commit dos docs**

```bash
git add docs/superpowers/specs/2026-05-18-onda5-podar-features-design.md docs/superpowers/plans/2026-05-18-onda5-podar-features.md
git -c user.email=danbarral@gmail.com -c user.name="Daniel Barral" commit -m "$(cat <<'EOF'
docs(onda5): spec + plan da Onda 5 podar features [Onda 5 PR 5.1]

Foundation documental: 3 PRs sequenciais removendo ~1500 LOC de
código vestigial (flag DOU + legacy, pages AGU duplicadas, AGU v1).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Verificar autoria**

```bash
git log -1 --format='%h | A:%ae | C:%ce | %s'
```

Expected: `A:danbarral@gmail.com | C:danbarral@gmail.com`. Se diferente, amend com `--reset-author` usando os mesmos `-c` flags.

---

### Task 2: Step 0 — Verificação de paridade `runV2` vs legacy

**Files:**
- Read-only inspection: `app/api/cron/sync-dou-atos-normativos/route.ts`

**Why:** Antes de deletar ~444 LOC do bloco legacy (linhas 127-577), confirmar que `runV2` (linhas 578+) NÃO chama nenhum símbolo declarado SOMENTE no bloco legacy. Se houver dependência, o drop quebra `runV2`.

- [ ] **Step 1: Listar símbolos top-level no legacy**

Run:
```bash
sed -n '127,577p' app/api/cron/sync-dou-atos-normativos/route.ts | grep -nE "^\s*(function|async function|const|let|type|interface) [a-zA-Z]" | head -30
```

Anotar os nomes encontrados (functions, consts, types declarados no escopo legacy). Algumas declarações estão dentro de blocos `try`/`{}` e não vazam pro escopo do módulo — essas são seguras. Foco em declarações no escopo módulo (no `withCronTelemetry` body OU fora).

- [ ] **Step 2: Listar símbolos importados/usados em `runV2` (linhas 578+)**

Run:
```bash
sed -n '578,820p' app/api/cron/sync-dou-atos-normativos/route.ts | grep -oE "\b(searchLastWeek|DOUClassifier|isAtoNormativoGeral|shouldAutoApprove|detectAtoType|isProcurementRelated|detectModifications|scrapeContent|LeiIndexer|SEARCH_TERMS_V2|CATEGORY_MAP|normalizeScrapedText)\b" | sort -u
```

Cruzar com os símbolos do step 1: se algum nome aparecer em ambos, é uma DEPENDÊNCIA — precisa ser preservada (mover pra fora do bloco legacy antes do drop).

- [ ] **Step 3: Decisão**

Se zero dependências: prosseguir com a implementação audacious (Task 3).
Se ≥1 dependência: pivot. Documentar no commit message qual símbolo era compartilhado e como foi tratado (mover pra cima do bloco legacy OU restringir o drop pra preservar).

Nenhum commit nesta task. É inspeção pura.

---

### Task 3: Remover flag + dropa fluxo legacy

**Files:**
- Modify: `app/api/cron/sync-dou-atos-normativos/route.ts`

**Context:** Linha 118 declara `v2Enabled`. Linhas 127-132 fazem `if (v2Enabled) { return runV2(...) }`. Linhas 133-577 são fluxo legacy executado quando flag OFF.

- [ ] **Step 1: Remover declaração do flag (linha 118)**

Localizar:
```ts
  const v2Enabled = process.env.DOU_CLIPPING_V2_ENABLED === 'true';
```

Deletar a linha inteira.

- [ ] **Step 2: Simplificar telemetria (linha 126)**

Localizar:
```ts
    await withCronTelemetry(v2Enabled ? 'sync-dou-atos-normativos-v2' : 'sync-dou-atos-normativos', async () => {
```

Substituir por:
```ts
    await withCronTelemetry('sync-dou-atos-normativos-v2', async () => {
```

- [ ] **Step 3: Remover `if (v2Enabled)` wrapper (linhas 127-132) + dropa fluxo legacy (linhas 133-577)**

Localizar bloco:
```ts
    if (v2Enabled) {
      capturedResponse = await runV2(dryRun, maxResults);
      // Sucesso/falha do runV2 já está na response; aqui só registramos
      // telemetria mínima (runV2 tem stats próprios mas não expostos).
      return { metadata: { v2: true, dryRun } };
    }
    // ↓ fluxo legacy continua abaixo (sem alteração)

    const stats = {
      // ... ~444 linhas até o fim do try block ...
    };
```

Substituir por:
```ts
    capturedResponse = await runV2(dryRun, maxResults);
    // Sucesso/falha do runV2 já está na response; aqui só registramos
    // telemetria mínima (runV2 tem stats próprios mas não expostos).
    return { metadata: { v2: true, dryRun } };
```

**Cuidado:** O bloco legacy termina antes do `runV2` (linha 578). Você precisa deletar linhas 127-577 exatamente — o fechamento do `withCronTelemetry` deve permanecer logo após o `return` simplificado. Use Read antes de Edit pra confirmar o limite exato.

- [ ] **Step 4: Remover imports órfãos**

Após o drop do legacy, alguns imports da linha 1-30 podem ter ficado sem uso. Verificar:

```bash
# Pra cada import suspeito, ver se ainda aparece no arquivo restante
for sym in DOUClassifier DOUDocumentCategory isAtoNormativoGeral shouldAutoApprove detectAtoType isProcurementRelated detectModifications scrapeContent LeiIndexer; do
  count=$(grep -c "$sym" app/api/cron/sync-dou-atos-normativos/route.ts)
  echo "$sym: $count usos"
done
```

Se algum mostrar **1 uso** (só o import), deletar o import. Se mostrar 0, também deletar (referência stale).

- [ ] **Step 5: Verificar TypeScript + grep**

```bash
npx tsc --noEmit 2>&1 | grep "sync-dou-atos-normativos" || echo "no TS errors in scope"
grep -rn "DOU_CLIPPING_V2_ENABLED\|DOU_CLIPPING_V2" app lib scripts --include="*.ts" || echo "fully removed"
```

Expected: ambos `clean` / `fully removed`.

- [ ] **Step 6: Verificar tamanho do arquivo (sanity check)**

```bash
wc -l app/api/cron/sync-dou-atos-normativos/route.ts
```

Expected: arquivo reduziu de 820 para ~370-400 linhas (depende dos imports limpos).

- [ ] **Step 7: Rodar testes**

```bash
npm run test 2>&1 | tail -10
```

Expected: todos PASS. Se algum teste testava o fluxo legacy especificamente, ele falhará — checar e atualizar/deletar.

- [ ] **Step 8: Commit**

```bash
git add app/api/cron/sync-dou-atos-normativos/route.ts
git -c user.email=danbarral@gmail.com -c user.name="Daniel Barral" commit -m "$(cat <<'EOF'
chore(dou): remove DOU_CLIPPING_V2_ENABLED flag + drop legacy flow [Onda 5 PR 5.1]

v2 é canônico há tempo em prod; flag virou vestígio. Remove a
declaração + dropa o fluxo legacy (linhas 127-577) que rodava
quando flag OFF. Também remove imports órfãos.

Ganho: ~444 LOC de código morto eliminadas. Telemetria
agora sempre 'sync-dou-atos-normativos-v2'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Verificação final + push + abrir PR 5.1

- [ ] **Step 1: Suite completa**

```bash
npm run test 2>&1 | tail -15
npx tsc --noEmit 2>&1 | grep -E "sync-dou" || echo "clean for scope"
npm run migration:api:status
```

Expected: 1467+ tests PASS, TS clean, migration 0 legacy.

- [ ] **Step 2: Verificar commits**

```bash
git log main..HEAD --format='%h | A:%ae | C:%ce | %s'
```

Expected: 2 commits, ambos `A:danbarral@gmail.com | C:danbarral@gmail.com`.

- [ ] **Step 3: Push**

```bash
git push -u origin chore/remove-dou-clipping-v2-flag
```

- [ ] **Step 4: Criar PR**

```bash
gh pr create --title "chore(dou): remove DOU_CLIPPING_V2_ENABLED flag + legacy flow [Onda 5 PR 5.1]" --body "$(cat <<'EOF'
## Summary

Remove a flag de feature `DOU_CLIPPING_V2_ENABLED` em `app/api/cron/sync-dou-atos-normativos/route.ts` e dropa o fluxo legacy (~444 LOC) que rodava quando a flag estava OFF.

## Por quê

DOU clipping v2 é canônico em prod há tempo. A flag e o fluxo legacy ficaram como dead code que dificultava manutenção do arquivo de 820 linhas.

## Auditoria pré-implementação

Step 0 confirmou: `runV2` não depende de nenhum símbolo declarado exclusivamente no bloco legacy. Drop é seguro.

## Mudanças

- Remove `const v2Enabled = process.env.DOU_CLIPPING_V2_ENABLED === 'true'` (linha 118)
- Simplifica `withCronTelemetry('sync-dou-atos-normativos-v2', ...)` (sempre v2)
- Dropa `if (v2Enabled) {...}` wrapper + fluxo legacy completo
- Remove imports órfãos (DOUClassifier, isAtoNormativoGeral, etc — só usados pelo legacy)

## Test plan

- [x] `npm run test` verde
- [x] `npx tsc --noEmit` clean em `sync-dou-atos-normativos`
- [x] `npm run migration:api:status` retorna 0
- [x] `grep DOU_CLIPPING_V2_ENABLED` retorna 0 hits
- [ ] Pós-deploy: cron diário (0 8 * * *) executa sem erros — verificar Sentry tag `sync-dou-atos-normativos-v2`

## Risk assessment

- Cron diário (8h UTC); primeira execução após merge é o gate
- Sem novos testes (refactor por remoção; comportamento idêntico ao prod atual com flag ON)
- Rollback fácil: revert no PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Reportar PR URL + checks pendentes**

Wait for Vercel deploy preview. Then merge via squash (Run Tests pode falhar por coverage threshold global — padrão Onda 4):

```bash
gh pr merge <PR_NUMBER> --squash
```

- [ ] **Step 6: Sync local main**

```bash
git checkout main
git pull origin main
```

---

## PR 5.2 — Consolidar pages AGU admin

Branch: `refactor/consolidate-agu-admin-pages` (criada de main pós-merge da 5.1)

### Task 5: Criar branch + auditoria pre-impl

- [ ] **Step 1: Criar branch**

```bash
git checkout main
git pull origin main
git checkout -b refactor/consolidate-agu-admin-pages
```

- [ ] **Step 2: Confirmar zero referências externas a /admin/agu-import**

```bash
grep -rn "/admin/agu-import\|app/admin/agu-import" app components lib scripts 2>/dev/null | grep -v "//" | grep -v "agu-import" || echo "no live refs"
```

Expected: zero matches (a string `/admin/agu-import` aparecer apenas em comentários ou no próprio arquivo é OK).

- [ ] **Step 3: Confirmar que `/api/admin/agu-stats` existe e é independente**

```bash
ls -la app/api/admin/agu-stats/route.ts
grep -rn "/api/admin/agu-stats" app components 2>/dev/null
```

Expected: arquivo existe. Único caller é `app/admin/agu-import/page.tsx:78` (a ser substituído).

---

### Task 6: Portar seção "Acervo AGU" para `ScraperAGUClient.tsx`

**Files:**
- Modify: `app/admin/scraper-agu/ScraperAGUClient.tsx`

**Context:** A seção tem 4 partes: (1) `AGUStats` interface, (2) state vars `aguStats` + `statsLoading`, (3) `useEffect` que faz fetch, (4) JSX da seção.

- [ ] **Step 1: Adicionar imports faltantes (se necessário)**

Verificar se `useEffect` já é importado no arquivo:

```bash
grep -E "^import.*useEffect|^import.*\{ useEffect" app/admin/scraper-agu/ScraperAGUClient.tsx
```

Se não estiver: adicionar `useEffect` à importação de `react` no topo:

```ts
// ANTES:
import { useState } from 'react';

// DEPOIS:
import { useState, useEffect } from 'react';
```

- [ ] **Step 2: Adicionar interface `AGUStats` antes do componente**

Após os imports e antes do `export default function ScraperAGUClient()`, adicionar:

```ts
interface AGUStats {
  counts: Array<{ category: string; label: string; count: number }>;
  totalDocuments: number;
  lastImport: {
    date: string;
    category: string;
    title: string;
  } | null;
}
```

- [ ] **Step 3: Adicionar state + useEffect no início do componente**

Dentro de `ScraperAGUClient`, logo após o primeiro `useState`, adicionar:

```ts
  const [aguStats, setAguStats] = useState<AGUStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/agu-stats')
      .then(res => res.ok ? res.json() : null)
      .then(data => setAguStats(data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);
```

- [ ] **Step 4: Adicionar JSX da seção "Acervo AGU" no topo do return**

Localizar o `<h1 className="text-3xl font-bold mb-2">AGU Scraper v4</h1>` no JSX retornado. Logo APÓS o container do header (mas ANTES das seções "1. Selecione..."), adicionar:

```tsx
        {/* Estatísticas do Acervo AGU */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Acervo AGU no Banco de Dados</h2>
          {statsLoading ? (
            <p className="text-sm text-gray-500">Carregando estatísticas...</p>
          ) : aguStats ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                {aguStats.counts.map(item => (
                  <div key={item.category} className="bg-gray-50 p-3 rounded text-center">
                    <div className="text-2xl font-bold text-blue-600">{item.count}</div>
                    <div className="text-xs text-gray-600">{item.label}</div>
                  </div>
                ))}
                <div className="bg-blue-50 p-3 rounded text-center">
                  <div className="text-2xl font-bold text-blue-800">{aguStats.totalDocuments}</div>
                  <div className="text-xs text-gray-600">Total AGU</div>
                </div>
              </div>
              {aguStats.lastImport && (
                <p className="text-xs text-gray-500">
                  Última importação: {new Date(aguStats.lastImport.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {' '}&mdash; {aguStats.lastImport.title}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">Não foi possível carregar estatísticas.</p>
          )}
        </div>
```

**Posicionamento:** O JSX deve aparecer DENTRO do mesmo container/div externo que envolve as outras seções, mas como o PRIMEIRO bloco visível abaixo do header.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "ScraperAGUClient\|scraper-agu" || echo "clean"
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/admin/scraper-agu/ScraperAGUClient.tsx
git -c user.email=danbarral@gmail.com -c user.name="Daniel Barral" commit -m "$(cat <<'EOF'
feat(admin): port "Acervo AGU" stats section to scraper-agu [Onda 5 PR 5.2]

Adiciona seção de estatísticas do banco AGU em ScraperAGUClient.tsx,
portada de agu-import (que será deletada no próximo commit).

API /api/admin/agu-stats permanece inalterada.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Deletar `app/admin/agu-import/`

**Files:**
- Delete: `app/admin/agu-import/` (diretório inteiro)

- [ ] **Step 1: Confirmação final pré-delete**

```bash
ls app/admin/agu-import/
grep -rn "agu-import" app components 2>/dev/null | grep -v "node_modules\|.git" | head
```

Expected: o diretório existe. A string `agu-import` deve aparecer apenas em arquivos do próprio diretório (que será deletado).

- [ ] **Step 2: Delete via `git rm -r`**

```bash
git rm -r app/admin/agu-import/
```

- [ ] **Step 3: TypeScript check + grep final**

```bash
npx tsc --noEmit 2>&1 | grep "agu-import" || echo "clean"
grep -rn "/admin/agu-import\|app/admin/agu-import\|agu-import/page" app components 2>/dev/null | head
```

Expected: zero matches. Se algo aparecer, é um link/import quebrado — investigar antes de seguir.

- [ ] **Step 4: Rodar testes**

```bash
npm run test 2>&1 | tail -10
```

Expected: PASS (nenhum teste depende de agu-import).

- [ ] **Step 5: Commit**

```bash
git -c user.email=danbarral@gmail.com -c user.name="Daniel Barral" commit -m "$(cat <<'EOF'
refactor(admin): delete duplicated agu-import page [Onda 5 PR 5.2]

Página app/admin/agu-import era duplicata de app/admin/scraper-agu
com apenas 1 seção extra (Acervo AGU stats), que foi portada no
commit anterior.

Ganho: -545 LOC de duplicação.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Push + abrir PR 5.2

- [ ] **Step 1: Verificação final**

```bash
git log main..HEAD --format='%h | A:%ae | C:%ce | %s'
npm run test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | grep -E "(scraper-agu|agu-import)" || echo "clean for scope"
npm run migration:api:status
```

Expected: 2 commits autorados corretamente, testes PASS, TS clean, migration 0 legacy.

- [ ] **Step 2: Push**

```bash
git push -u origin refactor/consolidate-agu-admin-pages
```

- [ ] **Step 3: Criar PR**

```bash
gh pr create --title "refactor(admin): consolidar pages AGU duplicadas [Onda 5 PR 5.2]" --body "$(cat <<'EOF'
## Summary

Consolida 2 pages admin duplicadas (`/admin/scraper-agu` e `/admin/agu-import`) em uma só (`/admin/scraper-agu`). Porta a única seção exclusiva da removida (Acervo AGU stats).

## Por quê

Auditoria 2026-05-18 identificou: as duas pages eram 99% idênticas, ambas tocadas no mesmo commit "Consolidar admin (T5)" (erro de consolidação). `scraper-agu` usa padrão moderno (dynamic import + ssr:false); `agu-import` era monolítica.

## Mudanças

- **Adiciona** `app/admin/scraper-agu/ScraperAGUClient.tsx`:
  - Interface `AGUStats`
  - State `aguStats` + `statsLoading`
  - `useEffect` chamando `/api/admin/agu-stats`
  - JSX da seção "Acervo AGU no Banco de Dados"
- **Deleta** `app/admin/agu-import/` inteiro (545 LOC)

API `/api/admin/agu-stats` permanece inalterada (compartilhada).

## Test plan

- [x] `npm run test` verde (nenhum teste depende de agu-import)
- [x] `npx tsc --noEmit` clean
- [x] `npm run migration:api:status` retorna 0
- [x] grep `agu-import` retorna 0 referências externas
- [ ] Pós-deploy: abrir `/admin/scraper-agu` em prod, ver seção "Acervo AGU" carregar + scraping funcionar

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Aguardar Vercel deploy + mergear**

```bash
gh pr merge <PR_NUMBER> --squash
git checkout main
git pull origin main
```

---

## PR 5.3 — Migrar cron AGU v1 → v4

Branch: `refactor/agu-scraper-v1-to-v4` (criada de main pós-merge da 5.2)

### Task 9: Criar branch + auditoria de paridade v4

- [ ] **Step 1: Criar branch**

```bash
git checkout main
git pull origin main
git checkout -b refactor/agu-scraper-v1-to-v4
```

- [ ] **Step 2: Inspecionar APIs de v1 e v4**

```bash
grep -E "^export " lib/agu-scraper.ts
grep -E "^export " lib/agu-scraper-v4.ts
grep -E "^export " lib/agu-types.ts
```

Confirma:
- v1 exporta: `scrapeOrientacoesAGU(): Promise<OrientacaoNormativa[]>`, `type OrientacaoNormativa`, `convertOrientacoesToDocuments`
- v4 exporta: `scrapeAGU(config: AGUScraperConfig): Promise<{success, results, stats, totalDocuments, totalRelevant, executionTime, errors}>`, `convertAGUDocumentsToImport`, `generateAGUExcelReport`

- [ ] **Step 3: Comparar shape do output v4 (AGUDocument) vs v1 (OrientacaoNormativa)**

```bash
sed -n '/^export interface AGUDocument/,/^}/p' lib/agu-types.ts | head -40
```

Tomar nota dos campos chave: `tipo`, `numero`, `descricao`, `linkFundamentacao`, `onNumber`, `onYear`, `ano`, `tags`. Confirmar que v4 retorna todos os campos usados pelo cron atual (ver `app/api/cron/import-documents/route.ts:130-162`).

- [ ] **Step 4: Inspecionar o que convertAGUDocumentsToImport retorna**

```bash
sed -n '/export function convertAGUDocumentsToImport/,/^}/p' lib/agu-scraper-v4.ts | head -40
```

Confirma que retorna `Array<{ title, description, category, type, url, tags, isPublic, courseIds, onNumber?, onYear?, alternativeUrls? }>`.

- [ ] **Step 5: Teste local do v4**

```bash
npx tsx scripts/test-agu-scraper-v4.ts 2>&1 | head -30
```

Expected: scraper roda, retorna ONs. **Atenção:** se falhar por timeout/network, anotar e decidir se proceder (não é blocker em si — sinal de fragilidade).

Não há commit nesta task. É auditoria pura.

---

### Task 10: Substituir v1 por v4 no cron

**Files:**
- Modify: `app/api/cron/import-documents/route.ts`

**Context atual (linhas 1-160):**
```ts
import { scrapeOrientacoesAGU, type OrientacaoNormativa } from '@/lib/agu-scraper';
// ...
const aguOrientacoes = await scrapeOrientacoesAGU();
const newOns: OrientacaoNormativa[] = [];
for (const on of aguOrientacoes) {
  const exists = await prisma.document.findFirst({ where: { OR: [{url: on.linkFundamentacao}, {title: on.numero}] }});
  if (!exists) newOns.push(on);
}
for (const on of newOns) {
  await prisma.document.create({
    data: {
      title: on.numero,
      description: on.descricao || '',
      url: on.linkFundamentacao || '',
      type: 'pdf',
      category: 'orientacao-normativa',
      isPublic: false,
      reviewed: false,
      courseId: '2',
      isCommon: true,
      tags: JSON.stringify(['AGU', 'Orientacao Normativa', 'AGU']),
      aiClassification: JSON.stringify({
        source: 'agu-scraper',
        orgao: 'AGU',
        data: on.ano,
        onNumber: on.onNumber,
        onYear: on.onYear,
      }),
    },
  });
}
```

- [ ] **Step 1: Substituir o import**

Linha 4. ANTES:
```ts
import { scrapeOrientacoesAGU, type OrientacaoNormativa } from '@/lib/agu-scraper';
```

DEPOIS:
```ts
import { scrapeAGU } from '@/lib/agu-scraper-v4';
import type { AGUDocument } from '@/lib/agu-types';
```

- [ ] **Step 2: Adaptar a chamada do scraper (substituir `scrapeOrientacoesAGU()`)**

Localizar:
```ts
const aguOrientacoes = await scrapeOrientacoesAGU();
```

Substituir por:
```ts
const aguResult = await scrapeAGU({
  tipos: ['orientacao-normativa'],
  filtroRelevancia: false, // cron importa tudo; admin filtra depois
});
const aguOrientacoes: AGUDocument[] = aguResult.results
  .filter(r => r.tipo === 'orientacao-normativa')
  .flatMap(r => r.documentos);
```

**Atenção:** a estrutura exata do `AGUScraperResult` (com `documentos: AGUDocument[]`) precisa ser confirmada via inspeção em Task 9 Step 4. Se o shape for diferente, ajustar o `.flatMap` correspondente.

Se `scrapeAGU` retorna `results: AGUScraperResult[]` onde cada result tem um campo flat (não `documentos[]`), adaptar pra:

```ts
const aguOrientacoes: AGUDocument[] = aguResult.results.filter(r => r.tipo === 'orientacao-normativa');
```

A inspeção do Step 4 da Task 9 deve revelar qual forma usar.

- [ ] **Step 3: Adaptar o type do `newOns` array**

Localizar:
```ts
const newOns: OrientacaoNormativa[] = [];
```

Substituir por:
```ts
const newOns: AGUDocument[] = [];
```

- [ ] **Step 4: Adaptar field accessors no loop de dedupe**

ANTES:
```ts
for (const on of aguOrientacoes) {
  const exists = await prisma.document.findFirst({
    where: {
      OR: [
        { url: on.linkFundamentacao },
        { title: on.numero },
      ],
    },
  });
  if (!exists) {
    newOns.push(on);
  }
}
```

DEPOIS — `AGUDocument` (v4) usa nomes ligeiramente diferentes. Confirmar com inspeção do tipo em Task 9 Step 3. Ajustes prováveis:
- `on.linkFundamentacao` → `on.url` ou `on.linkFundamentacao` (a confirmar)
- `on.numero` → `on.numero` ou `on.titulo` (a confirmar)

Se v4 mantém os mesmos nomes (`linkFundamentacao`, `numero`): zero mudança. Se mudou: ajustar pelos field names reais.

- [ ] **Step 5: Adaptar `prisma.document.create` no loop final**

ANTES (campos referenciando v1 fields):
```ts
for (const on of newOns) {
  await prisma.document.create({
    data: {
      title: on.numero,
      description: on.descricao || '',
      url: on.linkFundamentacao || '',
      type: 'pdf',
      category: 'orientacao-normativa',
      isPublic: false,
      reviewed: false,
      courseId: '2',
      isCommon: true,
      tags: JSON.stringify([
        'AGU',
        'Orientacao Normativa',
        'AGU',
      ]),
      aiClassification: JSON.stringify({
        source: 'agu-scraper',
        orgao: 'AGU',
        data: on.ano,
        onNumber: on.onNumber,
        onYear: on.onYear,
      }),
    },
  });
}
```

DEPOIS — mantenha a forma se os nomes dos fields em v4 coincidirem. Se forem diferentes, adapte. Source na aiClassification deve mudar pra `'agu-scraper-v4'` pra audit trail claro:

```ts
for (const on of newOns) {
  await prisma.document.create({
    data: {
      title: on.numero,
      description: on.descricao || '',
      url: on.linkFundamentacao || on.url || '',
      type: 'pdf',
      category: 'orientacao-normativa',
      isPublic: false,
      reviewed: false,
      courseId: '2',
      isCommon: true,
      tags: JSON.stringify([
        'AGU',
        'Orientacao Normativa',
        'AGU',
      ]),
      aiClassification: JSON.stringify({
        source: 'agu-scraper-v4',
        orgao: 'AGU',
        data: on.ano,
        onNumber: on.onNumber,
        onYear: on.onYear,
      }),
    },
  });
}
```

**Confirmar com a inspeção do Step 3 da Task 9 quais nomes de fields existem em `AGUDocument`.** Se um campo do v1 (ex: `ano`) não existir em v4, usar substituto equivalente (ex: derivar de `on.onYear` se `ano` não existir).

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "(import-documents|agu-scraper|agu-types)" || echo "clean for scope"
```

Expected: clean. Se aparecer erro de tipo, é sinal de que o mapping precisa ajuste — voltar e fixar.

- [ ] **Step 7: Commit**

```bash
git add app/api/cron/import-documents/route.ts
git -c user.email=danbarral@gmail.com -c user.name="Daniel Barral" commit -m "$(cat <<'EOF'
refactor(cron): migrate import-documents from agu-scraper v1 to v4 [Onda 5 PR 5.3]

Cron semanal de importação de Orientações Normativas agora usa
scrapeAGU(v4) com { tipos: ['orientacao-normativa'] }. v1 vai ser
deletada no próximo commit.

aiClassification.source mudou pra 'agu-scraper-v4' para auditoria.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Deletar `lib/agu-scraper.ts` (v1) + condicionalmente `lib/agu-types.ts`

**Files:**
- Delete: `lib/agu-scraper.ts`
- Delete (condicional): `lib/agu-types.ts`

- [ ] **Step 1: Verificar que zero arquivos importam do v1**

```bash
grep -rn "from '@/lib/agu-scraper'\|from '@/lib/agu-scraper\b" app lib scripts --include="*.ts" 2>/dev/null | grep -v "agu-scraper-v4" | head
```

Expected: zero matches (a Task 10 já removeu o último uso). Se aparecer alguma referência: investigar antes do delete.

- [ ] **Step 2: Deletar v1**

```bash
git rm lib/agu-scraper.ts
```

- [ ] **Step 3: Verificar se `lib/agu-types.ts` ainda é usado**

```bash
grep -rn "from '@/lib/agu-types'\|from '../lib/agu-types'\|from './agu-types'" app lib scripts --include="*.ts" 2>/dev/null | head
```

Expected: alguma referência ainda existe (`lib/agu-scraper-v4.ts` importa de `./agu-types`). NÃO deletar `agu-types.ts` neste caso.

Se a inspeção mostrar zero referências: deletar também.

```bash
# SE zero referências:
git rm lib/agu-types.ts
```

- [ ] **Step 4: TypeScript check final**

```bash
npx tsc --noEmit 2>&1 | grep -E "(agu-scraper|agu-types|import-documents)" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 5: Test suite**

```bash
npm run test 2>&1 | tail -10
```

Expected: PASS. Se algum teste importava do v1, falhará — deletar/atualizar o teste.

- [ ] **Step 6: Commit**

```bash
git -c user.email=danbarral@gmail.com -c user.name="Daniel Barral" commit -m "$(cat <<'EOF'
refactor(cron): drop agu-scraper v1 [Onda 5 PR 5.3]

v1 ficou órfão após migração do último caller (cron import-documents)
para v4 no commit anterior. Drop libera ~496 LOC.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Push + abrir PR 5.3 + atualizar memória pós-merge

- [ ] **Step 1: Verificação final completa**

```bash
git log main..HEAD --format='%h | A:%ae | C:%ce | %s'
npm run test 2>&1 | tail -10
npx tsc --noEmit 2>&1 | grep -E "(agu|import-documents)" || echo "clean for scope"
npm run migration:api:status
ls lib/agu-scraper.ts 2>/dev/null && echo "WARN: v1 ainda existe" || echo "v1 deleted"
```

Expected: 2 commits autorados corretamente, testes PASS, TS clean, migration 0 legacy, v1 deleted.

- [ ] **Step 2: Push**

```bash
git push -u origin refactor/agu-scraper-v1-to-v4
```

- [ ] **Step 3: Criar PR**

```bash
gh pr create --title "refactor(cron): migrate AGU scraper v1 → v4 + drop v1 [Onda 5 PR 5.3]" --body "$(cat <<'EOF'
## Summary

Migra o cron semanal `import-documents` de `agu-scraper.ts` (v1) para `agu-scraper-v4.ts` e deleta v1.

## Por quê

`lib/agu-scraper.ts` (v1, 496 LOC) era o único bloqueio pra adoção total do v4. Usado apenas em `app/api/cron/import-documents/route.ts:4` (cron semanal de Orientações Normativas).

## Auditoria pré-implementação

- v4 (`scrapeAGU`) suporta `tipos: ['orientacao-normativa']`
- v4 retorna `AGUDocument` com mesmos campos chave (`numero`, `descricao`, `linkFundamentacao`, `onNumber`, `onYear`)
- Helper `convertAGUDocumentsToImport` não foi usado aqui porque o cron tem mapping específico (categoria 'orientacao-normativa', courseId '2', etc); chamada direta a `prisma.document.create` mantida com campos adaptados

## Mudanças

- `app/api/cron/import-documents/route.ts`:
  - Import muda de `scrapeOrientacoesAGU, OrientacaoNormativa` (v1) → `scrapeAGU, AGUDocument` (v4)
  - Chamada `scrapeOrientacoesAGU()` → `scrapeAGU({ tipos: ['orientacao-normativa'], filtroRelevancia: false })`
  - `aiClassification.source` muda de `'agu-scraper'` → `'agu-scraper-v4'` (audit trail)
- `lib/agu-scraper.ts` deletado (496 LOC)
- `lib/agu-types.ts` mantido (ainda usado por `agu-scraper-v4.ts`)

## Test plan

- [x] `npm run test` verde
- [x] `npx tsc --noEmit` clean em arquivos modificados
- [x] `npm run migration:api:status` retorna 0
- [x] Teste local `npx tsx scripts/test-agu-scraper-v4.ts` valida v4 funciona
- [ ] Pós-deploy: aguardar primeira execução do cron semanal (ou disparar manualmente via `?key=CRON_SECRET`) e verificar Sentry tag `import-documents`
- [ ] Contagem de ONs importadas similar à última execução pré-migração

## Risk assessment

- Cron semanal; primeira execução real é o gate
- Se v4 quebrar produção: revert no PR, restaura v1 instantaneamente
- aiClassification.source mudou — query histórica que filtra por `source = 'agu-scraper'` precisará incluir `'agu-scraper-v4'`

## Fecha Onda 5

Esta PR fecha a campanha 5 (3 PRs: 5.1 DOU flag, 5.2 AGU pages, 5.3 AGU v1 drop). ~1500 LOC removidas líquidas.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Aguardar Vercel deploy + mergear**

```bash
gh pr merge <PR_NUMBER> --squash
git checkout main
git pull origin main
```

- [ ] **Step 5: Atualizar memória (Controller — não Task de subagent)**

Editar `/Users/danba/.claude/projects/-Users-danba/memory/MEMORY.md`:

```markdown
- **Onda 5 completa** ✅ 3 PRs #XX-#XX (2026-05-XX) — poda de features mortas: remove flag `DOU_CLIPPING_V2_ENABLED` + dropa fluxo legacy (~444 LOC), consolida pages AGU admin duplicadas (~495 LOC líquidas), migra cron de `agu-scraper.ts` (v1) para v4 e dropa v1 (~496 LOC). Total: ~1500 LOC removidas. Detalhes: [project_sessao_2026-05-XX-onda5.md](project_sessao_2026-05-XX-onda5.md).
```

Criar `/Users/danba/.claude/projects/-Users-danba/memory/project_sessao_2026-05-XX-onda5.md` com resumo similar ao das Ondas 4.6 e 4.7.

---

## Self-review

### Spec coverage verificada

| Spec requirement | Task que cobre |
|---|---|
| PR 5.1: step 0 de paridade `runV2` vs legacy | Task 2 |
| PR 5.1: remove flag + simplifica telemetria | Task 3, Steps 1-2 |
| PR 5.1: dropa fluxo legacy (~444 LOC) | Task 3, Step 3 |
| PR 5.1: remove imports órfãos | Task 3, Step 4 |
| PR 5.2: porta seção stats pra scraper-agu | Task 6 |
| PR 5.2: deleta agu-import inteira | Task 7 |
| PR 5.2: verificação que zero refs externas | Tasks 5 Step 2 + 7 Step 3 |
| PR 5.3: auditoria de paridade v4 vs v1 | Task 9 |
| PR 5.3: teste local v4 antes do cron | Task 9 Step 5 |
| PR 5.3: substitui import + adapta cron handler | Task 10 |
| PR 5.3: dropa v1 (e agu-types se órfão) | Task 11 |
| Pós-deploy: monitorar Sentry tags do cron | Cada PR Step "pós-deploy" |

### Placeholder scan

Sem "TBD", "TODO", "fill in", "similar to Task X". Step 5 da Task 10 indica adaptação condicional ("se v4 mantém os mesmos nomes... zero mudança; senão ajustar") mas com **direção concreta + comando pra descobrir o real**. Aceitável para refactor de mapping cuja forma exata depende de inspeção feita no Step 3 da Task 9.

### Type consistency

- `OrientacaoNormativa` (v1, dropado) — só referenciado em Tasks 9-11, sempre indicando "DELETAR"
- `AGUDocument` (v4) — Tasks 10-11 usam consistentemente como replacement
- `AGUStats` interface — Task 6 declara, mesma usada em todo o JSX da seção stats
- Branches: `chore/remove-dou-clipping-v2-flag` → `refactor/consolidate-agu-admin-pages` → `refactor/agu-scraper-v1-to-v4` — sequência consistente

---

## Execução

Plan complete and saved to `docs/superpowers/plans/2026-05-18-onda5-podar-features.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatcho um subagent fresco por task, revisão entre tasks, iteração rápida. Bom porque as 12 tasks são bem isoladas (cada PR independente).

**2. Inline Execution** — executo tudo nesta sessão usando `executing-plans`, batch com checkpoints.

**Qual abordagem?**
