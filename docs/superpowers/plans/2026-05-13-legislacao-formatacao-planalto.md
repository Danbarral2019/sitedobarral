# Formatação Planalto-like na página de legislação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aproximar a apresentação da seção "Texto Integral" em `/legislacao/[id]` da formatação oficial do Planalto — título centralizado em vinho, ementa lateral, hierarquia visual de Art./§/incisos/alíneas, blocos de alteração com recuo extra, pontilhados de omissão e *caput* em itálico.

**Architecture:** Reforçar `lib/format-legal-content.ts` para emitir markdown com diretivas semânticas (`:::alteracao`, `:omitido`, `:nr`, `:::signature`) via `remark-directive`. Adicionar variante opt-in `variant="planalto"` em `components/MarkdownContent.tsx` com CSS escopado (`markdown-content--planalto`) + fonte serif Lora. A página `/legislacao/[id]` passa a prop; outras superfícies (blog, lei-comentada) ficam intactas.

**Tech Stack:** Next.js 15 (App Router, Server Components), React 19, TypeScript 5, Vitest, react-markdown 10, remark-gfm 4, **remark-directive 4** (nova), `next/font/google` (Lora).

**Spec:** [`docs/superpowers/specs/2026-05-13-legislacao-formatacao-planalto-design.md`](../specs/2026-05-13-legislacao-formatacao-planalto-design.md)

---

## File Structure

**Criar:**
- `lib/format-legal-content.test.ts` — suíte completa (Grupos A/B/C)
- `lib/__snapshots__/format-legal-content.test.ts.snap` — auto-gerado pelo Vitest

**Modificar:**
- `lib/format-legal-content.ts` — 7 regras novas/reforçadas (~80 linhas adicionadas)
- `components/MarkdownContent.tsx` — variante CSS + 4 custom components + font Lora (~150 linhas)
- `app/(acervo)/legislacao/[id]/page.tsx` — 1 linha (prop `variant="planalto"`)
- `package.json` — +1 dep: `remark-directive`

**Não tocar:**
- `prisma/schema.prisma`, pipeline de scraping, `lib/legislative-acts/`
- Rotas `/area-restrita/lei-comentada`, `/artigo/[numero]`, `/blog/[slug]`

---

## Task 1: Setup — dependências + scaffold de testes

**Files:**
- Modify: `package.json` (+`remark-directive`)
- Create: `lib/format-legal-content.test.ts`

- [ ] **Step 1.1: Instalar `remark-directive`**

```bash
cd C:/Users/User/projetos/sitedobarral
npm install remark-directive@^4
```

Esperado: instala `remark-directive@4.x.x` sem warnings de peer deps.

- [ ] **Step 1.2: Verificar instalação**

```bash
node -e "console.log(require('remark-directive').name)"
```

Esperado: imprime `remarkDirective` ou similar (confirma que o módulo carrega).

- [ ] **Step 1.3: Criar scaffold do arquivo de testes**

Criar `lib/format-legal-content.test.ts` com:

```typescript
import { describe, it, expect } from 'vitest';
import { formatLegalContent } from './format-legal-content';

describe('formatLegalContent', () => {
  describe('caput em itálico', () => {
    it('placeholder', () => {
      expect(true).toBe(true);
    });
  });
});
```

- [ ] **Step 1.4: Rodar para confirmar que o test runner pega o arquivo**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 1 test passed. Se Vitest reclamar de import, verifique se `vitest.config.ts` cobre `lib/**/*.test.ts` (deve cobrir — outros testes em `lib/` já rodam).

- [ ] **Step 1.5: Commit**

```bash
git add package.json package-lock.json lib/format-legal-content.test.ts
git commit -m "chore(legislacao): instala remark-directive e scaffold de testes do format-legal-content"
```

---

## Task 2: Regra E — *caput* em itálico (TDD)

Começamos pela regra mais simples para validar o ciclo TDD.

**Files:**
- Modify: `lib/format-legal-content.ts`
- Modify: `lib/format-legal-content.test.ts`

- [ ] **Step 2.1: Escrever o teste falho**

Substituir o bloco `describe('caput em itálico', ...)` em `lib/format-legal-content.test.ts` por:

```typescript
describe('caput em itálico', () => {
  it('italiciza caput entre vírgulas', () => {
    const input = 'art. 84, caput, inciso IV, da Constituição';
    const output = formatLegalContent(input);
    expect(output).toContain('*caput*');
  });

  it('italiciza caput seguido de espaço', () => {
    const input = 'previsto no caput deste artigo';
    const output = formatLegalContent(input);
    expect(output).toContain('*caput*');
  });

  it('NÃO italiciza caput dentro de outra palavra (word boundary)', () => {
    const input = 'isto é capturar dados, não capitular';
    const output = formatLegalContent(input);
    expect(output).not.toContain('*capt*urar');
    expect(output).not.toContain('*capt*ular');
    expect(output).toContain('capturar');
    expect(output).toContain('capitular');
  });
});
```

- [ ] **Step 2.2: Rodar — confirmar que falha**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 3 tests failed (caput não está sendo italicizado).

- [ ] **Step 2.3: Implementar a regra**

Em `lib/format-legal-content.ts`, dentro do loop `for (let p of merged)` (linha ~107), **antes** da linha que faz `p = p.replace(/\s{2,}/g, ' ').trim();`, adicionar:

```typescript
// E — caput em itálico (word boundary)
p = p.replace(/\bcaput\b/g, '*caput*');
```

Exatamente assim. A `\b` evita matches dentro de palavras como `capturar`.

- [ ] **Step 2.4: Rodar — confirmar que passa**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 3 tests passed.

- [ ] **Step 2.5: Commit**

```bash
git add lib/format-legal-content.ts lib/format-legal-content.test.ts
git commit -m "feat(format-legal): italiciza caput como palavra inteira"
```

---

## Task 3: Regra C — `[...]` → `:omitido` (TDD)

**Files:**
- Modify: `lib/format-legal-content.ts`
- Modify: `lib/format-legal-content.test.ts`

- [ ] **Step 3.1: Escrever testes falhos**

Adicionar em `lib/format-legal-content.test.ts` (após o describe do caput):

```typescript
describe('[...] → :omitido', () => {
  it('substitui [...] simples por marcador inline', () => {
    const input = 'Art. 1º [...] Parágrafo único.';
    const output = formatLegalContent(input);
    expect(output).toContain(':omitido');
    expect(output).not.toContain('[...]');
  });

  it('substitui [ ... ] com espaços', () => {
    const input = 'Art. 1º [ ... ] fim';
    const output = formatLegalContent(input);
    expect(output).toContain(':omitido');
  });

  it('substitui múltiplas ocorrências no mesmo parágrafo', () => {
    const input = 'Art. 1º [...] meio [...] fim';
    const output = formatLegalContent(input);
    expect(output.match(/:omitido/g)?.length).toBe(2);
  });
});
```

- [ ] **Step 3.2: Rodar — confirmar que falham**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 3 tests failed em `[...] → :omitido`.

- [ ] **Step 3.3: Implementar**

Em `lib/format-legal-content.ts`, dentro do loop `for (let p of merged)`, logo após a regra do caput, adicionar:

```typescript
// C — [...] (com ou sem espaços) vira :omitido
p = p.replace(/\[\s*\.{3,}\s*\]/g, ':omitido');
```

- [ ] **Step 3.4: Rodar — confirmar que passam**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 6 tests passed (3 anteriores + 3 novos).

- [ ] **Step 3.5: Commit**

```bash
git add lib/format-legal-content.ts lib/format-legal-content.test.ts
git commit -m "feat(format-legal): converte [...] em marcador :omitido"
```

---

## Task 4: Regra D — `(NR)` → `:nr[(NR)]` (TDD)

**Files:**
- Modify: `lib/format-legal-content.ts`
- Modify: `lib/format-legal-content.test.ts`

- [ ] **Step 4.1: Escrever testes falhos**

Adicionar:

```typescript
describe('(NR) preserva e marca', () => {
  it('envolve (NR) no fim de parágrafo em :nr[]', () => {
    const input = 'Parágrafo único. O disposto no art. 2º... (NR)';
    const output = formatLegalContent(input);
    expect(output).toContain(':nr[(NR)]');
  });

  it('NÃO envolve (NR) no meio de parágrafo', () => {
    const input = '(NR) é uma sigla. O texto continua.';
    const output = formatLegalContent(input);
    // (NR) no início não deve virar diretiva
    expect(output).not.toContain(':nr[(NR)]');
  });
});
```

- [ ] **Step 4.2: Rodar — confirmar que falham**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 2 tests failed em `(NR) preserva`.

- [ ] **Step 4.3: Implementar**

Adicionar ao loop, após a regra `[...]`:

```typescript
// D — (NR) no fim do parágrafo vira diretiva inline
p = p.replace(/\s\(NR\)\s*$/, ' :nr[(NR)]');
```

A âncora `$` garante que só substitui no fim do parágrafo.

- [ ] **Step 4.4: Rodar — confirmar que passam**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 8 tests passed.

- [ ] **Step 4.5: Commit**

```bash
git add lib/format-legal-content.ts lib/format-legal-content.test.ts
git commit -m "feat(format-legal): marca (NR) com diretiva :nr ao final de parágrafos"
```

---

## Task 5: Regra B — aspas curvas → `:::alteracao` (TDD, multi-paragrafo)

A regra mais complexa. Implementação em **2 passos**: primeiro a detecção single-paragraph (fácil), depois multi-paragraph com balanceamento de contador.

**Files:**
- Modify: `lib/format-legal-content.ts`
- Modify: `lib/format-legal-content.test.ts`

- [ ] **Step 5.1: Escrever testes falhos**

Adicionar:

```typescript
describe('aspas curvas → :::alteracao', () => {
  it('envolve bloco de aspas em um único parágrafo', () => {
    const input = 'Art. 1º\n\nO Decreto X passa a vigorar:\n\n"Art. 1º novo texto." (NR)';
    const output = formatLegalContent(input);
    expect(output).toContain(':::alteracao');
    expect(output).toContain(':::');
  });

  it('envolve aspas atravessando múltiplos parágrafos', () => {
    const input = [
      'Texto base.',
      '',
      '"Art. 1º começo do bloco',
      '',
      'Parágrafo único. Continua.',
      '',
      'Mais texto fechamento." (NR)',
      '',
      'Depois do bloco.',
    ].join('\n');
    const output = formatLegalContent(input);
    expect(output).toContain(':::alteracao');
    // O parágrafo "Mais texto fechamento" deve estar dentro do bloco
    const blockMatch = output.match(/:::alteracao([\s\S]*?):::/);
    expect(blockMatch).toBeTruthy();
    expect(blockMatch![1]).toContain('Mais texto fechamento');
    expect(blockMatch![1]).toContain('Parágrafo único');
  });

  it('aspas aninhadas: balanceamento de contador', () => {
    const input = '"externo "interno" externo continua." (NR)';
    const output = formatLegalContent(input);
    const blocos = output.match(/:::alteracao/g);
    expect(blocos?.length).toBe(1);
  });

  it('aspa abrindo sem fechar: fail-safe (não cria bloco)', () => {
    const input = '"texto sem fechamento até o fim do ato';
    const output = formatLegalContent(input);
    expect(output).not.toContain(':::alteracao');
    // Mas o conteúdo permanece
    expect(output).toContain('texto sem fechamento');
  });
});
```

- [ ] **Step 5.2: Rodar — confirmar que falham**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 4 tests failed em `aspas curvas`.

- [ ] **Step 5.3: Implementar a detecção de blocos**

No `lib/format-legal-content.ts`, **após** o passo de merge (linha ~101, depois do `merged.push(p)` final) e **antes** do `// Step 4: Format each paragraph into markdown`, inserir uma nova etapa:

```typescript
// Step 3.5 — Detectar blocos de alteração entre aspas curvas “…”
// Faz balanceamento de contador. Se não fechar até o fim, devolve original (fail-safe).
const withAlteracaoBlocks = wrapAlteracaoBlocks(merged);
```

E substituir o uso de `merged` no loop principal por `withAlteracaoBlocks`. Ou seja, a linha `for (let p of merged)` vira `for (let p of withAlteracaoBlocks)`.

Depois, adicionar a função `wrapAlteracaoBlocks` no final do arquivo (antes de `function isStructuralStart`):

```typescript
/**
 * Envolve sequências de parágrafos delimitadas por aspas curvas “…” em
 * marcadores :::alteracao ... ::: para destaque visual no Planalto-like CSS.
 * Tolera aspas aninhadas via contador. Se não fechar, devolve original.
 */
function wrapAlteracaoBlocks(paragraphs: string[]): string[] {
  // Detecta se há aspas curvas no texto. Se não houver, retorna sem modificação.
  const hasCurlyQuotes = paragraphs.some(p => /[“”]/.test(p));
  if (!hasCurlyQuotes) return paragraphs;

  // Verifica balanceamento total: número de “ deve ser igual a número de ”.
  let opens = 0;
  let closes = 0;
  for (const p of paragraphs) {
    opens += (p.match(/“/g) || []).length;
    closes += (p.match(/”/g) || []).length;
  }
  if (opens !== closes || opens === 0) {
    return paragraphs; // fail-safe
  }

  const result: string[] = [];
  let buffer: string[] = [];
  let depth = 0;
  let openParagraph = -1;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const localOpens = (p.match(/“/g) || []).length;
    const localCloses = (p.match(/”/g) || []).length;
    const wasZero = depth === 0;
    depth += localOpens - localCloses;

    if (wasZero && depth > 0) {
      // Abriu bloco neste parágrafo
      result.push(':::alteracao');
      openParagraph = i;
    }

    // Remove as aspas curvas do texto agora dentro do bloco (visualmente o
    // CSS já delimita o bloco; manter as aspas seria redundante).
    const stripped = p.replace(/[“”]/g, '').trim();
    if (stripped) {
      if (depth > 0 || (depth === 0 && i === openParagraph)) {
        buffer.push(stripped);
      } else {
        result.push(stripped);
      }
    }

    if (depth === 0 && buffer.length > 0) {
      // Fechou bloco neste parágrafo
      result.push(...buffer);
      result.push(':::');
      buffer = [];
      openParagraph = -1;
    }
  }

  // Defesa final: se algo sobrou no buffer (não deveria, já validamos), devolve original.
  if (buffer.length > 0) return paragraphs;
  return result;
}
```

- [ ] **Step 5.4: Rodar — confirmar que passam**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 12 tests passed (8 anteriores + 4 novos).

Se o teste de aspas aninhadas falhar, ajuste para que a contagem de `:::alteracao` no output seja exatamente 1 (o teste valida que **não** se crie bloco duplicado por causa das aspas internas).

- [ ] **Step 5.5: Commit**

```bash
git add lib/format-legal-content.ts lib/format-legal-content.test.ts
git commit -m "feat(format-legal): envolve blocos de alteração entre aspas curvas em :::alteracao"
```

---

## Task 6: Regra F — título oficial preservado como H1 (TDD)

**Files:**
- Modify: `lib/format-legal-content.ts`
- Modify: `lib/format-legal-content.test.ts`

- [ ] **Step 6.1: Escrever testes falhos**

Adicionar:

```typescript
describe('título oficial → H1', () => {
  it('promove DECRETO Nº … a # heading', () => {
    const input = [
      'Presidência da República',
      'Casa Civil',
      'DECRETO Nº 12.926, DE 13 DE ABRIL DE 2026',
      '',
      'Altera o Decreto nº 12.174...',
    ].join('\n');
    const output = formatLegalContent(input);
    expect(output).toContain('# DECRETO Nº 12.926, DE 13 DE ABRIL DE 2026');
  });

  it('promove LEI Nº … a # heading', () => {
    const input = 'LEI Nº 14.133, DE 1º DE ABRIL DE 2021\n\nDispõe sobre...';
    const output = formatLegalContent(input);
    expect(output).toContain('# LEI Nº 14.133');
  });

  it('promove PORTARIA / INSTRUÇÃO NORMATIVA / MEDIDA PROVISÓRIA', () => {
    const tipos = ['PORTARIA Nº 1', 'INSTRUÇÃO NORMATIVA Nº 1', 'MEDIDA PROVISÓRIA Nº 1'];
    for (const titulo of tipos) {
      const output = formatLegalContent(`${titulo}, DE 1 DE JANEIRO\n\nEmenta.`);
      expect(output).toContain(`# ${titulo}`);
    }
  });
});
```

- [ ] **Step 6.2: Rodar — confirmar que falham**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 3 tests failed em `título oficial`.

- [ ] **Step 6.3: Modificar a Step 2 do código**

Em `lib/format-legal-content.ts`, linhas 62-66 (a parte que descarta o título), trocar:

```typescript
  if (startIdx < rawParagraphs.length) {
    if (/^(DECRETO|LEI|PORTARIA|INSTRUÇÃO NORMATIVA|MEDIDA PROVISÓRIA)\s+N[ºo°]\s/i.test(rawParagraphs[startIdx])) {
      startIdx++;
    }
  }
```

Por:

```typescript
  let officialTitle: string | null = null;
  if (startIdx < rawParagraphs.length) {
    if (/^(DECRETO|LEI|PORTARIA|INSTRUÇÃO NORMATIVA|MEDIDA PROVISÓRIA|RESOLUÇÃO|ORDEM DE SERVIÇO)\s+N[ºo°]\s/i.test(rawParagraphs[startIdx])) {
      officialTitle = rawParagraphs[startIdx];
      startIdx++;
    }
  }
```

E no `return` final (linha 207), trocar:

```typescript
  return result.join('\n\n');
```

Por:

```typescript
  const body = result.join('\n\n');
  return officialTitle ? `# ${officialTitle}\n\n${body}` : body;
```

- [ ] **Step 6.4: Rodar — confirmar que passam**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 15 tests passed.

- [ ] **Step 6.5: Commit**

```bash
git add lib/format-legal-content.ts lib/format-legal-content.test.ts
git commit -m "feat(format-legal): preserva título oficial (DECRETO/LEI/...) como H1"
```

---

## Task 7: Regra G — preâmbulo bold + DECRETA: sem régua (TDD)

**Files:**
- Modify: `lib/format-legal-content.ts`
- Modify: `lib/format-legal-content.test.ts`

- [ ] **Step 7.1: Escrever testes falhos**

Adicionar:

```typescript
describe('preâmbulo e cláusula', () => {
  it('DECRETA: vira **DECRETA:** sem régua horizontal', () => {
    const input = 'preâmbulo.\n\nDECRETA:\n\nArt. 1º texto.';
    const output = formatLegalContent(input);
    expect(output).toContain('**DECRETA:**');
    expect(output).not.toMatch(/^---$/m); // sem régua
  });

  it('RESOLVE: vira **RESOLVE:** sem régua', () => {
    const input = '...\n\nRESOLVE:\n\nArt. 1º texto.';
    const output = formatLegalContent(input);
    expect(output).toContain('**RESOLVE:**');
  });

  it('O PRESIDENTE DA REPÚBLICA no início do preâmbulo vira bold', () => {
    const input = 'O PRESIDENTE DA REPÚBLICA, no uso da atribuição que lhe confere...';
    const output = formatLegalContent(input);
    expect(output).toContain('**O PRESIDENTE DA REPÚBLICA**');
  });

  it('O CONGRESSO NACIONAL vira bold', () => {
    const input = 'O CONGRESSO NACIONAL decreta:';
    const output = formatLegalContent(input);
    expect(output).toContain('**O CONGRESSO NACIONAL**');
  });
});
```

- [ ] **Step 7.2: Rodar — confirmar que falham**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 4 tests failed em `preâmbulo e cláusula`.

- [ ] **Step 7.3: Substituir a regra `DECRETA:` existente**

Em `lib/format-legal-content.ts`, linhas 162-171 (regra atual que faz `result.push('---')`), trocar:

```typescript
    if (/^(DECRETA|RESOLVE)\s*:?\s*$/i.test(p)) {
      result.push('---');
      continue;
    }

    if (/,\s*resolve\s*:\s*$/i.test(p)) {
      result.push(p);
      result.push('---');
      continue;
    }
```

Por:

```typescript
    if (/^(DECRETA|RESOLVE|PROMULGA)\s*:?\s*$/i.test(p)) {
      const verb = p.replace(/[:\s]/g, '').toUpperCase();
      result.push(`**${verb}:**`);
      continue;
    }
```

(Remove totalmente as regras com `---`. A segunda regra que casava `, resolve:` no meio era para portarias antigas — vamos deixar passar como texto normal; se aparecer demanda, abrimos novo escopo.)

- [ ] **Step 7.4: Adicionar regra do preâmbulo bold**

Logo após o `prevWasHeader = false;` da linha ~158, adicionar:

```typescript
    // G — Preâmbulo: "O <SUJEITO EM CAIXA ALTA>" vira bold parcial
    p = p.replace(
      /^(O\s+(?:PRESIDENTE\s+DA\s+REPÚBLICA|CONGRESSO\s+NACIONAL|MINISTRO\s+DE\s+ESTADO[^,]+|GOVERNADOR[^,]+|PREFEITO[^,]+))(,|\s)/i,
      '**$1**$2'
    );
```

- [ ] **Step 7.5: Rodar — confirmar que passam**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 19 tests passed.

- [ ] **Step 7.6: Commit**

```bash
git add lib/format-legal-content.ts lib/format-legal-content.test.ts
git commit -m "feat(format-legal): DECRETA: bold sem régua + preâmbulo com sujeito em bold"
```

---

## Task 8: Regra H — assinatura em `:::signature` (TDD)

**Files:**
- Modify: `lib/format-legal-content.ts`
- Modify: `lib/format-legal-content.test.ts`

- [ ] **Step 8.1: Escrever teste falho**

Adicionar:

```typescript
describe('assinatura', () => {
  it('envolve Brasília + assinantes em :::signature', () => {
    const input = [
      'Art. 1º texto final.',
      '',
      'Brasília, 13 de abril de 2026; 205º da Independência e 138º da República.',
      '',
      'LUIZ INÁCIO LULA DA SILVA',
      '',
      'Esther Dweck',
    ].join('\n');
    const output = formatLegalContent(input);
    expect(output).toContain(':::signature');
    const sigMatch = output.match(/:::signature([\s\S]*?):::/);
    expect(sigMatch).toBeTruthy();
    expect(sigMatch![1]).toContain('Brasília');
    expect(sigMatch![1]).toContain('LULA');
    expect(sigMatch![1]).toContain('Esther');
  });
});
```

- [ ] **Step 8.2: Rodar — confirmar que falha**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 1 test failed em `assinatura`.

- [ ] **Step 8.3: Implementar**

A regra atual (linhas ~182-191) já detecta `Brasília` e marca em itálico, mas isso não agrupa. Vamos substituí-la por uma etapa pós-loop, antes do return.

Em `lib/format-legal-content.ts`, **remover** as linhas:

```typescript
    if (/^Brasília,\s+\d+/i.test(p)) {
      result.push('---');
      result.push('*' + p + '*');
      continue;
    }

    if (result.length > 0 && isAfterSignature(result) && p === p.toUpperCase() && p.length < 80) {
      result.push('*' + p + '*');
      continue;
    }
```

E também remover a função `isAfterSignature` (não será mais usada).

Antes do `const body = result.join('\n\n');`, adicionar:

```typescript
  // H — Envolver assinatura final (Brasília + assinantes) em :::signature
  const withSignature = wrapSignature(result);
  const body = withSignature.join('\n\n');
```

E adicionar a função `wrapSignature` no final do arquivo:

```typescript
/**
 * Localiza o parágrafo "Brasília, <data>..." e envolve dele até o final
 * (incluindo assinantes em CAIXA ALTA ou Title Case) em :::signature.
 */
function wrapSignature(paragraphs: string[]): string[] {
  const idx = paragraphs.findIndex(p => /^Brasília,\s+\d/i.test(p));
  if (idx === -1) return paragraphs;

  const before = paragraphs.slice(0, idx);
  const sigBlock = paragraphs.slice(idx);

  return [...before, ':::signature', ...sigBlock, ':::'];
}
```

- [ ] **Step 8.4: Rodar — confirmar que passa**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 20 tests passed.

- [ ] **Step 8.5: Commit**

```bash
git add lib/format-legal-content.ts lib/format-legal-content.test.ts
git commit -m "feat(format-legal): envolve assinatura final em :::signature"
```

---

## Task 9: Regra A — merge agressivo de quebras aberrantes (TDD)

**Files:**
- Modify: `lib/format-legal-content.ts`
- Modify: `lib/format-legal-content.test.ts`

- [ ] **Step 9.1: Escrever testes falhos**

Adicionar:

```typescript
describe('merge agressivo de quebras aberrantes', () => {
  it('mergeia "Art. 1º O" + "Decreto nº 12.174"', () => {
    const input = 'Art. 1º O\n\nDecreto nº 12.174, de 11 de setembro.';
    const output = formatLegalContent(input);
    // Não deve haver quebra entre "O" e "Decreto"
    expect(output).toMatch(/Art\.\s+1º\s+O\s+Decreto/);
  });

  it('mergeia preposição órfã: "no" + "art. 8º"', () => {
    const input = 'observado o disposto no\n\nart. 8º do Decreto nº 9.507.';
    const output = formatLegalContent(input);
    expect(output).toMatch(/disposto no art\. 8º/);
  });

  it('mergeia palavra + número quebrado: "art." + "46 da Lei"', () => {
    const input = 'trata o art.\n\n46 da Lei nº 14.133.';
    const output = formatLegalContent(input);
    expect(output).toMatch(/o art\.\s+46 da Lei/);
  });

  it('NÃO mergeia parágrafos terminados com pontuação completa', () => {
    const input = 'Art. 1º Primeira frase.\n\nArt. 2º Segunda frase.';
    const output = formatLegalContent(input);
    // Os dois devem permanecer separados
    expect(output).toMatch(/Art\.\s+1º[^\n]*\.[\s\n]+\*\*Art\.\s+2º\*\*/);
  });
});
```

- [ ] **Step 9.2: Rodar — confirmar que falham**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 3-4 tests failed em `merge agressivo`.

- [ ] **Step 9.3: Reforçar o loop de merge**

Em `lib/format-legal-content.ts`, dentro do `// Step 3: Merge broken sentences` (linhas ~82-101), substituir o bloco inteiro por:

```typescript
  // Step 3: Merge broken sentences (reforçado)
  const merged: string[] = [];
  for (const p of filtered) {
    if (merged.length > 0) {
      const prev = merged[merged.length - 1];
      const prevTrim = prev.trim();
      const prevEndsClean = /[.;:!?)"']$/.test(prevTrim);
      const prevIsHeading = isHeading(prev);
      const curIsHeading = isHeading(p);
      const curIsStructural =
        /^(Art\.\s|§\s*\d|Parágrafo único|[IVXLCDM]+\s*[-–—]\s|[a-z]\)\s)/i.test(p);

      // Sinais adicionais de continuação:
      const prevEndsWithStopWord = /\b(no|na|do|da|dos|das|o|a|os|as|em|de|com|por|para|sob|que)$/i.test(prevTrim);
      const prevEndsWithSingleLetter = /\s[A-Za-z]$/.test(prevTrim);
      const prevEndsWithArtAbbrev = /\bart\.?$/i.test(prevTrim);
      const curStartsLowercase = /^[a-záàâãéêíóôõúç]/.test(p);
      const curStartsWithNumber = /^\d/.test(p);
      const curStartsWithCrossRef = /^(art\.|inciso|Lei|Decreto|caput)/i.test(p);

      const shouldMerge =
        // regra antiga
        (!prevEndsClean && !prevIsHeading && !curIsHeading && !curIsStructural) ||
        // novas regras
        prevEndsWithStopWord ||
        prevEndsWithSingleLetter ||
        prevEndsWithArtAbbrev ||
        (curStartsLowercase && !prevEndsClean) ||
        (curStartsWithNumber && prevEndsWithArtAbbrev) ||
        (curStartsWithCrossRef && !prevEndsClean && !prevIsHeading);

      if (shouldMerge && !curIsStructural) {
        merged[merged.length - 1] = prev + ' ' + p;
        continue;
      }
    }
    merged.push(p);
  }
```

- [ ] **Step 9.4: Rodar — confirmar que passam**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 24 tests passed.

Se algum teste antigo quebrar (regressão no merge), inspecione o output com `console.log(output)` no teste falho e ajuste o `shouldMerge`.

- [ ] **Step 9.5: Commit**

```bash
git add lib/format-legal-content.ts lib/format-legal-content.test.ts
git commit -m "fix(format-legal): merge agressivo de quebras aberrantes do scraping (preposições órfãs, palavras quebradas, números soltos)"
```

---

## Task 10: `MarkdownContent` — adicionar prop `variant` e classe condicional

**Files:**
- Modify: `components/MarkdownContent.tsx`

- [ ] **Step 10.1: Editar a interface e o wrapper**

Em `components/MarkdownContent.tsx`, substituir as linhas 6-12:

```typescript
interface MarkdownContentProps {
  content: string;
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-content">
```

Por:

```typescript
interface MarkdownContentProps {
  content: string;
  variant?: 'planalto';
}

export default function MarkdownContent({ content, variant }: MarkdownContentProps) {
  const wrapperClassName = variant === 'planalto'
    ? 'markdown-content markdown-content--planalto'
    : 'markdown-content';
  return (
    <div className={wrapperClassName}>
```

- [ ] **Step 10.2: Validar com `npm run build`**

```bash
npm run build
```

Esperado: build OK, sem erros TypeScript. (A prop nova não está sendo usada por ninguém ainda — zero impacto.)

- [ ] **Step 10.3: Commit**

```bash
git add components/MarkdownContent.tsx
git commit -m "feat(MarkdownContent): adiciona prop variant para suportar tema planalto"
```

---

## Task 11: `MarkdownContent` — instalar Lora + CSS escopado da variante Planalto

**Files:**
- Modify: `components/MarkdownContent.tsx`
- Modify: `app/layout.tsx` (para carregar Lora)

- [ ] **Step 11.1: Carregar Lora via next/font/google**

Em `app/layout.tsx`, localizar onde outras fonts são importadas (provavelmente perto do topo) e adicionar:

```typescript
import { Lora } from 'next/font/google';

const lora = Lora({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'swap',
});
```

E adicionar `${lora.variable}` na lista de classes do `<html>` ou `<body>` (junto com outras `variable` que já estiverem lá).

- [ ] **Step 11.2: Verificar com `npm run build`**

```bash
npm run build
```

Esperado: build OK. Vercel vai cachear a Lora no edge automaticamente.

- [ ] **Step 11.3: Adicionar CSS da variante no MarkdownContent**

Em `components/MarkdownContent.tsx`, dentro do bloco `<style jsx>`, **após** o fechamento da regra `.markdown-content` base (último `}` antes do `}{)} backtick fechamento`), inserir **antes** do backtick final:

```css
        /* === VARIANTE PLANALTO ===================================== */

        .markdown-content--planalto {
          --planalto-vinho: #7a1c1c;
          --planalto-link:  #1d4ed8;
          font-family: var(--font-lora), Georgia, 'Times New Roman', serif;
          font-size: 1.0625rem;
          line-height: 1.65;
          color: #1f2937;
        }

        /* Título oficial (H1) — centralizado, vinho, underline */
        .markdown-content--planalto :global(h1) {
          text-align: center;
          color: var(--planalto-vinho);
          font-weight: 700;
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 4px;
          font-size: 1.5rem;
          margin: 2.5rem auto 2rem;
          padding: 0;
          border: none;
          line-height: 1.4;
        }

        /* Ementa = primeiro <p> após H1 → lateral à direita, vinho itálico */
        .markdown-content--planalto :global(h1 + p) {
          width: 65%;
          margin-left: auto;
          margin-right: 0;
          color: var(--planalto-vinho);
          font-style: italic;
          font-size: 0.95rem;
          text-align: justify;
          text-indent: 0;
        }

        /* H2 — CAPÍTULO/TÍTULO/ANEXO centralizado */
        .markdown-content--planalto :global(h2) {
          text-align: center;
          text-transform: uppercase;
          color: rgba(122, 28, 28, 0.85);
          font-size: 1.15rem;
          font-weight: 700;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
        }

        /* H3/H4 — SEÇÃO/SUBSEÇÃO centralizado */
        .markdown-content--planalto :global(h3),
        .markdown-content--planalto :global(h4) {
          text-align: center;
          font-weight: 700;
          color: #374151;
          font-size: 1rem;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
        }

        /* Parágrafos — recuo de primeira linha (Art./§) */
        .markdown-content--planalto :global(p) {
          text-indent: 2em;
          text-align: justify;
          hyphens: auto;
          margin-bottom: 0.85rem;
          line-height: 1.65;
        }

        /* Inciso (classe injetada pelo custom <p>) */
        .markdown-content--planalto :global(p.inciso) {
          padding-left: 2em;
          text-indent: 0;
        }

        /* Alínea */
        .markdown-content--planalto :global(p.alinea) {
          padding-left: 4em;
          text-indent: 0;
        }

        /* Bloco :::alteracao — recuo lateral + borda esquerda */
        .markdown-content--planalto :global(.alteracao-block) {
          margin: 1.25rem 0 1.25rem 2.5rem;
          padding-left: 1rem;
          border-left: 2px solid #d1d5db;
          font-size: 0.97rem;
        }
        .markdown-content--planalto :global(.alteracao-block p) {
          text-indent: 1.5em;
        }
        .markdown-content--planalto :global(.alteracao-block p.inciso) {
          padding-left: 1.5em;
        }
        .markdown-content--planalto :global(.alteracao-block p.alinea) {
          padding-left: 3em;
        }

        /* Omitido inline — linha pontilhada CSS */
        .markdown-content--planalto :global(.omitido-line)::before {
          content: '';
          display: inline-block;
          width: 60%;
          border-bottom: 1px dotted #9ca3af;
          vertical-align: middle;
          margin: 0 0.25em;
        }

        /* (NR) discreto */
        .markdown-content--planalto :global(.nr) {
          font-size: 0.85em;
          color: #6b7280;
          margin-left: 0.25em;
        }

        /* Assinatura centralizada */
        .markdown-content--planalto :global(.signature-block) {
          text-align: center;
          margin: 3rem 0;
          line-height: 2;
        }
        .markdown-content--planalto :global(.signature-block p) {
          text-indent: 0;
          text-align: center;
        }

        /* Links no tom Planalto */
        .markdown-content--planalto :global(a) {
          color: var(--planalto-link);
          text-decoration: underline;
        }

        /* Strong herda vinho discreto, sem ficar gritante */
        .markdown-content--planalto :global(strong) {
          color: #111827;
        }

        /* Mobile (< 640px) */
        @media (max-width: 640px) {
          .markdown-content--planalto :global(h1) {
            font-size: 1.15rem;
          }
          .markdown-content--planalto :global(h1 + p) {
            width: 100%;
          }
          .markdown-content--planalto :global(.alteracao-block) {
            margin-left: 1rem;
          }
          .markdown-content--planalto :global(p.inciso) {
            padding-left: 1.25em;
          }
          .markdown-content--planalto :global(p.alinea) {
            padding-left: 2.5em;
          }
          .markdown-content--planalto :global(.omitido-line)::before {
            width: 40%;
          }
        }
```

- [ ] **Step 11.4: Build**

```bash
npm run build
```

Esperado: build OK.

- [ ] **Step 11.5: Commit**

```bash
git add app/layout.tsx components/MarkdownContent.tsx
git commit -m "feat(MarkdownContent): carrega Lora + CSS da variante planalto (hierarquia, vinho, recuos)"
```

---

## Task 12: `MarkdownContent` — habilitar remark-directive + custom components

**Files:**
- Modify: `components/MarkdownContent.tsx`

- [ ] **Step 12.1: Importar remark-directive e adicionar ao pipeline**

Em `components/MarkdownContent.tsx`, perto do topo, adicionar:

```typescript
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
```

(O `unist-util-visit` provavelmente já está como transitive — se não estiver, instalar com `npm install unist-util-visit`.)

- [ ] **Step 12.2: Adicionar plugin de transformação de diretivas**

Antes do `export default function MarkdownContent`, adicionar:

```typescript
/**
 * remark plugin: transforma diretivas (:::alteracao, :omitido, :nr, :::signature)
 * em nós HTML com data attributes que o renderer customizado abaixo intercepta.
 */
function remarkLegalDirectives() {
  return (tree: any) => {
    visit(tree, (node: any) => {
      if (
        node.type === 'containerDirective' ||
        node.type === 'leafDirective' ||
        node.type === 'textDirective'
      ) {
        const data = node.data || (node.data = {});
        const tagName =
          node.type === 'textDirective' ? 'span' : 'div';
        data.hName = tagName;
        data.hProperties = {
          className: `${node.name}-directive`,
        };
      }
    });
  };
}
```

- [ ] **Step 12.3: Adicionar o plugin ao `remarkPlugins`**

Substituir:

```typescript
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
```

Por:

```typescript
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkDirective, remarkLegalDirectives]}
          components={{
```

- [ ] **Step 12.4: Adicionar custom components**

Dentro do objeto `components={{...}}`, **após** o handler existente `a: ({ href, ... })`, adicionar:

```typescript
            div: ({ className, children, ...props }: any) => {
              if (className?.includes('alteracao-directive')) {
                return <div className="alteracao-block">{children}</div>;
              }
              if (className?.includes('signature-directive')) {
                return <div className="signature-block">{children}</div>;
              }
              return <div className={className} {...props}>{children}</div>;
            },
            span: ({ className, children, ...props }: any) => {
              if (className?.includes('omitido-directive')) {
                return <span className="omitido-line" aria-label="Trecho não alterado" />;
              }
              if (className?.includes('nr-directive')) {
                return <span className="nr">{children}</span>;
              }
              return <span className={className} {...props}>{children}</span>;
            },
            // Custom <p>: detecta inciso/alínea pelo primeiro filho de texto
            p: ({ children, ...props }: any) => {
              const firstText = extractFirstText(children);
              let className: string | undefined;
              if (/^[IVXLCDM]+\s*[-–—]\s/.test(firstText)) {
                className = 'inciso';
              } else if (/^[a-z]\)\s/.test(firstText)) {
                className = 'alinea';
              }
              return <p className={className} {...props}>{children}</p>;
            },
```

E adicionar a função utilitária `extractFirstText` no escopo do módulo (fora do componente):

```typescript
function extractFirstText(children: any): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    for (const c of children) {
      const t = extractFirstText(c);
      if (t) return t;
    }
  }
  if (children?.props?.children) return extractFirstText(children.props.children);
  return '';
}
```

- [ ] **Step 12.5: Verificar build**

```bash
npm run build
```

Esperado: build OK. Se reclamar de `unist-util-visit` faltando:

```bash
npm install unist-util-visit
npm run build
```

- [ ] **Step 12.6: Commit**

```bash
git add components/MarkdownContent.tsx package.json package-lock.json
git commit -m "feat(MarkdownContent): habilita remark-directive + custom components para :::alteracao/:omitido/:nr/:::signature/inciso/alínea"
```

---

## Task 13: Integrar variante na página `/legislacao/[id]`

**Files:**
- Modify: `app/(acervo)/legislacao/[id]/page.tsx:273`

- [ ] **Step 13.1: Passar a prop**

Em `app/(acervo)/legislacao/[id]/page.tsx`, linha 273:

```tsx
            <MarkdownContent content={formatLegalContent(act.content)} />
```

Substituir por:

```tsx
            <MarkdownContent
              content={formatLegalContent(act.content)}
              variant="planalto"
            />
```

- [ ] **Step 13.2: Rodar dev server e visualizar**

```bash
npm run dev
```

Abrir no browser: `http://localhost:3000/legislacao/<id-do-decreto-12926>`

Para descobrir o ID:

```bash
npx tsx -e "import { prisma } from './lib/prisma'; (async () => { const a = await prisma.legislativeAct.findFirst({ where: { fullNumber: { contains: '12.926' } }, select: { id: true, fullNumber: true } }); console.log(a); await prisma.\$disconnect(); })();"
```

Validar visualmente:
- Título "DECRETO Nº 12.926..." centralizado e em vinho
- Ementa lateral à direita
- Bloco `"Art. 1º ..."` recuado com borda lateral
- Linhas pontilhadas visíveis
- (NR) discreto
- *caput* em itálico

- [ ] **Step 13.3: Commit**

```bash
git add app/(acervo)/legislacao/[id]/page.tsx
git commit -m "feat(legislacao): ativa variante planalto em /legislacao/[id]"
```

---

## Task 14: Snapshot test do Decreto 12.926/2026 (golden case)

**Files:**
- Modify: `lib/format-legal-content.test.ts`
- Auto-create: `lib/__snapshots__/format-legal-content.test.ts.snap`

- [ ] **Step 14.1: Capturar o conteúdo bruto do Decreto 12.926**

```bash
npx tsx -e "import { prisma } from './lib/prisma'; (async () => { const a = await prisma.legislativeAct.findFirst({ where: { fullNumber: { contains: '12.926' } }, select: { content: true } }); console.log(JSON.stringify(a?.content)); await prisma.\$disconnect(); })();" > /tmp/decreto-12926-raw.json
```

(No Windows PowerShell: `> $env:TEMP\decreto-12926-raw.json`.)

Inspecionar o conteúdo. Ele será uma única string JSON (com `\n` escapado). Você vai colar uma versão **abreviada** do conteúdo no teste (~30 linhas representativas), não os 8 KB completos.

- [ ] **Step 14.2: Adicionar snapshot test**

Em `lib/format-legal-content.test.ts`, adicionar:

```typescript
describe('snapshots (golden cases)', () => {
  it('Decreto 12.926/2026 — formato completo', () => {
    const input = [
      'Presidência da República',
      'Casa Civil',
      'Secretaria Especial para Assuntos Jurídicos',
      '',
      'DECRETO Nº 12.926, DE 13 DE ABRIL DE 2026',
      '',
      'Altera o Decreto nº 12.174, de 11 de setembro de 2024, que dispõe sobre as garantias trabalhistas.',
      '',
      'O PRESIDENTE DA REPÚBLICA, no uso da atribuição que lhe confere o art. 84, caput, inciso IV, da Constituição,',
      '',
      'DECRETA:',
      '',
      'Art. 1º O Decreto nº 12.174, de 11 de setembro de 2024, passa a vigorar com as seguintes alterações:',
      '',
      '"Art. 1º [...]',
      '',
      'Parágrafo único. O disposto no art. 2º deste Decreto aplica-se aos contratos." (NR)',
      '',
      '"Art. 3º [...]',
      '',
      'I - a previsibilidade da época de gozo de suas férias;',
      '',
      'II - [...]',
      '',
      'b) necessidade eventual de caráter pessoal;',
      '',
      'III - a concessão do benefício de reembolso-creche." (NR)',
      '',
      'Brasília, 13 de abril de 2026; 205º da Independência e 138º da República.',
      '',
      'LUIZ INÁCIO LULA DA SILVA',
      '',
      'Esther Dweck',
    ].join('\n');

    expect(formatLegalContent(input)).toMatchSnapshot();
  });
});
```

- [ ] **Step 14.3: Gerar o snapshot inicial**

```bash
npm test -- lib/format-legal-content.test.ts --run
```

Esperado: 25 tests passed, 1 snapshot written.

- [ ] **Step 14.4: Inspecionar o snapshot manualmente**

Abrir `lib/__snapshots__/format-legal-content.test.ts.snap` e verificar:
- Começa com `# DECRETO Nº 12.926, DE 13 DE ABRIL DE 2026`
- Tem `**DECRETA:**` (sem `---`)
- Tem `**O PRESIDENTE DA REPÚBLICA**, no uso...`
- Tem 2 blocos `:::alteracao ... :::`
- Tem `:omitido` no lugar dos `[...]`
- Tem `:nr[(NR)]` ao final de cada bloco
- Tem `*caput*` italicizado
- Tem `:::signature ... :::` no final
- Brasília + LULA + Esther estão dentro do `:::signature`

Se algo estiver errado, ajustar a regra e regenerar:
```bash
npm test -- lib/format-legal-content.test.ts --run -u
```

- [ ] **Step 14.5: Commit**

```bash
git add lib/format-legal-content.test.ts lib/__snapshots__/format-legal-content.test.ts.snap
git commit -m "test(format-legal): snapshot golden do Decreto 12.926/2026"
```

---

## Task 15: Smoke test em todos os atos do banco

**Files:**
- Create: `scripts/smoke-test-format-legal.ts`

- [ ] **Step 15.1: Criar script de smoke test**

Criar `scripts/smoke-test-format-legal.ts`:

```typescript
import { prisma } from '../lib/prisma';
import { formatLegalContent } from '../lib/format-legal-content';

async function main() {
  const acts = await prisma.legislativeAct.findMany({
    where: { content: { not: null } },
    select: { id: true, fullNumber: true, content: true },
  });

  console.log(`Smoke test em ${acts.length} atos…`);

  let pass = 0;
  const failures: Array<{ id: string; full: string; reason: string }> = [];

  for (const act of acts) {
    if (!act.content) continue;
    try {
      const out = formatLegalContent(act.content);

      // Asserções
      if (!out || out.length === 0) {
        failures.push({ id: act.id, full: act.fullNumber, reason: 'output vazio' });
        continue;
      }
      if (/\[\s*\.{3,}\s*\]/.test(out)) {
        failures.push({ id: act.id, full: act.fullNumber, reason: '[...] remanescente' });
        continue;
      }
      // Aberturas :::alteracao devem ter fechamentos correspondentes
      const opens = (out.match(/:::alteracao/g) || []).length;
      const closes = (out.match(/^:::$/gm) || []).length;
      // Conta apenas fechamentos de alteracao (signature também usa :::)
      // Validação: ao menos as aberturas + signature aberturas == fechamentos
      const sigOpens = (out.match(/:::signature/g) || []).length;
      if (opens + sigOpens > closes) {
        failures.push({ id: act.id, full: act.fullNumber, reason: `desbalanço: abre=${opens + sigOpens} fecha=${closes}` });
        continue;
      }
      // Aspas curvas remanescentes fora de blocos (se :::alteracao foi corretamente detectado, deveriam ter sumido)
      // Tolera: se opens === 0, pode haver aspas decorativas no texto. Se opens > 0, não pode sobrar “.
      if (opens > 0 && /“/.test(out)) {
        failures.push({ id: act.id, full: act.fullNumber, reason: 'aspa “ remanescente apesar de bloco detectado' });
        continue;
      }

      pass++;
    } catch (e: any) {
      failures.push({ id: act.id, full: act.fullNumber, reason: `exceção: ${e.message}` });
    }
  }

  console.log(`✅ Passaram: ${pass}/${acts.length}`);
  if (failures.length) {
    console.log(`❌ Falharam: ${failures.length}`);
    for (const f of failures) {
      console.log(`  - ${f.full} (${f.id}): ${f.reason}`);
    }
    process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 15.2: Rodar**

```bash
npx tsx scripts/smoke-test-format-legal.ts
```

Esperado: `✅ Passaram: 108/108` (ou o número de atos com `content` no seu banco).

Se houver falhas:
- **Output vazio:** ato com `content` mas só whitespace — esperado, ignore manualmente ou skipe atos com `content.length < 100`.
- **`[...]` remanescente:** regex da regra C precisa ajuste — investigar o ato específico, ajustar regex, re-rodar testes unitários e smoke.
- **Desbalanço `:::`:** scraping defeituoso. Verificar fail-safe da `wrapAlteracaoBlocks` — se contagem total não bate, deveria retornar original. Reforce a defesa.
- **Aspa remanescente:** ajuste similar.

Iterar até zero falhas.

- [ ] **Step 15.3: Commit**

```bash
git add scripts/smoke-test-format-legal.ts
git commit -m "test(format-legal): smoke test em todos os atos com content no banco"
```

---

## Task 16: Validação visual (golden test manual) + Lighthouse

- [ ] **Step 16.1: Subir dev server**

```bash
npm run dev
```

- [ ] **Step 16.2: Abrir Decreto 12.926/2026**

Browser: `http://localhost:3000/legislacao/<id-do-decreto-12926>`

(ID obtido na Task 13.2.)

- [ ] **Step 16.3: Checklist visual lado-a-lado com a screenshot oficial**

Abrir em outra aba: `https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/D12926.htm`

Verificar:

- [ ] Título "DECRETO Nº 12.926, DE 13 DE ABRIL DE 2026" centralizado, vinho, bold, underline
- [ ] Ementa ("Altera o Decreto nº 12.174...") à direita, vinho itálico, ~65% width
- [ ] Preâmbulo "**O PRESIDENTE DA REPÚBLICA**" em bold, parágrafo justificado
- [ ] "**DECRETA:**" em bold, sem régua horizontal
- [ ] "Art. 1º O Decreto nº 12.174..." com recuo de 1ª linha
- [ ] Bloco `"Art. 1º .........."` recuado à esquerda com borda lateral cinza
- [ ] Linha pontilhada CSS no lugar de `[...]`
- [ ] "**Parágrafo único.**" em bold dentro do bloco de alteração
- [ ] "(NR)" discreto em cinza pequeno
- [ ] *caput* em itálico nas ocorrências
- [ ] Incisos `I -`, `II -`, `III -` com recuo de bloco
- [ ] Alínea `b)` com recuo extra
- [ ] "Brasília, 13 de abril de 2026..." centralizado
- [ ] "LUIZ INÁCIO LULA DA SILVA" centralizado, próximo da Brasília
- [ ] "Esther Dweck" centralizado abaixo

- [ ] **Step 16.4: Rodar Lighthouse antes/depois**

Abrir DevTools → Lighthouse → Performance → Mobile.

Comparar com baseline (antes da feature). Aceitar regressão ≤ 2 pontos. Se for maior, investigar — provavelmente é a Lora; ajustar `next/font` ou aceitar (impacto cosmético na UX).

- [ ] **Step 16.5: Testar não-regressão em rotas adjacentes**

Abrir as seguintes URLs e validar que renderizam idêntico ao baseline (anote screenshot mental):
- `/blog/<qualquer-post>` — fonte sans-serif, sem variante planalto
- `/area-restrita/lei-comentada` (logado) — idêntico
- `/glossario/<qualquer-termo>` — idêntico

- [ ] **Step 16.6: Build de produção**

```bash
npm run build
```

Esperado: build OK, sem erros TypeScript.

---

## Task 17: PR final

- [ ] **Step 17.1: Verificar histórico**

```bash
git log --oneline -20
```

Esperado: ver os ~13 commits dessa feature (Task 1 a 15) mais o "ativa variante planalto" da Task 13.

- [ ] **Step 17.2: Rodar a suíte completa**

```bash
npm test -- --run
```

Esperado: todos os 720+ testes existentes + 25 novos passando.

- [ ] **Step 17.3: Build final**

```bash
npm run build
```

Esperado: OK.

- [ ] **Step 17.4: Push e deploy**

```bash
git push origin main
vercel --prod
```

(Lembrar: deploy é manual no projeto, GitHub não conectado.)

- [ ] **Step 17.5: Smoke test em produção**

Abrir `https://www.profdanielbarral.com/legislacao/<id-do-decreto-12926>` e revalidar o checklist da Task 16.3.

---

## Recap de impacto

- **15 testes unitários novos** + **1 snapshot test** + **1 smoke test em massa**
- **0 schema migrations**
- **0 mudanças em pipelines de scraping/import**
- **1 dependência nova:** `remark-directive` (~3 KB)
- **1 font carregada:** Lora via `next/font/google` (cacheada no edge)
- **0 impacto em** `/blog`, `/area-restrita/lei-comentada`, `/glossario`, newsletter, emails
- **Reversível em 1 linha:** remover `variant="planalto"` na page volta ao layout atual

## Self-review

**Spec coverage:**
- Goal: aproximar `/legislacao/[id]` ao Planalto → Tasks 10-13 cobrem MarkdownContent + page
- Non-goals: nenhum brasão/Casa Civil → confirmado, não há task pra isso
- Arquitetura: format-legal-content → MarkdownContent → page → Tasks 2-9 (format), 10-12 (markdown), 13 (page)
- Mudanças no format-legal-content (A-H): Tasks 2 (E), 3 (C), 4 (D), 5 (B), 6 (F), 7 (G), 8 (H), 9 (A)
- Mudanças no MarkdownContent: prop variant (Task 10), CSS (Task 11), directive plugin (Task 12)
- Testes: Grupo A (Tasks 2-9), Grupo B snapshot (Task 14), Grupo C smoke (Task 15)
- Golden test visual: Task 16
- Não-regressão: Task 16.5
- Riscos: fail-safe aspa não-fechada coberto no Step 5.3; fail-safe atos atípicos coberto no smoke 15

**Placeholder scan:** sem TBD/TODO/"implementar mais tarde". Cada step tem código exato ou comando exato.

**Type consistency:**
- `wrapAlteracaoBlocks(paragraphs: string[]): string[]` usado em Step 5.3 ✓
- `wrapSignature(paragraphs: string[]): string[]` usado em Step 8.3 ✓
- `extractFirstText(children: any): string` definido e usado em Step 12.4 ✓
- prop `variant?: 'planalto'` em Step 10.1 consistente com classe `markdown-content--planalto` em Step 10.1 e CSS Step 11.3 ✓
- nomes de diretivas (`alteracao`, `omitido`, `nr`, `signature`) consistentes em Steps 5.3, 8.3, format rules, Step 12.4 components ✓
