import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError, NotFoundError } from '@/lib/errors/api-error';
import { revokeCertificate } from '@/lib/certificate';

interface AdminContext {
  user: { userId: string; email: string; role: string };
  params: Promise<{ id: string }>;
}

/**
 * PATCH: Revoga um certificado emitido (soft delete) e notifica o aluno.
 * Body opcional: { reason?: string }
 */
export const PATCH = withAdminAuth(async (request: NextRequest, context?: Record<string, unknown>) => {
  try {
    const ctx = context as unknown as AdminContext;
    const { id } = await ctx.params;
    if (!id) throw new ValidationError('id do certificado obrigatório');

    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.trim() || undefined : undefined;

    const result = await revokeCertificate(id, ctx.user.userId, reason);
    if (!result.ok) throw new NotFoundError('Certificado');

    return NextResponse.json({ ok: true, alreadyRevoked: result.alreadyRevoked });
  } catch (error) {
    return handleApiError(error);
  }
});
