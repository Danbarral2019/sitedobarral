import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authLogger } from './logger';

// Schema Zod para validação runtime do payload JWT
export const AuthPayloadSchema = z.object({
  userId: z.string().min(1, 'userId é obrigatório'),
  courseId: z.string().optional(),
  role: z.enum(['admin', 'student'], {
    error: 'role deve ser "admin" ou "student"'
  }),
  email: z.string().optional(),
  name: z.string().optional(),
  validUntil: z.string().datetime().optional(),
  turma: z.string().optional(),
});

// Tipos para o payload do JWT (inferido do schema Zod)
export type AuthPayload = z.infer<typeof AuthPayloadSchema>;

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

  // Validar payload com Zod
  const validationResult = AuthPayloadSchema.safeParse(payload);
  if (!validationResult.success) {
    authLogger.error({ err: validationResult.error, payload }, 'Payload JWT inválido');
    throw new Error(`Payload JWT inválido: ${validationResult.error.message}`);
  }

  // Calcula tempo de expiração
  let expirationTime: string | number = '7d'; // 7 dias por padrão

  if (payload.validUntil) {
    // Se validUntil é uma data ISO, converte para timestamp em segundos
    const validUntilDate = new Date(payload.validUntil);

    // Validar se a data é válida
    if (isNaN(validUntilDate.getTime())) {
      throw new Error('validUntil contém data inválida');
    }

    const now = new Date();
    const secondsUntilExpiration = Math.floor((validUntilDate.getTime() - now.getTime()) / 1000);

    if (secondsUntilExpiration > 0) {
      expirationTime = `${secondsUntilExpiration}s`;
    } else {
      throw new Error('Acesso expirado: validUntil está no passado');
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

    // ✅ VALIDAÇÃO RUNTIME com Zod (remove type assertions inseguros)
    const validationResult = AuthPayloadSchema.safeParse(payload);

    if (!validationResult.success) {
      authLogger.warn({ err: validationResult.error }, 'Token JWT com payload inválido');
      return null;
    }

    return validationResult.data;
  } catch (error) {
    authLogger.debug({ err: error }, 'Erro ao verificar token JWT');
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
 * Verifica se o usuário tem acesso a um curso específico.
 * Checa: (1) role admin, (2) courseId no JWT, (3) enrollments no banco, (4) subscriptions ativas.
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

  // Check rápido: courseId no JWT token
  if (user.courseId === courseId) {
    return true;
  }

  // Check no banco: enrollment válido (não expirado, ou lifetime)
  const { prisma } = await import('@/lib/prisma');

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: user.userId,
      courseId,
      OR: [
        { isLifetime: true },
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  if (enrollment) {
    return true;
  }

  // Check no banco: subscription ativa (Premium = todos cursos, Básico = curso específico)
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: user.userId,
      status: 'active',
      OR: [
        { plan: 'premium' },
        { plan: 'basico', courseId },
      ],
    },
  });

  return !!subscription;
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

  // ✅ SINCRONIZADO: Cookie e JWT expiram ao mesmo tempo (7 dias ou validUntil)
  let cookieMaxAge = 7 * 24 * 60 * 60; // 7 dias por padrão (igual ao JWT)

  if (payload.validUntil) {
    const validUntilDate = new Date(payload.validUntil);
    const now = new Date();
    const secondsUntilExpiration = Math.floor((validUntilDate.getTime() - now.getTime()) / 1000);

    if (secondsUntilExpiration > 0) {
      cookieMaxAge = secondsUntilExpiration;
    } else {
      // generateToken já rejeita validUntil no passado, mas previne caso chegue aqui
      cookieMaxAge = 0;
    }
  }

  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: cookieMaxAge,
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
    authLogger.error({ err: error }, 'Erro ao verificar autenticação');
    return { valid: false };
  }
}
