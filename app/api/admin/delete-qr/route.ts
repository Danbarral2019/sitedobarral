import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { deleteQRCode } from '@/lib/qrcode';
import { ValidationError, NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

export const DELETE = withAdminApi(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    apiLogger.warn('DELETE QR Code: code parameter missing');
    throw new ValidationError('Código do QR Code não fornecido');
  }

  const success = await deleteQRCode(code);

  if (!success) {
    apiLogger.warn({ code }, 'QR Code not found or failed to delete');
    throw new NotFoundError('QR Code');
  }

  apiLogger.info({ code }, 'QR Code deleted successfully');

  return NextResponse.json({
    success: true,
    message: 'QR Code deletado com sucesso',
  });
});
