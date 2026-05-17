import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError, NotFoundError } from '@/lib/errors/api-error';
import { revokeCertificate } from '@/lib/certificate';

/**
 * PATCH: Revoga um certificado emitido (soft delete) e notifica o aluno.
 * Body opcional: { reason?: string }
 */
export const PATCH = withAdminApi<{ id: string }>(async (request: NextRequest, ctx) => {
  const { id } = ctx.params;
  if (!id) throw new ValidationError('id do certificado obrigatório');

  const body = await request.json().catch(() => ({}));
  const reason = typeof body?.reason === 'string' ? body.reason.trim() || undefined : undefined;

  const result = await revokeCertificate(id, ctx.user.userId, reason);
  if (!result.ok) throw new NotFoundError('Certificado');

  return NextResponse.json({ ok: true, alreadyRevoked: result.alreadyRevoked });
});
