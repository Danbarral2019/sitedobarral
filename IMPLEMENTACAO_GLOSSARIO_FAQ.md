# 📚 Implementação: Glossário e FAQ Interativos

**Branch:** `feature/glossario-faq`
**Data de Início:** 2025-11-01
**Estimativa:** 1-2 semanas

---

## 🎯 Objetivo

Adicionar duas funcionalidades complementares ao site:

1. **Glossário Interativo** - Dicionário técnico de termos de licitações e contratos
2. **FAQ Interativo** - Perguntas frequentes com sistema de feedback

Ambas as features são simples, práticas e totalmente aderentes ao conceito original do site.

---

## 📋 Escopo Detalhado

### ✅ GLOSSÁRIO INTERATIVO

**Funcionalidades:**
- Lista alfabética de termos técnicos
- Busca em tempo real
- Filtros por categoria
- Navegação A-Z
- Links para documentos relacionados
- Admin CRUD completo

**Páginas:**
- `/glossario` - Página pública com lista e busca
- `/glossario/[slug]` - Página individual do termo
- `/admin/glossario` - Gestão de termos

---

### ✅ FAQ INTERATIVO

**Funcionalidades:**
- Perguntas organizadas por categoria
- Busca em perguntas e respostas
- Accordion (expandir/colapsar)
- Sistema de feedback "Foi útil?"
- Analytics de visualizações
- Admin CRUD completo

**Páginas:**
- `/faq` - Página pública com FAQs
- `/admin/faq` - Gestão de perguntas

---

## 🗄️ Schema do Banco de Dados

### Modelo: GlossaryTerm

```prisma
model GlossaryTerm {
  id          String   @id @default(uuid())

  // Identificação
  term        String   @unique
  slug        String   @unique

  // Conteúdo
  definition  String   @db.Text
  shortDef    String?  // Definição curta para tooltips

  // Categorização
  category    String?  // Ex: "Modalidade", "Fase", "Documento", "Legislação"

  // Relacionamentos (JSON arrays)
  relatedTerms String? // IDs de termos relacionados
  leiArticles  String? // Artigos da Lei 14.133/2021
  relatedDocs  String? // IDs de documentos relacionados

  // Referências externas
  externalUrl  String? // Link para legislação oficial

  // Analytics
  viewCount    Int      @default(0)

  // Visibilidade
  isPublic     Boolean  @default(true)

  // Auditoria
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  createdBy    String?  // Email do admin

  @@index([term])
  @@index([slug])
  @@index([category])
  @@index([isPublic])
}
```

### Modelo: FAQ

```prisma
model FAQ {
  id          String   @id @default(uuid())

  // Conteúdo
  question    String
  answer      String   @db.Text // Suporta markdown

  // Categorização
  category    String   // Ex: "Acesso ao Site", "Documentos", "Certificados", "Cursos"

  // Ordem e destaque
  displayOrder Int     @default(0)
  isPinned     Boolean @default(false) // Perguntas destacadas no topo

  // Visibilidade
  isPublished  Boolean @default(true)

  // Analytics
  viewCount    Int     @default(0)
  helpfulCount Int     @default(0)
  notHelpfulCount Int  @default(0)

  // Relacionamentos (JSON arrays)
  relatedFAQs  String? // IDs de FAQs relacionadas
  relatedDocs  String? // IDs de documentos
  keywords     String? // Palavras-chave para busca

  // Auditoria
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  createdBy    String?  // Email do admin

  @@index([category])
  @@index([isPublished])
  @@index([displayOrder])
  @@index([isPinned])
}

model FAQFeedback {
  id          String   @id @default(uuid())
  faqId       String

  wasHelpful  Boolean  // true = útil, false = não útil
  comment     String?  // Feedback opcional

  // Identificação do usuário
  userEmail   String?  // Se logado
  ip          String?

  createdAt   DateTime @default(now())

  @@index([faqId])
  @@index([wasHelpful])
  @@index([createdAt])
}
```

---

## 🛣️ Rotas e APIs

### Glossário - APIs Públicas

```
GET  /api/glossary              // Listar todos os termos (com filtros)
GET  /api/glossary/[slug]       // Obter termo específico
GET  /api/glossary/search?q=    // Buscar termos
```

### Glossário - APIs Admin

```
GET    /api/admin/glossary           // Listar todos (incluindo não publicados)
POST   /api/admin/glossary           // Criar novo termo
PUT    /api/admin/glossary/[id]      // Atualizar termo
DELETE /api/admin/glossary/[id]      // Deletar termo
```

### FAQ - APIs Públicas

```
GET  /api/faq                   // Listar todas as FAQs publicadas
GET  /api/faq/[id]              // Obter FAQ específica
GET  /api/faq/search?q=         // Buscar em perguntas/respostas
POST /api/faq/[id]/feedback     // Enviar feedback (útil/não útil)
POST /api/faq/[id]/view         // Incrementar contador de visualização
```

### FAQ - APIs Admin

```
GET    /api/admin/faq              // Listar todas (incluindo não publicadas)
POST   /api/admin/faq              // Criar nova FAQ
PUT    /api/admin/faq/[id]         // Atualizar FAQ
DELETE /api/admin/faq/[id]         // Deletar FAQ
GET    /api/admin/faq/analytics    // Estatísticas de uso
GET    /api/admin/faq/feedback     // Ver todos os feedbacks
```

---

## 📄 Estrutura de Arquivos

```
site-prof-barral/
├── app/
│   ├── glossario/
│   │   ├── page.tsx                    # Lista de termos
│   │   └── [slug]/
│   │       └── page.tsx                # Página individual do termo
│   ├── faq/
│   │   └── page.tsx                    # Página de FAQs
│   ├── admin/
│   │   ├── glossario/
│   │   │   ├── page.tsx                # Lista admin de termos
│   │   │   ├── novo/
│   │   │   │   └── page.tsx            # Criar termo
│   │   │   └── editar/[id]/
│   │   │       └── page.tsx            # Editar termo
│   │   └── faq/
│   │       ├── page.tsx                # Lista admin de FAQs
│   │       ├── novo/
│   │       │   └── page.tsx            # Criar FAQ
│   │       ├── editar/[id]/
│   │       │   └── page.tsx            # Editar FAQ
│   │       └── analytics/
│   │           └── page.tsx            # Analytics de FAQs
│   └── api/
│       ├── glossary/
│       │   ├── route.ts                # GET listar
│       │   ├── [slug]/
│       │   │   └── route.ts            # GET por slug
│       │   └── search/
│       │       └── route.ts            # GET buscar
│       ├── faq/
│       │   ├── route.ts                # GET listar
│       │   ├── [id]/
│       │   │   ├── route.ts            # GET por ID
│       │   │   ├── feedback/
│       │   │   │   └── route.ts        # POST feedback
│       │   │   └── view/
│       │   │       └── route.ts        # POST incrementar view
│       │   └── search/
│       │       └── route.ts            # GET buscar
│       └── admin/
│           ├── glossary/
│           │   ├── route.ts            # GET, POST
│           │   └── [id]/
│           │       └── route.ts        # PUT, DELETE
│           └── faq/
│               ├── route.ts            # GET, POST
│               ├── [id]/
│               │   └── route.ts        # PUT, DELETE
│               ├── analytics/
│               │   └── route.ts        # GET analytics
│               └── feedback/
│                   └── route.ts        # GET feedbacks
├── components/
│   ├── glossary/
│   │   ├── GlossarySearch.tsx          # Busca de termos
│   │   ├── GlossaryTermCard.tsx        # Card de termo
│   │   ├── AlphabeticalNav.tsx         # Navegação A-Z
│   │   ├── CategoryFilter.tsx          # Filtro por categoria
│   │   └── RelatedTerms.tsx            # Termos relacionados
│   └── faq/
│       ├── FAQSearch.tsx               # Busca de perguntas
│       ├── FAQAccordion.tsx            # Accordion de perguntas
│       ├── FAQFeedback.tsx             # Botões de feedback
│       ├── FAQCategoryNav.tsx          # Navegação por categorias
│       └── FAQAdminTable.tsx           # Tabela admin
└── prisma/
    └── schema.prisma                   # Atualizado com novos models
```

---

## 🎨 Design e UX

### Glossário

**Página Principal (`/glossario`):**
- Hero com título "Glossário de Licitações"
- Busca destacada no topo
- Navegação alfabética (A-Z) sticky
- Filtros por categoria (sidebar ou tabs)
- Cards de termos em grid
- Paginação ou scroll infinito

**Página do Termo (`/glossario/[slug]`):**
- Breadcrumb: Glossário > [Categoria] > [Termo]
- Título do termo (grande e destacado)
- Categoria (badge)
- Definição completa (markdown)
- Seção "Artigos Relacionados da Lei 14.133"
- Seção "Documentos Relacionados"
- Seção "Termos Relacionados"
- Botão de compartilhamento
- Link externo (se houver)

### FAQ

**Página Principal (`/faq`):**
- Hero com título "Perguntas Frequentes"
- Busca destacada no topo
- Navegação por categorias (tabs)
- Perguntas em accordion
- Ícone de pin para perguntas fixadas
- Sistema de feedback em cada resposta

**Accordion Item:**
- Pergunta (clickável)
- Resposta (markdown, expandível)
- "Esta resposta foi útil?" com 👍 👎
- Contador de visualizações (discreto)

---

## 📝 Conteúdo Inicial

### Glossário - Categorias Sugeridas

1. **Modalidades**
   - Pregão
   - Concorrência
   - Concurso
   - Leilão
   - Diálogo Competitivo
   - Credenciamento

2. **Fases/Etapas**
   - Fase Preparatória
   - Fase Externa
   - Habilitação
   - Julgamento
   - Homologação
   - Adjudicação

3. **Documentos**
   - Edital
   - Termo de Referência
   - Projeto Básico
   - Estudo Técnico Preliminar (ETP)
   - Proposta
   - Ata de Registro de Preços

4. **Legislação**
   - Lei 14.133/2021
   - Lei 8.666/93 (revogada)
   - IN SEGES
   - Acórdão TCU

5. **Conceitos**
   - Contrato Administrativo
   - Licitação
   - Dispensa
   - Inexigibilidade
   - SRP (Sistema de Registro de Preços)

### FAQ - Categorias Sugeridas

1. **Acesso ao Site**
   - Como me cadastrar?
   - Esqueci minha senha
   - Como validar QR Code?
   - Como renovar meu acesso?

2. **Documentos**
   - Como baixar documentos?
   - Quais documentos são públicos?
   - Posso compartilhar documentos?
   - Como favoritar um documento?

3. **Cursos**
   - Quais cursos estão disponíveis?
   - Como me matricular?
   - Quanto tempo tenho de acesso?
   - Como funciona o acesso vitalício?

4. **Certificados** (se implementado)
   - Como obter certificado?
   - Como validar certificado?
   - Posso compartilhar no LinkedIn?

5. **Suporte Técnico**
   - Problemas ao fazer login
   - Documento não abre
   - Como atualizar meu cadastro?

---

## ✅ Checklist de Implementação

### Fase 1: Schema e Migrações
- [ ] Adicionar models ao `schema.prisma`
- [ ] Criar migration
- [ ] Rodar `npx prisma generate`
- [ ] Testar no Prisma Studio

### Fase 2: APIs - Glossário
- [ ] GET `/api/glossary` - Listar todos
- [ ] GET `/api/glossary/[slug]` - Obter por slug
- [ ] GET `/api/glossary/search` - Buscar
- [ ] POST `/api/admin/glossary` - Criar
- [ ] PUT `/api/admin/glossary/[id]` - Atualizar
- [ ] DELETE `/api/admin/glossary/[id]` - Deletar

### Fase 3: APIs - FAQ
- [ ] GET `/api/faq` - Listar publicadas
- [ ] GET `/api/faq/[id]` - Obter por ID
- [ ] GET `/api/faq/search` - Buscar
- [ ] POST `/api/faq/[id]/feedback` - Enviar feedback
- [ ] POST `/api/faq/[id]/view` - Incrementar view
- [ ] POST `/api/admin/faq` - Criar
- [ ] PUT `/api/admin/faq/[id]` - Atualizar
- [ ] DELETE `/api/admin/faq/[id]` - Deletar
- [ ] GET `/api/admin/faq/analytics` - Analytics

### Fase 4: Componentes - Glossário
- [ ] `GlossarySearch.tsx` - Busca
- [ ] `GlossaryTermCard.tsx` - Card
- [ ] `AlphabeticalNav.tsx` - Navegação A-Z
- [ ] `CategoryFilter.tsx` - Filtro
- [ ] `RelatedTerms.tsx` - Termos relacionados

### Fase 5: Componentes - FAQ
- [ ] `FAQSearch.tsx` - Busca
- [ ] `FAQAccordion.tsx` - Accordion
- [ ] `FAQFeedback.tsx` - Sistema de feedback
- [ ] `FAQCategoryNav.tsx` - Navegação por categoria
- [ ] `FAQAdminTable.tsx` - Tabela admin

### Fase 6: Páginas Públicas
- [ ] `/glossario/page.tsx` - Lista de termos
- [ ] `/glossario/[slug]/page.tsx` - Termo individual
- [ ] `/faq/page.tsx` - Lista de FAQs

### Fase 7: Páginas Admin
- [ ] `/admin/glossario/page.tsx` - Lista admin
- [ ] `/admin/glossario/novo/page.tsx` - Criar termo
- [ ] `/admin/glossario/editar/[id]/page.tsx` - Editar termo
- [ ] `/admin/faq/page.tsx` - Lista admin
- [ ] `/admin/faq/novo/page.tsx` - Criar FAQ
- [ ] `/admin/faq/editar/[id]/page.tsx` - Editar FAQ
- [ ] `/admin/faq/analytics/page.tsx` - Analytics

### Fase 8: Navegação e Links
- [ ] Adicionar "Glossário" no Header
- [ ] Adicionar "FAQ" no Header
- [ ] Adicionar links no Footer
- [ ] Adicionar no menu Admin

### Fase 9: Conteúdo Inicial
- [ ] Criar 30-50 termos no Glossário
- [ ] Criar 20-30 perguntas no FAQ
- [ ] Revisar e validar conteúdo

### Fase 10: Testes
- [ ] Testar todas as APIs
- [ ] Testar busca (glossário e FAQ)
- [ ] Testar CRUD admin
- [ ] Testar feedback no FAQ
- [ ] Testar responsividade mobile
- [ ] Testar performance com muitos termos/FAQs

### Fase 11: Documentação
- [ ] Atualizar CLAUDE.md com novas features
- [ ] Documentar APIs no README
- [ ] Criar guia de uso para admin

---

## 🚀 Ordem de Execução Sugerida

**Dia 1-2: Schema e APIs Glossário**
- Schema Prisma
- Migrations
- APIs públicas e admin do Glossário

**Dia 3-4: APIs FAQ**
- APIs públicas e admin do FAQ
- Sistema de feedback

**Dia 5-6: Componentes e Páginas Glossário**
- Componentes reutilizáveis
- Página pública
- Páginas admin

**Dia 7-8: Componentes e Páginas FAQ**
- Componentes reutilizáveis
- Página pública
- Páginas admin

**Dia 9: Navegação e Integração**
- Adicionar links no Header/Footer
- Menu admin
- Testes de integração

**Dia 10: Conteúdo e Testes**
- Popular conteúdo inicial
- Testes finais
- Ajustes de UX

---

## 📊 Métricas de Sucesso

**Glossário:**
- [ ] 50+ termos cadastrados
- [ ] Sistema de busca funcionando
- [ ] Navegação A-Z funcional
- [ ] Links para documentos relacionados funcionando
- [ ] Admin consegue criar/editar/deletar termos

**FAQ:**
- [ ] 30+ perguntas cadastradas
- [ ] Organização por categorias
- [ ] Sistema de feedback funcionando
- [ ] Analytics mostrando perguntas mais vistas
- [ ] Admin consegue ver feedbacks negativos

---

## 🎯 Entregáveis

Ao final da implementação:

1. ✅ Página pública de Glossário totalmente funcional
2. ✅ Página pública de FAQ totalmente funcional
3. ✅ Admin CRUD completo para ambos
4. ✅ Sistema de busca em ambos
5. ✅ Analytics básico de uso
6. ✅ Conteúdo inicial populado
7. ✅ Documentação atualizada
8. ✅ Testes realizados

---

**Pronto para começar! 🚀**
