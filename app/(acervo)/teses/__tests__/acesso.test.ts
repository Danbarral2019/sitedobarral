// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUser, mockAcesso, mockBuscar } = vi.hoisted(() => ({
  mockUser: vi.fn(), mockAcesso: vi.fn(), mockBuscar: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...a: unknown[]) => mockUser(...a),
  hasAnyActiveAccess: (...a: unknown[]) => mockAcesso(...a),
}));
vi.mock('@/lib/teses/consultas', () => ({ buscarPorChave: (...a: unknown[]) => mockBuscar(...a) }));

import { resolverAcessoDoDetalhe } from '../[chave]/acesso';

describe('resolverAcessoDoDetalhe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('visitante sem sessão não tem acesso ativo', async () => {
    mockUser.mockResolvedValue(null);
    expect(await resolverAcessoDoDetalhe()).toBe(false);
    expect(mockAcesso).not.toHaveBeenCalled();
  });

  it('admin tem acesso ativo sem consultar matrícula', async () => {
    mockUser.mockResolvedValue({ userId: 'u1', role: 'admin' });
    expect(await resolverAcessoDoDetalhe()).toBe(true);
    expect(mockAcesso).not.toHaveBeenCalled();
  });

  it('estudante delega para hasAnyActiveAccess', async () => {
    mockUser.mockResolvedValue({ userId: 'u1', role: 'student' });
    mockAcesso.mockResolvedValue(true);
    expect(await resolverAcessoDoDetalhe()).toBe(true);
    expect(mockAcesso).toHaveBeenCalledWith('u1');
  });

  it('estudante sem acesso ativo vê só a vitrine', async () => {
    mockUser.mockResolvedValue({ userId: 'u1', role: 'student' });
    mockAcesso.mockResolvedValue(false);
    expect(await resolverAcessoDoDetalhe()).toBe(false);
  });
});
