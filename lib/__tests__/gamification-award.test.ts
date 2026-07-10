import { describe, it, expect, vi } from 'vitest';

// Evita inicializar o cliente Prisma real / logger ao importar o módulo sob teste.
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/logger', () => ({ apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { awardQuizPass, XP_VALUES } from '../gamification';

function makeDeps() {
  return {
    addXp: vi.fn().mockResolvedValue(undefined),
    updateStreak: vi.fn().mockResolvedValue(undefined),
    checkAndAwardBadges: vi.fn().mockResolvedValue(undefined),
  };
}

describe('awardQuizPass', () => {
  it('concede PASS_QUIZ, atualiza streak e checa badges de quiz_pass numa aprovação normal', async () => {
    const deps = makeDeps();

    await awardQuizPass('u1', 'c1', 60, deps);

    expect(deps.addXp).toHaveBeenCalledTimes(1);
    expect(deps.addXp).toHaveBeenCalledWith('u1', 'c1', XP_VALUES.PASS_QUIZ);
    expect(deps.updateStreak).toHaveBeenCalledWith('u1', 'c1');
    expect(deps.checkAndAwardBadges).toHaveBeenCalledWith('u1', 'c1', 'quiz_pass');
  });

  it('concede PERFECT_QUIZ adicional quando o score é 100', async () => {
    const deps = makeDeps();

    await awardQuizPass('u1', 'c1', 100, deps);

    expect(deps.addXp).toHaveBeenCalledTimes(2);
    expect(deps.addXp).toHaveBeenNthCalledWith(1, 'u1', 'c1', XP_VALUES.PASS_QUIZ);
    expect(deps.addXp).toHaveBeenNthCalledWith(2, 'u1', 'c1', XP_VALUES.PERFECT_QUIZ);
  });

  it('NÃO concede PERFECT_QUIZ quando o score é abaixo de 100', async () => {
    const deps = makeDeps();

    await awardQuizPass('u1', 'c1', 99, deps);

    expect(deps.addXp).toHaveBeenCalledTimes(1);
    expect(deps.addXp).not.toHaveBeenCalledWith('u1', 'c1', XP_VALUES.PERFECT_QUIZ);
  });
});
