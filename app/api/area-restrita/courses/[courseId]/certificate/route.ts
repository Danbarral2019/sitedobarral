import { NextRequest, NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import {
  checkCertificateEligibility,
  issueCertificate,
} from '@/lib/certificate';

/**
 * GET: Verificar elegibilidade e retornar certificado existente (se houver)
 */
export const GET = withUserApi<{ courseId: string }>(async (
  _request: NextRequest,
  ctx
) => {
  const { courseId } = ctx.params;

  const eligibility = await checkCertificateEligibility(ctx.user.userId, courseId);

  return NextResponse.json({
    ...eligibility,
    certificate: eligibility.existingCertificate,
  });
});

/**
 * POST: Gerar certificado (se elegível)
 */
export const POST = withUserApi<{ courseId: string }>(async (
  _request: NextRequest,
  ctx
) => {
  const { courseId } = ctx.params;

  // Verificar elegibilidade primeiro
  const eligibility = await checkCertificateEligibility(ctx.user.userId, courseId);
  if (!eligibility.eligible) {
    throw new ValidationError(
      'Você ainda não completou todos os requisitos para o certificado.',
      eligibility
    );
  }

  const result = await issueCertificate(ctx.user.userId, courseId);
  if (!result.certificate) {
    return NextResponse.json(
      { error: 'Erro ao gerar certificado.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    certificate: result.certificate,
    alreadyExists: result.alreadyExists,
  }, { status: result.alreadyExists ? 200 : 201 });
});
