import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getPublicR2Url, fileExistsInR2 } from '@/lib/storage/r2-client';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors/api-error';

// ===========================
// Types
// ===========================

interface ConfirmUploadRequest {
  fileId: string;
  r2Key: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  // Optional metadata for document creation
  title?: string;
  description?: string;
  courseId?: string;
  category?: string;
  isPublic?: boolean;
  tags?: string[];
}

// ===========================
// API Route
// ===========================

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user (admin only)
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token');

    if (!token) {
      throw new AuthenticationError('Não autenticado');
    }

    const decoded = await verifyToken(token.value);

    if (!decoded || decoded.role !== 'admin') {
      throw new AuthorizationError('Apenas administradores podem confirmar uploads');
    }

    // 2. Parse request
    const body: ConfirmUploadRequest = await req.json();

    if (!body.fileId || !body.r2Key || !body.fileName) {
      throw new ValidationError('Dados incompletos (fileId, r2Key, fileName obrigatórios)');
    }

    // 3. Verify file exists in R2 (optional but recommended)
    const exists = await fileExistsInR2(body.r2Key);

    if (!exists) {
      throw new NotFoundError('Arquivo no storage');
    }

    // 4. Generate public URL
    const url = getPublicR2Url(body.r2Key);

    // 5. Create document record in database
    const document = await prisma.document.create({
      data: {
        title: body.title || body.fileName,
        description: body.description || `Documento enviado: ${body.fileName}`,
        type: getDocumentType(body.fileType),
        url, // Public R2 URL
        category: body.category || 'outro',
        courseId: body.courseId || null,
        isPublic: body.isPublic ?? false,
        isCommon: false,
        tags: body.tags ? JSON.stringify(body.tags) : null,
        size: body.fileSize,
        reviewed: false,

        // R2 metadata (Fase 8)
        r2Key: body.r2Key,
        r2UploadedAt: new Date(),
      },
    });

    // 6. Enqueue indexation job for Gemini (optional)
    // This will be processed by a background cron job
    await prisma.indexJob.create({
      data: {
        entityType: 'document',
        entityId: document.id,
        status: 'pending',
        priority: 5, // Medium priority
        r2Key: body.r2Key,
        metadata: JSON.stringify({
          fileName: body.fileName,
          fileSize: body.fileSize,
          fileType: body.fileType,
        }),
      },
    });

    // 7. Return success response
    return NextResponse.json({
      success: true,
      documentId: document.id,
      url,
      r2Key: body.r2Key,
      message: 'Upload confirmado e documento criado com sucesso',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ===========================
// Helper Functions
// ===========================

function getDocumentType(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('word')) return 'doc';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'xls';
  if (mimeType.startsWith('image/')) return 'image';
  return 'file';
}

// ===========================
// OPTIONS for CORS
// ===========================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
