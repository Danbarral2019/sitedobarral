import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate Limiter usando Map em memória
 *
 * Para produção com múltiplas instâncias, considere usar Redis
 *
 * Uso:
 *
 * const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500 });
 *
 * export async function POST(request: NextRequest) {
 *   try {
 *     await limiter.check(request, 10); // 10 requests per interval
 *   } catch {
 *     return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
 *   }
 *   // ... rest of your code
 * }
 */

interface RateLimitOptions {
  interval?: number; // Janela de tempo em ms (padrão: 60000 = 1 minuto)
  uniqueTokenPerInterval?: number; // Máximo de IPs únicos para rastrear
}

interface RateLimitData {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private tokenCache: Map<string, RateLimitData>;
  private interval: number;
  private uniqueTokenPerInterval: number;

  constructor(options: RateLimitOptions = {}) {
    this.tokenCache = new Map();
    this.interval = options.interval || 60000; // 1 minuto padrão
    this.uniqueTokenPerInterval = options.uniqueTokenPerInterval || 500;
  }

  /**
   * Extrai o IP do request
   */
  private getIdentifier(request: NextRequest): string {
    // Tentar obter IP de headers comuns de proxy
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');

    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    if (realIp) {
      return realIp;
    }

    // Fallback quando não é possível obter o IP
    return 'unknown';
  }

  /**
   * Limpa tokens expirados periodicamente
   */
  private cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.tokenCache.entries()) {
      if (now > value.resetTime) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.tokenCache.delete(key));

    // Limitar tamanho do cache
    if (this.tokenCache.size > this.uniqueTokenPerInterval) {
      const oldestKey = this.tokenCache.keys().next().value;
      if (oldestKey) {
        this.tokenCache.delete(oldestKey);
      }
    }
  }

  /**
   * Verifica se o request excedeu o rate limit
   * @throws Error se exceder o limite
   */
  async check(request: NextRequest, limit: number): Promise<void> {
    const identifier = this.getIdentifier(request);
    const now = Date.now();

    // Cleanup periódico
    if (Math.random() < 0.1) { // 10% de chance a cada chamada
      this.cleanup();
    }

    const tokenData = this.tokenCache.get(identifier);

    if (!tokenData || now > tokenData.resetTime) {
      // Nova janela de tempo
      this.tokenCache.set(identifier, {
        count: 1,
        resetTime: now + this.interval,
      });
      return;
    }

    // Incrementar contador
    tokenData.count++;

    if (tokenData.count > limit) {
      const resetIn = Math.ceil((tokenData.resetTime - now) / 1000);
      throw new Error(`Rate limit exceeded. Try again in ${resetIn} seconds.`);
    }

    this.tokenCache.set(identifier, tokenData);
  }

  /**
   * Retorna informações sobre o rate limit atual
   */
  async getStatus(request: NextRequest, limit: number): Promise<{
    remaining: number;
    resetIn: number;
  }> {
    const identifier = this.getIdentifier(request);
    const now = Date.now();
    const tokenData = this.tokenCache.get(identifier);

    if (!tokenData || now > tokenData.resetTime) {
      return {
        remaining: limit,
        resetIn: Math.ceil(this.interval / 1000),
      };
    }

    return {
      remaining: Math.max(0, limit - tokenData.count),
      resetIn: Math.ceil((tokenData.resetTime - now) / 1000),
    };
  }
}

/**
 * Helper para criar rate limiter com configuração padrão
 */
export function rateLimit(options: RateLimitOptions = {}) {
  return new RateLimiter(options);
}

/**
 * Configurações pré-definidas
 */
export const rateLimiters = {
  // Autenticação: 5 tentativas por minuto
  auth: rateLimit({ interval: 60000, uniqueTokenPerInterval: 500 }),

  // Formulários: 10 envios por minuto
  forms: rateLimit({ interval: 60000, uniqueTokenPerInterval: 1000 }),

  // APIs gerais: 30 requests por minuto
  api: rateLimit({ interval: 60000, uniqueTokenPerInterval: 1000 }),

  // Geração de QR Code: 3 por hora (mais restritivo)
  qrcode: rateLimit({ interval: 3600000, uniqueTokenPerInterval: 200 }),
};

/**
 * Middleware helper para adicionar headers de rate limit
 */
export function addRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  resetIn: number
): NextResponse {
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', resetIn.toString());
  return response;
}
