import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { authLogger } from '@/lib/logger';

// Rotas que requerem autenticação
const protectedRoutes = ['/area-restrita'];

// Rotas que só admin pode acessar
const adminRoutes = ['/admin'];

// Rotas públicas do admin (não requerem autenticação)
const publicAdminRoutes = ['/admin/login'];

async function verifyAuth(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    // ✅ Log estruturado para debugging (campos sensíveis são redacted automaticamente)
    authLogger.debug({ err: error }, 'Falha ao verificar token JWT');
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Verifica se é rota pública de admin
  const isPublicAdminRoute = publicAdminRoutes.some(route =>
    pathname.startsWith(route)
  );

  if (isPublicAdminRoute) {
    return NextResponse.next();
  }

  // Redireciona /jurisprudencia → /area-restrita/jurisprudencia quando
  // o usuário está logado. Versão restrita tem TCU/STJ/STF + busca IA, e
  // o aluno espera consistência: clicar "Jurisprudência" no menu superior
  // deve abrir a versão completa, não a pública resumida.
  // (A página pública continua acessível diretamente em /jurisprudencia
  // pra usuários não logados, e via deep link em /jurisprudencia/[id] —
  // só o root /jurisprudencia faz o redirect.)
  if (pathname === '/jurisprudencia') {
    const token = request.cookies.get('auth-token')?.value;
    if (token) {
      const payload = await verifyAuth(token);
      if (payload) {
        const url = new URL('/area-restrita/jurisprudencia', request.url);
        // Preserva search params (filtros de tribunal/ano/busca) na transição
        url.search = request.nextUrl.search;
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // ✅ Verifica se é uma rota protegida (match exato ou subpath)
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  );

  const isAdminRoute = adminRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  );

  if (isProtectedRoute || isAdminRoute) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      // Redireciona para página apropriada
      if (isAdminRoute) {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
      return NextResponse.redirect(new URL('/validar-acesso', request.url));
    }

    const payload = await verifyAuth(token);

    if (!payload) {
      // Token inválido ou expirado
      if (isAdminRoute) {
        return NextResponse.redirect(new URL('/admin/login?error=expired', request.url));
      }
      return NextResponse.redirect(new URL('/validar-acesso?error=expired', request.url));
    }

    // Verifica se é rota admin e se usuário é admin
    if (isAdminRoute && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/area-restrita/:path*',
    '/admin/:path*',
    '/jurisprudencia',
  ],
};
