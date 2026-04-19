# Fixes de Extração de LegislativeActs (Bundle A) — Design

**Data:** 2026-04-19
**Contexto:** A auditoria de `docs/audits/2026-04-19-legislative-acts-audit.md` identificou que 11 de 12 URLs spot-checked têm verdict não-ok. Este design endereça 5 fixes priorizados (Bundle A de T1) que cobrem ~80% dos atos suspeitos.

**Spec origem:** T1 reescrita em `FUTURE_TASKS.md` (linhas 50-82).

---

## Arquitetura-alvo

Existem dois scrapers em paralelo no repositório:

1. **Produção:** `lib/legislative-scrapers/` (cheerio, class-based). Classes `PlanaltoScraper` e `GovBrComprasScraper`, orquestradas por `lib/legislative-scrapers/index.ts#scrapeUrl()`. Consumido por:
   - `lib/legislative-scrapers/scrape-and-index.ts#scrapeAndIndexAct()`
   - Crons: `check-legislative-updates`, `sync-dou-atos-normativos`
   - Admin API: `update-content`, `import`

2. **Script manual:** `scripts/scrape-legislative-acts-content.ts` (regex-based). Standalone, usado só para backfill manual.

**Decisão:** todos os fixes vão em (1), que é o código que roda em produção. (2) será deprecado em favor de chamar `scrapeAndIndexAct()` por ato.

## Escopo (5 fixes de Bundle A)

| # | Fix | Arquivo-alvo | Impacto esperado |
|---|---|---|---|
| F3 | `www.gov.br` / `www.in.gov.br` content truncation | `govbr-compras.ts` | 8 atos suspeitos → ok |
| F4 | Planalto whitespace (runs de `⏎`) | `planalto.ts` | Ruído visual em Decretos eliminado |
| F5 | `www.in.gov.br` masthead/footer vazando | `govbr-compras.ts` | "Brasão do Brasil" e "Borda do rodapé" removidos |
| F6 | SGD/MGI form annexes (`<NOME DO FISCAL TECNICO>`) | `govbr-compras.ts` | Portarias SGD 6.680 e 6.679 limpas |
| F7 | MP 1.167/2023 URL dead | one-off script + FUTURE_TASKS.md | Caso resolvido ou documentado |

**Fora de escopo (sessões futuras):**
- TCU SPA (requer Playwright ou API dedicada)
- MPF biblioteca PDF (requer parser PDF)
- `themes` taxonomy + backfill
- Reescrita completa de `scrape-legislative-acts-content.ts`

## Análise de root cause por fix

### F3 — Truncation em `govbr-compras.ts`

Código atual em `govbr-compras.ts:26-44`: ordem dos seletores começa com `#content-core`, depois `.content-area`, depois `#main-content`. Em páginas Plone (usadas por SEGES/MGI em `www.gov.br`), o conteúdo textual completo fica em `#parent-fieldname-text`, que aparece apenas no MEIO da lista de fallbacks. `#content-core` pode existir mas conter só metadados do topo (título, ementa curta).

Loop em `govbr-compras.ts:147-155`: para o primeiro seletor que produz `text.length > 100`. Se `#content-core` der 250 chars de metadados, o loop retorna sem alcançar `#parent-fieldname-text` (que teria 25k chars).

**Fix:** reordenar seletores para priorizar o body completo (`#parent-fieldname-text` → `#content-core` → demais fallbacks). Em vez de "primeiro match acima de N chars", mudar a estratégia para "tentar todos os seletores primários e escolher o de MAIOR text.length, desde que > 500 chars; se nenhum primário bater, cair para os fallbacks genéricos com threshold de 100". Isso resolve o caso de um seletor encontrar 250 chars de metadados enquanto outro tem 25k chars de corpo. Atos legitimamente curtos (ex: portarias de 1 artigo) ainda são capturados via fallback.

### F4 — Planalto whitespace em `planalto.ts`

Código atual em `planalto.ts` (função `cleanText`, similar à de `govbr-compras.ts:164-176`): colapsa `\n{3,}` para `\n\n`, mas runs de linhas vazias com NBSP (`\u00A0`) ou espaços "lonely" não viram `\n\n` antes do collapse. Decretos do Planalto têm tabelas com cells vazias renderizadas como `<tr><td>\u00A0</td></tr>`, que cheerio `.text()` transforma em ` \n \n \n `.

**Fix:** adicionar passo de normalização ANTES do `\n{3,}` collapse: `.replace(/\n[\s\u00A0]+\n/g, '\n\n').replace(/\n{3,}/g, '\n\n')`. Também considerar remover linhas com apenas NBSP: `.replace(/^[\s\u00A0]+$/gm, '')`.

### F5 — in.gov.br masthead/footer

Código atual em `govbr-compras.ts:49-62`: `ELEMENTS_TO_REMOVE` inclui `header`, `footer`, mas NÃO inclui os markers específicos da in.gov.br:
- Masthead: "Brasão do Brasil / Diário Oficial da União / Publicado em / Edição / Seção / Página / Órgão" dentro de um `<div class="identifica">` ou similar
- Footer: "Borda do rodapé / Logo da Imprensa" dentro de divs específicas da Imprensa Nacional

**Fix:** duas camadas — (a) adicionar seletores DOU específicos a `ELEMENTS_TO_REMOVE` (`.identifica`, `.jornal-cabecalho`, `.jornal-rodape`, `.imagem-detalhe`), e (b) passo de limpeza pós-extração que trima tudo antes da primeira ocorrência de padrão normativo ("Instrução Normativa Nº", "Portaria Nº", "Decreto Nº", etc.) quando host for `www.in.gov.br`.

### F6 — SGD/MGI form annexes

Portarias SGD/MGI (ex: 6.680/2024) incluem ao final documentos-modelo com placeholders `<NOME DO FISCAL TECNICO>`, `<NOME DO GESTOR>`, etc. Esses anexos não são parte do texto normativo propriamente dito — são formulários para uso administrativo.

**Fix:** passo de limpeza pós-extração — se content contém `<NOME DO FISCAL TECNICO>` (ou variações: `<NOME DO GESTOR>`, `<NOME DO PREPOSTO>`), cortar do PRIMEIRO marker em diante. Se houver footer DOU válido ("Este texto não substitui..." ou similar) ANTES do marker, preservá-lo como última linha.

### F7 — MP 1.167/2023 URL dead

Investigação one-shot:
1. Fetch manual da URL `www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/mpv/mpv1167.htm`
2. Se 200 OK com conteúdo atual: problema era transitório — re-scrapear
3. Se 404: buscar URL alternativa (pode ter virado Lei nº XX ou virado MP arquivada)
4. Se virou lei: atualizar `officialUrl` no banco via script one-shot, re-scrapear

Script: `scripts/fix-mp-1167-url.ts` (one-off, removido após uso OU mantido como exemplo).

## Componentes novos

### `lib/legislative-scrapers/normalize.ts`

Utilitários pós-extração compartilhados entre scrapers:

```typescript
export function collapseWhitespace(text: string): string
export function stripDouBoilerplate(text: string): string  // masthead + footer in.gov.br
export function stripFormAnnex(text: string): string         // <NOME DO FISCAL TECNICO>
```

Cada função é pura (input string → output string), testável isolada.

### `test/legislative-scrapers/`

Estrutura:
```
test/legislative-scrapers/
  fixtures/
    planalto-decreto-12807-2025.html    # snapshot real do HTML
    govbr-portaria-seges-4932-2023.html
    in-gov-br-in-sgd-86-2025.html
    sgd-mgi-portaria-6680-2024.html
  planalto.test.ts         # extractContent(fixture) === expected
  govbr-compras.test.ts
  normalize.test.ts        # unidade: cada helper em isolamento
```

Fixtures são HTML real capturado via `curl` e comitado no repo. Cada teste lê fixture, roda extractor, compara com `expected.txt` correspondente. Snapshot testing com vitest `toMatchFileSnapshot()` para facilitar atualização.

**Nota:** `vitest.config.ts:47-50` exclui `scripts/` mas NÃO exclui `test/` — então esses testes rodam normalmente via `npm test`.

## Estratégia de rollout

1. **Capturar snapshot "antes"** — rodar a auditoria atual salvando output como baseline (já feito: `docs/audits/2026-04-19-legislative-acts-audit.md`).
2. **Capturar fixtures "antes"** — salvar HTML atual de 4 atos-exemplo em `test/legislative-scrapers/fixtures/`.
3. **Escrever testes baseline** — cada teste roda scraper atual e armazena snapshot do output via `toMatchFileSnapshot()`. Esses snapshots documentam comportamento atual (com bugs).
4. **Aplicar fixes** — testes quebram. Atualizar snapshots para refletir output corrigido. Commit mostra diff claro entre "antes" e "depois" do output textual.
5. **Re-scrape** — rodar `scrapeAndIndexAct` para os 20 atos com `scrapeStatus: null` + os 11 atos em `spotCheckSuspicious` da auditoria. Total ~30 atos, feito em batch via novo script `scripts/rescrape-affected-acts.ts` que usa o índice JSON da auditoria.
6. **Re-rodar auditoria** — `scripts/audit-legislative-acts.ts`. Gera `docs/audits/2026-04-19-legislative-acts-audit-post-fix.md` (sufixo para coexistir com o baseline).
7. **Commitar diff** — ambos os relatórios lado a lado no PR.

## Critérios de sucesso (mensuráveis pela re-auditoria)

- [ ] `spotCheckSuspicious` cai de **11 → ≤ 3 atos** (meta: 0; aceita 3 se forem TCU + MPF que não foram escopo)
- [ ] Portaria SEGES/MGI 4.932/2023 ratio de **0.03 → ≥ 0.7** (conteúdo completo)
- [ ] Todas as 6 "SEGES-CICS/MGI Resolução" que estavam truncated viram ok
- [ ] Amostras Section 7 de Decretos Planalto sem runs de `⏎` acima de 2
- [ ] Amostras Section 7 de IN SGD/MGI 86/2025 sem "Brasão do Brasil" nem "Borda do rodapé"
- [ ] Amostras Section 7 de Portaria SGD/MGI 6.680/2024 sem `<NOME DO FISCAL TECNICO>`
- [ ] `scrapeStatus: null` cai de **20 → ≤ 2 atos** (TCU permanece null, sem fix nesta sessão)
- [ ] Testes vitest novos (≥8 casos) passam
- [ ] `npm run build` e `npm run lint` sem regressão

## Fora de escopo

- Refatorar `scripts/scrape-legislative-acts-content.ts` (deprecação formal fica para próxima sessão — apenas adicionar aviso no topo do arquivo nesta PR)
- Parser TCU (SPA — sessão separada)
- Parser MPF PDF (sessão separada)
- Taxonomy de `themes` e backfill (sessão separada)
- Adicionar novos scrapers para hosts ainda não cobertos (ex: TCE)

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Rewrite quebra atos que hoje estão ok | Fixtures capturam estado atual; só atualizar snapshots manualmente após inspeção |
| Novos seletores não cobrem variações de página real | 4 fixtures reais cobrem os padrões principais; post-deploy monitorar `scrapeStatus: failed` |
| Cheerio 0.22 (antigo) tem quirks | Já está em uso em prod há muito tempo; manter na versão atual para evitar migração paralela |
| Re-scrape gera muitas escritas no Neon | Lote pequeno (~30 atos), serialized com delay de 2s como a auditoria; sem risco de rate-limit |
| Boundary markers DOU mudam de site upstream | Multiple markers tentados em sequência; fallback para extração original se nenhum bate |

## Não objetivos

- Não mudar schema do banco
- Não alterar a interface `LegislativeScraper`
- Não mexer em embeddings (content re-indexado automaticamente por `processLegislativeAct` após re-scrape)
- Não adicionar novas deps (cheerio + jsdom já instalados)

## Próximo passo após aprovação

Invocar `superpowers:writing-plans` com referência a este spec. Plan decompõe o trabalho em tasks task-a-task:

1. Capturar fixtures
2. Escrever baseline tests (pré-fix, para snapshot)
3. Implementar `normalize.ts`
4. F3 (govbr-compras selector reorder + threshold)
5. F5 (in.gov.br boilerplate removal)
6. F6 (SGD form annex cutoff)
7. F4 (planalto whitespace)
8. F7 (MP 1.167 investigation one-off)
9. Script de re-scrape em batch
10. Re-executar auditoria + commit diff
