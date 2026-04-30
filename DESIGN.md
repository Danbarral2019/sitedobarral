---
name: Site do Prof. Daniel Barral
description: Repositório jurídico operacional — Direito Administrativo, Licitações e Contratos
colors:
  brand-primary: "#20364e"
  brand-deep: "#142230"
  brand-mid: "#3a5a73"
  brand-50: "#f0f4f7"
  brand-100: "#d9e2ea"
  brand-200: "#b3c5d5"
  brand-300: "#8da8c0"
  brand-400: "#5d8199"
  brand-500: "#3a5a73"
  brand-600: "#20364e"
  brand-700: "#1a2c3f"
  brand-800: "#142230"
  brand-900: "#0e1821"
  amber-accent: "#b07d3a"
  amber-accent-deep: "#8a6235"
  amber-accent-soft: "#e9d8b8"
  ink-primary: "#1a1c20"
  ink-secondary: "#3d4044"
  ink-muted: "#6b6e72"
  surface-page: "#fdfdfb"
  surface-raised: "#f7f6f3"
  surface-deep: "#eeeae4"
  border-subtle: "#e8e6e1"
  border-strong: "#cdcac4"
  semantic-success: "#2f6f4a"
  semantic-warning: "#a86b1c"
  semantic-error: "#a23830"
typography:
  display:
    fontFamily: "'Source Serif 4', 'Source Serif Pro', Georgia, serif"
    fontSize: "clamp(2rem, 4.5vw, 3.5rem)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "'Source Serif 4', 'Source Serif Pro', Georgia, serif"
    fontSize: "clamp(1.5rem, 2.5vw, 2rem)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, 'Inter Tight', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  body-reading:
    fontFamily: "'Source Serif 4', Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0.005em"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.06em"
  mono:
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
rounded:
  none: "0px"
  sm: "3px"
  md: "6px"
  lg: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.brand-primary}"
    textColor: "{colors.surface-page}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.brand-deep}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.brand-primary}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-raised}"
  input-text:
    backgroundColor: "{colors.surface-page}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  badge-citation:
    backgroundColor: "{colors.amber-accent-soft}"
    textColor: "{colors.amber-accent-deep}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-source:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  surface-card:
    backgroundColor: "{colors.surface-page}"
    rounded: "{rounded.md}"
    padding: "20px"
---

# Design System: Site do Prof. Daniel Barral

## 1. Overview

**Creative North Star: "O Caderno do Tribunal"**

A linguagem visual desta plataforma é a de um **caderno doutrinário moderno** — o livro técnico que um operador do direito mantém aberto na mesa enquanto trabalha. Capa sóbria, miolo denso, marginália visível, números à vista. O leitor entende em segundos onde está, qual é a fonte, e onde encontrar a próxima referência.

O sistema rejeita explicitamente três caricaturas: **info-produto** (gradients roxos, urgência manufaturada, depoimentos plásticos), **portal de tribunal antigo** (cinza-1995, formulários cascata, paleta dependente do ente publicador), e **SaaS genérico moderno** (hero gradient + 3 cards + CTA roxo, o "AI made that" sem pensar). O ponto de equilíbrio é a ferramenta jurídica séria — Westlaw, Lexis, Google Scholar — atualizada com tipografia editorial contemporânea e densidade respeitosa.

**Key Characteristics:**
- Fundo levemente quente, quase off-white, nunca puro `#fff`
- Tipografia editorial com serif para leitura longa e mono para citações de artigos
- Paleta restrita: azul petróleo da casa + um acento âmbar reservado para refs importantes
- Densidade alta mas hierarquizada — nunca cards aerados onde lista densa serve melhor
- Profundidade por tonalidade, não por sombra

## 2. Colors

A paleta é **restrita por escolha**, não por timidez. Azul petróleo (a marca do Prof. Daniel Barral) carrega ≤10% da área visível em qualquer tela; o âmbar quente aparece apenas onde há informação que precisa ser lida com atenção (jurisprudência citada, fonte oficial, marcador de versão). Tudo o mais é neutro tintado para o brand hue (chroma ≤0.01) — nunca preto puro, nunca branco puro.

### Primary
- **Petróleo da Casa** (#20364e / `oklch(28% 0.04 240)`): a marca. Aparece em links, ícones de navegação, botões primários, ênfases de heading. Carrega ≤10% da área em qualquer tela.
- **Petróleo Profundo** (#142230 / `oklch(20% 0.03 240)`): hover do primary, headers de página de detalhe, faixas de credibilidade institucional.

### Secondary
- **Âmbar Acadêmico** (#b07d3a / `oklch(60% 0.09 75)`): o "lápis vermelho" do caderno. Aparece exclusivamente em **referências** — citações de jurisprudência, link "fonte oficial", marcador de "versão atualizada". Nunca decorativo.
- **Âmbar Profundo** (#8a6235 / `oklch(46% 0.06 65)`): texto de marcador (sobre `amber-accent-soft`).
- **Âmbar Suave** (#e9d8b8 / `oklch(88% 0.04 80)`): fundo de chip/badge de citação.

### Neutral
- **Tinta Principal** (#1a1c20 / `oklch(15% 0.005 240)`): texto base. Quase preto, mas levemente azulado pela brand hue.
- **Tinta Secundária** (#3d4044 / `oklch(30% 0.005 240)`): texto descritivo, ementas longas.
- **Tinta Apagada** (#6b6e72 / `oklch(50% 0.005 240)`): metadado, datas, contagens, breadcrumbs.
- **Página** (#fdfdfb / `oklch(99% 0.003 80)`): fundo principal da página. Off-white levemente quente, jamais `#fff`.
- **Superfície Elevada** (#f7f6f3 / `oklch(96% 0.005 80)`): cards de conteúdo, sidebars sticky, painéis laterais.
- **Superfície Profunda** (#eeeae4 / `oklch(92% 0.008 80)`): marcadores de seção dentro de leitura longa, separadores de capítulo.
- **Borda Sutil** (#e8e6e1 / `oklch(91% 0.006 80)`): divisores horizontais, bordas de input em estado de repouso.
- **Borda Forte** (#cdcac4 / `oklch(80% 0.008 80)`): bordas de input no hover, separadores de seção fortes.

### Named Rules

**A Regra das 10%.** O petróleo da casa nunca carrega mais de 10% de qualquer tela. Se uma página parece "azul demais", está errada — substituir blocos azuis por neutros tintados.

**A Regra do Lápis Vermelho.** O âmbar acadêmico aparece exclusivamente onde há informação institucional que precisa ser lida com atenção (citação oficial, link DOU, marcador de revisão). Nunca em CTAs, nunca em hero, nunca em decoração. Se você vê o âmbar e ele não diz "olha aqui, isto é jurisprudência" — está mal aplicado.

**A Regra Off-White.** O fundo principal é `#fdfdfb`, jamais `#fff`. O preto é `#1a1c20`, jamais `#000`. Se um valor puro escapar, é bug.

## 3. Typography

**Display Font:** Source Serif 4 (com fallback Source Serif Pro, Georgia, serif)
**Body Font:** Inter (com fallback Inter Tight, system-ui, sans-serif)
**Reading Font:** Source Serif 4 — usada em blocos de leitura prolongada (artigos da Lei, textos integrais de DOU)
**Mono Font:** JetBrains Mono (com fallback Fira Code, Consolas, monospace)

**Character:** Source Serif é a tipografia da editora técnica do Adobe — generosa em pesos, calma na contraescala, leitura sem ruído. Pareada com Inter (a sans neutra de mais variantes do mercado), forma o duo "livro + ferramenta". JetBrains Mono entra para qualquer marcador técnico — número de artigo, código de processo, citação `art. 75, II, b`. Os três fontes são gratuitas via Google Fonts e carregadas com `next/font` para zero CLS.

### Hierarchy

- **Display** (Source Serif 4, weight 400, `clamp(2rem, 4.5vw, 3.5rem)`, line-height 1.08, letter-spacing -0.015em): hero de página principal, abertura de capítulo. Use uma vez por tela, no máximo.
- **Headline** (Source Serif 4, weight 500, `clamp(1.5rem, 2.5vw, 2rem)`, line-height 1.15): título de seção dentro de página, abertura de artigo individual.
- **Title** (Inter, weight 600, 1.125rem, line-height 1.3): título de card, label de filtro, título de coluna.
- **Body** (Inter, weight 400, 1rem, line-height 1.6, max-width 65ch): texto de UI, descrições, ementas curtas, metadados.
- **Body-Reading** (Source Serif 4, weight 400, 1.0625rem, line-height 1.7, max-width 65ch): blocos de leitura prolongada — texto de artigo, parágrafos de doutrina, texto integral DOU.
- **Label** (Inter, weight 500, 0.75rem, letter-spacing 0.06em, UPPERCASE): tag de categoria, badge de fonte, marcador de seção.
- **Mono** (JetBrains Mono, weight 400, 0.875rem, line-height 1.5): número de artigo (`Art. 75`), inciso (`II, b`), número de processo, citação técnica em linha.

### Named Rules

**A Regra do Texto da Lei.** Texto integral de artigo da Lei 14.133/Lei 8.666 é renderizado em **Source Serif 4 1.0625rem line-height 1.7**, em coluna ≤65ch. Sem exceção. É o caso de uso prioritário do site — não pode ser sacrificado por design.

**A Regra do Mono Funcional.** JetBrains Mono entra apenas onde representa um identificador técnico imutável: número de artigo, citação de inciso, código de processo, hash. Não é decorativo. Se o texto admitiria reescrita em prosa, não é mono.

**A Regra do Caps Discreto.** UPPERCASE é reservado para Labels (tags, categorias, marcadores de seção). Nunca em headings, nunca em parágrafos, nunca em CTAs. Em UPPERCASE, sempre `letter-spacing: 0.06em` para legibilidade.

## 4. Elevation

Sistema **flat-by-default**. Profundidade vem de **tonalidade** (página → superfície elevada → superfície profunda), não de sombra. Sombra é estado de interação, não decoração.

### Shadow Vocabulary
- **Foco discreto** (`box-shadow: 0 0 0 3px oklch(60% 0.09 75 / 0.25)`): anel de foco em inputs, botões e links. Usa o âmbar acadêmico para puxar atenção sem destoar.
- **Hover de card clicável** (`box-shadow: 0 1px 3px oklch(15% 0.005 240 / 0.06), 0 1px 2px oklch(15% 0.005 240 / 0.08)`): apenas em superfícies que de fato são clicáveis. Surpresa: o cursor mudou — a sombra confirma.

### Named Rules

**A Regra Plana de Repouso.** Em estado default (sem hover, sem foco), nenhuma superfície tem sombra. Profundidade é construída empilhando tons da escala neutra (`surface-page` → `surface-raised` → `surface-deep`). Se uma página parece com cards flutuando sobre fundo, está errada.

**A Regra Sem Glassmorphism.** Backdrop-filter, blurs decorativos, "vidro fosco" — nada disso. O caderno do tribunal é papel, não vidro.

## 5. Components

### Buttons

- **Shape:** raio sutil de 3px (`rounded.sm`). Nunca pílula, nunca quadrado puro.
- **Primary:** `background: brand-primary; color: surface-page; padding: 10px 20px; font: Inter 600 0.875rem;`. Hover: `background: brand-deep`. Foco: anel âmbar discreto.
- **Ghost:** `background: transparent; color: brand-primary; padding: 10px 16px;`. Hover: `background: surface-raised`. Para ações secundárias e cancelar.
- **Não usar:** botões com gradiente, botões 3D, botões com ícone gigante. Nunca.

### Chips & Badges

Três tipos, nunca mais:

- **Citation Badge** (jurisprudência, fonte oficial): `background: amber-accent-soft; color: amber-accent-deep; padding: 2px 8px; rounded: sm; font: Inter 500 0.75rem`. Aparece com o ícone discreto de aspas ou link externo, e SOMENTE quando aponta para uma fonte primária.
- **Source Badge** (categoria, ente, ano): `background: surface-raised; color: ink-secondary; padding: 2px 8px; rounded: sm; font: Inter 500 0.75rem`. Para metadados de ente (TCU, AGU, IBDA, INCP, CJF).
- **Mono Tag** (número de artigo, código): `background: transparent; color: brand-primary; font: JetBrains Mono 400 0.875rem`. Sem fundo. Só o texto técnico.

### Cards / Containers

Cards são o **último recurso**, não o primeiro. Listagens longas devem ser linhas, não cards. Quando card é a resposta certa:

- **Corner:** raio de 6px (`rounded.md`)
- **Background:** `surface-page` em fundo `surface-raised`, OU `surface-raised` em fundo `surface-page`. Nunca cards aninhados.
- **Border:** 1px sólida `border-subtle` em vez de sombra.
- **Padding interno:** 20px (`spacing.lg`).
- **Hover (se clicável):** sombra leve descrita em Elevation. Não move o card.
- **Proibido:** card com gradiente de fundo, card com border-left colorida, cards aninhados.

### Inputs / Fields

- **Style:** `background: surface-page; border: 1px solid border-subtle; rounded: 3px; padding: 10px 14px; font: Inter 400 1rem`.
- **Hover:** `border-color: border-strong`.
- **Focus:** anel âmbar discreto (3px), `border-color: brand-primary`.
- **Search input:** ícone de lupa à esquerda (Inter 400, color `ink-muted`), placeholder em `ink-muted`.
- **Disabled:** opacidade 0.5, cursor not-allowed, sem alteração de cor (não infantilizar).

### Navigation

- **Header de site:** background `brand-primary` (a única exceção à Regra das 10%, porque header é institucional). Texto em `surface-page`, links em weight 400, ativo em weight 600. Cinzel está OUT — substituir por Source Serif 4 em peso 500.
- **Sidebar de página de detalhe (Lei 14.133, base de conhecimento):** background `surface-raised`, sticky em desktop, drawer em mobile. Itens em Inter 400 0.9375rem. Item ativo: weight 600 + barra vertical âmbar de 2px à esquerda (a única exceção à proibição de side-stripe — funcional, não decorativa).

### Article Number (componente assinatura)

A unidade visual mais reconhecível do site. Aparece em sidebars, listas de artigos, breadcrumbs.

- **Renderização:** `font: JetBrains Mono 400 1.5rem; color: brand-primary; padding-right: 12px; border-right: 1px solid border-subtle`.
- **Acompanhado de:** título do artigo em Source Serif 4 weight 500, descrição em Inter 400.
- **Nunca:** dentro de círculo colorido, dentro de gradient, com ícone substituto.

### Citation Block (texto integral da Lei)

- **Style:** background `surface-raised`, padding 20px-24px, border-left 4px `brand-primary` (a outra exceção justificada — é uma citação literal, igual à barra de citação de qualquer livro técnico).
- **Texto:** Source Serif 4 1.0625rem line-height 1.7, max-width 65ch.
- **Atribuição:** abaixo do bloco, em Inter 400 0.75rem `ink-muted`: "Lei 14.133/2021 — art. X, redação atual" + link `amber-accent` para a fonte oficial.

## 6. Do's and Don'ts

### Do:
- **Do** usar `#fdfdfb` e `#1a1c20` em vez de `#fff` e `#000`. Pretos puros e brancos puros são bug.
- **Do** carregar texto integral da lei em Source Serif 4 1.0625rem com line-height 1.7 e max-width 65ch.
- **Do** usar JetBrains Mono para qualquer número de artigo, inciso ou código técnico.
- **Do** aplicar âmbar acadêmico (`#b07d3a`) exclusivamente em referências (citação oficial, fonte DOU, marcador de versão).
- **Do** começar pela hierarquia tipográfica e ritmo de espaçamento. Cor é a última camada.
- **Do** tratar listas longas como **linhas** (densas, com separadores sutis), não como grids de cards.
- **Do** mostrar contagens, datas e fontes a olho nu — o profissional confere antes de citar.
- **Do** usar tonalidade (page → raised → deep) para profundidade. Sombras só para hover/foco.

### Don't:
- **Don't** usar `border-left` ou `border-right` colorido com mais de 1px como decoração. As únicas exceções funcionais são (a) o marcador de item ativo na sidebar, (b) o bloco de citação literal de artigo da lei.
- **Don't** usar gradient text (`background-clip: text`). Ênfase via peso ou tamanho.
- **Don't** usar glassmorphism, backdrop-filter decorativo, "vidro fosco". Nem em hero.
- **Don't** repetir o template hero-metric: número grande + label pequeno + 3 cards de stat + CTA gradient. SaaS cliché, AI slop.
- **Don't** usar cards-grid uniformes com ícone+heading+texto repetidos. Listagens longas viram linhas, não grids.
- **Don't** usar modal como primeira opção. Quase sempre uma página, um drawer ou expansão inline serve melhor.
- **Don't** usar urgência manufaturada — countdown timers, badges "%OFF", "últimas vagas". Anti-Hotmart.
- **Don't** usar paleta cinza-1995 com azul-marinho institucional (paleta govbr antiga). Distinguir-se de portal de tribunal velho é tão importante quanto distinguir-se de info-produto.
- **Don't** usar Cinzel ou Poppins (a stack atual será migrada). Source Serif 4 + Inter + JetBrains Mono.
- **Don't** usar em-dashes (—) como separador de cláusulas. Use vírgulas, dois pontos, ponto-e-vírgula, parênteses.
