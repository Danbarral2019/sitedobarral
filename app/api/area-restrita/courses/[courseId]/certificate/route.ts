import { NextRequest, NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
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
    return NextResponse.json(
      {
        error: 'Você ainda não completou todos os requisitos para o certificado.',
        ...eligibility,
      },
      { status: 400 }
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
