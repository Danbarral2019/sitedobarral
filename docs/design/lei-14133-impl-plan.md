# Plano de Implementação — Direção C "Edição Comentada"

> Escolhida em 2026-04-30. Base: `lei-14133-shape-brief.md` + `lei-14133-direcoes-visuais.md` (Direção C).
>
> **Escopo:** redesign de `/lei-14133` (home) + `/artigo/[numero]` (detalhe), seguindo a metáfora "edição doutrinária comentada do Prof. Daniel Barral".
>
> **Tempo estimado:** 2-3 sessões de implementação. Esta sessão entrega só o plano.

## 1. Resumo executivo

A Direção C reorganiza a Lei 14.133 como uma **edição doutrinária comentada** — o leitor entra no que parece a abertura de um livro técnico, busca está disponível mas não dominante, os artigos são apresentados agrupados pelos **capítulos da própria Lei** (não pelos 21 grupos temáticos atuais), e a página de cada artigo tem **marginália** (aside narrow à direita) com jurisprudência, pareceres e cross-references.

A implementação tem três frentes paralelas que precisam convergir:

1. **Tipografia + tokens de cor** — adoção de Source Serif 4 + Inter + JetBrains Mono, off-white `#fdfdfb`, paleta âmbar acadêmico (DESIGN.md).
2. **Reorganização de dados** — mapeamento dos artigos pelos capítulos oficiais da Lei + agregação de contadores Document↔leiArticles por artigo e por capítulo.
3. **Refazer páginas** — `app/lei-14133/page.tsx` (home) e `app/artigo/[numero]/page.tsx` (detalhe), com componentes novos seguindo DESIGN.md.

## 2. Mudanças globais (afetam todo o site, não só Lei 14.133)

Estas mudanças têm efeito além das duas páginas em escopo. **Decidir em primeiro deploy** se aplica globalmente ou só nas páginas afetadas (recomendado: globalmente, porque DESIGN.md já define como visão coerente).

### 2.1. Tipografia

**Substituir:**
- Cinzel (display atual) → **Source Serif 4** (Adobe, Google Fonts variável)
- Poppins (body atual) → **Inter** (Google Fonts variável)

**Adicionar:**
- **JetBrains Mono** (Google Fonts variável) — para números de artigos, citações técnicas, códigos

**Onde mexer:**
- `app/layout.tsx` — substituir imports `next/font/google`
- `app/globals.css` — atualizar `--font-sans`, `--font-serif`, adicionar `--font-mono`
- Componentes que usam `font-cinzel` (grep) — trocar para `font-serif` ou ajustar classe utilitária
- `tailwind.config.ts` — atualizar fontFamily se necessário

**Carregamento:**
- Continuar usando `next/font/google` para zero CLS
- `display: 'swap'`, weight ranges: Source Serif 4 [400, 500, 600], Inter [400, 500, 600, 700], JetBrains Mono [400, 500]

### 2.2. Tokens de cor

Atualizar `app/globals.css` com tokens de DESIGN.md:

```css
:root {
  /* Off-whites e tintas (NOVOS) */
  --surface-page: oklch(99% 0.003 80);          /* #fdfdfb */
  --surface-raised: oklch(96% 0.005 80);        /* #f7f6f3 */
  --surface-deep: oklch(92% 0.008 80);          /* #eeeae4 */
  --ink-primary: oklch(15% 0.005 240);          /* #1a1c20 */
  --ink-secondary: oklch(30% 0.005 240);        /* #3d4044 */
  --ink-muted: oklch(50% 0.005 240);            /* #6b6e72 */
  --border-subtle: oklch(91% 0.006 80);         /* #e8e6e1 */
  --border-strong: oklch(80% 0.008 80);         /* #cdcac4 */

  /* Âmbar acadêmico (NOVO) */
  --amber-accent: oklch(60% 0.09 75);           /* #b07d3a */
  --amber-accent-deep: oklch(46% 0.06 65);      /* #8a6235 */
  --amber-accent-soft: oklch(88% 0.04 80);      /* #e9d8b8 */

  /* Brand existente (mantém) */
  --brand-primary: #20364e;
  /* etc. */
}

body {
  background: var(--surface-page);
  color: var(--ink-primary);
}
```

### 2.3. Migração defensiva

Globais afetam o site inteiro. Estratégia:

1. Adicionar as **novas vars** sem remover as antigas
2. Atualizar `app/lei-14133/*` e `app/artigo/[numero]/*` pra usar as novas
3. Em commit separado, varrer o site e migrar páginas restantes
4. Em commit final, remover Cinzel/Poppins e CSS legado

## 3. Reorganização de dados

### 3.1. Mapeamento grupos → capítulos

A Lei 14.133/2021 tem estrutura oficial em **Títulos → Capítulos → Seções → Artigos**. Os atuais 21 "grupos temáticos" em `data/lei-14133-grupos.ts` não correspondem 1-para-1 com a estrutura oficial. Para a Direção C, precisamos da **estrutura oficial**.

**Ação:** criar `data/lei-14133-capitulos.ts` mapeando cada artigo ao seu capítulo oficial:

```ts
export interface ChapterEntry {
  id: string;              // 'cap-i', 'cap-ii', ...
  number: string;          // 'I', 'II', ...
  title: string;           // 'Disposições Preliminares'
  titleNumber: string;     // 'TÍTULO I' (a Lei tem 5 títulos)
  articles: string[];      // ['1', '2', '3', '4', '5']
}
```

Os 21 grupos temáticos atuais NÃO são removidos — viram **filtro lateral opcional** (chip "Por tema") que cruza com a navegação por capítulo.

**Fonte da estrutura oficial:** o próprio texto da lei já indica `titulo` e `capituloCompleto` em cada artigo de `data/lei-14133-artigos.ts`. Basta agrupar.

### 3.2. Contadores Document↔leiArticles

Cada `Document` no DB tem `leiArticles` (JSON array de números). Para o redesign precisamos:

- **Por artigo:** quantos Documents (acórdãos, pareceres, ONs) referenciam aquele artigo
- **Por capítulo:** soma das contagens dos artigos do capítulo
- **Globais:** total de acórdãos relacionados a qualquer artigo da Lei + total de pareceres/ONs

**Ação:** criar **API nova** `app/api/lei-14133/stats/route.ts` que retorna:

```ts
{
  totalArticles: number;
  totalAcordaos: number;        // documents com category='acordao' e leiArticles cobrindo Lei 14.133
  totalPareceresOns: number;    // documents com category in (parecer, parecer-vinculante, decor, orientacao-normativa)
  porArtigo: Record<string, { acordaos: number; pareceresOns: number; }>;
  porCapitulo: Record<string, { acordaos: number; pareceresOns: number; }>;
  ultimaAtualizacao: string;    // mais recente entre updates legislativos
}
```

Cache: Redis 1h (igual ao padrão das outras APIs do projeto). Revalidate ISR 1h.

## 4. Componentes novos / refatorados

Em `components/lei-14133/` (novo diretório):

| Componente | Arquivo | Função |
|---|---|---|
| `LegalHeroCover` | `LegalHeroCover.tsx` | Hero "abertura de livro" da home: título grande, prosa explicativa com stats, busca modesta |
| `ChapterDivider` | `ChapterDivider.tsx` | Separador entre capítulos da Lei na lista da home |
| `ArticleListItem` | `ArticleListItem.tsx` | Linha de artigo na home: numero (mono) + título + ementa + chips contagem à direita |
| `ArticleNumberMono` | `ArticleNumberMono.tsx` | Componente atômico: número de artigo em JetBrains Mono, com formato consistente |
| `ArticleHeader` | `ArticleHeader.tsx` | Topo da página de artigo: número grande (Source Serif 4 display) + título + breadcrumb |
| `ArticleBody` | `ArticleBody.tsx` | Texto integral do artigo em coluna 60-65ch, Source Serif 4 1.125rem |
| `ArticleMargin` | `ArticleMargin.tsx` | Aside narrow ~280px com tabs internas (Jurisprudência, Pareceres, Cross-refs) — em desktop, sticky |
| `ArticleMarginAccordion` | `ArticleMarginAccordion.tsx` | Versão mobile do aside: accordion ao final do artigo |
| `LegalSearchCommand` | `LegalSearchCommand.tsx` | Campo de busca modesto com atalho `/`, debounce 200ms, highlights |
| `LegalFilterDropdown` | `LegalFilterDropdown.tsx` | Dropdown link-style "Filtros: grupo · tipo · base legal" — abre painel discreto |
| `CitationLinkPreview` | `CitationLinkPreview.tsx` | Hover preview (≥350ms) de artigo citado dentro do texto |

Componentes existentes a **manter** (mas verificar compat tipográfica):
- `LegislativeActsPanel` — já é robusto, só ajustar para tokens novos
- `ArticleRelationshipGraph` — pode ficar em segunda tela (área restrita) ou ser apresentado como diagrama na margem

Componentes a **deprecar/remover**:
- `CollapsibleArticle` — substituído por `ArticleListItem` (sem expansão inline)
- Sidebar de grupos temáticos atual — vira filtro dropdown

## 5. APIs

### 5.1. `/api/lei-14133/stats` (novo)

Já descrito em §3.2. Server-only, cache Redis 1h, revalidate ISR.

### 5.2. `/api/lei-14133/articles` (estender)

Já existe com suporte a `withDocuments=true`. Estender:

- `?withCounts=true` retorna apenas contagens (acordaos, pareceresOns) por artigo, mais leve
- `?capitulo=I` filtra por capítulo
- `?grupo=tema-x` filtra por grupo temático (mantém compat com URL antiga)
- `?q=texto` busca textual

### 5.3. `/api/artigos/[numero]/related` (novo, ou estender existente)

Retorna agregado para a aside da página de artigo:

```ts
{
  jurisprudencia: { total: number; topItems: TribunalDecision[] };
  pareceres: { total: number; topItems: Document[] };       // categories: parecer*, decor, on
  crossRefs: { total: number; topItems: Article[] };        // outros artigos relacionados via cross-references.ts
}
```

`topItems` retorna 5-10 mais relevantes por padrão; "Ver todos" leva para listagem dedicada.

## 6. Páginas

### 6.1. `app/lei-14133/page.tsx` (refazer)

Estrutura nova:

```tsx
export const revalidate = 3600;

export default async function LeiPage() {
  const stats = await getCachedLeiStats();          // /api/lei-14133/stats
  const capitulos = getCapitulosWithArticles();     // data/lei-14133-capitulos.ts
  const counts = await getCachedArticleCounts();    // /api/lei-14133/articles?withCounts=true

  return (
    <main>
      <LegalHeroCover stats={stats} />              {/* hero "abertura de livro" */}
      <LegalSearchCommand />                        {/* sticky abaixo do hero */}
      <LegalFilterDropdown />                       {/* link-style */}

      {capitulos.map((cap) => (
        <section key={cap.id}>
          <ChapterDivider chapter={cap} />
          {cap.articles.map((numero) => (
            <ArticleListItem
              key={numero}
              numero={numero}
              article={artigos[numero]}
              counts={counts[numero]}
            />
          ))}
        </section>
      ))}
    </main>
  );
}
```

Server component. Filtros e busca são client island via URL search params.

### 6.2. `app/artigo/[numero]/page.tsx` (refazer)

Estrutura nova:

```tsx
export default async function ArtigoPage({ params }) {
  const { numero } = await params;
  const article = artigos[numero];
  const related = await getCachedArticleRelated(numero);  // /api/artigos/{numero}/related
  const chapter = getChapterByArticle(numero);

  return (
    <main>
      <ArticleHeader
        numero={numero}
        title={article.titulo}
        chapter={chapter}
      />
      <div className="grid lg:grid-cols-[1fr_280px] gap-8">
        <ArticleBody content={article.ementa} />
        <ArticleMargin
          related={related}
          className="hidden lg:block"
        />
      </div>
      <ArticleMarginAccordion
        related={related}
        className="lg:hidden"
      />
      <ArticleNavigation numero={numero} />
    </main>
  );
}
```

Server component, client island só pra hover preview e tabs interativas.

## 7. Estados

| Estado | Implementação |
|---|---|
| **Default** (home, sem filtros) | Lista completa, capítulos delineados |
| **Filtrando** | Capítulos vazios escondem-se. Header mostra "X resultados em Y capítulos" |
| **Empty (busca sem match)** | Após capítulo header, "Nenhum artigo encontrado para 'X'." + sugestão (3 termos comuns) |
| **Loading inicial** | Skeleton: hero estático + 3 capítulos com 5 linhas de skeleton cada |
| **Loading busca/filtro** | Spinner discreto no campo + 200ms debounce |
| **Error API stats** | Hero usa fallback "193 artigos" e omite contagens dinâmicas. Banner discreto opcional. |
| **Sem related na pg artigo** | Aside mostra "Nenhuma jurisprudência catalogada para este artigo ainda." |

## 8. Acessibilidade

WCAG AA (DESIGN.md):

- Headings hierárquicos: `<h1>` é o título da Lei (home) ou número do artigo (detalhe). `<h2>` para capítulos. `<h3>` para artigos na lista. `<h4>` para tópicos da margem.
- `<article>` em volta de cada `ArticleListItem` e `ArticleBody`
- `<nav aria-label="Filtros">` para o painel de filtros
- `<aside aria-label="Referências e jurisprudência">` para a margem
- Atalho de teclado `/` foca o campo de busca; `Esc` limpa
- Foco visível com anel âmbar (DESIGN.md `box-shadow: 0 0 0 3px oklch(60% 0.09 75 / 0.25)`)
- `prefers-reduced-motion` desativa transições não-essenciais
- Contraste validado em todos os textos contra `surface-page` e `surface-raised`

## 9. Verificação

Antes do push pra produção:

1. **Build local** (`npm run build`) sem erros nem warnings novos
2. **Lighthouse mobile** ≥ 85 (foco: LCP, CLS)
3. **Smoke test manual**:
   - Home carrega capítulos, busca funciona, filtros aplicam
   - Artigo individual: aside lateral em desktop, accordion em mobile (375px), 65ch em texto
   - Hover de link interno mostra preview (depois de 350ms)
   - Atalho `/` e `Esc` funcionam
   - Contadores na home batem com query direta no DB (ON 102 → quantos pareceres?)
4. **Visual regression** (sem ferramenta, manual): comparar com Direção C deste mockup
5. **`/impeccable critique app/lei-14133/page.tsx`** e **`/impeccable critique app/artigo/[numero]/page.tsx`** — esperar score >0.7 e zero anti-patterns
6. **Vercel preview deploy** (sem branch) → user valida → push em main

## 10. Pendentes para próximas sessões

- **Capability dark mode:** DESIGN.md hoje só prevê light. Adicionar dark theme tokens em sessão futura se demanda surgir.
- **Inline preview de citação:** começa simples (link), evolui pra hover preview (≥350ms). Pode ser feature flag.
- **Modo "leitura sequencial":** botão "Ler do Art. 1 ao Art. N" pra alunos. Adia para v2.
- **Migração tipográfica do site inteiro:** este plano cobre Lei 14.133 + artigo. Páginas restantes (home, blog, jurisprudência) migram em commit separado depois.
- **Componente ArticleRelationshipGraph:** atualmente está na página de artigo logada; avaliar se mover para a margem pública ou manter como feature exclusiva.

## 11. Estimativa de esforço

| Fase | Tempo estimado |
|---|---|
| Tipografia global (fonts + tokens) | 2-3h |
| `data/lei-14133-capitulos.ts` (mapeamento) | 1-2h |
| API `/api/lei-14133/stats` | 1-2h |
| API `/api/artigos/[numero]/related` | 1-2h |
| Componentes em `components/lei-14133/` (11 novos) | 6-8h |
| Refazer `app/lei-14133/page.tsx` | 2-3h |
| Refazer `app/artigo/[numero]/page.tsx` | 3-4h |
| Estados (loading, empty, error) | 2h |
| Acessibilidade + foco em teclado | 1-2h |
| Verificação + critique impeccable + ajustes | 2-3h |
| **Total** | **~22-30h** (2-3 sessões focadas) |

## 12. Próximo passo

Esta sessão termina com o plano completo escrito. Em sessão dedicada (sugestão: separadamente, fora desta), executar:

1. Implementar Fase 2.1 (tipografia + tokens) primeiro — afeta o site inteiro, vale isolar
2. Validar visualmente em alguma página simples (sobre, contato)
3. Implementar Fase 3 (dados) + Fase 4 (componentes Lei 14.133) em paralelo
4. Implementar Fase 5 (APIs) em paralelo
5. Implementar Fase 6 (páginas) integrando tudo
6. Verificação completa + Vercel preview
7. Push em main quando aprovado

Pra começar, abrir nova sessão e referenciar este plano: `docs/design/lei-14133-impl-plan.md`.
