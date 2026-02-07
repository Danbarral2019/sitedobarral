import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { generatePresignedUploadUrl } from '@/lib/storage/r2-client';
import { randomUUID } from 'crypto';

// ===========================
// Types
// ===========================

interface PresignedUrlRequest {
  fileName: string;
  fileSize: number;
  fileType: string;
  courseId?: string; // Optional: for organizing files by course
}

// ===========================
// Configuration
// ===========================

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const PRESIGNED_URL_EXPIRATION = 900; // 15 minutes in seconds

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
];

// ===========================
// Helper Functions
// ===========================

function sanitizeFileName(fileName: string): string {
  // Remove special characters and normalize
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function validateFileMetadata(request: PresignedUrlRequest): {
  valid: boolean;
  error?: string;
} {
  // Validate file name
  if (!request.fileName || request.fileName.trim().length === 0) {
    return { valid: false, error: 'Nome do arquivo é obrigatório' };
  }

  // Validate file size
  if (!request.fileSize || request.fileSize <= 0) {
    return { valid: false, error: 'Tamanho do arquivo inválido' };
  }

  if (request.fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Arquivo muito grande (máximo: ${MAX_FILE_SIZE / (1024 * 1024)}MB)`,
    };
  }

  // Validate file type
  if (!request.fileType || !ALLOWED_MIME_TYPES.includes(request.fileType)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido (aceitos: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, GIF)`,
    };
  }

  return { valid: true };
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
        { error: 'Apenas administradores podem fazer upload' },
        { status: 403 }
      );
    }

    // 2. Parse and validate request
    const body: PresignedUrlRequest = await req.json();
    const validation = validateFileMetadata(body);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 3. Generate unique file ID and R2 key
    const fileId = randomUUID();
    const courseId = body.courseId || 'general';
    const sanitizedFileName = sanitizeFileName(body.fileName);
    const r2Key = `documents/${courseId}/${fileId}-${sanitizedFileName}`;

    // 4. Generate presigned URL
    const presignedUrl = await generatePresignedUploadUrl(
      r2Key,
      PRESIGNED_URL_EXPIRATION,
      body.fileType
    );

    // 5. Return presigned URL and metadata
    return NextResponse.json({
      presignedUrl,
      r2Key,
      fileId,
      expiresIn: PRESIGNED_URL_EXPIRATION,
      maxFileSize: MAX_FILE_SIZE,
    });
  } catch (error) {
    console.error('Presigned URL generation error:', error);
    return NextResponse.json(
      {
        error: 'Erro ao gerar URL de upload',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
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
