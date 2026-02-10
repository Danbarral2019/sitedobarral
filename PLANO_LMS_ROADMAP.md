# ROADMAP LMS — Site do Barral

**Data de Criação:** 2026-02-10
**Status:** ✅ FASES 1-4 CONCLUÍDAS (2026-02-10)

---

## Visão Geral

Sistema LMS (Learning Management System) integrado ao site do Prof. Barral, permitindo organização de cursos em módulos e aulas com conteúdo estruturado, avaliações, certificados e analytics.

---

## Índice de Fases

| Fase | Título | Prioridade | Status |
|------|--------|------------|--------|
| **1** | Core: Módulos, Aulas, Progresso e Discussão | 🔴 ALTA | ✅ Concluída |
| **2** | Avaliações (Quizzes) e Certificados | 🔴 ALTA | ✅ Concluída |
| **3** | Analytics, Export, Insights IA e Notificações | 🟡 MÉDIA | ✅ Concluída |
| **4** | Gamificação: XP, Badges, Streaks, Leaderboard | 🟡 MÉDIA | ✅ Concluída |
| **5** | Recursos Avançados: Coortes, Deadlines, Atividades | 🟢 BAIXA | ⏳ Futuro |

---

## FASE 1: Core LMS ✅ Concluída (2026-02-10)

### O que foi entregue

**Models Prisma:**
- `Module` — subdivisões do curso com ordem e publicação
- `Lesson` — aulas com slug, conteúdo markdown, resumo IA, pontos-chave
- `LessonDocument` — junction table com documentos (ordem + required flag)
- `LessonVideo` — junction table com vídeos YouTube (ordem + required flag)
- `LessonProgress` — progresso por aluno/aula (status, tempo, conteúdo lido, vídeos assistidos, docs visualizados)
- `LessonComment` — discussão com threads, pins, edição, soft delete

**Admin:**
- Dashboard LMS (`app/admin/lms/`)
- CRUD de módulos e aulas com reordenação
- Editor de aula com tabs: Conteúdo, Documentos, Vídeos, Configuração
- APIs: `app/api/admin/modules/` + `app/api/admin/lessons/`

**Aluno:**
- Landing page do curso com navegação por módulos
- Página de aula com sidebar de módulos
- Progresso visual por módulo/aula
- Botão "Marcar como Concluída"
- APIs: `app/api/area-restrita/courses/[courseId]/modules|progress` + `lessons/[lessonId]/`

**Componentes LMS (8):**
- ModuleSidebar, LessonContent, LessonDocuments, LessonVideos
- LessonProgressBar, MarkCompleteButton, LessonAIAssistant, LessonDiscussion

**Integração IA:**
- Resumo IA por aula (`aiSummary`)
- Pontos-chave IA por aula (`aiKeyPoints`)
- Assistente contextual na sidebar (usa documentos/artigos da aula)

**Coexistência:**
- Cursos COM módulos → landing page + navegação modular
- Cursos SEM módulos → trail de 4 estágios (preservado)

---

## FASE 2: Avaliações e Certificados ⏳ Pendente

**Prioridade:** 🔴 ALTA
**Dependência:** Fase 1

### 2.1 Quizzes

**Novos Models:**
- `Quiz` — avaliação vinculada a uma aula ou módulo
  - Campos: title, description, type (quiz|exam), passingScore, maxAttempts, timeLimit, shuffleQuestions
- `QuizQuestion` — pergunta com tipo (multiple_choice, true_false, short_answer)
  - Campos: text, type, options (JSON), correctAnswer, explanation, points, displayOrder
- `QuizAttempt` — tentativa do aluno
  - Campos: userId, quizId, answers (JSON), score, passed, startedAt, completedAt

**Features:**
- [ ] CRUD de quizzes no admin (vinculados a Lesson ou Module)
- [ ] Editor de perguntas com drag-and-drop para reordenação
- [ ] Tipos: múltipla escolha, verdadeiro/falso, resposta curta
- [ ] Correção automática (múltipla escolha + V/F)
- [ ] Correção manual para resposta curta (opcional)
- [ ] Nota mínima configurável (passingScore)
- [ ] Limite de tentativas (maxAttempts)
- [ ] Timer opcional (timeLimit em minutos)
- [ ] Shuffle de perguntas (shuffleQuestions)
- [ ] Feedback por pergunta (explanation mostrada após submissão)
- [ ] Página do aluno: fazer quiz, ver resultado, ver tentativas anteriores

**APIs:**
- `POST/GET /api/admin/quizzes` — CRUD admin
- `GET /api/area-restrita/lessons/[lessonId]/quiz` — obter quiz da aula
- `POST /api/area-restrita/quizzes/[quizId]/attempt` — submeter tentativa
- `GET /api/area-restrita/quizzes/[quizId]/attempts` — histórico de tentativas

### 2.2 Certificados

**Novos Models:**
- `Certificate` — certificado emitido ao aluno
  - Campos: userId, courseId, certificateNumber (único), issuedAt, templateData (JSON)

**Features:**
- [ ] Geração automática ao concluir 100% das aulas + quizzes aprovados
- [ ] Número único de certificado (ex: `BARRAL-2026-0001`)
- [ ] PDF gerado com jsPDF: nome do aluno, curso, carga horária, data, número
- [ ] Página de verificação pública: `/certificado/[numero]`
- [ ] Botão "Baixar Certificado" na página do curso (quando elegível)
- [ ] Admin: visualizar certificados emitidos

**APIs:**
- `POST /api/area-restrita/courses/[courseId]/certificate` — gerar certificado
- `GET /api/certificado/[numero]` — verificação pública
- `GET /api/admin/certificates` — listar certificados emitidos

### 2.3 Pré-requisitos de Aula

**Features:**
- [ ] Campo `prerequisiteLessonId` no model Lesson
- [ ] Aula bloqueada se pré-requisito não concluído (visual: cadeado + tooltip)
- [ ] Quiz aprovado como pré-requisito opcional (`requireQuizPass` flag na Lesson)

---

## FASE 3: Analytics e Dashboard Admin LMS ⏳ Pendente

**Prioridade:** 🟡 MÉDIA
**Dependência:** Fase 2

### 3.1 Dashboard Analytics LMS

**Página:** `app/admin/lms/analytics/page.tsx`

**Métricas:**
- [ ] Taxa de conclusão por curso (% alunos que completaram todas as aulas)
- [ ] Taxa de conclusão por módulo e por aula
- [ ] Tempo médio por aula
- [ ] Pontos de abandono (aulas com menor taxa de progressão)
- [ ] Notas médias nos quizzes por aula/módulo
- [ ] Ranking de alunos mais ativos
- [ ] Gráfico de progresso ao longo do tempo (dias/semanas)

### 3.2 Relatórios

**Features:**
- [ ] Exportar CSV com progresso de todos os alunos de um curso
- [ ] Exportar PDF com relatório resumido do curso
- [ ] Filtros: por curso, por período, por aluno

### 3.3 Insights IA

**Features:**
- [ ] Análise automática de perguntas frequentes no assistente IA (por aula)
- [ ] Sugestão de conteúdo adicional baseado em dificuldades dos alunos
- [ ] Alerta para admin quando taxa de aprovação de quiz < 60%

---

## FASE 4: Engajamento e Gamificação ⏳ Pendente

**Prioridade:** 🟡 MÉDIA
**Dependência:** Fase 2-3

### 4.1 Notificações

**Features:**
- [ ] Email de boas-vindas ao iniciar curso
- [ ] Email de lembrete após 7 dias inativo
- [ ] Email de parabéns ao concluir módulo
- [ ] Email com certificado ao concluir curso
- [ ] Milestones visuais na plataforma (25%, 50%, 75%, 100%)

### 4.2 Gamificação

**Features:**
- [ ] Badges por conquistas (primeiro quiz, primeiro módulo, conclusão do curso)
- [ ] Streak de dias consecutivos acessando o curso
- [ ] Ranking entre alunos do mesmo curso (opt-in)
- [ ] XP por ações (concluir aula, acertar quiz, participar da discussão)

### 4.3 Discussão Avançada

**Features:**
- [ ] Menções (@aluno) nos comentários
- [ ] Notificação por email quando mencionado
- [ ] Reputação por "melhor resposta" (professor pode marcar)
- [ ] Badge "Contribuidor" para alunos ativos nas discussões

---

## FASE 5: Recursos Avançados ⏳ Futuro

**Prioridade:** 🟢 BAIXA
**Dependência:** Fases 1-4

### 5.1 Coortes e Deadlines

- [ ] Turmas com data de início/fim
- [ ] Deadlines por aula/módulo
- [ ] Calendário do curso com marcos

### 5.2 Atividades Avaliativas

- [ ] Upload de trabalhos/exercícios pelo aluno
- [ ] Rubrica de avaliação configurável
- [ ] Revisão por pares (opcional)
- [ ] Nota composta: quizzes + atividades + participação

### 5.3 Conteúdo Adaptativo

- [ ] Branching: aula extra de reforço se quiz < 70%
- [ ] Recomendações personalizadas baseadas em progresso
- [ ] Paths alternativos por nível de experiência

### 5.4 Mobile

- [ ] Layout mobile-first para aulas
- [ ] Player de vídeo com fullscreen nativo
- [ ] Download em lote de materiais para offline

---

## Arquivos-Chave

| Área | Localização |
|------|------------|
| Models Prisma | `prisma/schema.prisma` |
| Components LMS | `components/lms/` |
| Admin Pages | `app/admin/lms/` |
| Student Pages | `app/area-restrita/curso/` |
| Admin APIs | `app/api/admin/modules/`, `app/api/admin/lessons/` |
| Student APIs | `app/api/area-restrita/courses/`, `.../lessons/` |
| Bridge Utility | `lib/courses.ts` |
| Validation | `lib/validation-schemas.ts` |

---

**Documento mantido por:** Claude Code (Anthropic)
