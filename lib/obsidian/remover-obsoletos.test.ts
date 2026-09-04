// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockReaddir, mockRm } = vi.hoisted(() => ({ mockReaddir: vi.fn(), mockRm: vi.fn() }));
vi.mock('fs/promises', async () => {
  const real = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return { ...real, readdir: (...a: unknown[]) => mockReaddir(...a), rm: (...a: unknown[]) => mockRm(...a) };
});

import { removerObsoletos } from './export';

describe('removerObsoletos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRm.mockResolvedValue(undefined);
  });

  it('remove o que não está no conjunto esperado', async () => {
    mockReaddir.mockResolvedValue(['a.md', 'b.md', 'c.md']);
    const n = await removerObsoletos('/destino', 'teses', new Set(['teses/a.md', 'teses/c.md']), false);
    expect(n).toBe(1);
    expect(mockRm).toHaveBeenCalledTimes(1);
    expect(String(mockRm.mock.calls[0][0])).toContain('b.md');
  });

  it('não remove nada quando tudo é esperado', async () => {
    mockReaddir.mockResolvedValue(['a.md']);
    const n = await removerObsoletos('/destino', 'teses', new Set(['teses/a.md']), false);
    expect(n).toBe(0);
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('dry-run conta mas não remove', async () => {
    mockReaddir.mockResolvedValue(['a.md', 'b.md']);
    const n = await removerObsoletos('/destino', 'teses', new Set(['teses/a.md']), true);
    expect(n).toBe(1);
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('diretório inexistente não é erro', async () => {
    mockReaddir.mockRejectedValue(Object.assign(new Error('nope'), { code: 'ENOENT' }));
    await expect(removerObsoletos('/destino', 'teses', new Set(), false)).resolves.toBe(0);
  });

  it('ignora arquivo que não termina em .md', async () => {
    mockReaddir.mockResolvedValue(['a.md', 'leia-me.txt']);
    const n = await removerObsoletos('/destino', 'teses', new Set(['teses/a.md']), false);
    expect(n).toBe(0);
  });
});
