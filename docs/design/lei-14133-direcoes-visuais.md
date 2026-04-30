# Direções Visuais — Redesign /lei-14133 + /artigo/[numero]

> Três direções distintas geradas após `/impeccable shape`, todas obedecendo:
> - PRODUCT.md (register=product, anti-info-produto, anti-govbr-velho, anti-SaaS-genérico)
> - DESIGN.md (Source Serif 4 + Inter + JetBrains Mono, paleta restrained + âmbar acadêmico, off-white #fdfdfb, tinta #1a1c20)
> - Brief de shape (sem sidebar fixa, sem hero gigante azul, lista única, página de artigo single-column com aside móvel)
>
> As três variam em **densidade**, **personalidade tipográfica** e **proeminência da busca/filtros**. Escolha uma para implementação.

---

## Direção A — "Westlaw Modernizada"

> *Lista densa com respiro tipográfico. Stats em linha. Filtros chips em primeiro plano.*

### Home `/lei-14133`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Header do site (brand-primary, navegação)                                    │
└──────────────────────────────────────────────────────────────────────────────┘

  Lei 14.133 / 2021                                       atualizado em 04/2026
  ════════════════════════════════════════════════════════
  Lei de Licitações e Contratos Administrativos — Comentada    [Source Serif 4 display]

  193 artigos  ·  1.573 acórdãos do TCU relacionados  ·  162 orientações da AGU
                                                              [Inter 0.875rem ink-muted]

  ┌────────────────────────────────────────────────────────────────────┐
  │ 🔍   Buscar artigo, tema ou número (ex.: 75, pregão, dispensa)     │
  └────────────────────────────────────────────────────────────────────┘
                                                       [campo grande, sem decoração]

  GRUPOS:  [Aplicação] [Princípios] [Agentes] [Processo] [Planejamento] [Modalidades]
           [Critérios] [Contratação Direta] [Aux] [Contratos] [Garantias] [+10]
                                                            [chips em 2 linhas, scrollável]

  TIPO:    [Tem jurisprudência] [Tem parecer/ON] [Lei 14.133] [Lei 8.666]

  ────────────────────────────────────────────────────────────────────
                                                            193 artigos · 21 grupos

   Art. 1.    Âmbito de aplicação · Disposições Preliminares
              [JetBrains Mono 1.5rem]   [Source Serif 4 weight 500 1.125rem]
              Esta Lei estabelece normas gerais de licitação e contratação para as
              Administrações Públicas diretas, autárquicas e fundacionais da União…
                                                            [Inter 0.875rem ink-secondary]
              ⚖ 47 acórdãos     📋 12 pareceres                            ›
              [chips amber-accent, weight 500, 0.75rem]

   ────────────────────────────────────────────────────────────────────

   Art. 2.    Aplicação subsidiária · Disposições Preliminares
              Esta Lei aplica-se às Administrações Públicas dos Estados, do Distrito Federal
              e dos Municípios, nos termos do art. 22, XXVII, da Constituição Federal…
              ⚖ 12 acórdãos                                                ›

   ────────────────────────────────────────────────────────────────────

   Art. 3.    Definições · Princípios e Definições
              [...]

   ────────────────────────────────────────────────────────────────────
                                                          [continua scroll]
```

### Página `/artigo/[numero]`

```
  Lei 14.133  /  Art. 75                                 ← voltar para Lei 14.133

  Art. 75
  ═════════
  Contratação direta · Modalidades de Licitação        [Source Serif 4 display]

  ┌────────────────────────────────────────────────┬──────────────────────────────┐
  │                                                │                              │
  │  É dispensável a licitação:                    │  REFERÊNCIAS NESTE ARTIGO    │
  │                                                │  [label uppercase]            │
  │  I — para contratação que envolva valores      │                              │
  │      inferiores a R$ 100.000,00, no caso de    │  Jurisprudência (47)         │
  │      obras e serviços de engenharia ou de      │  ────────────────             │
  │      serviços de manutenção de veículos        │  Acórdão TCU 1234/2024       │
  │      automotores;                              │  Pleno · 14/03/2024           │
  │                                                │  Sobre dispensa de baixo…    │
  │  II — para contratação que envolva valores     │                              │
  │       inferiores a R$ 50.000,00, no caso de    │  Acórdão TCU 567/2023        │
  │       outros serviços e compras;               │  [+45 mais]                   │
  │                                                │                              │
  │  III — para contratação que mantenha …         │  Pareceres e ONs (12)        │
  │                                                │  ────────────────             │
  │  [Source Serif 4 1.0625rem line-height 1.7,    │  ON 102/2025 AGU             │
  │   max-width 65ch]                              │  Sobre ETP em dispensa…      │
  │                                                │                              │
  │  Lei 14.133/2021 — art. 75, redação atual      │  Cross-references (8)        │
  │  ↗ Texto oficial (planalto.gov.br)              │  ────────────────             │
  │  ↗ Publicação DOU                               │  Art. 6º · Definições        │
  │  [link âmbar]                                   │  Art. 17 · Estimativa…        │
  │                                                │                              │
  └────────────────────────────────────────────────┴──────────────────────────────┘

  ART. ANTERIOR ←  Art. 74. Inexigibilidade...     →  Art. 76. Hipóteses específicas
```

### Características da Direção A

| Atributo | Decisão |
|---|---|
| Busca | Dominante mas não gigante (height ~52px, font 1rem) |
| Filtros | Chips em 2 linhas, sempre visíveis, scroll horizontal em mobile |
| Linhas de artigo | ~100-120px height (número + título + ementa 2 linhas + chips) |
| Separadores | Linha sutil 1px `border-subtle` entre artigos |
| Aside da página de artigo | 1/3 da largura, flexbox simples, mostra contadores e top-3 de cada categoria |
| Tipografia "destaque" | Source Serif 4 weight 500 nos títulos |
| Refeito visualmente | Estática, profissional, claramente "ferramenta de consulta" |

**Pros:** equilíbrio entre densidade e leitura. Filtros visíveis = descoberta rápida. Familiar pra quem usa Westlaw/Lexis.
**Contras:** mais visual elements no fold = mais carga cognitiva inicial. Linhas longas podem cansar em 4K.

---

## Direção B — "Hub Compacto"

> *Stripe Docs jurídico. Linhas tightly packed, hover expande. Filtros e busca colapsam num único bloco header.*

### Home `/lei-14133`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Header do site                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

  Lei 14.133 / 2021 — Comentada                          [Source Serif 4 weight 500 2rem]

  ┌─────────────────┬─────────────────┬─────────────────┐
  │ 193             │ 1.573           │ 162             │   [JetBrains Mono 1.875rem
  │ artigos         │ acórdãos TCU    │ pareceres+ONs   │    + Inter 0.75rem label]
  └─────────────────┴─────────────────┴─────────────────┘
            [3 mini-cards horizontais, sem sombra, border-subtle]

  ┌────────────────────────────────────────────────────────────────────┐
  │ 🔍 Busca rápida...                                          [/]    │
  └────────────────────────────────────────────────────────────────────┘
       [campo médio, atalho / visível à direita]

   GRUPOS  ▼   TIPO ▼   BASE LEGAL ▼              193 artigos · sem filtros ativos
   [dropdowns como command-bar style]
   ────────────────────────────────────────────────────────────────────

   Art. 1     Âmbito de aplicação                          ⚖ 47   📋 12     ›
   Art. 2     Aplicação subsidiária                        ⚖ 12              ›
   Art. 3     Definições                                   ⚖ 89   📋 23     ›
   Art. 4     Princípios da contratação                    ⚖ 134  📋 47     ›
   Art. 5     Princípios fundamentais                      ⚖ 67   📋 15     ›
   Art. 6     Definições normativas                        ⚖ 234  📋 89     ›
              [linhas de 36px, hover background surface-raised]
   Art. 7     Agentes públicos                             ⚖ 18              ›
              ↓ Os agentes públicos atuarão de forma legal, transparente, eficiente…
              [hover: ementa expande inline, 2-3 linhas Source Serif 4 0.875rem]

   Art. 8     Agente de contratação                        ⚖ 56   📋 8       ›
   Art. 9     Vedações                                     ⚖ 23              ›
   Art. 10    Capacidade técnica                           ⚖ 41              ›
   Art. 11    Princípios de licitação                      ⚖ 89   📋 31     ›
   Art. 12    Fase preparatória                            ⚖ 156  📋 67     ›
   ...
```

### Página `/artigo/[numero]`

```
  /  Lei 14.133  /  Art. 75   [breadcrumb pequeno, 0.75rem]

  Art. 75 · Contratação direta
  ═══════════════════════════                            [Source Serif 4 weight 500 1.875rem]
  Modalidades de Licitação                            [Inter 0.875rem ink-muted]

  ┌────────────────────────────────────────────────────────────────┐
  │  É dispensável a licitação:                                    │
  │                                                                │
  │  I — para contratação que envolva valores inferiores a         │
  │       R$ 100.000,00, no caso de obras e serviços de            │
  │       engenharia ou de serviços de manutenção de veículos      │
  │       automotores;                                             │
  │                                                                │
  │  II — para contratação que envolva valores inferiores a        │
  │       R$ 50.000,00, no caso de outros serviços e compras;      │
  │                                                                │
  │  [Source Serif 4 1.0625rem · max-width 65ch · line-height 1.7] │
  │                                                                │
  │  ↗ planalto.gov.br · publicação no DOU                          │
  └────────────────────────────────────────────────────────────────┘

  ╔═══════════════════════════════════════════════════════════════╗
  ║  REFERÊNCIAS                                                  ║
  ║  ──────────                                                   ║
  ║  [tabs persistentes:]                                         ║
  ║   ◉ Jurisprudência (47)  ○ Pareceres (12)  ○ Cross-refs (8)  ║
  ║                                                               ║
  ║   Acórdão TCU 1234/2024 · Pleno · 14/03/2024                  ║
  ║   Dispensa em obras de pequeno valor — entendimento atualiz... ║
  ║                                                               ║
  ║   Acórdão TCU 567/2023 · 1ª Câmara · 22/05/2023               ║
  ║   ...                                                         ║
  ║                                                               ║
  ║   [+45 itens]                                          ›       ║
  ╚═══════════════════════════════════════════════════════════════╝

  ←   Art. 74 · Inexigibilidade        Art. 76 · Hipóteses     →
```

### Características da Direção B

| Atributo | Decisão |
|---|---|
| Busca | Compacta com atalho `/` visível |
| Filtros | Dropdowns command-bar (não chips) — economia de espaço |
| Linhas de artigo | 36-40px (tightly packed). Hover expande ementa inline |
| Separadores | Background hover (`surface-raised`), sem linha entre |
| Stats | 3 mini-cards horizontais, sem sombra, border discreta |
| Aside da página de artigo | TABS PERSISTENTES (não 2-col). Mais ergonômico em mobile |
| Tipografia | Mais Inter (UI), menos Source Serif |
| Sensação | Workspace, ferramenta densa, "Linear pra direito" |

**Pros:** densidade máxima, scan rápido. Mobile-friendly (tabs > aside lateral). Familiar pra quem usa SaaS produtivo.
**Contras:** menos calor editorial — pode soar "tech" demais pra contexto jurídico. Hover-to-expand não funciona em touch.

---

## Direção C — "Edição Comentada"

> *O livro doutrinário caro. Tipografia editorial generosa, marginália na página de artigo, ritmo de leitura prolongada.*

### Home `/lei-14133`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Header do site                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

                                                      [muito espaço acima, ~80px]

                  Lei nº 14.133, de 1º de abril de 2021
                  ─────────────────────────────────────────              [letter-spacing -0.02em]
                  Edição comentada                              [Source Serif 4 display 3rem]

                  Cento e noventa e três artigos. Mil quinhentas e setenta
                  e três decisões do TCU sistematizadas. Cento e sessenta
                  e duas orientações da AGU consolidadas. Tudo navegável.

                  [Source Serif 4 1.0625rem line-height 1.7, max-width 50ch, ink-secondary]

                                              [centralizado, sem CTA gritante]

                  ┌──────────────────────────────────────────────┐
                  │  Buscar...                                    │   [campo modesto, ~480px]
                  └──────────────────────────────────────────────┘
                                                              [/  para foco]

                  Filtros: grupo · tipo · base legal               [link-style, abre dropdown]

  ────────────────────────────────────────────────────────────────────
                                                               [linha cheia]

  Capítulo I.  Disposições Preliminares                       [Source Serif 4 weight 500 1.5rem]

       Art. 1.   Âmbito de aplicação
                 [JetBrains Mono 1.25rem]   [Source Serif 4 weight 500 1.125rem]

                 Esta Lei estabelece normas gerais de licitação e contratação
                 para as Administrações Públicas diretas, autárquicas e
                 fundacionais da União, dos Estados, do Distrito Federal e
                 dos Municípios.
                 [Source Serif 4 1rem line-height 1.65, ink-secondary]

                                                       47 acórdãos · 12 pareceres
                                                                       [âmbar discreto à direita]

       Art. 2.   Aplicação subsidiária

                 Esta Lei aplica-se às Administrações Públicas dos Estados,
                 do Distrito Federal e dos Municípios, nos termos do
                 art. 22, XXVII, da Constituição Federal.

                                                              12 acórdãos

  ────────────────────────────────────────────────────────────────────

  Capítulo II.  Princípios e Definições

       Art. 3.   Princípios fundamentais
                 [continua...]
```

### Página `/artigo/[numero]`

```
  Edição comentada / Capítulo XII / Modalidades de Licitação

                                                          [breadcrumb formal, 0.75rem ink-muted]

                 Art. 75
                 ═══════                                   [Source Serif 4 display 3rem]

                 Contratação direta
                 ──────────────────
                                                           [letter-spacing -0.015em]

  ┌────────────────────────────────────────────────┐ ┌─────────────────────────┐
  │                                                │ │ ▎ NA MARGEM             │
  │  É dispensável a licitação:                    │ │                         │
  │                                                │ │ Jurisprudência          │
  │  I — para contratação que envolva valores      │ │ ▶ Acórdão 1234/2024 TCU │
  │      inferiores a R$ 100.000,00, no caso de    │ │   Dispensa de baixo va… │
  │      obras e serviços de engenharia ou de      │ │ ▶ Acórdão 567/2023 TCU  │
  │      serviços de manutenção de veículos        │ │   ...                   │
  │      automotores;                              │ │                         │
  │                                                │ │ Pareceres                │
  │  II — para contratação que envolva valores     │ │ ▶ ON 102/2025 AGU       │
  │       inferiores a R$ 50.000,00, no caso de    │ │   Sobre ETP em dispensa │
  │       outros serviços e compras;               │ │                         │
  │                                                │ │ Cross-references         │
  │  [Source Serif 4 1.125rem line-height 1.75]    │ │ ▶ Art. 6º Definições    │
  │  [max-width 60ch, ink-primary]                 │ │ ▶ Art. 17 Estimativa    │
  │                                                │ │                         │
  │  Lei 14.133/2021 — art. 75, redação atual      │ │ [Source Serif 4 0.875rem│
  │  ↗ planalto.gov.br                              │ │  ink-secondary, sticky] │
  │                                                │ │                         │
  └────────────────────────────────────────────────┘ └─────────────────────────┘
                                                       [aside como margem, narrow ~280px,
                                                        background ligeiramente diferente
                                                        — surface-raised — separador 1px
                                                        border-subtle à esquerda]

                 ◀ Art. 74. Inexigibilidade            Art. 76. Hipóteses específicas ▶
                                                                  [navegação tipográfica]
```

### Características da Direção C

| Atributo | Decisão |
|---|---|
| Hero | Tipografia generosa, prosa explicativa, "abertura de livro" |
| Busca | Modesta, posicionada como ferramenta secundária |
| Filtros | Link-style → abre dropdown discreto |
| Estrutura | **Agrupamento por Capítulo** (não por grupos temáticos atuais) |
| Linhas de artigo | Ementa generosa (3 linhas), serif throughout |
| Aside da página de artigo | "Margem do livro" — narrow, separator vertical, tipografia menor (Source Serif 0.875rem), título "NA MARGEM" |
| Tipografia | Source Serif 4 dominante, Inter só em UI controls |
| Sensação | Edição doutrinária colecionável, leitura prolongada |

**Pros:** distintiva, calorosa, valoriza o trabalho do professor. Tipografia respeitosa com a tradição jurídica. Marginália é signature visual.
**Contras:** menos eficiente para busca-rápida (assume leitor com tempo). Mais complexa de implementar (capítulos = nova estrutura de dados). Hero ocupa muita "fold" inicial.

---

## Tabela Comparativa

| Critério | A: Westlaw Modern | B: Hub Compacto | C: Edição Comentada |
|---|---|---|---|
| **Densidade** | Média-alta | Máxima | Média (priorizando leitura) |
| **Velocidade de scan** | Boa | Excelente | Moderada |
| **Calor editorial** | Médio | Baixo | Alto |
| **Mobile-friendliness** | Bom | Excelente (tabs) | Médio (margem some) |
| **Implementação** | Média | Média | Alta (estrutura por capítulos é nova) |
| **Risco de "AI made that"** | Baixo | Médio (tabs cliché) | Muito baixo (distintiva) |
| **Fidelidade ao North Star** | Boa | Média (mais SaaS) | Excelente |
| **Tempo de implementação estimado** | 1 sessão | 1-2 sessões | 2-3 sessões |

## Recomendação do impeccable

**Direção C "Edição Comentada"** alinha-se mais fielmente com:

- O **Creative North Star** ("O Caderno do Tribunal")
- A **personalidade Erudito · Confiável · Acessível** (PRODUCT.md)
- Os **anti-references** (mais distante de info-produto/SaaS/govbr)
- O **registrer = product** orientado a profissional sério

Mas é a mais ambiciosa em implementação (requer reorganizar dados em capítulos da Lei). **Direção A** é uma ponte segura: 80% do calor editorial da C, 80% da eficiência da B, custo de implementação baixo. **Direção B** seria escolha se o foco fosse 100% velocidade pura e ferramenta-only.

## Próximo passo

Escolha **A**, **B**, **C**, ou peça ajustes (ex.: "C mas com aside como tabs em vez de margem"). Após escolha, gero o plano de implementação detalhado em `docs/design/lei-14133-impl-plan.md`.
