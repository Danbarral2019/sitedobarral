/**
 * Sistema de erros customizados para APIs
 *
 * Hierarquia de erros:
 * - ApiError (base)
 *   - ValidationError (400)
 *   - AuthenticationError (401)
 *   - AuthorizationError (403)
 *   - NotFoundError (404)
 *   - ConflictError (409)
 *   - RateLimitError (429)
 *   - InternalServerError (500)
 */

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 400 - Dados inválidos ou mal formatados
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * 401 - Usuário não autenticado (sem token ou token inválido)
 */
export class AuthenticationError extends ApiError {
  constructor(message = 'Não autenticado. Faça login para continuar.') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * 403 - Usuário autenticado mas sem permissão
 */
export class AuthorizationError extends ApiError {
  constructor(message = 'Acesso negado. Você não tem permissão para esta ação.') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

/**
 * 404 - Recurso não encontrado
 */
export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} não encontrado`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * 409 - Conflito (ex: email já cadastrado, registro duplicado)
 */
export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(409, message, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

/**
 * 429 - Muitas requisições (rate limit excedido)
 */
export class RateLimitError extends ApiError {
  constructor(
    message = 'Muitas requisições. Tente novamente em alguns instantes.',
    retryAfter?: number
  ) {
    super(429, message, 'RATE_LIMIT_EXCEEDED', { retryAfter });
    this.name = 'RateLimitError';
  }
}

/**
 * 500 - Erro interno do servidor
 */
export class InternalServerError extends ApiError {
  constructor(message = 'Erro interno do servidor', originalError?: Error) {
    super(
      500,
      message,
      'INTERNAL_SERVER_ERROR',
      originalError ? { message: originalError.message, stack: originalError.stack } : undefined,
      false // Not operational - indica que é um erro inesperado
    );
    this.name = 'InternalServerError';
  }
}

/**
 * 503 - Serviço indisponível (ex: database offline, external API down)
 */
export class ServiceUnavailableError extends ApiError {
  constructor(service: string, message?: string) {
    super(
      503,
      message || `Serviço temporariamente indisponível: ${service}`,
      'SERVICE_UNAVAILABLE',
      { service }
    );
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Helper: Verifica se um erro é operacional (esperado) ou não
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof ApiError) {
    return error.isOperational;
  }
  return false;
}
