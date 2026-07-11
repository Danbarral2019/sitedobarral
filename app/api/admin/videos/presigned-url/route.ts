import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import { generatePresignedUploadUrl } from '@/lib/storage/r2-client';
import { validateVideoUpload, generateVideoKey } from '@/lib/videos/upload-validation';
import { randomUUID } from 'crypto';

const PRESIGNED_EXPIRATION = 900; // 15 min

interface Body {
  courseId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export const POST = withAdminApi(async (request) => {
  const body = (await request.json()) as Body;

  if (!body.courseId || typeof body.courseId !== 'string') {
    throw new ValidationError('courseId é obrigatório');
  }

  const validation = validateVideoUpload({
    fileName: body.fileName,
    fileSize: body.fileSize,
    fileType: body.fileType,
  });
  if (!validation.valid) {
    throw new ValidationError(validation.error);
  }

  const fileId = randomUUID();
  const r2Key = generateVideoKey(body.courseId, body.fileName, fileId);
  const presignedUrl = await generatePresignedUploadUrl(
    r2Key,
    PRESIGNED_EXPIRATION,
    body.fileType
  );

  return NextResponse.json({
    presignedUrl,
    r2Key,
    fileId,
    expiresIn: PRESIGNED_EXPIRATION,
  });
});
