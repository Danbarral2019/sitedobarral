import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// Tipos para o payload do JWT
export interface AuthPayload {
  userId: string;
  courseId?: string;
  role: 'admin' | 'student';
  validUntil?: string;
  turma?: string;
}

// Tipo para resultado de verificação de autenticação
export interface AuthResult {
  valid: boolean;
  user?: AuthPayload;
}

// Chave secreta para assinar tokens (deve estar no .env)
const getSecretKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET não configurado');
  }
  return new TextEncoder().encode(secret);
};

/**
 * Gera um token JWT
 */
export async function generateToken(payload: AuthPayload): Promise<string> {
  const secret = getSecretKey();

  // Calcula tempo de expiração
  let expirationTime: string | number = '7d'; // 7 dias por padrão

  if (payload.validUntil) {
    // Se validUntil é uma data ISO, converte para timestamp em segundos
    const validUntilDate = new Date(payload.validUntil);
    const now = new Date();
    const secondsUntilExpiration = Math.floor((validUntilDate.getTime() - now.getTime()) / 1000);

    if (secondsUntilExpiration > 0) {
      expirationTime = `${secondsUntilExpiration}s`;
    }
  }

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(secret);

  return token;
}

/**
 * Verifica e decodifica um token JWT
 */
export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret);

    return {
      userId: payload.userId as string,
      courseId: payload.courseId as string | undefined,
      role: payload.role as 'admin' | 'student',
      validUntil: payload.validUntil as string | undefined,
      turma: payload.turma as string | undefined,
    };
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    return null;
  }
}

/**
 * Obtém o token do cookie da requisição
 */
export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token');
  return token?.value || null;
}

/**
 * Obtém os dados do usuário autenticado a partir do cookie
 */
export async function getCurrentUser(): Promise<AuthPayload | null> {
  const token = await getTokenFromCookies();

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

/**
 * Verifica se o usuário tem acesso a um curso específico
 */
export async function hasAccessToCourse(courseId: string): Promise<boolean> {
  const user = await getCurrentUser();

  if (!user) {
    return false;
  }

  // Admin tem acesso a tudo
  if (user.role === 'admin') {
    return true;
  }

  // Estudante só tem acesso ao curso específico do token
  return user.courseId === courseId;
}

/**
 * Verifica se o usuário é admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'admin';
}

/**
 * Cria um token JWT e define o cookie de autenticação
 */
export async function createAuthSession(payload: AuthPayload): Promise<string> {
  const token = await generateToken(payload);
  const cookieStore = await cookies();

  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 dias
    path: '/',
  });

  return token;
}

/**
 * Remove o cookie de autenticação (logout)
 */
export async function destroyAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
}

/**
 * Verifica autenticação a partir de um NextRequest
 * Usado em rotas API que precisam verificar auth manualmente
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Obter token do cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return { valid: false };
    }

    // Verificar token
    const user = await verifyToken(token);

    if (!user) {
      return { valid: false };
    }

    return {
      valid: true,
      user,
    };
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error);
    return { valid: false };
  }
}
