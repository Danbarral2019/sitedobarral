// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const findUnique = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: { certificate: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

import { GET } from '../route';

const base = {
  id: 'c1',
  certificateNumber: 'BARRAL-2026-0001',
  studentName: 'Aluno Teste',
  courseTitle: 'Planejamento das Contratações',
  estimatedHours: 20,
  issuedAt: new Date('2026-01-10T00:00:00Z'),
};

function call(numero = 'BARRAL-2026-0001') {
  return GET(new NextRequest(`http://localhost/api/certificates/verify/${numero}`), {
    params: Promise.resolve({ numero }),
  });
}

describe('GET /api/certificates/verify/[numero]', () => {
  beforeEach(() => findUnique.mockReset());

  it('certificado vigente é válido', async () => {
    findUnique.mockResolvedValue({ ...base, revokedAt: null });
    const res = await call();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.certificate).not.toHaveProperty('revokedAt');
  });

  it('certificado revogado responde valid:false com indicação de revogação', async () => {
    findUnique.mockResolvedValue({ ...base, revokedAt: new Date('2026-05-01T12:00:00Z') });
    const res = await call();
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.revoked).toBe(true);
    expect(body.revokedAt).toBe('2026-05-01T12:00:00.000Z');
  });

  it('certificado inexistente responde 404', async () => {
    findUnique.mockResolvedValue(null);
    const res = await call('X');
    expect(res.status).toBe(404);
  });
});
