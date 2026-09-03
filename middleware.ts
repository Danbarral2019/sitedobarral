import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { authLogger } from '@/lib/logger';
import { isAllowlistedRoute, hasValidPreviewCookie } from '@/lib/middleware/coming-soon';

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
    authLogger.debug({ err: error }, 'Falha ao verificar token JWT');
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const comingSoonEnabled = process.env.COMING_SOON_ENABLED === 'true';

  // ========== COMING-SOON GATE (só ativa quando flag ligada) ==========
  if (comingSoonEnabled && !isAllowlistedRoute(pathname)) {
    // Tenta bypass por JWT (qualquer role: admin OU aluno)
    const token = request.cookies.get('auth-token')?.value;
    let hasJWTBypass = false;
    if (token) {
      const payload = await verifyAuth(token);
      hasJWTBypass = !!payload;
    }

    // Tenta bypass por cookie de preview (URL secreta)
    let hasPreviewBypass = false;
    if (!hasJWTBypass) {
      const cookie = request.cookies.get('preview-bypass')?.value;
      hasPreviewBypass = await hasValidPreviewCookie(
        cookie,
        process.env.PREVIEW_BYPASS_KEY,
      );
    }

    if (!hasJWTBypass && !hasPreviewBypass) {
      const url = request.nextUrl.clone();
      url.pathname = '/coming-soon';
      const response = NextResponse.rewrite(url);
      // Anti-cache: evita Vercel CDN servir coming-soon depois que o
      // kill switch for desligado. Crítico para rollback rápido.
      response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      return response;
    }
  }

  // ========== LÓGICA EXISTENTE (preservada integralmente) ==========

  // APIs administrativas devem falhar com JSON, sem depender apenas da
  // autenticação implementada por cada route handler.
  const isAdminApiRoute = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  if (isAdminApiRoute) {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const payload = await verifyAuth(token);
    if (!payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    return NextResponse.next();
  }

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
  if (pathname === '/jurisprudencia') {
    const token = request.cookies.get('auth-token')?.value;
    if (token) {
      const payload = await verifyAuth(token);
      if (payload) {
        const url = new URL('/area-restrita/jurisprudencia', request.url);
        url.search = request.nextUrl.search;
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // Verifica rotas protegidas e admin
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  );

  const isAdminRoute = adminRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  );

  if (isProtectedRoute || isAdminRoute) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      if (isAdminRoute) {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
      return NextResponse.redirect(new URL('/validar-acesso', request.url));
    }

    const payload = await verifyAuth(token);

    if (!payload) {
      if (isAdminRoute) {
        return NextResponse.redirect(new URL('/admin/login?error=expired', request.url));
      }
      return NextResponse.redirect(new URL('/validar-acesso?error=expired', request.url));
    }

    if (isAdminRoute && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Cobre tudo, exceto assets estáticos servidos diretamente pelo Vercel
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|css|js|map)$).*)',
  ],
};
