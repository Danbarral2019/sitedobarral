import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';

/**
 * GET: Verificação pública de certificado (sem auth)
 *
 * Certificado revogado responde `valid: false` com `revoked: true` e a data da
 * revogação (o motivo interno não é exposto).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    const { numero } = await params;

    const certificate = await prisma.certificate.findUnique({
      where: { certificateNumber: numero },
      select: {
        id: true,
        certificateNumber: true,
        studentName: true,
        courseTitle: true,
        estimatedHours: true,
        issuedAt: true,
        revokedAt: true,
      },
    });

    if (!certificate) {
      return NextResponse.json(
        { valid: false, error: 'Certificado não encontrado.' },
        { status: 404 }
      );
    }

    const { revokedAt, ...publicData } = certificate;

    if (revokedAt) {
      return NextResponse.json({
        valid: false,
        revoked: true,
        revokedAt: revokedAt.toISOString(),
        error: 'Certificado revogado.',
        certificate: publicData,
      });
    }

    return NextResponse.json({
      valid: true,
      certificate: publicData,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
