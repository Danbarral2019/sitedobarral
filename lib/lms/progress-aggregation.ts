export interface ProgressRow {
  userId: string;
  lessonId: string;
  status: string;
}

export interface ModuleCompletionBucket {
  completed: number;
  total: number;
}

/**
 * Agrupa rows de LessonProgress em estrutura indexada por (userId, moduleId).
 *
 * Substitui o padrão O(users × lessons × progress) usado em
 * `app/api/admin/lms/analytics/route.ts` linhas 241-247, onde
 * `progress.filter(...)` rodava dentro de loop aninhado.
 *
 * Complexidade: O(N) onde N = progress.length. Lookups posteriores são O(1).
 *
 * @param progress rows de `LessonProgress` (apenas campos necessários)
 * @param lessonModuleMap map de `lessonId -> moduleId` (cliente da rota constrói)
 */
export function groupProgressByUserModule(
  progress: ProgressRow[],
  lessonModuleMap: Map<string, string>,
): Map<string, Map<string, ModuleCompletionBucket>> {
  const result = new Map<string, Map<string, ModuleCompletionBucket>>();

  for (const p of progress) {
    const moduleId = lessonModuleMap.get(p.lessonId);
    if (!moduleId) continue;

    let userModules = result.get(p.userId);
    if (!userModules) {
      userModules = new Map();
      result.set(p.userId, userModules);
    }

    let bucket = userModules.get(moduleId);
    if (!bucket) {
      bucket = { completed: 0, total: 0 };
      userModules.set(moduleId, bucket);
    }

    bucket.total += 1;
    if (p.status === 'completed') bucket.completed += 1;
  }

  return result;
}

/**
 * Calcula avgCompletion% por módulo a partir do output de `groupProgressByUserModule`.
 * Média aritmética das porcentagens dos users que têm progresso no módulo.
 * Módulos sem users no `grouped` retornam 0.
 */
export function computeModuleAvgCompletion(
  grouped: Map<string, Map<string, ModuleCompletionBucket>>,
  moduleIds: string[],
): Array<{ moduleId: string; avgCompletion: number }> {
  return moduleIds.map(moduleId => {
    let sumPct = 0;
    let users = 0;
    for (const userMap of grouped.values()) {
      const bucket = userMap.get(moduleId);
      if (!bucket || bucket.total === 0) continue;
      sumPct += (bucket.completed / bucket.total) * 100;
      users += 1;
    }
    return {
      moduleId,
      avgCompletion: users > 0 ? Math.round(sumPct / users) : 0,
    };
  });
}
