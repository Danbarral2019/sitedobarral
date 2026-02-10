import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { handleApiError } from '@/lib/errors/error-handler';
import {
  checkCertificateEligibility,
  issueCertificate,
} from '@/lib/certificate';

/**
 * GET: Verificar elegibilidade e retornar certificado existente (se houver)
 */
export const GET = withAuth(async (
  request: NextRequest,
  context?: Record<string, unknown>
) => {
  try {
    const user = context?.user as { userId: string };
    const { courseId } = await (context as { params: Promise<{ courseId: string }> }).params;

    const eligibility = await checkCertificateEligibility(user.userId, courseId);

    return NextResponse.json({
      ...eligibility,
      certificate: eligibility.existingCertificate,
    });
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * POST: Gerar certificado (se elegível)
 */
export const POST = withAuth(async (
  request: NextRequest,
  context?: Record<string, unknown>
) => {
  try {
    const user = context?.user as { userId: string };
    const { courseId } = await (context as { params: Promise<{ courseId: string }> }).params;

    // Verificar elegibilidade primeiro
    const eligibility = await checkCertificateEligibility(user.userId, courseId);
    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          error: 'Você ainda não completou todos os requisitos para o certificado.',
          ...eligibility,
        },
        { status: 400 }
      );
    }

    const result = await issueCertificate(user.userId, courseId);
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
  } catch (error) {
    return handleApiError(error);
  }
});
