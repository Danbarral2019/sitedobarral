// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { groupProgressByUserModule, computeModuleAvgCompletion } from '@/lib/lms/progress-aggregation';

describe('groupProgressByUserModule', () => {
  it('retorna Map vazio para inputs vazios', () => {
    const result = groupProgressByUserModule([], new Map());
    expect(result.size).toBe(0);
  });

  it('agrupa um user em um módulo corretamente', () => {
    const lessonModule = new Map([
      ['l1', 'm1'],
      ['l2', 'm1'],
      ['l3', 'm1'],
    ]);

    const progress = [
      { userId: 'u1', lessonId: 'l1', status: 'completed' },
      { userId: 'u1', lessonId: 'l2', status: 'completed' },
      { userId: 'u1', lessonId: 'l3', status: 'in_progress' },
    ];

    const result = groupProgressByUserModule(progress, lessonModule);
    expect(result.get('u1')?.get('m1')).toEqual({ completed: 2, total: 3 });
  });

  it('separa users e modulos diferentes em buckets ortogonais', () => {
    const lessonModule = new Map([
      ['l1', 'm1'], ['l2', 'm1'],
      ['l3', 'm2'], ['l4', 'm2'],
    ]);

    const progress = [
      { userId: 'u1', lessonId: 'l1', status: 'completed' },
      { userId: 'u1', lessonId: 'l3', status: 'completed' },
      { userId: 'u2', lessonId: 'l2', status: 'in_progress' },
      { userId: 'u2', lessonId: 'l4', status: 'completed' },
    ];

    const result = groupProgressByUserModule(progress, lessonModule);
    expect(result.get('u1')?.get('m1')).toEqual({ completed: 1, total: 1 });
    expect(result.get('u1')?.get('m2')).toEqual({ completed: 1, total: 1 });
    expect(result.get('u2')?.get('m1')).toEqual({ completed: 0, total: 1 });
    expect(result.get('u2')?.get('m2')).toEqual({ completed: 1, total: 1 });
  });

  it('ignora rows com lessonId que não está no map (órfão)', () => {
    const lessonModule = new Map([['l1', 'm1']]);
    const progress = [
      { userId: 'u1', lessonId: 'l1', status: 'completed' },
      { userId: 'u1', lessonId: 'l999', status: 'completed' }, // órfão
    ];

    const result = groupProgressByUserModule(progress, lessonModule);
    expect(result.get('u1')?.get('m1')).toEqual({ completed: 1, total: 1 });
    expect(result.get('u1')?.size).toBe(1);
  });
});

describe('computeModuleAvgCompletion', () => {
  it('calcula média de completion% por módulo a partir de buckets', () => {
    // u1 completou 2/4 = 50% do módulo m1; u2 completou 4/4 = 100%
    const grouped = new Map([
      ['u1', new Map([['m1', { completed: 2, total: 4 }]])],
      ['u2', new Map([['m1', { completed: 4, total: 4 }]])],
    ]);

    const result = computeModuleAvgCompletion(grouped, ['m1']);
    expect(result).toEqual([{ moduleId: 'm1', avgCompletion: 75 }]); // (50+100)/2
  });

  it('módulo sem users tem avgCompletion 0', () => {
    const result = computeModuleAvgCompletion(new Map(), ['m1', 'm2']);
    expect(result).toEqual([
      { moduleId: 'm1', avgCompletion: 0 },
      { moduleId: 'm2', avgCompletion: 0 },
    ]);
  });
});
