import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';

/**
 * GET: Verificação pública de certificado (sem auth)
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
      },
    });

    if (!certificate) {
      return NextResponse.json(
        { valid: false, error: 'Certificado não encontrado.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      certificate,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
