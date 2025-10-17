import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { listQRCodes } from '@/lib/qrcode';

export const GET = withAdminAuth(async () => {
  try {
    const qrCodes = await listQRCodes();

    return NextResponse.json({ qrCodes });
  } catch (error) {
    console.error('Erro ao listar QR Codes:', error);
    return NextResponse.json(
      { error: 'Erro ao listar QR Codes' },
      { status: 500 }
    );
  }
});
