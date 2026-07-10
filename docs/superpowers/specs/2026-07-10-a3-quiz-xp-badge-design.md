# A3 — Validar engrenagem de XP/badge + quiz piloto (Curso 10)

**Data:** 2026-07-10
**Status:** aprovado (brainstorming), pronto para execução
**Origem:** FUTURE_TASKS A3 — "Quiz LMS: criar 1-2 quizzes piloto via admin e validar o fluxo XP/badge."

## Contexto (mapa do sistema existente)

- **Quiz** vincula-se 1:1 a uma **Lesson** (`Quiz.lessonId @unique`); o curso é derivado via `Lesson → Module.courseId`. Precisa de `isPublished: true` senão o endpoint do aluno retorna 404.
- **QuizQuestion**: `type` (`multiple_choice`|`true_false`), `options` JSON `[{id,text,isCorrect}]`, `points`.
- **Submit** (`POST /api/area-restrita/lessons/[lessonId]/quiz/submit`): corrige, cria `QuizAttempt`, e **se `passed`** dispara (fire-and-forget, `lib/gamification.ts`): `addXp(+25 PASS_QUIZ)`, `+50` se score 100 (PERFECT_QUIZ), `updateStreak`, `checkAndAwardBadges('quiz_pass')` → badge `first_quiz` só na 1ª aprovação global do aluno.
- **XP** mora em `UserStreak.totalXp` (por `userId`+`courseId`); **badges** na tabela `Badge` (`@@unique([userId,type,courseId])`).
- Admin API: `POST /api/admin/quizzes` + `POST /api/admin/quizzes/[id]/questions`.
- **Zero testes** cobrindo quiz/XP/badge. Nenhum badge cadastrado (concessão só em runtime).

## Fase 1 — Validar a engrenagem (execução autônoma, dados descartáveis)

Objetivo: provar quiz → correção → XP → badge ponta-a-ponta, sem tocar em conteúdo real.

1. Re-puxar env de produção (`DATABASE_URL`), apagar no fim.
2. Verificar como os endpoints de lição checam acesso (courseId válido em `data/courses.ts`? enrollment?) para escolher entre courseId descartável vs conteúdo de teste sob curso real. Escolher a via que passe pelos checks de acesso.
3. Criar ambiente isolado: Module + Lesson (`isPublished`) + Quiz (`isPublished`, `passingScore: 60`) com 3 perguntas `multiple_choice`; User aluno de teste (`role student`, `emailVerified`); Enrollment válida.
4. Como o aluno (login → JWT): 
   - (a) submit gabaritando (score 100) → assert resposta `passed:true`; no banco `UserStreak.totalXp += 75` e `Badge{type:'first_quiz'}` criado.
   - (b) submit reprovando (score < 60) → assert `passed:false`, **sem** XP/badge novos.
5. Limpar 100% dos dados de teste (quiz, questions, attempts, lesson, module, enrollment, user, UserStreak, Badge).

## Fase 2 — Quiz piloto real no Curso 10 (com revisão do PO)

1. Identificar uma lição publicada do Curso 10 (Contratação Direta) com conteúdo adequado.
2. Rascunhar ~4-5 perguntas `multiple_choice` **a partir do material real da lição** (+ explicação), marcando incertezas jurídicas.
3. **PO revisa/corrige** antes de publicar.
4. Criar quiz via API admin, `isPublished=false` → após aprovação, `isPublished=true`.

## Testing

Adicionar um teste automatizado cobrindo a concessão de XP/badge no `quiz_pass` (hoje sem cobertura) — protege a engrenagem contra regressão. Escopo: teste focado da lógica de award (funções de `lib/gamification.ts` e/ou o handler de submit) com prisma mockado.

## Não-objetivos (YAGNI)

- Não popular o catálogo de badges nem mexer no cron `compute-streaks`.
- Não criar UI nova (admin de quiz já existe).
- Não portar quizzes em massa — é piloto.
