/**
 * Constantes de gamificação (XP e badges).
 *
 * Módulo puro, separado de `lib/gamification.ts` para que componentes de
 * cliente (ex.: GamificationSidebar) possam usá-las sem levar o Prisma para
 * o navegador (issue #212). NÃO importe o Prisma aqui.
 */

// ═══════════════════════════════════════════════════════
// XP Values
// ═══════════════════════════════════════════════════════

export const XP_VALUES = {
  COMPLETE_LESSON: 10,
  PASS_QUIZ: 25,
  PERFECT_QUIZ: 50,
  COMPLETE_MODULE: 50,
  COMPLETE_COURSE: 200,
  STREAK_7: 30,
  STREAK_30: 100,
} as const;

// ═══════════════════════════════════════════════════════
// Badge Types
// ═══════════════════════════════════════════════════════

export const BADGE_TYPES = {
  // Autom\u00E1ticos (concedidos por eventos do sistema)
  first_lesson:     { type: 'first_lesson',     label: 'Primeira Aula',    icon: '\u{1F4D6}', description: 'Completou sua primeira aula', award: 'auto' },
  first_quiz:       { type: 'first_quiz',       label: 'Primeiro Quiz',    icon: '\u2705',     description: 'Passou no primeiro quiz', award: 'auto' },
  module_complete:  { type: 'module_complete',   label: 'Modulo Completo',  icon: '\u{1F3AF}', description: 'Concluiu um modulo inteiro', award: 'auto' },
  course_complete:  { type: 'course_complete',   label: 'Curso Completo',   icon: '\u{1F393}', description: 'Concluiu 100% do curso', award: 'auto' },
  streak_7:         { type: 'streak_7',          label: '7 Dias Seguidos',  icon: '\u{1F525}', description: 'Estudou 7 dias consecutivos', award: 'auto' },
  streak_30:        { type: 'streak_30',         label: '30 Dias Seguidos', icon: '\u26A1',     description: 'Estudou 30 dias consecutivos', award: 'auto' },
  // Manuais (admin concede via /admin/badges)
  mentor:           { type: 'mentor',            label: 'Mentor',           icon: '\u{1F9D1}\u200D\u{1F3EB}', description: 'Ajudou colegas com excel\u00EAncia', award: 'manual' },
  feedback_giver:   { type: 'feedback_giver',    label: 'Construtor',       icon: '\u{1F4AC}', description: 'Forneceu feedback construtivo ao curso', award: 'manual' },
  early_adopter:    { type: 'early_adopter',     label: 'Primeira Turma',   icon: '\u{1F31F}', description: 'Aluno da primeira turma da plataforma', award: 'manual' },
  community_builder:{ type: 'community_builder', label: 'Construtor da Comunidade', icon: '\u{1F91D}', description: 'Contribuiu para construir a comunidade', award: 'manual' },
  legal_eagle:      { type: 'legal_eagle',       label: 'Mestre da Lei 14.133', icon: '\u2696\uFE0F', description: 'Excel\u00EAncia no estudo da Nova Lei de Licita\u00E7\u00F5es', award: 'manual' },
  tcu_master:       { type: 'tcu_master',        label: 'Especialista TCU', icon: '\u{1F3DB}\uFE0F', description: 'Dom\u00EDnio profundo da jurisprud\u00EAncia do TCU', award: 'manual' },
} as const;

export type BadgeType = keyof typeof BADGE_TYPES;
