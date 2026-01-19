import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';

/**
 * Helper para validar body de requisições com Zod
 * Retorna dados validados ou NextResponse com erro 400
 */
export async function validateRequest<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    // Parse do body JSON
    const body = await request.json();

    // Validação com Zod
    const validationResult = schema.safeParse(body);

    if (!validationResult.success) {
      // Formatar erros do Zod de forma amigável
      // Zod v4 usa .issues em vez de .errors
      const errors = validationResult.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return {
        data: null,
        error: NextResponse.json(
          {
            error: 'Dados inválidos',
            details: errors,
          },
          { status: 400 }
        ),
      };
    }

    return {
      data: validationResult.data,
      error: null,
    };
  } catch (error) {
    // Erro ao fazer parse do JSON
    if (error instanceof SyntaxError) {
      return {
        data: null,
        error: NextResponse.json(
          { error: 'JSON inválido no body da requisição' },
          { status: 400 }
        ),
      };
    }

    // Erro desconhecido
    console.error('Erro ao validar requisição:', error);
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Erro ao processar requisição' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Helper para validar query parameters com Zod
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): { data: T; error: null } | { data: null; error: NextResponse } {
  try {
    // Converter URLSearchParams para objeto
    const params = Object.fromEntries(searchParams.entries());

    // Validação com Zod
    const validationResult = schema.safeParse(params);

    if (!validationResult.success) {
      // Formatar erros do Zod (Zod v4 usa .issues)
      const errors = validationResult.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return {
        data: null,
        error: NextResponse.json(
          {
            error: 'Parâmetros inválidos',
            details: errors,
          },
          { status: 400 }
        ),
      };
    }

    return {
      data: validationResult.data,
      error: null,
    };
  } catch (error) {
    console.error('Erro ao validar query params:', error);
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Erro ao processar parâmetros' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Helper para formatar erros Zod de forma consistente
 */
export function formatZodError(error: ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};

  // Zod v4 usa .issues em vez de .errors
  error.issues.forEach(err => {
    const field = err.path.join('.');
    formatted[field] = err.message;
  });

  return formatted;
}
