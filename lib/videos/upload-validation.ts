export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const MAX_VIDEO_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

export function validateVideoUpload(input: {
  fileName: string;
  fileSize: number;
  fileType: string;
}): { valid: true } | { valid: false; error: string } {
  if (!input.fileName || input.fileName.trim().length === 0) {
    return { valid: false, error: 'Nome do arquivo é obrigatório' };
  }
  if (!input.fileSize || input.fileSize <= 0) {
    return { valid: false, error: 'Tamanho do arquivo inválido' };
  }
  if (input.fileSize > MAX_VIDEO_SIZE_BYTES) {
    return { valid: false, error: 'Arquivo muito grande (máximo: 5GB)' };
  }
  if (!input.fileType || !ALLOWED_VIDEO_MIME_TYPES.includes(input.fileType as never)) {
    return {
      valid: false,
      error: 'Tipo de arquivo não permitido (aceitos: MP4, WebM, MOV)',
    };
  }
  return { valid: true };
}

export function generateVideoKey(
  courseId: string,
  fileName: string,
  fileId: string
): string {
  const sanitized = fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (combining marks)
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `videos/${courseId}/${fileId}-${sanitized}`;
}
