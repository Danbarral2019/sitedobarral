# Admin editorial da Lei 14.133 Comentada — design (MVP)

**Data:** 2026-05-02
**Status:** Draft

## Goal

Construir uma página admin única em `/admin/lei-14133/comentada` que dê controle editorial completo sobre a apresentação da Lei 14.133 Comentada (`/lei-14133` e `/area-restrita/lei-comentada`). O usuário (prof) deve poder, navegando pela estrutura da lei artigo a artigo:

- Editar um comentário em markdown por artigo
- Curar uma "leitura combinada" — lista de outros artigos da Lei com nota explicando a conexão
- Curar sugestões de leitura externa (artigos doutrinários, vídeos, blog posts)
- Vincular/desvincular `Document` e `LegislativeAct` ao artigo
- Marcar atos normativos como destaque editorial (`LegislativeAct.importance`)

Sem workflow de publicação ou histórico de revisões — tudo publica direto. Esses ficam pra fase 2 se houver necessidade.

## Non-goals

- Editar texto da lei (`LeiArticle.ementa`) — fora de escopo, a fonte é o Planalto.
- Workflow rascunho/publicado (fase 2).
- Histórico/auditoria de quem editou o quê (fase 2).
- Edição de blog posts/atos a partir desta página — usar admin existente.

## Schema changes

### Campo novo em `LeiArticle`

```prisma
model LeiArticle {
  // ... campos existentes ...
  professorComment String? @db.Text   // Markdown — bloco editorial do prof
  commentUpdatedAt DateTime?           // Pra futura badge "atualizado em"

  crossRefs         LeiArticleCrossRef[]
  suggestedReadings LeiArticleSuggestedReading[]
}
```

### Models novos

```prisma
model LeiArticleCrossRef {
  id             String   @id @default(uuid())
  articleNumber  String   // FK lógica pra LeiArticle.numero (não é FK formal pq numero é único)
  targetNumber   String   // Artigo destino (deve existir em LeiArticle.numero)
  note           String   @db.Text   // Frase curta do prof explicando a conexão
  order          Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  article LeiArticle @relation(fields: [articleNumber], references: [numero], onDelete: Cascade)

  @@index([articleNumber, order])
  @@index([targetNumber])
}

model LeiArticleSuggestedReading {
  id            String   @id @default(uuid())
  articleNumber String
  type          String   // 'video' | 'article' | 'blog' | 'book' | 'other'
  title         String
  url           String?  // Pode ser vazio se for "livro físico"
  description   String?  @db.Text  // Curta — 1-3 linhas
  author        String?  // Opcional
  order         Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  article LeiArticle @relation(fields: [articleNumber], references: [numero], onDelete: Cascade)

  @@index([articleNumber, order])
}
```

`vercel-build` aplica via `prisma db push --accept-data-loss`. Adições de coluna nullable e tabelas novas são compatíveis.

## Endpoints

Todos sob `/api/admin/lei-14133/articles/[numero]/...` e exigem `verifyAdmin`. Após mudança, invalidar cache `CacheInvalidation.leiArticles()`.

| Método  | Rota                                            | Função |
|---------|-------------------------------------------------|--------|
| GET     | `/api/admin/lei-14133/articles/[numero]`        | Retorna artigo enriquecido pra editor (texto, comment, crossRefs, readings, docs vinculados, acts vinculados) |
| PUT     | `/api/admin/lei-14133/articles/[numero]/comment` | Body `{ markdown }` → grava `professorComment` |
| GET     | `.../crossrefs`                                  | Lista crossRefs do artigo |
| POST    | `.../crossrefs`                                  | Body `{ targetNumber, note, order? }` → cria |
| PUT     | `.../crossrefs/[id]`                             | Atualiza |
| DELETE  | `.../crossrefs/[id]`                             | Remove |
| POST    | `.../crossrefs/reorder`                          | Body `{ ids: [] }` → reordena |
| GET     | `.../readings`                                   | Lista readings do artigo |
| POST    | `.../readings`                                   | Body `{ type, title, url?, description?, author?, order? }` |
| PUT     | `.../readings/[id]`                              | Atualiza |
| DELETE  | `.../readings/[id]`                              | Remove |
| POST    | `.../readings/reorder`                           | Reordena |
| POST    | `.../link-document`                              | Body `{ documentId }` → adiciona ao `Document.leiArticles` |
| DELETE  | `.../link-document/[documentId]`                 | Remove |
| POST    | `.../link-act`                                   | Body `{ actId }` → adiciona ao `LegislativeAct.leiArticles` |
| DELETE  | `.../link-act/[actId]`                           | Remove |
| GET     | `/api/admin/documents/search?q=...`              | Search da base pra modal "incluir doc" (já existe ou criar) |
| GET     | `/api/admin/legislative-acts/search?q=...`       | Search da base pra modal "incluir ato" (já existe) |

Reuso: o endpoint público `/api/lei-14133/article-docs/[numero]` já entrega o que a UI pública precisa; basta o admin alimentar os dados certos.

## Apresentação pública

Vou adicionar duas seções novas no `LeiComentadaClient` (público) e na `lei-comentada` (logada), entre o card do artigo e os destaques de regulamentação:

1. **Comentário do Prof.** — card com fundo suave, ícone, render via `MarkdownContent` (já existe no projeto). Só aparece se `professorComment` for preenchido.

2. **Leitura combinada do Prof.** — card com tipografia editorial. Cada item: número do artigo (badge clicável → `?artigo=N`) + nota curta do prof. Só aparece se `crossRefs.length > 0`.

3. **Sugestões de leitura** — card listando readings com ícone do tipo (vídeo/artigo/livro), título linkado pra URL externa, descrição curta. Só aparece se `readings.length > 0`.

A API pública `/api/lei-14133/articles` precisa expor `professorComment`, `crossRefs[]` e `suggestedReadings[]` em cada artigo enriquecido (com cache invalidation já existente).

## UX da página admin

### Layout

```
+---------------------------------------------------------------+
| Admin > Lei 14.133 Comentada                  [voltar admin]  |
+---------------------------------------------------------------+
| Sidebar Estrutura |  Artigo selecionado                        |
| (igual à pública) |                                            |
|                   |  ▌Art. 18 — Estudo Técnico Preliminar     |
| TÍTULO I          |  [texto da lei — read only]                |
|   CAP I           |                                            |
|     Art. 1        |  📝 Comentário do Prof.    [✏️ editar]    |
|     Art. 2        |  ─ markdown renderizado ─                  |
|   CAP II          |                                            |
| TÍTULO II         |  📚 Leitura combinada      [+ adicionar]   |
|     Art. 18  ◀━━  |  Art. 44 — quando o ETP é dispensado [✏️][🗑️]|
|     ...           |                                            |
|                   |  🔗 Sugestões de leitura   [+ adicionar]   |
|                   |  🎥 Vídeo... [✏️][🗑️]                    |
|                   |                                            |
|                   |  📑 Documentos vinculados  [+ vincular]    |
|                   |  ─ accordion existente, com botão [🗑️] ─  |
|                   |                                            |
|                   |  ⚖️ Atos normativos        [+ vincular]    |
|                   |  ─ lista, com importance dropdown inline ─ |
+---------------------------------------------------------------+
```

### Edição (híbrida — confirmado pelo usuário)

- **Modal full-width** para o markdown do comentário (textarea + preview lado-a-lado via `MarkdownContent`). Botões: salvar / cancelar / `⌘S`.
- **Inline** para crossRefs (linha = `<select artigo>` + `<input note>` + salvar/cancelar)
- **Inline** para readings (linha = `<select tipo>` + `<input title>` + `<input url>` + `<textarea description>`)
- **Modal de busca** para "vincular documento" e "vincular ato" — search field, lista paginada, clica pra linkar; mostra os já vinculados com botão "remover"
- **Inline** para `LegislativeAct.importance` — dropdown ao lado de cada ato vinculado (já existe na página de edit, vai virar ação inline aqui também)

### Drag-and-drop pra reordenar

CrossRefs e readings têm `order` — drag-and-drop com `@dnd-kit/sortable` (já no projeto). Reordenação dispara `POST .../reorder`.

## Componentes

```
app/admin/lei-14133/comentada/
├── page.tsx                         # Server: metadata + Client wrapper
├── ComentadaAdminClient.tsx         # Client: layout sidebar + main
├── components/
│   ├── ArticleEditorMain.tsx        # Coluna principal (orquestra todas seções)
│   ├── CommentEditor.tsx            # Modal markdown com preview
│   ├── CrossRefsEditor.tsx          # Inline list editor de crossRefs
│   ├── ReadingsEditor.tsx           # Inline list editor de readings
│   ├── LinkedDocsEditor.tsx         # Lista docs + modal de vincular
│   ├── LinkedActsEditor.tsx         # Lista atos + dropdown importance + modal
│   └── SearchBaseModal.tsx          # Modal genérico (props: tipo doc|ato)
```

A sidebar de Estrutura da Lei é a mesma da `LeiComentadaClient` pública. **Refator paralelo:** extrair `<LeiSidebar>` pra `components/lei-14133/LeiSidebar.tsx` e reusar entre admin + público + área restrita. Essa extração é refator de baixo risco e bate com o princípio de unidades focadas.

## Data flow

```
Editar comentário:
  user clica ✏️ → CommentEditor abre modal
  user edita + salva → PUT /api/admin/.../comment
  resposta OK → state local atualiza + toast
  React Query (ou refetch local) → /api/lei-14133/articles cache invalidado
  pública mostra novo comentário no próximo refresh / revalidate

Adicionar crossref:
  user clica + → linha vazia aparece com select de artigo + input nota
  user salva → POST /api/admin/.../crossrefs
  resposta OK → linha re-renderiza com [✏️][🗑️]

Vincular doc:
  user clica + Vincular → SearchBaseModal abre
  user busca, clica num resultado → POST /api/admin/.../link-document { documentId }
  servidor adiciona o numero do artigo em Document.leiArticles (JSON)
  resposta OK → modal mostra "Adicionado", lista do artigo refresca
```

## Error handling

- Endpoints retornam 4xx com `{ error: string }` — UI mostra toast com `useToast`
- 401 (admin não autenticado) → redirect pra `/admin/login`
- 404 artigo inexistente → mostrar mensagem amigável na sidebar
- Drag-and-drop reorder falhou → reverter ordem otimista no client + toast

## Cache

`CacheInvalidation.leiArticles()` deve ser chamado em todos os endpoints PUT/POST/DELETE relevantes — a função já existe (vista em `/api/admin/legislative-acts/[id]/route.ts`). Se quiser mais granular, criar `CacheInvalidation.leiArticle(numero)` que invalida só a chave daquele artigo.

A versão pública (`/lei-14133`) tem cache de 1h via `withCache`. Pra mudanças refletirem rapidamente, o admin pode disparar `POST /api/admin/revalidate { path: '/lei-14133' }` após edição (ou automatizar no endpoint).

## Testing

- **Unit (vitest)**: validação de input (note ≤ 500 chars, url válida, type ∈ enum), helpers de reordenação.
- **Integration**: cada endpoint de CRUD com banco real (já é o padrão do projeto).
- **Manual**: editar comentário do art. 18, adicionar crossref pro art. 44, criar reading com vídeo do YouTube, vincular IN 67/2021. Conferir aparição na `/lei-14133?artigo=18`.

## Fases

**MVP (este design):**
- Schema + endpoints de comentário, crossRefs, readings, link-doc, link-act
- Página admin completa
- Apresentação na pública (3 seções novas)
- Refator: extrair `<LeiSidebar>` compartilhada

**Fase 2 (não escopada aqui):**
- Workflow rascunho/publicado (`status` em LeiArticle)
- Histórico de edições (tabela `LeiArticleRevision`)
- Bulk operations (linkar muitos docs de uma vez)

## Riscos e mitigações

- **Risco**: edição massiva de crossRefs e readings pode gerar muitas chamadas API.
  **Mitigação**: drag-and-drop manda 1 chamada `reorder` em vez de N.

- **Risco**: 195 artigos × 5 entidades editáveis = muito conteúdo. UI pode ficar lenta se carregar tudo.
  **Mitigação**: o editor mostra só o artigo selecionado; sidebar só carrega ementa + counts (já é o padrão da pública).

- **Risco**: cache da `/api/lei-14133/articles` invalidado a cada edit pode gerar regen frequente.
  **Mitigação**: aceitar (volume de edits é baixo, ~poucas por dia). Se virar problema, trocar pra invalidação por artigo.
