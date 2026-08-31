import { prisma } from '@/lib/prisma';
import { courses } from '@/data/courses';

export interface CursoVendavel {
  id: string;
  name: string;
}

/**
 * Cursos que podem ser oferecidos na escolha do plano Básico.
 *
 * O Básico dá acesso a UM curso, escolhido no ato da compra. Vender a escolha
 * de um curso sem nenhuma aula publicada é cobrar por uma sala vazia — em
 * 31/08/2026 eram quatro dos sete (Processo Sancionador, Assessoramento
 * Jurídico, Revisão e Reajuste, Alterações Contratuais), cada um com um módulo
 * e zero aulas.
 *
 * O critério é ter ao menos uma aula, consultado no banco a cada carregamento
 * em vez de mantido numa lista fixa. Assim o curso volta à venda sozinho no dia
 * em que a primeira aula for publicada, sem depender de alguém lembrar de
 * editar código — que é exatamente o tipo de lembrete que não acontece.
 *
 * Ordem e títulos vêm de `data/courses.ts`, a fonte da vitrine; o banco decide
 * apenas quem entra.
 */
export async function listarCursosVendaveis(): Promise<CursoVendavel[]> {
  const comAula = await prisma.lesson.groupBy({
    by: ['moduleId'],
    _count: { _all: true },
  });

  if (comAula.length === 0) return [];

  const modulos = await prisma.module.findMany({
    where: { id: { in: comAula.map((m) => m.moduleId) } },
    select: { courseId: true },
  });

  const idsComAula = new Set(modulos.map((m) => m.courseId));

  return courses
    .filter((c) => idsComAula.has(c.id))
    .map((c) => ({ id: c.id, name: c.title }));
}
