import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError, NotFoundError } from '@/lib/errors/api-error';
import { restoreCertificate } from '@/lib/certificate';

interface AdminContext {
  user: { userId: string; email: string; role: string };
  params: Promise<{ id: string }>;
}

/**
 * PATCH: Restaura um certificado revogado (corrige revogação por engano).
 */
export const PATCH = withAdminAuth(async (_request: NextRequest, context?: Record<string, unknown>) => {
  try {
    const ctx = context as unknown as AdminContext;
    const { id } = await ctx.params;
    if (!id) throw new ValidationError('id do certificado obrigatório');

    const result = await restoreCertificate(id);
    if (!result.ok) throw new NotFoundError('Certificado');

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
});
