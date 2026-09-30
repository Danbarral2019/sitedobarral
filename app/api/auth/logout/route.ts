import { NextRequest, NextResponse } from 'next/server';
import { revokeUserTokens, verifyToken } from '@/lib/auth';
import { authLogger } from '@/lib/logger';

/**
 * Revoga os tokens do usuário (incrementa User.tokenVersion), para que uma
 * cópia do cookie não continue valendo depois do logout. Só age com token
 * ainda válido: um token já revogado não pode forçar novos incrementos.
 * Falha aqui não impede o logout; o cookie é apagado de qualquer forma.
 */
async function revokeCurrentSession(request: NextRequest): Promise<void> {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    return;
  }

  try {
    const user = await verifyToken(token);
    if (user) {
      await revokeUserTokens(user.userId);
      authLogger.info({ userId: user.userId }, 'Logout: tokens revogados');
    }
  } catch (error) {
    authLogger.error({ err: error }, 'Logout: falha ao revogar tokens');
  }
}

function clearCookie(response: NextResponse): NextResponse {
  // Remover cookie de autenticação (nome correto: auth-token)
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}

export async function GET(request: NextRequest) {
  await revokeCurrentSession(request);
  return clearCookie(
    NextResponse.redirect(new URL('/admin/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')),
  );
}

export async function POST(request: NextRequest) {
  await revokeCurrentSession(request);
  return clearCookie(
    NextResponse.json(
      { success: true, message: 'Logout realizado com sucesso' },
      { status: 200 }
    ),
  );
}
