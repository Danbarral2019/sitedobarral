// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { groupProgressByUserModule } from '@/lib/lms/progress-aggregation';

describe('groupProgressByUserModule', () => {
  it('retorna Map vazio para inputs vazios', () => {
    const result = groupProgressByUserModule([], new Map());
    expect(result.size).toBe(0);
  });
});
