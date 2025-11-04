import pino from 'pino';

/**
 * Logger profissional com Pino
 *
 * Features:
 * - ✅ Logs estruturados (JSON em produção)
 * - ✅ Redact automático de campos sensíveis (password, token, secret)
 * - ✅ Pretty printing em desenvolvimento
 * - ✅ Níveis de log apropriados por ambiente
 *
 * Uso:
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * logger.info({ userId: '123' }, 'Login bem-sucedido');
 * logger.error({ err, userId }, 'Erro ao processar pagamento');
 * logger.warn({ ip: request.ip }, 'Tentativa de acesso suspeita');
 * ```
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

  // ✅ Remover automaticamente campos sensíveis dos logs
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'secret',
      'jwt',
      'cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.secret',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    remove: true, // Remove completamente em vez de substituir por [Redacted]
  },

  // ✅ Formatação legível em desenvolvimento, JSON em produção
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // ✅ Adicionar timestamp em produção
  timestamp: pino.stdTimeFunctions.isoTime,

  // ✅ Serializers para formatar erros e requests
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },

  // ✅ Context adicional
  base: {
    env: process.env.NODE_ENV,
  },
});

/**
 * Logger específico para autenticação (com contexto adicional)
 */
export const authLogger = logger.child({ module: 'auth' });

/**
 * Logger para operações de banco de dados
 */
export const dbLogger = logger.child({ module: 'database' });

/**
 * Logger para APIs externas
 */
export const apiLogger = logger.child({ module: 'external-api' });
