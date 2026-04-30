# Product

## Register

product

## Users

Profissionais de Direito Administrativo brasileiro — advogados públicos e privados, procuradores, gestores de licitações, servidores de tribunais de contas, professores e alunos de pós-graduação — que precisam consultar materiais jurídicos sobre licitações e contratos administrativos no fluxo de trabalho.

Eles não estão estudando do zero. Vêm com uma pergunta específica ("o art. 75 da Lei 14.133 permite o quê?", "qual o entendimento do TCU sobre dispensa de baixo valor?", "essa cláusula de prorrogação é válida?") e querem o artigo, o acórdão ou o parecer rápido, com fonte oficial, sem ruído.

Em segundo plano: alunos dos cursos do Prof. Daniel Barral usando a área restrita para estudar de forma mais sistemática (módulos, vídeos, materiais exclusivos). Esses são minoria — a porta de entrada do site é o conteúdo público.

## Product Purpose

Repositório jurídico operacional especializado em licitações e contratos públicos. O site existe para ser a ferramenta de consulta diária do profissional que trabalha com a Lei 14.133/2021, a Lei 8.666/1993, atos normativos infralegais (ONs da AGU, manuais do TCU, pareceres uniformizantes), enunciados de simpósios (CJF, IBDA, INCP) e jurisprudência selecionada (TCU, TCEs, CNJ).

Sucesso = usuário encontrou a resposta certa em poucos cliques, com fonte oficial e link direto, e voltou pro trabalho confiante.

Vendas de cursos e área restrita são canais secundários. O conteúdo público é a porta de entrada e a prova de competência do professor.

## Brand Personality

Erudito · confiável · acessível.

- **Erudito** — profundidade técnica visível. Citações fielmente reproduzidas, doutrina referenciada, jurisprudência integrada. Não simplifica em demasia.
- **Confiável** — cada peça de conteúdo expõe a fonte (DOU, gov.br/agu, cjf.jus.br) e a data. Resumos por IA são marcados explicitamente como tais; texto oficial é texto oficial.
- **Acessível** — linguagem técnica preservada, mas a interface não é hostil. O profissional consulta sem precisar entender a "arquitetura" do site. Hierarquia visual clara, busca primária, breadcrumbs honestos.

Tom: terceira pessoa formal mas conversacional. Cita sem floreio. Nunca usa ênfase sensacionalista, urgência manufaturada, ou linguagem de venda.

## Anti-references

Definitivamente NÃO deve parecer:

- **Site de info-produto** — Hotmart-style, gradient roxo decorativo, badges de "%OFF", contadores de urgência, depoimentos com cara de fake, CTAs gigantes em cima de gradients pulsantes.
- **Tribunal / portal gov.br antigo** — cinza-de-1995, navegação em árvore profunda, formulários densos sem hierarquia, paleta presa a "qual ente publicou".
- **SaaS genérico moderno** — hero gradient + 3 cards de features + CTA gradient roxo + 5 logos de "trusted by". O "AI made that" sem pensar. Linear-clone, Stripe-clone, Vercel-clone genéricos.

Referências positivas (do mesmo gênero do produto): **Google Scholar, Westlaw, Lexis**. São ferramentas jurídicas sérias. Densidade de informação alta, navegação por filtros e facetas, breadcrumbs profundos, foco em utilidade — não em "design moderno". A vibe é: ferramenta de trabalho de profissional, não vitrine de marketing.

## Design Principles

1. **Fonte oficial sempre visível.** Cada peça de conteúdo expõe sua origem (DOU, AGU, CJF, IBDA, INCP, TCU) e link direto. Resumos por IA são marcados explicitamente como tais; texto oficial é citado integralmente, com link para a publicação original.

2. **Densidade respeitosa.** Profissionais aceitam — e preferem — alta densidade de informação se ela está bem hierarquizada. Não infantilizar com whitespace excessivo, ícones gigantes ou cards aerados onde não faz sentido. Linhas tipográficas finas, ritmo de espaçamento variado, números à vista quando ajudam (contagens, datas, anos).

3. **Busca e filtros são primários, não secundários.** A página /lei-14133 e similares devem responder "como acho o artigo X / o tema Y" em ≤2 cliques. Cross-references entre artigos, jurisprudência relacionada, e temas transversais são parte do produto — não decoração.

4. **Cite o próprio acervo.** Onde existe relacionamento entre conteúdos (acórdão do TCU sobre o artigo X, parecer da AGU sobre o tema Y, ON sobre o instituto Z), exibir esse relacionamento de forma navegável. O valor do site é a curadoria; torne-a legível.

5. **Compose, don't decorate.** Hierarquia surge da estrutura: escala tipográfica generosa (≥1.25× entre níveis), ritmo de espaçamento intencional, ordem de leitura clara. Não de adornos: gradients decorativos, bordas coloridas laterais, ícones grandes pra preencher espaço. Se um elemento não tem função informacional, sai.

## Accessibility & Inclusion

WCAG AA como piso, com atenção especial às demandas comuns ao público-alvo (servidores e profissionais que passam horas lendo na tela).

- **Contraste AA** em todo texto: ≥4.5:1 para texto normal, ≥3:1 para texto grande e elementos UI essenciais.
- **Foco visível** em toda interação: sem `outline:none` sem replacement consistente.
- **Aria-labels** em ações principais (busca, filtros, navegação por temas, expansão de artigos).
- **Navegação completa por teclado**: tab order coerente, atalhos onde fizer sentido (esc fecha modal, / abre busca).
- **Semântica HTML correta**: headings hierárquicos sem pular níveis, `<article>` para artigos da lei, `<nav>` para sidebar, `<aside>` para painéis laterais.
- **Suporte a `prefers-reduced-motion`** em qualquer transição não-essencial.
- **Texto base** ≥16px; line-height ≥1.5 em blocos de leitura longa (artigos, ementas).
- **Imagens decorativas** com `alt=""`; imagens informativas com alt descritivo.

Não é obrigatório AAA — a base de usuários não inclui demandas críticas de baixa visão como driver primário, mas o site também não cria barreiras desnecessárias.
