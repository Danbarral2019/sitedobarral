import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getPublicR2Url, fileExistsInR2 } from '@/lib/storage/r2-client';
import { prisma } from '@/lib/prisma';

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
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const decoded = await verifyToken(token.value);

    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem confirmar uploads' },
        { status: 403 }
      );
    }

    // 2. Parse request
    const body: ConfirmUploadRequest = await req.json();

    if (!body.fileId || !body.r2Key || !body.fileName) {
      return NextResponse.json(
        { error: 'Dados incompletos (fileId, r2Key, fileName obrigatórios)' },
        { status: 400 }
      );
    }

    // 3. Verify file exists in R2 (optional but recommended)
    const exists = await fileExistsInR2(body.r2Key);

    if (!exists) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado no storage' },
        { status: 404 }
      );
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

        // Gemini indexation (initially not indexed)
        geminiIndexed: false,
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
    console.error('Upload confirmation error:', error);

    // If it's a Prisma error, provide more details
    if (error && typeof error === 'object' && 'code' in error) {
      return NextResponse.json(
        {
          error: 'Erro ao criar documento no banco de dados',
          details: (error as any).message,
          code: (error as any).code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Erro ao confirmar upload',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
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
