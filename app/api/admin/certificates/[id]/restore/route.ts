import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError, NotFoundError } from '@/lib/errors/api-error';
import { restoreCertificate } from '@/lib/certificate';

/**
 * PATCH: Restaura um certificado revogado (corrige revogação por engano).
 */
export const PATCH = withAdminApi<{ id: string }>(async (_request: NextRequest, ctx) => {
  const { id } = ctx.params;
  if (!id) throw new ValidationError('id do certificado obrigatório');

  const result = await restoreCertificate(id);
  if (!result.ok) throw new NotFoundError('Certificado');

  return NextResponse.json({ ok: true });
});
