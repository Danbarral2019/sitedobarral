# Brief de Design — Redesign /lei-14133 + /artigo/[numero]

> Produto desta sessão de `/impeccable shape`. Estado: **confirmado pelo usuário** em 2026-04-30.

## 1. Feature Summary

Redesign da home pública da Lei 14.133/2021 e da página de detalhe de cada artigo. A Lei é o conteúdo central do site (193 artigos, 21 grupos temáticos, 19 cross-references) e hoje é apresentada num formato que esconde a profundidade do acervo (sidebar fixa + cards padrão + sem indicação de quantos acórdãos/pareceres existem por tema). O redesign é para **profissionais consultando** (não alunos lendo de cabo a rabo), com foco em achar rápido o artigo certo + contexto jurisprudencial.

## 2. Primary User Action

**Encontrar o artigo X (ou o tema Y) e ver imediatamente o que existe de jurisprudência e parecer sobre ele**, em ≤2 cliques desde a entrada da página.

Secundário: ler o texto integral do artigo com tipografia confortável e referências cruzadas navegáveis.

## 3. Design Direction

- **Color strategy:** **Restrained + acento secundário quente** (de PRODUCT.md / DESIGN.md). Petróleo da casa ≤10% da área; âmbar acadêmico exclusivo para citações e fontes oficiais; demais elementos em neutros tintados ao brand hue.
- **Theme scene sentence:** *"Procurador às 9h da manhã num escritório de janelas amplas, segunda-feira, monitor de 24'', café na mesa, lista de demandas ao lado, precisa achar o art. 75 e ver o que o TCU já decidiu."* → **Light theme** (sem dark mode obrigatório agora).
- **Anchor references:** **Google Scholar**, **Westlaw**, **Lexis** (PRODUCT.md). Densidade alta, busca primária, filtros visíveis, foco em utilidade jurídica.
- **Anti-anchors:** site de info-produto, portal gov.br velho, SaaS genérico moderno (PRODUCT.md). Especificamente para esta tela: hero gigante azul com gradient, cards-grid uniforme de 21 grupos, modal por artigo, sidebar permanente de grupos.

## 4. Scope

- **Fidelidade:** mid-fi (mockup detalhado em ASCII + descrição visual rica). Sem image gen disponível.
- **Breadth:** duas surfaces — `/lei-14133` (home) + `/artigo/[numero]` (detalhe).
- **Interatividade:** estática (mockup descritivo). Implementação fica em sessão futura.
- **Time intent:** 2-3 direções pra você comparar e escolher.

## 5. Layout Strategy

### Home `/lei-14133`

- **Sem sidebar fixa.** Sai a sidebar permanente de 21 grupos.
- **Hero "dashboard de saber":** stats no topo (193 artigos · N acórdãos · N pareceres relacionados), título sóbrio, busca grande dominante, filtros chips logo abaixo.
- **Lista única**, densa, scrollável. Cada linha = 1 artigo com: número (mono large) · título · chips de contagem (acórdãos · pareceres/ONs) · ementa truncada.
- **Filtros chip stickys**: por grupo temático (21 chips), por tipo de referência ("tem jurisprudência", "tem parecer"), por base legal (8.666, 14.133, ambos).

### Página `/artigo/[numero]`

- **Single-column densa com aside móvel.**
  - Desktop: texto da lei centrado (max ~65ch); aside lateral à direita com artigos relacionados, jurisprudência, pareceres, ONs, doutrina.
  - Mobile: aside vira accordion ao final do texto.
- Hero da página é o número do artigo + grupo temático + texto integral. Sem decoração.
- Citação de outros artigos como link de hover preview (mostra ementa do artigo citado).

## 6. Key States

| Estado | Home /lei-14133 | Página /artigo/[numero] |
|---|---|---|
| **Default** | Lista de 193 artigos, busca vazia, todos chips desativados | Texto integral do artigo + aside cheia |
| **Buscando** | Filtragem em tempo real (debounce 200ms), highlight em matches | N/A |
| **Filtro ativo** | Chip selecionado destacado, contagem de matches no header | N/A |
| **Empty (busca sem match)** | "Nenhum artigo encontrado para 'X'." + sugestão alternativa | N/A |
| **Loading inicial** | Skeleton de 8 linhas + skeleton dos stats | Skeleton do texto + aside |
| **Error API** | Banner discreto top com retry + fallback estático | Idem |
| **Sem dados relacionados** | (não aplicável na home) | Aside mostra "Nenhuma jurisprudência catalogada ainda neste artigo" sem ser deselegante |

## 7. Interaction Model

- **Busca:** atalho `/` foca, ESC limpa. Debounce 200ms. Match destacado em âmbar acadêmico.
- **Chips de filtro:** click toggle, múltiplos selecionáveis, "Limpar filtros" aparece quando ≥1 ativo.
- **Linha de artigo (home):** click → navega para `/artigo/[numero]` (full page, não modal).
- **Link interno (página de artigo):** hover (≥350ms) → tooltip card com ementa do artigo citado; click → navega.
- **Aside de relacionados:** sticky até atingir o footer; em mobile vira accordion.
- **Voltar pra home:** breadcrumb honesto no topo (Lei 14.133 / Art. 75).

## 8. Content Requirements

- **Stats no hero:** "193 artigos · N acórdãos do TCU relacionados · N pareceres e ONs relacionados". Números reais do DB, atualizados via cache (revalidate 1h).
- **Card de artigo na lista:** número (mono) · título (Source Serif 4 weight 500) · chips de contagem (Inter 500 0.75rem em âmbar discreto se >0) · primeiras 2 linhas da ementa (Inter 400 0.875rem ink-secondary).
- **Página de artigo:** texto integral em Source Serif 4 1.0625rem line-height 1.7. Atribuição abaixo: "Lei 14.133/2021 — art. X, redação atual" + link âmbar para Planalto.
- **Empty state da busca:** "Nenhum artigo encontrado para '[query]'. Tente termos como: 'pregão', 'dispensa', 'art. 75'."
- **Empty state da aside (sem jurisprudência):** "Nenhuma jurisprudência catalogada para este artigo ainda."
- **Sem em-dashes** em copy (regra DESIGN.md).

## 9. Recommended References

Durante implementação, ler:

- `reference/typography.md` — hierarquia tipográfica e ritmo (esta tela é heavy em texto)
- `reference/spatial-design.md` — densidade respeitosa, ritmo de espaçamento
- `reference/interaction-design.md` — estados de input + chip + link com preview
- `reference/responsive-design.md` — adaptação aside→accordion no mobile
- `reference/ux-writing.md` — empty states e copy de filtros

## 10. Open Questions

Itens que ficam pra resolver durante implementação:

1. **API de stats:** cache Redis? Revalidação ISR? Computar em build? Decidir baseado no custo da query.
2. **Cross-references na home:** os 19 tópicos de cross-reference deveriam virar chips de filtro extras? Ou ficam só na página de artigo?
3. **Modo "ler de cabo a rabo":** atualmente esta jornada é minoritária — vale dar um botão "modo leitura sequencial" pra quem quer? (Adia pra v2)
4. **Inline preview de referência:** o tooltip-card no hover de link é feature nice. Vale a complexidade ou começa com link simples?

A próxima etapa é avaliar **3 direções visuais distintas** documentadas em `lei-14133-direcoes-visuais.md`. Depois da escolha, escrever plano de implementação detalhado.
