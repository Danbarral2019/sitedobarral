import { NextResponse } from 'next/server';

function clearAuthCookie() {
  const response = NextResponse.redirect(new URL('/admin/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));

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

export async function GET() {
  return clearAuthCookie();
}

export async function POST() {
  const response = NextResponse.json(
    { success: true, message: 'Logout realizado com sucesso' },
    { status: 200 }
  );

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
