# Home Hero sem foto — redesign (opção B: centralizado + busca)

**Data:** 2026-06-07
**Status:** Aprovado (design) — pronto para plano de implementação
**Escopo:** Primeira página (`app/page.tsx`), seção 1 (Hero) apenas. Seções 2–6 inalteradas.

## Contexto e motivação

A home atual exibe a foto pessoal do Prof. Daniel Barral no hero, num grid
assimétrico de 12 colunas (texto em 8, foto em 5, posicionada de forma absoluta
à direita; a foto já está escondida no mobile via `hidden lg:block`).

Daniel quer **remover a foto** da primeira página e ter um **visual mais limpo e
sóbrio**. Após brainstorming visual (3 direções comparadas no navegador), a
direção escolhida foi:

- **Hero centralizado** (opção B), e
- **uma barra de busca do acervo em destaque** ocupando o espaço antes ocupado
  pela foto. No mobile, a busca fica **empilhada** (input largo em cima, botão
  full width embaixo).

## Objetivos

1. Remover a foto do hero sem deixar o layout "vazio".
2. Hero centralizado, sóbrio, mantendo a faixa navy (`brand`) atual.
3. Aproveitar o espaço com uma barra de busca funcional que leva ao acervo.
4. Não regredir nada nas demais seções nem na página `/busca`.

## Não-objetivos (YAGNI)

- Não redesenhar as seções 2–6 (Base de Conhecimento, Novidades, Depoimentos,
  Newsletter, Admin).
- Não remover o arquivo de imagem `public/images/professor/banner-home.jpg`
  (fica no repositório, apenas deixa de ser referenciado — permite reverter).
- Não criar um novo endpoint de busca — reutiliza `/busca` + `/api/busca-integrada`.
- Não mexer no autocomplete/sugestões da busca; o hero apenas encaminha o termo.

## Estado atual relevante

- `app/page.tsx` é um **Server Component** (`export const revalidate = 3600`).
  A seção 1 usa `import Image from 'next/image'` e renderiza
  `<Image src="/images/professor/banner-home.jpg" ... />` na coluna direita.
- `app/busca/page.tsx` é **Client Component** (`'use client'`). Hoje:
  - `const [searchTerm, setSearchTerm] = useState('')` — inicia vazio.
  - `debouncedSearch` → `fetch('/api/busca-integrada?q=...')`.
  - **Não lê** nenhum parâmetro `?q=` da URL. Logo, navegar para `/busca?q=foo`
    hoje cai numa busca vazia.
- O link "Pesquisar no Acervo" já existe na seção 2 apontando para `/busca`.

## Design

### Componente 1 — Hero centralizado (`app/page.tsx`, seção 1)

Substituir o grid assimétrico por uma **coluna única centralizada**:

- Container do hero: manter a `<section>` com o gradiente navy
  (`bg-gradient-to-b from-brand-600 via-brand-600 to-brand-700`) e o padding
  vertical.
- Conteúdo: `max-w-3xl mx-auto text-center` (largura confortável de leitura).
- Manter, centralizados:
  - `h1` "Prof. Daniel Barral" (font-cinzel).
  - "Professor | Mestre em Direito Público".
  - "Especialista em Licitações e Contratos Administrativos".
  - Parágrafo descritivo (repositório especializado…).
  - Os dois CTAs (Explorar Cursos / Área do Aluno), agora `justify-center`.
- Inserir `<HomeHeroSearch />` entre a descrição e os botões (ou logo acima dos
  botões — definição fina no plano), com `max-w-xl mx-auto`.
- **Remover:** `import Image from 'next/image'` e todo o bloco da coluna da foto
  (`lg:col-span-5 ... <Image .../>`). Remover também as classes de grid
  agora órfãs (`lg:grid-cols-12`, `lg:col-span-8`, o wrapper com
  `backdrop-blur`/gradiente lateral que existia só para legibilidade sobre a
  foto).

> O arquivo `banner-home.jpg` **não** é apagado.

### Componente 2 — `components/HomeHeroSearch.tsx` (novo, Client Component)

Pequeno componente isolado e testável:

- **Entrada/estado:** input controlado (`useState('')`).
- **Ação:** ao `submit` do `<form>` (botão ou Enter), se o termo (trimado) não
  for vazio, `router.push('/busca?q=' + encodeURIComponent(termo))`
  (`useRouter` de `next/navigation`). Termo vazio → não navega.
- **Layout responsivo (Tailwind):**
  - **Mobile (default):** `flex-col` — input `w-full` em cima; botão
    "Buscar no acervo" `w-full` embaixo.
  - **Desktop (`sm:`):** `sm:flex-row` — input ocupa o espaço (`flex-1`) e o
    botão "Buscar" fica na mesma linha.
- **Estilo:** consistente com o hero (input claro sobre navy; botão em destaque,
  cor `accent`/branco a definir no plano para casar com os CTAs existentes).
- **Acessibilidade:** `<form role="search">`, `<label>` (visualmente oculto)
  para o input, `placeholder` descritivo
  ("Pesquisar acórdãos, pareceres, Lei 14.133…"), botão `type="submit"`.
- **Dependências:** `next/navigation` (`useRouter`), React. Sem libs novas.

Interface pública: componente sem props (ou prop opcional `className` para o
container). Pode ser usado em Server Component pai (`app/page.tsx`) normalmente,
pois é um Client Component importado.

### Componente 3 — `/busca` lê `?q=` (`app/busca/page.tsx`)

Fazer a busca **semear o termo inicial** a partir da URL:

- Ler `?q=` via `useSearchParams()` e inicializar `searchTerm` com esse valor
  (ex.: `useState(() => searchParams.get('q') ?? '')`).
- **Next 15:** `useSearchParams()` exige uma `<Suspense>` boundary. Se a página
  ainda não tem, envolver o componente cliente que usa `useSearchParams` em
  `<Suspense fallback={...}>` (extrair o corpo atual para um componente interno
  se necessário, mantendo comportamento idêntico).
- Comportamento subsequente inalterado: o `debounce`/fetch existente dispara a
  partir do `searchTerm` já preenchido.

### Componente 4 — Link redundante (seção 2)

Sem mudança. "Pesquisar no Acervo" na seção 2 permanece como entrada secundária.

## Fluxo (busca a partir do hero)

1. Usuário digita na barra do hero e envia (Enter/botão).
2. `HomeHeroSearch` faz `router.push('/busca?q=<termo>')`.
3. `/busca` monta, lê `?q=` → `searchTerm` já preenchido.
4. `debouncedSearch` dispara `GET /api/busca-integrada?q=<termo>` → resultados.

## Tratamento de erros / casos de borda

- Termo vazio ou só espaços no hero → submit não navega (no-op).
- `/busca` com `?q=` < 2 chars → comportamento atual mantido (não busca até 2+).
- `?q=` ausente → `searchTerm` inicia vazio (comportamento atual preservado).
- Caracteres especiais → `encodeURIComponent` no push; `/busca` decodifica via
  `searchParams.get` (já decodificado).

## Testes / verificação

- `npm run build` limpo (sem erro de Suspense/`useSearchParams`, sem import
  `Image` órfão).
- Conferência visual no navegador:
  - **Desktop:** hero centralizado, sem foto, busca inline, CTAs centralizados.
  - **Mobile:** busca empilhada (input em cima, botão full width), CTAs
    empilhados.
- Fluxo funcional: digitar termo no hero → `/busca?q=` → resultados carregando.
- Se existir teste/snapshot da home em `app/__tests__`, atualizar conforme a
  nova marcação.

## Arquivos afetados

- `app/page.tsx` — hero reescrito (seção 1); remove `Image` + foto.
- `components/HomeHeroSearch.tsx` — **novo**.
- `app/busca/page.tsx` — semear `searchTerm` de `?q=` + `Suspense` se preciso.
- (Possível) `app/__tests__/*` — atualizar snapshot da home, se houver.

## Riscos

- **Baixo.** Mudança visual + um componente pequeno. Site em produção: validar
  build e fluxo de busca antes do deploy automático (push em `main` faz deploy).
- Atenção ao requisito de `<Suspense>` do Next 15 em `/busca` para não quebrar o
  build.
