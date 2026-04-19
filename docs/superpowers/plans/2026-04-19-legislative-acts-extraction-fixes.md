# Legislative Acts Extraction Fixes (Bundle A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 5 bugs de extração de conteúdo de atos normativos (gov.br truncation, Planalto whitespace, in.gov.br DOU boilerplate, SGD/MGI form annexes, MP 1.167 URL) em `lib/legislative-scrapers/`, com re-scrape dos atos afetados e nova auditoria mostrando o antes/depois.

**Architecture:** Fixes ficam em `lib/legislative-scrapers/` (código de produção, usado por crons e admin API). Novo módulo `normalize.ts` concentra helpers pós-extração puros e testáveis. Testes vitest com fixtures HTML reais capturados do upstream. Re-scrape orquestrado por script batch que consome o JSON da auditoria.

**Tech Stack:** cheerio 0.22, vitest 4, Prisma + Neon adapter, fetch nativo.

**Spec de referência:** `docs/superpowers/specs/2026-04-19-legislative-acts-extraction-fixes-design.md`

---

## File Structure

**Created:**
- `test/legislative-scrapers/fixtures/planalto-decreto-12807-2025.html` — HTML real
- `test/legislative-scrapers/fixtures/govbr-portaria-seges-mgi-4932-2023.html` — HTML real
- `test/legislative-scrapers/fixtures/in-gov-br-sgd-mgi-86-2025.html` — HTML real
- `test/legislative-scrapers/fixtures/sgd-mgi-portaria-6680-2024.html` — HTML real
- `test/legislative-scrapers/normalize.test.ts` — unit tests dos helpers puros
- `test/legislative-scrapers/planalto.test.ts` — integration test com fixture
- `test/legislative-scrapers/govbr-compras.test.ts` — integration test com fixtures (3)
- `lib/legislative-scrapers/normalize.ts` — `collapseWhitespace`, `stripDouBoilerplate`, `stripFormAnnex`
- `scripts/rescrape-affected-acts.ts` — batch re-scrape usando JSON da auditoria
- `scripts/fix-mp-1167-url.ts` — one-off para F7
- `docs/audits/2026-04-19-legislative-acts-audit-post-fix.md` — gerado pela re-auditoria
- `docs/audits/2026-04-19-legislative-acts-audit-post-fix.json` — gerado pela re-auditoria

**Modified:**
- `lib/legislative-scrapers/planalto.ts` — `cleanText` usa `collapseWhitespace`
- `lib/legislative-scrapers/govbr-compras.ts` — nova estratégia de seleção + boilerplate + form annex
- `scripts/scrape-legislative-acts-content.ts` — aviso de deprecação no topo
- `FUTURE_TASKS.md` — marcar subtasks F3-F7 como concluídos

---

### Task 1: Capturar fixtures HTML reais

**Files:**
- Create: `test/legislative-scrapers/fixtures/` (directory)
- Create: 4 arquivos HTML

Fixtures são snapshots reais do upstream no momento do fix. Comitamos como dado de teste estável.

- [ ] **Step 1: Criar diretório**

```bash
cd "C:/Projeto de site do Barral/sitedobarral-stripe"
mkdir -p test/legislative-scrapers/fixtures
```

- [ ] **Step 2: Fetch Planalto Decreto 12.807/2025**

```bash
curl -sSL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12807.htm" \
  -o test/legislative-scrapers/fixtures/planalto-decreto-12807-2025.html
```

Verificar: `ls -la test/legislative-scrapers/fixtures/planalto-decreto-12807-2025.html` deve ter > 20KB.

Se o curl retornar 404, usar URL alternativa encontrada via busca na estrutura planalto. Não prosseguir sem um fixture real — ele é a base dos testes.

- [ ] **Step 3: Fetch Gov.br Portaria SEGES/MGI 4.932/2023**

Obter a URL exata do banco:

```bash
npx dotenv -e .env.local -- npx tsx -e "import { PrismaClient } from '@prisma/client'; import { PrismaNeon } from '@prisma/adapter-neon'; const p = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) }); p.legislativeAct.findFirst({ where: { fullNumber: 'Portaria SEGES/MGI 4.932/2023' }, select: { officialUrl: true } }).then(r => console.log(r?.officialUrl)).finally(() => p.\$disconnect());"
```

Em seguida:

```bash
curl -sSL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  "<URL-do-banco>" \
  -o test/legislative-scrapers/fixtures/govbr-portaria-seges-mgi-4932-2023.html
```

Verificar: arquivo > 50KB.

- [ ] **Step 4: Fetch in.gov.br IN SGD/MGI 86/2025**

```bash
npx dotenv -e .env.local -- npx tsx -e "import { PrismaClient } from '@prisma/client'; import { PrismaNeon } from '@prisma/adapter-neon'; const p = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) }); p.legislativeAct.findFirst({ where: { fullNumber: 'IN SGD/MGI 86/2025' }, select: { officialUrl: true } }).then(r => console.log(r?.officialUrl)).finally(() => p.\$disconnect());"
```

```bash
curl -sSL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  "<URL-do-banco>" \
  -o test/legislative-scrapers/fixtures/in-gov-br-sgd-mgi-86-2025.html
```

Verificar: arquivo > 10KB.

- [ ] **Step 5: Fetch SGD/MGI Portaria 6.680/2024**

```bash
npx dotenv -e .env.local -- npx tsx -e "import { PrismaClient } from '@prisma/client'; import { PrismaNeon } from '@prisma/adapter-neon'; const p = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) }); p.legislativeAct.findFirst({ where: { fullNumber: 'Portaria SGD/MGI nº 6.680/2024' }, select: { officialUrl: true } }).then(r => console.log(r?.officialUrl)).finally(() => p.\$disconnect());"
```

```bash
curl -sSL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  "<URL-do-banco>" \
  -o test/legislative-scrapers/fixtures/sgd-mgi-portaria-6680-2024.html
```

Verificar: arquivo > 100KB (este tem formulários anexados volumosos).

- [ ] **Step 6: Commit fixtures**

```bash
git add test/legislative-scrapers/fixtures/
git commit -m "test(scrapers): adicionar fixtures HTML reais para scrapers de legislação"
```

---

### Task 2: Módulo `normalize.ts` com helpers puros

**Files:**
- Create: `lib/legislative-scrapers/normalize.ts`
- Create: `test/legislative-scrapers/normalize.test.ts`

- [ ] **Step 1: Escrever testes (falham por ora)**

Criar `test/legislative-scrapers/normalize.test.ts`:

```typescript
// @vitest-environment node

import { describe, it, expect } from 'vitest';
import {
  collapseWhitespace,
  stripDouBoilerplate,
  stripFormAnnex,
} from '../../lib/legislative-scrapers/normalize';

describe('collapseWhitespace', () => {
  it('colapsa múltiplas quebras de linha em \\n\\n', () => {
    expect(collapseWhitespace('A\n\n\n\nB')).toBe('A\n\nB');
  });

  it('trata linhas com apenas espaços como vazias', () => {
    expect(collapseWhitespace('A\n   \n   \nB')).toBe('A\n\nB');
  });

  it('trata linhas com NBSP (\\u00A0) como vazias', () => {
    expect(collapseWhitespace('A\n\u00A0\n\u00A0\nB')).toBe('A\n\nB');
  });

  it('preserva parágrafos separados por uma linha em branco', () => {
    expect(collapseWhitespace('A\n\nB')).toBe('A\n\nB');
  });

  it('colapsa espaços múltiplos em 1', () => {
    expect(collapseWhitespace('A    B')).toBe('A B');
  });

  it('remove espaços nas bordas de cada linha', () => {
    expect(collapseWhitespace('  A  \n  B  ')).toBe('A\nB');
  });

  it('trim final', () => {
    expect(collapseWhitespace('\n\nA\n\n')).toBe('A');
  });
});

describe('stripDouBoilerplate', () => {
  const sample = `Brasão do Brasil

Diário Oficial da União

 Publicado em:
 30/07/2025
 |

 Edição:
 142
 |

 Seção: 1
 |

 Página:
 140

 Órgão:
 Ministério da Gestão e da Inovação em Serviços Públicos/Secretaria de Governo Digital

Instrução Normativa SGD/MGI Nº 86, DE 25 DE JULHO DE 2025

Altera a Instrução Normativa SGD/MGI nº 6, de 29 de março de 2023...

Art. 3º Esta Instrução Normativa entra em vigor em 1º de agosto de 2025.

ROGÉRIO SOUZA MASCARENHAS

Este conteúdo não substitui o publicado na versão certificada.

 Borda do rodapé

 Logo da Imprensa`;

  it('remove masthead com "Brasão do Brasil" até fim da linha "Órgão:..."', () => {
    const out = stripDouBoilerplate(sample);
    expect(out).not.toContain('Brasão do Brasil');
    expect(out).not.toContain('Diário Oficial da União');
    expect(out).not.toContain('Secretaria de Governo Digital');
  });

  it('remove footer "Borda do rodapé" e "Logo da Imprensa"', () => {
    const out = stripDouBoilerplate(sample);
    expect(out).not.toContain('Borda do rodapé');
    expect(out).not.toContain('Logo da Imprensa');
  });

  it('preserva "Este conteúdo não substitui" (rodapé DOU legítimo)', () => {
    const out = stripDouBoilerplate(sample);
    expect(out).toContain('Este conteúdo não substitui');
  });

  it('preserva o texto normativo propriamente dito', () => {
    const out = stripDouBoilerplate(sample);
    expect(out).toContain('Instrução Normativa SGD/MGI Nº 86');
    expect(out).toContain('Art. 3º Esta Instrução Normativa');
    expect(out).toContain('ROGÉRIO SOUZA MASCARENHAS');
  });

  it('é no-op quando não há marker de masthead', () => {
    const plainText = 'Art. 1º Esta é uma norma.\n\nArt. 2º Segue a regra.';
    expect(stripDouBoilerplate(plainText)).toBe(plainText);
  });
});

describe('stripFormAnnex', () => {
  it('corta a partir da primeira ocorrência de "<NOME DO FISCAL TECNICO>"', () => {
    const input = 'Art. 1º Conteúdo.\n\nArt. 2º Mais conteúdo.\n\nDocumento assinado eletronicamente\n<NOME DO FISCAL TECNICO>\nFiscal Técnico';
    const out = stripFormAnnex(input);
    expect(out).toContain('Art. 1º Conteúdo.');
    expect(out).toContain('Art. 2º Mais conteúdo.');
    expect(out).not.toContain('<NOME DO FISCAL TECNICO>');
    expect(out).not.toContain('Fiscal Técnico');
  });

  it('detecta variações do placeholder', () => {
    const input1 = 'Texto\n<NOME DO GESTOR>\nx';
    const input2 = 'Texto\n<NOME DO PREPOSTO>\nx';
    expect(stripFormAnnex(input1)).not.toContain('<NOME DO GESTOR>');
    expect(stripFormAnnex(input2)).not.toContain('<NOME DO PREPOSTO>');
  });

  it('preserva rodapé DOU se aparecer ANTES do form annex', () => {
    const input = 'Art. 1º Texto.\n\nEste texto não substitui o publicado no DOU\n\nDocumento assinado eletronicamente\n<NOME DO FISCAL TECNICO>';
    const out = stripFormAnnex(input);
    expect(out).toContain('Este texto não substitui');
    expect(out).not.toContain('<NOME DO FISCAL TECNICO>');
  });

  it('é no-op quando não há placeholder', () => {
    const input = 'Art. 1º Norma sem anexo.\n\nEste texto não substitui...';
    expect(stripFormAnnex(input)).toBe(input);
  });
});
```

- [ ] **Step 2: Rodar testes — confirmar que falham**

```bash
npm test -- test/legislative-scrapers/normalize.test.ts
```

Expected: todos os testes falham com "Cannot find module '../../lib/legislative-scrapers/normalize'".

- [ ] **Step 3: Implementar `normalize.ts`**

Criar `lib/legislative-scrapers/normalize.ts`:

```typescript
/**
 * Normalização pós-extração para scrapers de legislação.
 *
 * Funções puras, sem I/O, sem state global.
 * Cada função aceita string e retorna string transformada.
 */

/**
 * Colapsa espaços em branco em excesso.
 *
 * - Remove espaços/NBSP no início e fim de cada linha.
 * - Linhas com apenas whitespace (incluindo NBSP \u00A0) viram linhas vazias.
 * - Runs de 2+ linhas vazias colapsam para exatamente uma linha em branco (\n\n).
 * - Runs de espaços múltiplos dentro de uma linha colapsam para 1 espaço.
 * - Trim final.
 */
export function collapseWhitespace(text: string): string {
  return text
    // Normalizar EOL
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Linhas "vazias" com apenas whitespace/NBSP → string vazia
    .replace(/^[\s\u00A0]+$/gm, '')
    // Trim por linha
    .replace(/^[ \t\u00A0]+|[ \t\u00A0]+$/gm, '')
    // Múltiplos espaços internos → 1
    .replace(/[ \t]+/g, ' ')
    // Runs de 3+ \n → 2
    .replace(/\n{3,}/g, '\n\n')
    // Trim geral
    .trim();
}

/**
 * Remove boilerplate DOU (in.gov.br).
 *
 * Aplicar APÓS extração + collapseWhitespace.
 *
 * Remove:
 * - Masthead: "Brasão do Brasil" + "Diário Oficial da União" + metadados
 *   ("Publicado em", "Edição", "Seção", "Página", "Órgão"), até o fim da linha
 *   "Órgão: ..." inclusive.
 * - Footer: "Borda do rodapé" e "Logo da Imprensa" até o fim do texto.
 *
 * Preserva:
 * - "Este conteúdo não substitui..." (footer DOU legítimo)
 * - Todo o texto normativo entre masthead e footer.
 *
 * É no-op quando o texto não contém os markers.
 */
export function stripDouBoilerplate(text: string): string {
  let result = text;

  // Masthead: se começar com "Brasão do Brasil" (tolerando whitespace),
  // cortar tudo até o fim da linha "Órgão: ..." (pode ser multi-linha).
  if (/^\s*Brasão do Brasil/.test(result)) {
    // Match "Órgão:" (possibly multi-line) até a próxima linha em branco.
    const orgaoIdx = result.indexOf('Órgão:');
    if (orgaoIdx >= 0) {
      // Encontrar próxima linha em branco após o "Órgão:" (ou próximo Art./Instrução Normativa/Portaria/Decreto)
      const afterOrgao = result.slice(orgaoIdx);
      const match = afterOrgao.match(/(?:Instrução Normativa|Portaria|Decreto|Resolução|Lei)[\s\S]*/);
      if (match) {
        result = match[0];
      }
    }
  }

  // Footer: cortar de "Borda do rodapé" em diante.
  const bordaIdx = result.indexOf('Borda do rodapé');
  if (bordaIdx >= 0) {
    result = result.slice(0, bordaIdx).trimEnd();
  }

  return result;
}

/**
 * Remove formulários-modelo anexados ao fim do texto normativo.
 *
 * Detecta o PRIMEIRO placeholder de formulário (`<NOME DO FISCAL TECNICO>`,
 * `<NOME DO GESTOR>`, `<NOME DO PREPOSTO>`) e corta do início da linha que
 * o contém em diante. Preserva tudo ANTES (incluindo "Este texto não substitui...").
 *
 * É no-op quando não há placeholder.
 */
export function stripFormAnnex(text: string): string {
  const placeholder = /<NOME DO (?:FISCAL TECNICO|GESTOR|PREPOSTO)>/;
  const match = placeholder.exec(text);
  if (!match) return text;

  const idx = match.index;
  // Recuar até o início da linha atual
  const lineStart = text.lastIndexOf('\n', idx - 1);
  const cutAt = lineStart >= 0 ? lineStart : 0;

  // Também recuar mais se as linhas imediatamente anteriores forem
  // "Documento assinado eletronicamente" (contexto do form annex)
  let result = text.slice(0, cutAt);
  const sigPattern = /\n\s*Documento assinado eletronicamente\s*$/;
  while (sigPattern.test(result)) {
    result = result.replace(sigPattern, '');
  }

  return result.trimEnd();
}
```

- [ ] **Step 4: Rodar testes — confirmar que passam**

```bash
npm test -- test/legislative-scrapers/normalize.test.ts
```

Expected: todos passam. Se algum falhar, ajustar a implementação (não os testes) até passar.

- [ ] **Step 5: Commit**

```bash
git add lib/legislative-scrapers/normalize.ts test/legislative-scrapers/normalize.test.ts
git commit -m "feat(scrapers): módulo normalize com helpers puros (collapse, DOU boilerplate, form annex)"
```

---

### Task 3: Teste de integração do PlanaltoScraper (F4 preparation)

**Files:**
- Create: `test/legislative-scrapers/planalto.test.ts`

Este teste usa o fixture Planalto e valida que a extração não contém ruído de whitespace. Inicialmente FALHA (ruído ainda presente); será corrigido na Task 4.

- [ ] **Step 1: Escrever teste**

```typescript
// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PlanaltoScraper } from '../../lib/legislative-scrapers/planalto';

const FIXTURE_PATH = join(__dirname, 'fixtures/planalto-decreto-12807-2025.html');
const FIXTURE_HTML = readFileSync(FIXTURE_PATH, 'utf-8');

// Truque para testar extractContent sem fetch: usar fetch mocked global
describe('PlanaltoScraper.extractContent (via fixture)', () => {
  it('extrai conteúdo substantivo (>2000 chars) do Decreto 12.807/2025', async () => {
    global.fetch = async () =>
      new Response(FIXTURE_HTML, { status: 200, headers: { 'content-type': 'text/html' } });

    const scraper = new PlanaltoScraper();
    const result = await scraper.scrape('https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12807.htm');

    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content!.length).toBeGreaterThan(2000);
  });

  it('contém o texto normativo principal', async () => {
    global.fetch = async () =>
      new Response(FIXTURE_HTML, { status: 200, headers: { 'content-type': 'text/html' } });

    const scraper = new PlanaltoScraper();
    const result = await scraper.scrape('https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12807.htm');

    expect(result.content).toContain('DECRETO');
    expect(result.content).toContain('Art.');
  });

  it('NÃO contém runs de 3+ linhas em branco consecutivas', async () => {
    global.fetch = async () =>
      new Response(FIXTURE_HTML, { status: 200, headers: { 'content-type': 'text/html' } });

    const scraper = new PlanaltoScraper();
    const result = await scraper.scrape('https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12807.htm');

    // No máximo 2 \n consecutivos (uma linha em branco)
    expect(result.content).not.toMatch(/\n{3,}/);
    // No máximo 2 runs de " \n" consecutivos
    expect(result.content).not.toMatch(/(\s*\n){3,}/);
  });

  it('NÃO contém NBSP isolado em linhas vazias', async () => {
    global.fetch = async () =>
      new Response(FIXTURE_HTML, { status: 200, headers: { 'content-type': 'text/html' } });

    const scraper = new PlanaltoScraper();
    const result = await scraper.scrape('https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12807.htm');

    // Não deve ter linhas contendo apenas \u00A0
    expect(result.content).not.toMatch(/^[\u00A0]+$/m);
  });
});
```

- [ ] **Step 2: Rodar teste — confirmar que os últimos 2 testes falham (bug atual)**

```bash
npm test -- test/legislative-scrapers/planalto.test.ts
```

Expected: primeiros 2 testes passam (conteúdo extrai), últimos 2 falham (whitespace não colapsado). Salvar exit code como baseline — esse é o bug.

---

### Task 4: F4 — Planalto whitespace fix

**Files:**
- Modify: `lib/legislative-scrapers/planalto.ts` (função `cleanText`)

- [ ] **Step 1: Ler o arquivo atual**

```bash
cat lib/legislative-scrapers/planalto.ts
```

Localizar a função `cleanText` (linhas ~160+). Padrão atual faz: normalizar EOL, `\n{3,}` → `\n\n`, colapsar spaces, trim. NÃO trata NBSP nem linhas "vazias" com spaces.

- [ ] **Step 2: Substituir `cleanText` por uso de `collapseWhitespace`**

Modificar `lib/legislative-scrapers/planalto.ts`:

1. Adicionar import no topo (após imports existentes):
```typescript
import { collapseWhitespace } from './normalize';
```

2. Substituir o corpo do método privado `cleanText` por:
```typescript
  private cleanText(text: string): string {
    return collapseWhitespace(text);
  }
```

3. Remover qualquer lógica duplicada que `collapseWhitespace` já cobre.

- [ ] **Step 3: Rodar testes — confirmar que passam**

```bash
npm test -- test/legislative-scrapers/planalto.test.ts
```

Expected: 4 testes passam.

- [ ] **Step 4: Commit**

```bash
git add lib/legislative-scrapers/planalto.ts test/legislative-scrapers/planalto.test.ts
git commit -m "fix(scrapers): Planalto whitespace — usar collapseWhitespace (remove runs de NBSP)"
```

---

### Task 5: Teste de integração do GovBrComprasScraper (F3 preparation — truncation case)

**Files:**
- Create: `test/legislative-scrapers/govbr-compras.test.ts`

Este teste cobre a Portaria SEGES/MGI 4.932/2023 que hoje extrai só 826 chars (deveria ter ~25k). Inicialmente FALHA.

- [ ] **Step 1: Escrever teste**

```typescript
// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GovBrComprasScraper } from '../../lib/legislative-scrapers/govbr-compras';

const FIXTURES = join(__dirname, 'fixtures');

function mockFetch(html: string) {
  global.fetch = async () =>
    new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
}

describe('GovBrComprasScraper — Portaria SEGES/MGI 4.932/2023 (caso truncation)', () => {
  const html = readFileSync(join(FIXTURES, 'govbr-portaria-seges-mgi-4932-2023.html'), 'utf-8');

  it('extrai conteúdo substantivo (>10000 chars — não o stub de 826 chars)', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape('https://www.gov.br/compras/pt-br/seges-mgi-4932-2023');

    expect(result.success).toBe(true);
    expect(result.content!.length).toBeGreaterThan(10000);
  });

  it('contém o corpo da portaria (Art. 1º, Art. 2º, etc.)', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape('https://www.gov.br/compras/pt-br/seges-mgi-4932-2023');

    expect(result.content).toContain('Art. 1');
    expect(result.content).toContain('Art. 2');
    expect(result.content).toMatch(/PORTARIA SEGES\/MGI/);
  });
});
```

- [ ] **Step 2: Rodar teste — confirmar falha (truncation)**

```bash
npm test -- test/legislative-scrapers/govbr-compras.test.ts
```

Expected: falha porque `result.content!.length` é pequeno (<1000 chars — o bug).

---

### Task 6: F3 — Selector strategy em `govbr-compras.ts`

**Files:**
- Modify: `lib/legislative-scrapers/govbr-compras.ts`

- [ ] **Step 1: Refatorar `extractContent` com estratégia "maior match > threshold"**

Substituir o método privado `extractContent` (linhas ~136-159 de `govbr-compras.ts`) por:

```typescript
  private extractContent(html: string): string {
    const $ = cheerio.load(html);

    // Remover elementos indesejados
    ELEMENTS_TO_REMOVE.forEach(selector => {
      $(selector).remove();
    });

    // Estratégia: coletar texto de TODOS os seletores primários,
    // escolher o de MAIOR tamanho desde que > 500 chars.
    // Primários = seletores que capturam o corpo completo do ato.
    const PRIMARY_SELECTORS = [
      '#parent-fieldname-text', // Plone body (gov.br/compras, gov.br/gestao) — geralmente o mais longo
      '.materia',                // DOU materia
      '#content-core',           // Plone content wrapper (pode conter body ou só metadados)
      'article',                 // HTML5 article
      'main',                    // HTML5 main
      '.content-area',
      '#main-content',
      '.conteudo-materia',
      '.texto-dou',
    ];

    let best = '';
    for (const selector of PRIMARY_SELECTORS) {
      const el = $(selector);
      if (el.length === 0) continue;
      const text = this.cleanText(el.text());
      if (text.length > best.length) {
        best = text;
      }
    }

    if (best.length >= 500) {
      return best;
    }

    // Fallbacks genéricos com threshold menor (para atos legitimamente curtos)
    const FALLBACK_SELECTORS = [
      '.text-body',
      '.dou-paragraph',
      '#materia',
      '.content',
      '.documentFirstHeading + div',
    ];

    for (const selector of FALLBACK_SELECTORS) {
      const el = $(selector);
      if (el.length === 0) continue;
      const text = this.cleanText(el.text());
      if (text.length > 100) return text;
    }

    // Último recurso: body inteiro
    return this.cleanText($('body').text());
  }
```

- [ ] **Step 2: Rodar testes — confirmar que o teste de truncation passa**

```bash
npm test -- test/legislative-scrapers/govbr-compras.test.ts
```

Expected: 2 testes passam.

- [ ] **Step 3: Commit**

```bash
git add lib/legislative-scrapers/govbr-compras.ts test/legislative-scrapers/govbr-compras.test.ts
git commit -m "fix(scrapers): govbr-compras — estratégia 'maior match > 500' para evitar truncation"
```

---

### Task 7: F5 — in.gov.br DOU boilerplate

**Files:**
- Modify: `lib/legislative-scrapers/govbr-compras.ts`
- Modify: `test/legislative-scrapers/govbr-compras.test.ts` (adicionar describe block)

- [ ] **Step 1: Adicionar testes para in.gov.br**

Acrescentar ao final de `test/legislative-scrapers/govbr-compras.test.ts`:

```typescript
describe('GovBrComprasScraper — IN SGD/MGI 86/2025 (caso in.gov.br boilerplate)', () => {
  const html = readFileSync(join(FIXTURES, 'in-gov-br-sgd-mgi-86-2025.html'), 'utf-8');
  const url = 'https://www.in.gov.br/en/web/dou/-/instrucao-normativa-sgd-mgi-n-86-de-25-de-julho-de-2025-';

  it('NÃO contém "Brasão do Brasil" (masthead removido)', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);
    expect(result.content).not.toContain('Brasão do Brasil');
  });

  it('NÃO contém "Borda do rodapé" nem "Logo da Imprensa" (footer removido)', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);
    expect(result.content).not.toContain('Borda do rodapé');
    expect(result.content).not.toContain('Logo da Imprensa');
  });

  it('preserva o texto normativo', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);
    expect(result.content).toContain('Instrução Normativa');
    expect(result.content).toMatch(/Art\.\s*\d+/);
  });

  it('preserva "Este conteúdo não substitui" se presente', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);
    // Se o fixture tem esse footer, deve ser preservado;
    // se não tem, o teste é no-op (skip implícito)
    const raw = html;
    if (raw.includes('Este conteúdo não substitui')) {
      expect(result.content).toContain('Este conteúdo não substitui');
    }
  });
});
```

- [ ] **Step 2: Rodar testes — confirmar falhas**

```bash
npm test -- test/legislative-scrapers/govbr-compras.test.ts
```

Expected: testes de Brasão/Borda falham porque o boilerplate ainda está presente.

- [ ] **Step 3: Aplicar `stripDouBoilerplate` no scraper**

Modificar `lib/legislative-scrapers/govbr-compras.ts`:

1. Importar `stripDouBoilerplate` no topo (após imports existentes):
```typescript
import { stripDouBoilerplate } from './normalize';
```

2. Na classe `GovBrComprasScraper`, método `scrape`, APÓS `const content = this.extractContent(html);` mas ANTES da validação de `content.length < 100`, adicionar:

```typescript
      // Aplicar limpeza DOU se URL for in.gov.br
      const isDou = /(?:^|\.)in\.gov\.br/.test(new URL(url).hostname);
      const cleanedContent = isDou ? stripDouBoilerplate(content) : content;
```

3. Usar `cleanedContent` em vez de `content` nas linhas subsequentes (`if (!cleanedContent || cleanedContent.length < 100)` e `content: cleanedContent`).

- [ ] **Step 4: Rodar testes — confirmar passam**

```bash
npm test -- test/legislative-scrapers/govbr-compras.test.ts
```

Expected: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add lib/legislative-scrapers/govbr-compras.ts test/legislative-scrapers/govbr-compras.test.ts
git commit -m "fix(scrapers): remover boilerplate DOU (masthead + footer) de páginas in.gov.br"
```

---

### Task 8: F6 — SGD/MGI form annex cutoff

**Files:**
- Modify: `lib/legislative-scrapers/govbr-compras.ts`
- Modify: `test/legislative-scrapers/govbr-compras.test.ts`

- [ ] **Step 1: Adicionar testes para SGD form annex**

Acrescentar ao final de `test/legislative-scrapers/govbr-compras.test.ts`:

```typescript
describe('GovBrComprasScraper — Portaria SGD/MGI 6.680/2024 (caso form annex)', () => {
  const html = readFileSync(join(FIXTURES, 'sgd-mgi-portaria-6680-2024.html'), 'utf-8');
  const url = 'https://www.in.gov.br/en/web/dou/-/portaria-sgd/mgi-n-6.680-de-4-de-outubro-de-2024-589193103';

  it('NÃO contém "<NOME DO FISCAL TECNICO>" no conteúdo', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);
    expect(result.content).not.toContain('<NOME DO FISCAL TECNICO>');
    expect(result.content).not.toContain('<NOME DO GESTOR>');
    expect(result.content).not.toContain('<NOME DO PREPOSTO>');
  });

  it('preserva texto normativo (Art. 1º e ementa)', async () => {
    mockFetch(html);
    const scraper = new GovBrComprasScraper();
    const result = await scraper.scrape(url);
    expect(result.content).toMatch(/Portaria SGD\/MGI/i);
    expect(result.content).toMatch(/Art\.\s*1/);
  });
});
```

- [ ] **Step 2: Rodar testes — confirmar falha**

```bash
npm test -- test/legislative-scrapers/govbr-compras.test.ts
```

Expected: testes de NOME DO FISCAL falham (placeholder ainda presente).

- [ ] **Step 3: Aplicar `stripFormAnnex` no scraper**

Modificar `lib/legislative-scrapers/govbr-compras.ts`:

1. Estender o import da Task 7:
```typescript
import { stripDouBoilerplate, stripFormAnnex } from './normalize';
```

2. No método `scrape`, após `cleanedContent` (da Task 7), adicionar:
```typescript
      // Remover formulários-modelo anexos (ex: Portarias SGD/MGI com <NOME DO FISCAL TECNICO>)
      const finalContent = stripFormAnnex(cleanedContent);
```

3. Usar `finalContent` em vez de `cleanedContent` nas linhas subsequentes.

- [ ] **Step 4: Rodar testes — confirmar passam**

```bash
npm test -- test/legislative-scrapers/govbr-compras.test.ts
```

Expected: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add lib/legislative-scrapers/govbr-compras.ts test/legislative-scrapers/govbr-compras.test.ts
git commit -m "fix(scrapers): remover formulários-modelo (<NOME DO FISCAL TECNICO>) do fim do texto"
```

---

### Task 9: F7 — MP 1.167/2023 URL investigation

**Files:**
- Create: `scripts/fix-mp-1167-url.ts`

- [ ] **Step 1: Fetch manual da URL atual**

```bash
curl -sSL -o /tmp/mp1167.html -w "HTTP %{http_code}\nSize %{size_download}\n" \
  "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/mpv/mpv1167.htm"
```

Se retornar `HTTP 200` com size > 1KB: URL funciona, o fetch da auditoria foi transiente. Pular para Task 10 (re-scrape resolve).

Se retornar 404 ou size < 1KB: prosseguir para Step 2 abaixo.

- [ ] **Step 2: Investigar destino**

MP pode ter sido convertida em lei, arquivada, ou URL mudou. Procurar:

```bash
# Buscar "MP 1.167" no legislacao.planalto
curl -sSL "https://legislacao.planalto.gov.br/LEGISLA/Legislacao.nsf/FrmConsultaWeb1?OpenForm&UnidFedDf=ME&Norma=MEDIDA+PROVIS%C3%93RIA&Numero=1.167&Ano=2023" | grep -oE 'href="[^"]+' | head -20
```

Documentar achado em um comentário no topo do script `fix-mp-1167-url.ts`.

- [ ] **Step 3: Criar script de correção**

Se a URL mudou: criar `scripts/fix-mp-1167-url.ts`:

```typescript
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const NEW_URL = '<preencher com URL real encontrada>';
const FULL_NUMBER = 'MP 1.167/2023';

async function main() {
  const act = await prisma.legislativeAct.findFirst({ where: { fullNumber: FULL_NUMBER } });
  if (!act) {
    console.error(`Ato ${FULL_NUMBER} não encontrado no banco`);
    return;
  }
  console.log(`Atualizando officialUrl:\n  FROM: ${act.officialUrl}\n  TO:   ${NEW_URL}`);
  await prisma.legislativeAct.update({
    where: { id: act.id },
    data: {
      officialUrl: NEW_URL,
      scrapeStatus: null, // forçar re-scrape
      lastScrapedAt: null,
    },
  });
  console.log('OK');
}

main().finally(() => prisma.$disconnect());
```

Rodar:
```bash
npx dotenv -e .env.local -- npx tsx scripts/fix-mp-1167-url.ts
```

Se o Step 1 mostrou que URL funciona, apenas pular este Step 3 (script não precisa existir; re-scrape em Task 10 resolverá).

- [ ] **Step 4: Commit (se script foi criado)**

```bash
git add scripts/fix-mp-1167-url.ts
git commit -m "fix(data): atualizar officialUrl da MP 1.167/2023"
```

---

### Task 10: Script de re-scrape em batch

**Files:**
- Create: `scripts/rescrape-affected-acts.ts`

Orquestra re-scrape dos atos afetados lendo o JSON da auditoria. Usa `scrapeAndIndexAct` (path de produção).

- [ ] **Step 1: Escrever script**

```typescript
/**
 * Re-scrape dos atos afetados pelos fixes (Bundle A de T1).
 *
 * Seleciona IDs a partir do JSON da auditoria:
 *   - spotCheckSuspicious: atos com verdict != ok
 *   - Atos com scrapeStatus null (opcional via flag)
 *
 * Para cada ID: chama scrapeAndIndexAct com 2s de delay.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/rescrape-affected-acts.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/rescrape-affected-acts.ts --include-null-status
 *   npx dotenv -e .env.local -- npx tsx scripts/rescrape-affected-acts.ts --dry-run
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { scrapeAndIndexAct } from '@/lib/legislative-scrapers/scrape-and-index';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const INCLUDE_NULL = process.argv.includes('--include-null-status');
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1. Ler audit JSON
  const auditPath = path.join(process.cwd(), 'docs', 'audits', '2026-04-19-legislative-acts-audit.json');
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));

  // 2. Coletar IDs únicos
  const ids = new Set<string>();
  for (const row of audit.spotCheck ?? []) {
    if (row.verdict !== 'ok') ids.add(row.id);
  }

  if (INCLUDE_NULL) {
    const nullStatusActs = await prisma.legislativeAct.findMany({
      where: { scrapeStatus: null, officialUrl: { not: null } },
      select: { id: true },
    });
    for (const a of nullStatusActs) ids.add(a.id);
  }

  const idList = Array.from(ids);
  console.log(`Re-scrape de ${idList.length} atos (include-null-status=${INCLUDE_NULL}, dry-run=${DRY_RUN})`);

  if (DRY_RUN) {
    for (const id of idList) console.log(`  would rescrape: ${id}`);
    return;
  }

  // 3. Executar com delay
  let ok = 0, fail = 0;
  for (let i = 0; i < idList.length; i++) {
    const id = idList[i];
    const act = await prisma.legislativeAct.findUnique({
      where: { id },
      select: { fullNumber: true, officialUrl: true },
    });
    console.log(`[${i + 1}/${idList.length}] ${act?.fullNumber} → ${act?.officialUrl}`);

    const result = await scrapeAndIndexAct(id);
    if (result.scraped) {
      console.log(`  ✓ scraped${result.indexed ? ' + indexed' : ''}`);
      ok++;
    } else {
      console.log(`  ✗ failed: ${result.error ?? 'unknown'}`);
      fail++;
    }

    if (i < idList.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nResumo: ${ok} OK, ${fail} falharam, ${idList.length} total.`);
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
npx dotenv -e .env.local -- npx tsx scripts/rescrape-affected-acts.ts --dry-run
```

Expected: imprime "Re-scrape de N atos" + lista de IDs sem fazer chamadas.

- [ ] **Step 3: Rodar de verdade (COM null-status)**

```bash
npx dotenv -e .env.local -- npx tsx scripts/rescrape-affected-acts.ts --include-null-status
```

Expected: ~30 atos processados ao longo de ~1-2 min (com delay de 2s). Maioria imprime "✓ scraped + indexed". Alguns podem falhar (TCU SPA, MPF PDF — esperado; fora do escopo deste bundle).

- [ ] **Step 4: Commit do script**

```bash
git add scripts/rescrape-affected-acts.ts
git commit -m "feat(scripts): rescrape-affected-acts — batch usando JSON da auditoria"
```

---

### Task 11: Deprecation notice + re-auditoria + commit final

**Files:**
- Modify: `scripts/scrape-legislative-acts-content.ts` (aviso no topo)
- Generate: `docs/audits/2026-04-19-legislative-acts-audit-post-fix.md` (+ `.json`)
- Modify: `FUTURE_TASKS.md` (marcar F3-F7 como feitos em T1)

- [ ] **Step 1: Deprecation notice**

Modificar `scripts/scrape-legislative-acts-content.ts`, adicionando no topo (após o docblock existente):

```typescript
/**
 * [!] DEPRECADO — use `scripts/rescrape-affected-acts.ts` ou
 * `lib/legislative-scrapers/scrape-and-index.ts#scrapeAndIndexAct(id)`.
 *
 * Este script é baseado em regex e NÃO é o caminho de produção.
 * Os fixes de extração (F3-F7 do Bundle A) estão em `lib/legislative-scrapers/`.
 * Mantido temporariamente para compatibilidade. Remover em sessão futura.
 */
```

- [ ] **Step 2: Adaptar audit script para suportar sufixo no nome**

Modificar `scripts/audit-legislative-acts.ts`, adicionar CLI arg `--suffix=STRING` que adiciona sufixo ao nome dos arquivos de saída:

Localizar a linha `const today = new Date().toISOString().slice(0, 10);` e imediatamente após ela, adicionar:

```typescript
  const SUFFIX_ARG = process.argv.find((a) => a.startsWith('--suffix='));
  const suffix = SUFFIX_ARG ? '-' + SUFFIX_ARG.split('=')[1] : '';
```

Em seguida, atualizar as duas linhas que constroem `mdPath` e `jsonPath`:

```typescript
  const mdPath = path.join(outDir, `${today}-legislative-acts-audit${suffix}.md`);
  const jsonPath = path.join(outDir, `${today}-legislative-acts-audit${suffix}.json`);
```

- [ ] **Step 3: Re-rodar auditoria com sufixo post-fix**

```bash
npx dotenv -e .env.local -- npx tsx scripts/audit-legislative-acts.ts --suffix=post-fix
```

Expected: gera `docs/audits/2026-04-19-legislative-acts-audit-post-fix.md` e `.json`. Verificar as métricas de sucesso:
- `spotCheckSuspicious` ≤ 3 (alvo: 0, tolera 3 se forem TCU + MPF)
- Portaria SEGES/MGI 4.932/2023 ratio ≥ 0.7
- `scrapeStatus: null` ≤ 2

- [ ] **Step 4: Comparar e documentar**

Abrir ambos relatórios lado a lado. Gerar um resumo do diff em `docs/audits/2026-04-19-diff-summary.md`:

```markdown
# Bundle A Fixes — Antes vs Depois

**Baseline:** `docs/audits/2026-04-19-legislative-acts-audit.md` (pré-fix)
**Post-fix:** `docs/audits/2026-04-19-legislative-acts-audit-post-fix.md`

## Métricas

| Métrica | Antes | Depois | Delta |
|---|---:|---:|---:|
| Total de atos | 108 | 108 | 0 |
| `spotCheckSuspicious` | 11 | <X> | <delta> |
| `scrapeStatus: null` | 20 | <X> | <delta> |
| Portaria SEGES/MGI 4.932/2023 ratio | 0.03 | <X> | <delta> |
| Resoluções SEGES-CICS/MGI truncadas | 6 | <X> | <delta> |

## Amostras limpas (Section 7)
- Planalto Decretos: [descrever se runs de ⏎ sumiram]
- IN SGD/MGI 86/2025: [descrever se "Brasão do Brasil"/"Borda do rodapé" sumiram]
- Portaria SGD/MGI 6.680/2024: [descrever se <NOME DO FISCAL TECNICO> sumiu]

## Pendências restantes
- TCU (Portarias 3/2025 e 175/2022): ainda bloated (SPA — fix em sessão separada)
- MPF Biblioteca (Portaria MPU 178/2023): ainda truncated (PDF — fix em sessão separada)
```

Preencher os `<X>` com valores reais extraídos dos dois relatórios.

- [ ] **Step 5: Atualizar FUTURE_TASKS.md**

Em `FUTURE_TASKS.md`, na seção T1, marcar as ações F3-F7 do Bundle A como concluídas:

- Mudar `- [ ] Corrigir www.gov.br / www.in.gov.br...` para `- [x] Corrigir www.gov.br / www.in.gov.br parser...` (concluído em 2026-04-19)
- Mudar `- [ ] Limpar ruído de table-row do parser Planalto...` para `- [x] Limpar ruído...`
- Mudar `- [ ] Remover masthead...` para `- [x] Remover masthead...`
- Mudar `- [ ] Detectar e excluir formulários-modelo...` para `- [x] Detectar e excluir...`
- Mudar `- [ ] Investigar MP 1.167/2023...` para `- [x] Investigar MP 1.167/2023...` (ou `- [~]` se ainda em aberto)
- Adicionar linha: `**Bundle A concluído em 2026-04-19**. Ver \`docs/audits/2026-04-19-diff-summary.md\`. Restante em bundles futuros (TCU SPA, MPF PDF, themes taxonomy).`

Manter F1, F2, F8 e demais itens em aberto.

- [ ] **Step 6: Commit final**

```bash
git add scripts/scrape-legislative-acts-content.ts scripts/audit-legislative-acts.ts
git add docs/audits/2026-04-19-legislative-acts-audit-post-fix.md docs/audits/2026-04-19-legislative-acts-audit-post-fix.json docs/audits/2026-04-19-diff-summary.md
git add FUTURE_TASKS.md
git commit -m "docs(audit): relatório post-fix + diff summary + marcar F3-F7 concluídos em T1"
```

---

## Self-Review

**Spec coverage:**
- ✓ F3 (gov.br truncation) → Tasks 5+6
- ✓ F4 (Planalto whitespace) → Tasks 3+4
- ✓ F5 (in.gov.br boilerplate) → Task 7
- ✓ F6 (SGD form annex) → Task 8
- ✓ F7 (MP 1.167 URL) → Task 9
- ✓ Arquitetura-alvo (lib/legislative-scrapers) → todos os fixes aplicados lá
- ✓ `normalize.ts` com 3 helpers puros → Task 2
- ✓ Fixtures reais → Task 1
- ✓ Testes vitest → Tasks 2, 3, 5, 7, 8
- ✓ Re-scrape com `scrapeAndIndexAct` → Task 10
- ✓ Re-auditoria com sufixo → Task 11
- ✓ Diff summary → Task 11 Step 4
- ✓ Deprecation notice no script regex → Task 11 Step 1
- ✓ T1 atualizado → Task 11 Step 5

**Placeholder scan:**
- No placeholders "TBD/TODO" no plano em si
- `<preencher com URL real encontrada>` em Task 9 Step 3 é intencional — depende do resultado da investigação Step 1/2
- `<X>` no template do diff summary é intencional — preenchido manualmente após rodar

**Type consistency:**
- `collapseWhitespace`, `stripDouBoilerplate`, `stripFormAnnex` usados consistentemente em Tasks 2, 4, 7, 8
- `GovBrComprasScraper` signature não muda (apenas corpo interno)
- `PlanaltoScraper` signature não muda
- `scrapeAndIndexAct` reutilizado em Task 10 conforme arquitetura existente

---

## Próximo passo após plan aprovado

Offer execução:

1. **Subagent-Driven** (recomendado) — fresh subagent por task, 2-stage review
2. **Inline Execution** — executing-plans com checkpoints

Escolher uma.
