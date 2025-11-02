# 📋 Plano de Implementação - Novas Funcionalidades

**Data:** 2025-11-01
**Features Selecionadas:**
1. ✅ Glossário Interativo de Licitações
2. ✅ FAQ Interativo
3. 🎓 LMS com Trilhas de Conhecimento
4. 🎓 Sistema de Certificações Digitais

---

## 🎯 VISÃO GERAL DO PROJETO

### Objetivo Estratégico
Transformar o site de um **repositório de documentos** em uma **plataforma educacional estruturada**, mantendo a base atual e adicionando camadas de aprendizado guiado.

### Complexidade por Feature
- **Glossário:** 🟢 Simples (1 semana)
- **FAQ:** 🟢 Simples (1 semana)
- **Certificações:** 🟡 Média (2-3 semanas)
- **LMS/Trilhas:** 🔴 Alta (4-6 semanas)

### Ordem de Implementação Sugerida
1. **Glossário** (base de conhecimento)
2. **FAQ** (suporte ao usuário)
3. **Certificações** (motivação e reconhecimento)
4. **LMS/Trilhas** (estrutura educacional completa)

---

## 📚 FEATURE 1: Glossário Interativo de Licitações

### Descrição
Dicionário técnico de termos de licitações e contratos administrativos, com busca inteligente e links para documentos relacionados.

### Casos de Uso
- Aluno pesquisa "pregão eletrônico" e encontra definição + legislação + documentos relacionados
- Admin adiciona novos termos via painel administrativo
- Termos aparecem destacados nos documentos (tooltip)

### Estrutura de Dados (Prisma Schema)

```prisma
model GlossaryTerm {
  id          String   @id @default(uuid())
  term        String   @unique // Ex: "Pregão Eletrônico"
  slug        String   @unique // Ex: "pregao-eletronico"
  definition  String   @db.Text // Definição completa
  shortDef    String?  // Definição resumida (para tooltips)

  // Relacionamentos
  category    String?  // Ex: "Modalidade", "Fase", "Documento"
  relatedTerms String? // JSON array com IDs de termos relacionados
  leiArticles  String? // JSON array com artigos da Lei 14.133/2021

  // Referências
  relatedDocs  String? // JSON array com IDs de documentos relacionados
  externalUrl  String? // Link para legislação oficial

  // Metadados
  viewCount    Int      @default(0)
  isPublic     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  createdBy    String?  // Email do admin que criou

  @@index([term])
  @@index([slug])
  @@index([category])
}
```

### Páginas e Rotas

1. **Página Pública:** `/glossario`
   - Lista alfabética de termos
   - Busca em tempo real
   - Filtros por categoria
   - Navegação alfabética (A-Z)

2. **Página de Termo:** `/glossario/[slug]`
   - Definição completa
   - Artigos da lei relacionados
   - Documentos relacionados
   - Termos relacionados
   - Botão de compartilhamento

3. **Admin CRUD:** `/admin/glossario`
   - Listar todos os termos
   - Criar novo termo (formulário completo)
   - Editar termo existente
   - Deletar termo
   - Importação em lote (CSV/Excel)

### Componentes

1. **`GlossarySearch.tsx`** (Client Component)
   - Input de busca com debounce
   - Resultados em tempo real
   - Highlight de termos encontrados

2. **`GlossaryTermCard.tsx`**
   - Card com term + definição curta
   - Link para página completa

3. **`AlphabeticalNav.tsx`**
   - Navegação A-Z
   - Indicador de letras sem termos

4. **`TermTooltip.tsx`**
   - Tooltip com definição curta
   - Para usar em documentos/blog

5. **`GlossaryAdmin.tsx`** (Admin)
   - Tabela com todos os termos
   - Ações: editar, deletar, visualizar

### APIs

```typescript
// Públicas
GET  /api/glossary              // Listar todos (com filtros)
GET  /api/glossary/[slug]       // Obter termo específico
GET  /api/glossary/search?q=    // Buscar termos

// Admin
POST   /api/admin/glossary      // Criar termo
PUT    /api/admin/glossary/[id] // Atualizar termo
DELETE /api/admin/glossary/[id] // Deletar termo
POST   /api/admin/glossary/import // Importar CSV
```

### Funcionalidades Avançadas (Fase 2)

- Auto-linking de termos em documentos e blog posts
- Tooltip automático quando termo aparece em textos
- Quiz "Você sabia?" com termos do glossário
- Gamificação: badge por consultar X termos

### Esforço Estimado
- **Desenvolvimento:** 5-7 dias
- **Conteúdo inicial:** 2-3 dias (criar ~50-100 termos)
- **Total:** 1-2 semanas

---

## ❓ FEATURE 2: FAQ Interativo

### Descrição
Sistema de perguntas frequentes organizado por categoria, com busca, analytics e sistema de feedback.

### Casos de Uso
- Aluno busca "como renovar acesso" e encontra resposta
- Sistema sugere perguntas relacionadas
- Admin vê quais perguntas são mais acessadas
- Feedback "foi útil?" para melhorar respostas

### Estrutura de Dados (Prisma Schema)

```prisma
model FAQ {
  id          String   @id @default(uuid())
  question    String   // Pergunta
  answer      String   @db.Text // Resposta (markdown)
  category    String   // Ex: "Acesso", "Documentos", "Certificados"

  // Ordem e visibilidade
  displayOrder Int     @default(0)
  isPublished  Boolean @default(true)
  isPinned     Boolean @default(false) // Perguntas destacadas

  // Analytics
  viewCount    Int     @default(0)
  helpfulCount Int     @default(0) // "Foi útil? Sim"
  notHelpfulCount Int  @default(0) // "Foi útil? Não"

  // Relacionamentos
  relatedFAQs  String? // JSON array com IDs de FAQs relacionadas
  relatedDocs  String? // JSON array com IDs de documentos
  keywords     String? // JSON array para busca

  // Metadados
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  createdBy    String?  // Email do admin

  @@index([category])
  @@index([isPublished])
  @@index([viewCount])
  @@index([displayOrder])
}

model FAQFeedback {
  id          String   @id @default(uuid())
  faqId       String
  wasHelpful  Boolean  // true = útil, false = não útil
  comment     String?  // Feedback opcional
  userEmail   String?  // Se logado
  ip          String?
  createdAt   DateTime @default(now())

  @@index([faqId])
  @@index([wasHelpful])
  @@index([createdAt])
}
```

### Páginas e Rotas

1. **Página Pública:** `/faq`
   - Perguntas agrupadas por categoria
   - Busca em tempo real
   - Accordion para respostas
   - Sistema de feedback
   - Perguntas relacionadas

2. **Admin:** `/admin/faq`
   - Listar todas as FAQs
   - Criar/editar/deletar
   - Analytics: mais vistas, mais úteis
   - Gerenciar categorias
   - Ver feedbacks negativos

### Componentes

1. **`FAQSearch.tsx`** (Client Component)
   - Busca em perguntas e respostas
   - Highlight de resultados

2. **`FAQAccordion.tsx`**
   - Accordion animado
   - Suporte a markdown na resposta
   - Botões de feedback

3. **`FAQFeedback.tsx`**
   - "Esta resposta foi útil? 👍 👎"
   - Modal para comentário adicional

4. **`FAQCategoryNav.tsx`**
   - Navegação por categorias
   - Badge com quantidade de perguntas

5. **`FAQAdminDashboard.tsx`**
   - Estatísticas de uso
   - Top perguntas
   - Feedbacks negativos para revisar

### APIs

```typescript
// Públicas
GET  /api/faq                   // Listar todas
GET  /api/faq/[id]              // Obter FAQ específica
GET  /api/faq/search?q=         // Buscar
POST /api/faq/[id]/feedback     // Enviar feedback
POST /api/faq/[id]/view         // Incrementar contador

// Admin
POST   /api/admin/faq           // Criar FAQ
PUT    /api/admin/faq/[id]      // Atualizar FAQ
DELETE /api/admin/faq/[id]      // Deletar FAQ
GET    /api/admin/faq/analytics // Estatísticas
```

### Funcionalidades Avançadas (Fase 2)

- Sugestão automática de FAQs baseada em chatbot (se implementado)
- Widget de FAQ contextual em páginas específicas
- Exportar FAQ como PDF
- Integração com sistema de tickets/suporte

### Esforço Estimado
- **Desenvolvimento:** 5-7 dias
- **Conteúdo inicial:** 2-3 dias (criar ~30-50 perguntas)
- **Total:** 1-2 semanas

---

## 🎓 FEATURE 3: Sistema de Certificações Digitais

### Descrição
Geração automática de certificados digitais ao concluir curso ou atingir marcos, com validação via QR code e página pública de verificação.

### Casos de Uso
- Aluno completa 80% dos documentos de um curso → recebe certificado
- Admin emite certificado manual para evento/webinar
- Empregador verifica autenticidade via código único
- Aluno compartilha certificado no LinkedIn

### Estrutura de Dados (Prisma Schema)

```prisma
model Certificate {
  id            String   @id @default(uuid())

  // Identificação única
  certificateNumber String @unique // Ex: "BARRAL-2025-001234"
  verificationCode  String @unique // Código curto para validação
  qrCodeImage       String?        // QR code em base64

  // Beneficiário
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  studentName   String   // Nome que aparece no certificado
  studentEmail  String

  // Curso/Evento
  courseId      String?  // ID do curso (da lista estática)
  courseName    String   // Nome completo do curso
  eventName     String?  // Se for de evento/webinar
  eventDate     DateTime? // Data do evento

  // Tipo e critério
  certificateType String  // "course_completion", "event_participation", "manual"
  completionCriteria String? // Ex: "80% documentos acessados"

  // Métricas de conclusão
  completionPercentage Int?
  documentsAccessed    Int?
  totalDocuments       Int?
  hoursCompleted       Float? // Se implementar tracking de horas

  // Datas
  issuedAt      DateTime @default(now())
  validUntil    DateTime? // Se tiver validade

  // Status
  isRevoked     Boolean  @default(false)
  revokedAt     DateTime?
  revokedReason String?

  // Customização
  templateId    String?  // Se tiver múltiplos templates
  customText    String?  // Texto adicional personalizado

  // Analytics
  viewCount     Int      @default(0)
  downloadCount Int      @default(0)
  sharedCount   Int      @default(0)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId])
  @@index([courseId])
  @@index([certificateNumber])
  @@index([verificationCode])
  @@index([issuedAt])
}

model CertificateTemplate {
  id          String   @id @default(uuid())
  name        String   // Ex: "Padrão Curso", "Evento Premium"
  description String?

  // Design
  backgroundImage String? // URL ou base64
  logoImage       String? // Logo do professor
  accentColor     String  @default("#1e40af") // Cor principal

  // Layout (JSON com configuração)
  layout      String   @db.Text // JSON: positions, fonts, etc

  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Páginas e Rotas

1. **Meus Certificados:** `/area-restrita/certificados`
   - Lista de certificados do aluno
   - Download PDF
   - Visualizar online
   - Compartilhar no LinkedIn

2. **Visualizar Certificado:** `/certificado/[numero]`
   - Página pública do certificado
   - Preview bonito do certificado
   - Botão de download
   - Selo de autenticidade

3. **Validar Certificado:** `/validar-certificado`
   - Form para inserir código
   - Exibe certificado se válido
   - Mostra status (válido, revogado, não encontrado)

4. **Admin:** `/admin/certificados`
   - Listar todos os certificados emitidos
   - Emitir certificado manual
   - Revogar certificado
   - Analytics: total emitido, por curso, etc.
   - Gerenciar templates

### Componentes

1. **`CertificateCard.tsx`**
   - Card de preview do certificado
   - Ações: visualizar, download, compartilhar

2. **`CertificateGenerator.tsx`** (Server/API)
   - Gera PDF usando jsPDF + html2canvas
   - Personaliza com dados do aluno
   - Adiciona QR code de validação

3. **`CertificateViewer.tsx`**
   - Visualização do certificado
   - Modo print-friendly

4. **`CertificateValidator.tsx`**
   - Form de validação
   - Resultado da busca

5. **`CertificateTemplateEditor.tsx`** (Admin)
   - Editor visual de templates
   - Preview em tempo real

### APIs

```typescript
// Públicas
GET  /api/certificates/[numero]        // Visualizar certificado
GET  /api/validate-certificate?code=   // Validar código
GET  /api/certificates/[numero]/download // Download PDF

// Protegidas (Aluno)
GET  /api/my-certificates               // Meus certificados
POST /api/certificates/request          // Solicitar certificado (se manual)

// Admin
POST   /api/admin/certificates/issue    // Emitir certificado manual
POST   /api/admin/certificates/revoke/[id] // Revogar
GET    /api/admin/certificates          // Listar todos
GET    /api/admin/certificates/analytics // Estatísticas
POST   /api/admin/certificates/generate-batch // Emissão em lote
```

### Critérios de Emissão Automática

**Opções de gatilhos:**

1. **Por acesso a documentos:**
   - 80% dos documentos do curso acessados
   - 100% dos documentos obrigatórios

2. **Por conclusão de trilha:** (se implementar LMS)
   - Completar todos os módulos
   - Atingir nota mínima em quizzes

3. **Manual (Admin):**
   - Eventos, webinars, workshops
   - Situações especiais

### Design do Certificado

**Elementos visuais:**
- Logo do Prof. Daniel Barral
- Título: "Certificado de Conclusão"
- Nome do aluno (destaque)
- Curso concluído
- Carga horária (se aplicável)
- Data de emissão
- Assinatura digital do professor
- QR Code de validação
- Número único do certificado
- Texto: "Este certificado atesta que [NOME] concluiu com êxito..."

**Formato:**
- PDF de alta qualidade
- Orientação paisagem (landscape)
- Tamanho A4
- Marca d'água sutil

### Funcionalidades Avançadas (Fase 2)

- Integração com LinkedIn (compartilhamento direto)
- Blockchain para prova imutável (opcional)
- Certificados progressivos (badges intermediários)
- Galeria pública de certificados (com opt-in)
- API pública para verificação por terceiros

### Esforço Estimado
- **Desenvolvimento:** 10-15 dias
- **Design de templates:** 3-5 dias
- **Testes:** 3 dias
- **Total:** 2-3 semanas

---

## 🎓 FEATURE 4: LMS com Trilhas de Conhecimento

### Descrição
Sistema de gerenciamento de aprendizado estruturado em trilhas, módulos e lições, com tracking de progresso e conteúdo sequencial.

### ⚠️ IMPORTANTE: Mudança de Paradigma

**Modelo Atual:**
- Repositório de documentos
- Acesso livre a todos os materiais
- Sem ordem específica de estudo

**Modelo com LMS:**
- Trilhas estruturadas
- Conteúdo sequencial (bloqueio opcional)
- Progresso trackado
- Quizzes/avaliações (opcional)

**❓ DECISÃO NECESSÁRIA:**
O LMS será:
1. **Complementar** - Trilhas OPCIONAIS + manter acesso livre a documentos?
2. **Substitutivo** - Trilhas OBRIGATÓRIAS + bloquear acesso até completar?
3. **Híbrido** - Alguns cursos com trilhas, outros livres?

**💡 RECOMENDAÇÃO:** Modelo Híbrido ou Complementar para não alienar usuários que gostam do acesso livre.

### Estrutura de Dados (Prisma Schema)

```prisma
// NOVO: Curso agora no banco de dados
model Course {
  id            String   @id // Usar IDs existentes '1', '2', etc
  slug          String   @unique
  title         String
  description   String   @db.Text
  excerpt       String?

  // Conteúdo
  syllabus      String?  @db.Text // Ementa
  bibliography  String?  @db.Text // Bibliografia
  coverImage    String?

  // LMS
  hasLearningPath Boolean @default(false) // Se tem trilha estruturada
  estimatedHours  Float?  // Carga horária estimada
  difficultyLevel String? // "iniciante", "intermediário", "avançado"

  // Ordem e status
  displayOrder  Int      @default(0)
  isActive      Boolean  @default(true)
  isPublished   Boolean  @default(true)

  // Relacionamentos
  modules       Module[]
  enrollments   Enrollment[]

  // Metadados
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Module {
  id            String   @id @default(uuid())
  courseId      String
  course        Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)

  title         String
  description   String?  @db.Text

  // Ordem
  displayOrder  Int      // Ordem dentro do curso

  // Requisitos
  isOptional    Boolean  @default(false)
  prerequisiteModules String? // JSON array com IDs de módulos pré-requisitos

  // Estimativas
  estimatedMinutes Int?

  // Relacionamentos
  lessons       Lesson[]

  // Status
  isPublished   Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([courseId, displayOrder])
}

model Lesson {
  id            String   @id @default(uuid())
  moduleId      String
  module        Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  title         String
  description   String?  @db.Text

  // Conteúdo
  contentType   String   // "document", "video", "quiz", "text"
  documentId    String?  // Se for documento existente
  videoUrl      String?  // Se for vídeo
  textContent   String?  @db.Text // Se for conteúdo texto/markdown

  // Ordem e requisitos
  displayOrder  Int
  isOptional    Boolean  @default(false)

  // Estimativas
  estimatedMinutes Int?

  // Quiz (se contentType = "quiz")
  quizData      String?  @db.Text // JSON com perguntas
  passingScore  Int?     // % mínimo para passar

  // Status
  isPublished   Boolean  @default(true)
  isFree        Boolean  @default(false) // Preview gratuito
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([moduleId, displayOrder])
}

// Tracking de progresso
model UserProgress {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Curso
  courseId      String

  // Progresso geral
  overallProgress Float  @default(0) // 0-100%
  completedModules Int   @default(0)
  totalModules     Int
  completedLessons Int   @default(0)
  totalLessons     Int

  // Tempo
  totalMinutesSpent Int  @default(0)
  lastAccessedAt    DateTime?

  // Certificado
  isCompleted       Boolean  @default(false)
  completedAt       DateTime?
  certificateIssued Boolean  @default(false)
  certificateId     String?

  // Metadados
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([userId, courseId])
  @@index([userId])
  @@index([courseId])
}

model LessonProgress {
  id            String   @id @default(uuid())
  userId        String
  lessonId      String

  // Status
  status        String   @default("not_started") // "not_started", "in_progress", "completed"
  progress      Float    @default(0) // 0-100%

  // Tempo
  timeSpent     Int      @default(0) // minutos

  // Quiz (se aplicável)
  quizAttempts  Int      @default(0)
  quizScore     Float?   // 0-100%
  quizPassed    Boolean  @default(false)

  // Datas
  startedAt     DateTime?
  completedAt   DateTime?
  lastAccessedAt DateTime @default(now())

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([userId, lessonId])
  @@index([userId])
  @@index([lessonId])
}
```

### Páginas e Rotas

1. **Página do Curso (Renovada):** `/cursos/[slug]`
   - Aba "Visão Geral" (como atual)
   - Aba "Trilha de Aprendizado" (NOVA)
     - Lista de módulos
     - Progresso visual
     - Próximo passo sugerido
   - Aba "Documentos" (lista livre, como atual)
   - Aba "Bibliografia" (como atual)

2. **Trilha de Aprendizado:** `/cursos/[slug]/trilha`
   - Visualização completa da trilha
   - Todos os módulos expandidos
   - Indicadores de progresso
   - Botão "Continuar de onde parei"

3. **Módulo:** `/cursos/[slug]/modulo/[moduleId]`
   - Lista de lições do módulo
   - Descrição e objetivos
   - Progresso do módulo

4. **Lição:** `/cursos/[slug]/licao/[lessonId]`
   - Conteúdo da lição
   - Navegação: anterior/próximo
   - Botão "Marcar como concluída"
   - Timer de estudo (opcional)
   - Comentários/dúvidas (opcional)

5. **Meu Progresso:** `/area-restrita/progresso`
   - Dashboard de progresso em todos os cursos
   - Certificados obtidos
   - Estatísticas: tempo estudado, lições completadas
   - Badges/conquistas (gamificação)

6. **Admin:** `/admin/cursos-lms`
   - Criar/editar curso
   - Gerenciar módulos e lições
   - Arrastar e soltar para ordenar
   - Import/export de trilhas
   - Analytics: progresso dos alunos

### Componentes

1. **`LearningPathViewer.tsx`**
   - Visualização da trilha completa
   - Progress bars
   - Navegação entre módulos/lições

2. **`ModuleCard.tsx`**
   - Card de módulo com progresso
   - Lista de lições
   - Indicador de bloqueio (se houver pré-requisitos)

3. **`LessonViewer.tsx`**
   - Renderiza conteúdo baseado no tipo
   - Navegação anterior/próximo
   - Botão de conclusão

4. **`ProgressDashboard.tsx`**
   - Dashboard de progresso do aluno
   - Gráficos e estatísticas

5. **`CourseBuilder.tsx`** (Admin)
   - Interface drag-and-drop para criar trilhas
   - Adicionar módulos/lições
   - Configurar pré-requisitos

6. **`QuizComponent.tsx`**
   - Componente de quiz interativo
   - Múltipla escolha, V/F
   - Resultado e feedback

### APIs

```typescript
// Públicas
GET  /api/courses                       // Listar cursos
GET  /api/courses/[id]                  // Detalhes do curso
GET  /api/courses/[id]/modules          // Módulos do curso

// Protegidas (Aluno)
GET  /api/my-progress                   // Meu progresso geral
GET  /api/my-progress/[courseId]        // Progresso no curso
POST /api/lessons/[id]/complete         // Marcar lição como completa
POST /api/lessons/[id]/quiz-submit      // Submeter quiz
GET  /api/courses/[id]/next-lesson      // Próxima lição sugerida

// Admin
POST   /api/admin/courses               // Criar curso
PUT    /api/admin/courses/[id]          // Atualizar curso
POST   /api/admin/modules               // Criar módulo
POST   /api/admin/lessons               // Criar lição
GET    /api/admin/analytics/progress    // Progresso dos alunos
POST   /api/admin/courses/[id]/publish  // Publicar trilha
```

### Funcionalidades do LMS

**Básicas (MVP):**
- ✅ Estrutura de módulos e lições
- ✅ Tracking de progresso
- ✅ Marcar como completo
- ✅ Navegação sequencial
- ✅ Dashboard de progresso
- ✅ Emissão de certificado ao completar

**Avançadas (Fase 2):**
- Quizzes com correção automática
- Bloqueio de conteúdo (pré-requisitos)
- Deadline por módulo
- Fórum de discussão por lição
- Anotações privadas do aluno
- Download de trilha completa (PDF)
- Gamificação (pontos, badges, ranking)
- Recomendação de próximo conteúdo (IA)

### Migração do Modelo Atual

**Estratégia sugerida:**

1. **Fase 1: Coexistência**
   - Manter documentos soltos (acesso livre)
   - Adicionar trilhas como OPCIONAL
   - Aluno escolhe: navegação livre OU trilha guiada

2. **Fase 2: Integração**
   - Documentos podem fazer parte de lições
   - Um documento pode estar em múltiplas lições
   - Acesso livre SEMPRE disponível na aba "Documentos"

3. **Fase 3: Completo**
   - Trilhas completas para todos os cursos
   - Certificados apenas para quem completa trilha
   - Manter acesso livre para consulta rápida

### Esforço Estimado

**MVP (Módulos + Lições + Progress Tracking):**
- Schema e migrações: 2 dias
- APIs backend: 5-7 dias
- UI/UX aluno: 7-10 dias
- Admin (course builder): 5-7 dias
- Testes e ajustes: 3-5 dias
- **Total: 4-5 semanas**

**Completo (com quizzes, gamificação, etc):**
- MVP + 2-3 semanas adicionais
- **Total: 6-8 semanas**

---

## 🚀 ROADMAP DE IMPLEMENTAÇÃO SUGERIDO

### Sprint 1: Fundação (2 semanas)
**Objetivo:** Features simples e base de conhecimento

**Semana 1:**
- ✅ Glossário Interativo
  - Schema + migrações
  - APIs públicas e admin
  - Página pública
  - Admin CRUD
  - Conteúdo inicial (50 termos)

**Semana 2:**
- ✅ FAQ Interativo
  - Schema + migrações
  - APIs públicas e admin
  - Página pública com accordion
  - Sistema de feedback
  - Conteúdo inicial (30 FAQs)

**Entregável:** Glossário e FAQ publicados e funcionais

---

### Sprint 2: Certificações (2-3 semanas)
**Objetivo:** Sistema de certificados digitais

**Semana 3:**
- Schema de certificados
- Gerador de PDF
- Template de certificado
- Página de visualização pública

**Semana 4:**
- Admin de certificados
- Emissão manual
- Sistema de validação
- QR codes

**Semana 5:** (se necessário)
- Emissão automática baseada em critérios
- Integração com progresso de documentos
- Testes finais

**Entregável:** Sistema de certificados funcionando (manual + automático básico)

---

### Sprint 3-4: LMS - MVP (4-5 semanas)
**Objetivo:** Trilhas de aprendizado básicas

**Semana 6-7:**
- Schema completo (Course, Module, Lesson, Progress)
- Migrações cuidadosas (manter compatibilidade)
- APIs de listagem e visualização
- Admin: criar cursos e módulos

**Semana 8-9:**
- UI de visualização de trilhas
- Navegação por lições
- Sistema de progresso
- Dashboard do aluno

**Semana 10:**
- Integração com certificados
- Criação de trilhas para 1-2 cursos piloto
- Testes com usuários beta
- Ajustes finais

**Entregável:** LMS MVP com 1-2 cursos estruturados em trilhas

---

### Sprint 5: Refinamento e Expansão (2-3 semanas)
**Objetivo:** Melhorar UX e criar mais trilhas

**Semana 11-12:**
- Melhorias de UX baseadas em feedback
- Otimizações de performance
- Criar trilhas para mais cursos
- Documentação

**Semana 13:** (opcional)
- Features avançadas: quizzes simples
- Gamificação básica (badges)
- Analytics de progresso

**Entregável:** LMS completo com todos os cursos estruturados

---

## 📊 RESUMO EXECUTIVO

### Timeline Total
- **Glossário + FAQ:** 2 semanas
- **Certificados:** 2-3 semanas
- **LMS MVP:** 4-5 semanas
- **Refinamento:** 2-3 semanas
- **TOTAL:** 10-13 semanas (~2,5-3 meses)

### Investimento Necessário

**Desenvolvimento:**
- ~250-350 horas de desenvolvimento
- Se freelancer: R$ 25.000 - 40.000
- Se dedicação exclusiva: 3 meses

**Conteúdo:**
- Glossário: 50-100 termos iniciais
- FAQ: 30-50 perguntas
- Trilhas: Estruturar 10 cursos em módulos/lições
- **Esforço:** 40-60 horas de trabalho do professor

**Infraestrutura:**
- Sem custos adicionais (usa stack atual)
- Storage: considerar upgrade se muito PDF

### Riscos e Mitigações

**Risco 1:** LMS muito diferente do modelo atual, usuários podem rejeitar
- **Mitigação:** Manter acesso livre aos documentos + trilhas opcionais

**Risco 2:** Criar trilhas para 10 cursos é muito trabalho
- **Mitigação:** Começar com 2-3 cursos piloto, expandir gradualmente

**Risco 3:** Alunos não se engajam com sistema de progresso
- **Mitigação:** Gamificação, certificados, incentivos

**Risco 4:** Complexidade técnica do LMS
- **Mitigação:** MVP simples primeiro, features avançadas depois

### Recomendações Finais

**✅ FAZER:**
1. Começar com Glossário e FAQ (quick wins)
2. Implementar Certificados (valoriza cursos)
3. LMS MVP em 2-3 cursos piloto
4. Coletar feedback e iterar
5. Expandir gradualmente

**⚠️ CUIDADOS:**
1. Não abandonar modelo atual (coexistência)
2. Não criar trilhas muito longas (desmotiva)
3. Não bloquear conteúdo demais (frustra)
4. Não fazer tudo de uma vez (MVP iterativo)

**❌ EVITAR:**
1. LMS complexo demais de primeira
2. Substituir completamente modelo atual
3. Quizzes obrigatórios (opcional é melhor)
4. Gamificação excessiva (foco no aprendizado)

---

## ❓ PRÓXIMAS DECISÕES NECESSÁRIAS

Antes de começar a implementação, preciso de suas respostas:

### 1. Sobre o LMS
- **Pergunta:** O LMS será OPCIONAL (aluno escolhe trilha OU acesso livre) ou OBRIGATÓRIO (precisa seguir trilha)?
- **Recomendação:** OPCIONAL para não alienar usuários atuais

### 2. Sobre Certificados
- **Pergunta:** Certificado será emitido apenas para quem completa trilha OU também para acesso a X% dos documentos?
- **Recomendação:** Híbrido - certificado básico por % de documentos, certificado premium por completar trilha

### 3. Sobre Conteúdo
- **Pergunta:** Você terá tempo para estruturar trilhas (módulos/lições) para os 10 cursos?
- **Recomendação:** Começar com 2-3 cursos mais importantes, expandir depois

### 4. Sobre Quizzes
- **Pergunta:** Quer incluir quizzes/avaliações no MVP ou deixar para Fase 2?
- **Recomendação:** Deixar para Fase 2 (LMS básico primeiro)

### 5. Sobre Branch Git
- **Pergunta:** Criar branch única `feature/lms-completo` OU branches separadas por feature?
- **Recomendação:** Branches separadas:
  - `feature/glossario`
  - `feature/faq`
  - `feature/certificados`
  - `feature/lms-mvp`

### 6. Sobre Ordem de Implementação
- **Pergunta:** Começar por qual? Sugestão: Glossário → FAQ → Certificados → LMS
- **Confirmação:** Está OK essa ordem?

---

**Aguardo suas respostas para criar o primeiro branch e começar a implementação! 🚀**
