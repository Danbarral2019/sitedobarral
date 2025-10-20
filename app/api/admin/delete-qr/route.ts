import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { deleteQRCode } from '@/lib/qrcode';

export const DELETE = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Código do QR Code não fornecido' },
        { status: 400 }
      );
    }

    const success = await deleteQRCode(code);

    if (!success) {
      return NextResponse.json(
        { error: 'QR Code não encontrado ou erro ao deletar' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'QR Code deletado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar QR Code:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar QR Code' },
      { status: 500 }
    );
  }
});
