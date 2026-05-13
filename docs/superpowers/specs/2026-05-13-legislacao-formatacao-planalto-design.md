# Formatação da página de legislação aproximada do Planalto — design

**Data:** 2026-05-13
**Status:** Draft
**Rota afetada:** `/legislacao/[id]` (público, `app/(acervo)/legislacao/[id]/page.tsx`)

## Goal

Aproximar a apresentação visual da seção "Texto Integral" em `/legislacao/[id]` da formatação oficial do Planalto (https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/D12926.htm) — título oficial centralizado e em vinho, ementa lateral à direita, hierarquia visual de Art. / § / incisos / alíneas, e tratamento especial para trechos de alteração ("Art. xº ..." entre aspas + `(NR)`) e omissões (`[...]`).

A aproximação preserva a identidade visual do site (cards, badges, metadata) — só o bloco "Texto Integral" muda. Aplica-se a **todos** os atos em `LegislativeAct` (Lei, Decreto, IN, Portaria, MP, Resolução, Ordem de Serviço, Orientação), via prop opt-in `variant="planalto"` em `MarkdownContent`.

## Non-goals

- Replicar o cabeçalho institucional do Gov.br ("Presidência da República / Casa Civil / Secretaria Especial...") em verde-oliva com brasão das Armas — escolha consciente para não confundir com site oficial.
- Detectar referências cruzadas (`"art. 84 da Constituição"`, `"Lei nº 14.133, de 2021"`) e linkar para o ato/artigo correspondente — fica para fase 2 (era a opção 3 do escopo, descartada).
- Aplicar a formatação na Lei 14.133 Comentada (`/area-restrita/lei-comentada`) ou na visualização individual de artigos (`/artigo/[numero]`) — formatos diferentes, podem entrar depois.
- Mudar o schema do Prisma. Nenhuma migração necessária.
- Mudar o pipeline de scraping/importação. O texto bruto atual já tem todos os elementos necessários.

## Arquitetura

```
LegislativeAct.content (texto bruto, com "Art. 1º O\n\nDecreto...", "..." curvas, [...], (NR))
        ↓
formatLegalContent()           ← REFORÇADO: novas detecções + merge agressivo
        ↓
markdown semântico             ← acrescenta marcadores via remark-directive:
        ↓                        :::alteracao / :::omitido / :nr / :::signature
MarkdownContent variant="planalto"  ← REFORÇADO: serif, hierarquia, vinho
        ↓                             + custom components para os marcadores
HTML renderizado
```

**Princípios:**

1. **Sem componente novo.** Reforçar `lib/format-legal-content.ts` e `components/MarkdownContent.tsx`, ambos já estabelecidos e usados por outros 50+ atos.
2. **Variante opt-in.** A prop `variant="planalto"` ativa CSS extra via classe `markdown-content--planalto`. Sem a prop, render idêntico ao atual — zero impacto em blog, lei comentada, glossário etc.
3. **Marcadores via diretivas markdown** (`:::nome ... :::`), não HTML cru. `remark-directive` é estável e ~3 KB.
4. **Fail-safe.** Se detecção de bloco falhar (ex.: aspa abrindo sem fechar por erro de scraping), o conteúdo é devolvido como-está. Nada se perde.

## Mudanças no `lib/format-legal-content.ts`

### A — Merge agressivo de quebras aberrantes (reforço da regra existente)

Hoje (linhas 82-101) o código mergeia parágrafos quando o anterior não termina com pontuação terminal **e** o próximo não é estrutural. Não é suficiente — o scraping do Planalto quebra dentro de elementos por causa de `<a>` inline.

**Casos observados no Decreto 12.926/2026:**
- `"Art. 1º O\n\nDecreto nº 12.174..."` (artigo + objeto direto isolados)
- `"observado o disposto no\n\nart. 8º do Decreto..."` (preposição órfã)
- `"art.\n46 da Lei nº 14.133..."` (palavra + número quebrados)

**Regra nova:** mergir quando:
- Parágrafo anterior termina em letra minúscula isolada (continuação)
- Parágrafo anterior termina com preposição/artigo (`no`, `na`, `do`, `da`, `o`, `a`, `em`, `de`)
- Próximo parágrafo começa com letra minúscula (continuação de frase)
- Próximo começa com `art.`/`Art.`/`§`/`inciso`/`Lei`/`Decreto`/vírgula seguida de letra

**Não mergir** se houver linha em branco dupla intencional **e** ambos os lados parecem estruturalmente independentes (heurística: ambos terminam/começam com pontuação completa).

### B — Aspas curvas `“…”` → bloco `:::alteracao`

**Detecção:** percorrer parágrafos sequencialmente mantendo um contador de aspas `“` abertas. Quando o contador sai de 0, começa um bloco de alteração. Quando volta a 0, fecha o bloco.

**Output markdown:**

```markdown
**Art. 1º** O Decreto nº 12.174, de 11 de setembro de 2024, passa a vigorar com as seguintes alterações:

:::alteracao
**Art. 1º** :omitido

**Parágrafo único.** O disposto no art. 2º... :nr[(NR)]
:::

:::alteracao
**Art. 3º** :omitido

**I -** a previsibilidade da época de gozo...
:::
```

**Edge cases tratados:**
- Aspas em múltiplos parágrafos: bloco abrange todos os parágrafos até `”` fechar
- Aspas aninhadas (`“texto “interno” fim”`): balanceamento de contador
- Aspa abrindo sem fechar (scraping defeituoso): se o contador não volta a 0 até o fim do texto, **abortar** o bloco — devolver os parágrafos como estavam (fail-safe)

### C — `[...]` → `:omitido`

Substituir literal `[...]` (com/sem espaços) pelo marcador inline `:omitido`. Renderizado como `<span class="omitido-line">` (linha pontilhada CSS — ver Seção CSS).

### D — `(NR)` → `:nr[(NR)]`

Detectar ` (NR)` no final de parágrafo. Substituir por `:nr[(NR)]` (texto preservado, estilo discreto via CSS).

### E — `caput` em itálico

Regex `\bcaput\b` → `*caput*`. Boundary check evita pegar `capturar`, `captura`, etc.

### F — Título oficial preservado como H1

Hoje (linhas 50-66) o filtro descarta `Presidência da República / Casa Civil / Secretaria...` **e** `DECRETO Nº...`. Manter o descarte das primeiras linhas institucionais, mas **promover** a linha `DECRETO|LEI|PORTARIA|...` a `# DECRETO Nº 12.926, DE 13 DE ABRIL DE 2026`.

Fallback: se o conteúdo bruto não tem essa linha (ex.: ato importado de fonte que não inclui), o `MarkdownContent` injeta `act.fullNumber` como H1 ao renderizar.

### G — Preâmbulo: `O PRESIDENTE DA REPÚBLICA`/`DECRETA:` em negrito

Hoje `DECRETA:` vira `---` (régua horizontal). **Trocar** para `**DECRETA:**` — sem régua. O Planalto usa só quebra de parágrafo.

Detectar o trecho em CAIXA ALTA inicial do preâmbulo (`O PRESIDENTE DA REPÚBLICA`, `O CONGRESSO NACIONAL`, `O MINISTRO DE ESTADO DE...`) e envolver em `**...**`.

### H — Assinatura final em `:::signature`

Detectar `Brasília, <dia> de <mês>...` e agrupar até o próximo `---` ou final. Envolver em `:::signature ... :::` (centralizado via CSS).

### Dependências

- `remark-directive` (~3 KB, estável, da família remark)

## Mudanças em `components/MarkdownContent.tsx`

### Prop

```tsx
interface MarkdownContentProps {
  content: string;
  variant?: 'planalto';   // novo
}
```

Quando `variant === 'planalto'`, adicionar classe `markdown-content--planalto` no wrapper.

### CSS escopado (todo em `.markdown-content--planalto`)

**Tipografia base:**
```css
.markdown-content--planalto {
  --planalto-vinho: #7a1c1c;
  --planalto-link:  #1d4ed8;
  font-family: 'Lora', Georgia, 'Times New Roman', serif;
  font-size: 1.0625rem;
  line-height: 1.65;
  color: #1f2937;
}
```

Carregar Lora via `next/font/google` com `display: 'swap'`. Sem FOIT.

**Título oficial (H1):**
```css
.markdown-content--planalto h1 {
  text-align: center;
  color: var(--planalto-vinho);
  font-weight: 700;
  text-decoration: underline;
  font-size: 1.5rem;
  margin: 2.5rem auto 2rem;
}
```

**Ementa lateral (primeiro parágrafo após H1):**
```css
.markdown-content--planalto > h1 + p {
  width: 65%;
  margin-left: auto;
  color: var(--planalto-vinho);
  font-style: italic;
  font-size: 0.95rem;
}
```

**Cabeçalhos de capítulo/seção:**
```css
.markdown-content--planalto h2 { text-align: center; text-transform: uppercase; color: rgba(122,28,28,0.8); }
.markdown-content--planalto h3 { text-align: center; text-transform: uppercase; color: #374151; }
```

**Art./§ — recuo de primeira linha:**
```css
.markdown-content--planalto p { text-indent: 2em; text-align: justify; hyphens: auto; }
```

**Incisos e alíneas — recuo de bloco** (detectados por classe injetada pelo custom component que parseia `^I -` ou `^a)`):
```css
.markdown-content--planalto .inciso { padding-left: 2em; text-indent: 0; }
.markdown-content--planalto .alinea { padding-left: 4em; text-indent: 0; }
```

**Bloco `:::alteracao`:**
```css
.markdown-content--planalto .alteracao-block {
  margin: 1.25rem 0 1.25rem 2.5rem;
  padding-left: 1rem;
  border-left: 2px solid #d1d5db;
  font-size: 0.97rem;
}
.markdown-content--planalto .alteracao-block p { text-indent: 1.5em; }
```

**Omitido inline:**
```css
.markdown-content--planalto .omitido-line::before {
  content: '';
  display: inline-block;
  width: 60%;
  border-bottom: 1px dotted #9ca3af;
  vertical-align: middle;
  margin: 0 0.25em;
}
```

**(NR) discreto:**
```css
.markdown-content--planalto .nr {
  font-size: 0.85em;
  color: #6b7280;
  margin-left: 0.25em;
}
```

**Signature centralizada:**
```css
.markdown-content--planalto .signature-block {
  text-align: center;
  margin: 3rem 0;
  line-height: 2;
}
```

**Responsivo (`< 640px`):**
- Título: `font-size: 1.15rem`
- Ementa lateral: `width: 100%` (perde lateral)
- `:::alteracao`: `margin-left: 1rem`
- Incisos: `padding-left: 1.25em`; alíneas: `padding-left: 2.5em`
- Omitido: `width: 40%`

### Custom components do react-markdown

Registrar componentes para as 4 diretivas:

```tsx
const directiveComponents = {
  alteracao: ({ children }) => <div className="alteracao-block">{children}</div>,
  omitido: () => <span className="omitido-line" aria-label="Trecho não alterado" />,
  nr: ({ children }) => <span className="nr">{children}</span>,
  signature: ({ children }) => <div className="signature-block">{children}</div>,
};
```

E um component customizado para `<p>` que detecta padrões de inciso (`^I -`, `^II -`, ...) e alínea (`^a)`, `^b)`, ...) no início do conteúdo e adiciona classe `.inciso` ou `.alinea`.

## Mudança em `app/(acervo)/legislacao/[id]/page.tsx`

Linha 273 (atual):
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

Nenhuma outra mudança nessa página.

## Testes

### Arquivo novo: `lib/format-legal-content.test.ts`

**Grupo A — Regras isoladas (~12 testes):**

| # | Caso | Input → Output |
|---|---|---|
| 1 | Merge: artigo + objeto direto | `"Art. 1º O\n\nDecreto..."` → `"**Art. 1º** O Decreto..."` |
| 2 | Merge: preposição órfã | `"...disposto no\n\nart. 8º..."` → `"...disposto no art. 8º..."` |
| 3 | Aspas simples 1 parágrafo | `"texto “Art. 1º ... (NR)”"` → contém `:::alteracao` |
| 4 | Aspas multi-parágrafo | bloco com 4 ¶ entre `“` e `”` → todos no `:::alteracao` |
| 5 | Aspas aninhadas | `“a “b” c”` → balanceamento correto |
| 6 | Aspa não-fechada | `“texto sem fim` → fail-safe, sem `:::alteracao` |
| 7 | `[...]` → `:omitido` | `"Art. 1º [...] Parágrafo"` → `"**Art. 1º** :omitido **Parágrafo**"` |
| 8 | `(NR)` preserva | `"texto. (NR)"` → `"texto. :nr[(NR)]"` |
| 9 | caput em itálico | `"art. 84, caput, inciso"` → `"art. 84, *caput*, inciso"` |
| 10 | caput word boundary | `"capturar"` NÃO vira `"*capt*urar"` |
| 11 | Título oficial preservado | header `"DECRETO Nº 12.926..."` → output começa com `"# DECRETO Nº..."` |
| 12 | DECRETA: bold, sem `---` | `"DECRETA:"` → `"**DECRETA:**"` (não régua) |

**Grupo B — Snapshot tests (3 casos):**
- Decreto 12.926/2026 (já no banco) → snapshot completo do markdown
- Portaria curta sem alterações → snapshot
- IN com anexos → snapshot

**Grupo C — Smoke tests:** loop em todos os atos de `LegislativeAct` no banco, assertando para cada um:
- Output é string não-vazia
- Sem `[...]` literal remanescente
- Toda abertura `:::alteracao` tem fechamento `:::`
- Sem caracteres `“` ou `”` cru fora de `:::alteracao`

### Golden test visual — Decreto 12.926/2026

Manual, uma única vez como aceitação. Build local + Playwright MCP para screenshot + comparação lado-a-lado com a screenshot oficial do Planalto. Checklist:

- [ ] Título "DECRETO Nº 12.926..." centralizado em vinho com underline
- [ ] Ementa ("Altera o Decreto nº 12.174...") à direita, em vinho itálico
- [ ] Preâmbulo "O PRESIDENTE DA REPÚBLICA" em bold, justificado
- [ ] "DECRETA:" em bold, sem régua
- [ ] "Art. 1º O Decreto nº 12.174..." com recuo de primeira linha
- [ ] Bloco `"Art. 1º .........."` recuado à esquerda com borda lateral
- [ ] Linha pontilhada visível no lugar de `[...]`
- [ ] "Parágrafo único" em bold dentro do bloco de alteração
- [ ] "(NR)" discreto em cinza pequeno
- [ ] *caput* em itálico em todas as ocorrências
- [ ] Incisos `I -`, `II -`, `III -` com recuo de bloco
- [ ] Alínea `b)` com recuo extra
- [ ] Assinatura "Brasília, 13 de abril de 2026" centralizada

### Não-regressão

- `/blog/[slug]` renderiza idêntico (usa `MarkdownContent` sem variant)
- `/area-restrita/lei-comentada` renderiza idêntico
- Newsletter HTML não afetado (não usa `MarkdownContent`)
- `npm run build` sem erros TypeScript
- Lighthouse score da página `/legislacao/[id]` antes vs depois — desvio ≤ 2 pontos

## Riscos e mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Atos atípicos (apostilas, orientações) com merge agressivo gerando texto errado | Baixa | Smoke test Grupo C pega isso. Se um ato específico falhar, dá pra restringir `variant="planalto"` por `hierarchyLevel`. |
| Aspa abrindo sem fechar (scraping defeituoso) | Média | Fail-safe: contador não-balanceado aborta `:::alteracao`, devolve parágrafos como estavam |
| Lora demora a carregar em conexão lenta | Baixa | `font-display: swap` + fallback `Georgia, 'Times New Roman', serif` |
| `remark-directive` mata `react-markdown` em alguma versão | Baixa | Versões testadas pinadas no `package.json`. Smoke test pega antes do deploy. |
| Conflito CSS com `markdown-content` base | Baixa | Tudo escopado em `.markdown-content--planalto`. Variante atual continua intocada. |

## Files affected

**Novos:**
- `lib/format-legal-content.test.ts` (~150 linhas, suíte completa)
- `lib/__snapshots__/format-legal-content.test.ts.snap` (auto-gerado, revisado uma vez)

**Modificados:**
- `lib/format-legal-content.ts` (~80 linhas adicionadas — 7 regras novas/reforçadas)
- `components/MarkdownContent.tsx` (~150 linhas adicionadas — CSS variante + 4 custom components + font Lora)
- `app/(acervo)/legislacao/[id]/page.tsx` (1 linha — prop `variant="planalto"`)
- `package.json` (+1 dep: `remark-directive`)

**Não tocar:**
- `prisma/schema.prisma`
- Pipeline de scraping/importação (`lib/legislative-acts/`, scripts de import)
- Rotas `/area-restrita/lei-comentada`, `/artigo/[numero]`, `/blog/[slug]`

## Estimativa

- 1-2 dias de implementação focada
- ~7 commits granulares (1 por bloco: deps, format-legal-content regras A-B, regras C-H, MarkdownContent variant, custom components, testes, glue final)
- Validação: 30 min de golden test manual + ajustes finos
