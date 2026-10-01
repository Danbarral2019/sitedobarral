// @vitest-environment node
/**
 * Em falha, /api/dou-clipping-health responde 500 no formato do
 * handleApiError e mantém `status: 'down'`, que a routine de monitoramento
 * lê (docs/RUNBOOK_DOU_CLIPPING.md).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dOUStagingDocument: {
      findFirst: vi.fn().mockRejectedValue(new Error('banco fora do ar')),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { GET } from '../route';

describe('/api/dou-clipping-health: erro', () => {
  it('500 com status down e o corpo padrão do handleApiError', async () => {
    const res = await GET();
    expect(res.status).toBe(500);
    const corpo = await res.json();
    expect(corpo.status).toBe('down');
    expect(corpo.code).toBe('INTERNAL_SERVER_ERROR');
    expect(corpo.error).toBe('Erro interno do servidor');
  });
});
