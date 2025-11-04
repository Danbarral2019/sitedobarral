/**
 * Handler centralizado de erros para APIs Next.js
 *
 * Processa diferentes tipos de erro e retorna respostas HTTP apropriadas:
 * - ApiError customizados
 * - Zod validation errors
 * - Prisma database errors
 * - JWT errors
 * - Erros genéricos
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { apiLogger } from '../logger';
import { ApiError, isOperationalError } from './api-error';

interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
  timestamp?: string;
}

/**
 * Handler principal - ponto único de tratamento de erros
 */
export function handleApiError(error: unknown, includeStackTrace = false): NextResponse {
  const timestamp = new Date().toISOString();

  // Log do erro (com nível apropriado)
  if (error instanceof ApiError && error.isOperational) {
    // Erros operacionais (esperados) - log level info/warn
    apiLogger.warn(
      {
        err: error,
        statusCode: error.statusCode,
        code: error.code,
      },
      `Operational error: ${error.message}`
    );
  } else {
    // Erros inesperados - log level error
    apiLogger.error(
      {
        err: error,
        isOperational: isOperationalError(error as Error),
      },
      'Unexpected API error'
    );
  }

  // 1. ApiError customizado
  if (error instanceof ApiError) {
    const response: ErrorResponse = {
      error: error.message,
      code: error.code,
      details: error.details,
      timestamp,
    };

    if (includeStackTrace && process.env.NODE_ENV === 'development') {
      (response as ErrorResponse & { stack?: string }).stack = error.stack;
    }

    return NextResponse.json(response, { status: error.statusCode });
  }

  // 2. Zod validation error
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
        timestamp,
      },
      { status: 400 }
    );
  }

  // 3. Prisma database errors
  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return handlePrismaError(error, timestamp);
  }

  // 4. JWT errors (jose library)
  if (error instanceof Error) {
    // JWT Expired
    if (error.name === 'JWTExpired' || error.message.includes('exp')) {
      return NextResponse.json(
        {
          error: 'Token expirado. Faça login novamente.',
          code: 'TOKEN_EXPIRED',
          timestamp,
        },
        { status: 401 }
      );
    }

    // JWT Invalid
    if (
      error.name === 'JWTInvalid' ||
      error.name === 'JWSInvalid' ||
      error.message.includes('signature')
    ) {
      return NextResponse.json(
        {
          error: 'Token inválido',
          code: 'TOKEN_INVALID',
          timestamp,
        },
        { status: 401 }
      );
    }

    // JWT Claim validation failed
    if (error.name === 'JWTClaimValidationFailed') {
      return NextResponse.json(
        {
          error: 'Token inválido ou expirado',
          code: 'TOKEN_CLAIM_INVALID',
          timestamp,
        },
        { status: 401 }
      );
    }
  }

  // 5. Erro genérico (unexpected)
  return NextResponse.json(
    {
      error: 'Erro interno do servidor',
      code: 'INTERNAL_SERVER_ERROR',
      timestamp,
      ...(process.env.NODE_ENV === 'development' && {
        details: error instanceof Error ? error.message : String(error),
      }),
    },
    { status: 500 }
  );
}

/**
 * Handler específico para erros Prisma
 */
function handlePrismaError(
  error: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
  timestamp: string
): NextResponse {
  // Prisma Validation Error (mal uso da API)
  if (error instanceof Prisma.PrismaClientValidationError) {
    apiLogger.error({ err: error }, 'Prisma validation error');
    return NextResponse.json(
      {
        error: 'Erro de validação no banco de dados',
        code: 'DATABASE_VALIDATION_ERROR',
        timestamp,
      },
      { status: 500 }
    );
  }

  // Prisma Known Request Error (erros do database)
  const prismaError = error as Prisma.PrismaClientKnownRequestError;

  switch (prismaError.code) {
    // P2002: Unique constraint violation
    case 'P2002': {
      const fields = prismaError.meta?.target as string[] | undefined;
      const fieldNames = fields?.join(', ') || 'campo único';

      return NextResponse.json(
        {
          error: `Já existe um registro com este ${fieldNames}`,
          code: 'DUPLICATE_ENTRY',
          details: { fields },
          timestamp,
        },
        { status: 409 }
      );
    }

    // P2025: Record not found (update/delete on non-existing record)
    case 'P2025':
      return NextResponse.json(
        {
          error: 'Registro não encontrado',
          code: 'NOT_FOUND',
          timestamp,
        },
        { status: 404 }
      );

    // P2003: Foreign key constraint failed
    case 'P2003':
      return NextResponse.json(
        {
          error: 'Referência inválida. Verifique os dados relacionados.',
          code: 'FOREIGN_KEY_VIOLATION',
          details: { field: prismaError.meta?.field_name },
          timestamp,
        },
        { status: 400 }
      );

    // P2014: Relation violation (cascade delete blocked)
    case 'P2014':
      return NextResponse.json(
        {
          error: 'Não é possível excluir este registro pois existem dados relacionados',
          code: 'RELATION_VIOLATION',
          timestamp,
        },
        { status: 409 }
      );

    // P2024: Timed out fetching new connection from pool
    case 'P2024':
      apiLogger.error({ err: prismaError }, 'Database connection timeout');
      return NextResponse.json(
        {
          error: 'Banco de dados temporariamente indisponível',
          code: 'DATABASE_TIMEOUT',
          timestamp,
        },
        { status: 503 }
      );

    // P1001: Can't reach database server
    case 'P1001':
      apiLogger.error({ err: prismaError }, 'Database unreachable');
      return NextResponse.json(
        {
          error: 'Não foi possível conectar ao banco de dados',
          code: 'DATABASE_UNREACHABLE',
          timestamp,
        },
        { status: 503 }
      );

    // P1017: Server has closed the connection
    case 'P1017':
      apiLogger.error({ err: prismaError }, 'Database connection closed');
      return NextResponse.json(
        {
          error: 'Conexão com banco de dados perdida',
          code: 'DATABASE_CONNECTION_LOST',
          timestamp,
        },
        { status: 503 }
      );

    // Default: Log erro desconhecido e retorna 500
    default:
      apiLogger.error(
        { err: prismaError, code: prismaError.code },
        `Unhandled Prisma error: ${prismaError.code}`
      );
      return NextResponse.json(
        {
          error: 'Erro no banco de dados',
          code: 'DATABASE_ERROR',
          timestamp,
          ...(process.env.NODE_ENV === 'development' && {
            details: { prismaCode: prismaError.code, message: prismaError.message },
          }),
        },
        { status: 500 }
      );
  }
}

/**
 * Helper: Wrap async route handlers com error handling automático
 *
 * Exemplo de uso:
 * ```typescript
 * export const GET = withErrorHandler(async (request) => {
 *   const documents = await getDocuments();
 *   return NextResponse.json({ documents });
 * });
 * ```
 */
export function withErrorHandler<T extends (...args: unknown[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  }) as T;
}
