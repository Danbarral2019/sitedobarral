/**
 * Progresso do usuário no módulo Planejamento.
 *
 * Regra de default do modo aprendizagem:
 *   - conta sessões do user com status EXPORT ou ARCHIVED
 *   - se < 3, modo aprendizagem vem ligado por default em novas sessões
 */
import { prisma } from "@/lib/prisma";

const LEARNING_MODE_THRESHOLD = 3;

export async function countCompletedPlanningSessions(userId: string) {
  return prisma.planningSession.count({
    where: {
      userId,
      deletedAt: null,
      OR: [{ status: "EXPORT" }, { status: "ARCHIVED" }],
    },
  });
}

export async function defaultLearningModeForUser(userId: string) {
  const count = await countCompletedPlanningSessions(userId);
  return count < LEARNING_MODE_THRESHOLD;
}

export { LEARNING_MODE_THRESHOLD };
