# 📋 PLANO: Fases 8-11 - Conclusão da Auditoria (100%)

**Data:** 2025-11-04
**Objetivo:** Resolver 4 problemas BAIXOS restantes (88% → 100%)
**Tempo estimado:** 3-4 semanas

---

## 📊 Status Atual

```
PROGRESSO: ████████████████████░░ 88% → 100%

✅ CRÍTICOS:   5/5   (100%)
✅ ALTOS:      4/4   (100%)
✅ MÉDIOS:     5/5   (100%)
⏸️ BAIXOS:     5/8   ( 63%) → 8/8 (100%)
```

**Problemas restantes:**
- #12: Testes Automatizados
- #13: Melhorar Tratamento de Erros
- #14: Cache com Redis
- #15: Monitoring e Observability

---

## 🎯 FASE 8: Tratamento de Erros (Prioridade #1)

**Tempo estimado:** 2-3 dias
**Impacto:** Alto (melhora debugging e UX)
**Complexidade:** Média

### Objetivos

1. **Criar sistema de erros customizados**
   - Classes de erro específicas por tipo
   - Status codes apropriados
   - Mensagens user-friendly

2. **Melhorar catch blocks**
   - Diferenciar tipos de erro (Prisma, Zod, JWT)
   - Retornar status codes corretos
   - Logging estruturado

3. **Adicionar error boundaries no frontend**
   - Capturar erros React
   - Fallback UI elegante
   - Report automático

### Arquivos a Criar

#### 1. `lib/errors/api-error.ts`
```typescript
/**
 * Sistema de erros customizados para APIs
 */

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Não autenticado') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Acesso negado') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} não encontrado`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Muitas requisições') {
    super(429, message, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class InternalServerError extends ApiError {
  constructor(message = 'Erro interno do servidor') {
    super(500, message, 'INTERNAL_SERVER_ERROR');
    this.name = 'InternalServerError';
  }
}
```

#### 2. `lib/errors/error-handler.ts`
```typescript
/**
 * Handler centralizado de erros para APIs
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { apiLogger } from '../logger';
import { ApiError } from './api-error';

export function handleApiError(error: unknown): NextResponse {
  // Log do erro
  apiLogger.error({ err: error }, 'API Error');

  // ApiError customizado
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  // Zod validation error
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
      { status: 400 }
    );
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(error);
  }

  // JWT errors
  if (error instanceof Error && error.name === 'JWTExpired') {
    return NextResponse.json(
      {
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED',
      },
      { status: 401 }
    );
  }

  if (error instanceof Error && error.name === 'JWTInvalid') {
    return NextResponse.json(
      {
        error: 'Token inválido',
        code: 'TOKEN_INVALID',
      },
      { status: 401 }
    );
  }

  // Erro genérico
  return NextResponse.json(
    {
      error: 'Erro interno do servidor',
      code: 'INTERNAL_SERVER_ERROR',
    },
    { status: 500 }
  );
}

function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): NextResponse {
  switch (error.code) {
    case 'P2002': // Unique constraint violation
      return NextResponse.json(
        {
          error: 'Este registro já existe',
          code: 'DUPLICATE_ENTRY',
          details: { fields: error.meta?.target },
        },
        { status: 409 }
      );

    case 'P2025': // Record not found
      return NextResponse.json(
        {
          error: 'Registro não encontrado',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );

    case 'P2003': // Foreign key constraint failed
      return NextResponse.json(
        {
          error: 'Referência inválida',
          code: 'FOREIGN_KEY_VIOLATION',
        },
        { status: 400 }
      );

    default:
      apiLogger.error({ err: error }, `Prisma error: ${error.code}`);
      return NextResponse.json(
        {
          error: 'Erro de banco de dados',
          code: 'DATABASE_ERROR',
        },
        { status: 500 }
      );
  }
}
```

#### 3. `components/ErrorBoundary.tsx`
```typescript
/**
 * Error Boundary para capturar erros React
 */

'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Send to monitoring service
    if (typeof window !== 'undefined') {
      // TODO: Send to Sentry/monitoring
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Algo deu errado
            </h1>
            <p className="text-gray-600 mb-6">
              Ocorreu um erro inesperado. Por favor, tente novamente.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Rotas a Refatorar

**Prioridade Alta (APIs críticas):**
1. `app/api/auth/login/route.ts`
2. `app/api/auth/register/route.ts`
3. `app/api/documents/route.ts`
4. `app/api/documents/[id]/route.ts`
5. `app/api/documents/[id]/download/route.ts`

**Prioridade Média (Admin APIs):**
6. `app/api/admin/documents/[id]/route.ts`
7. `app/api/admin/qrcodes/route.ts`
8. `app/api/admin/blog/route.ts`

**Exemplo de Refatoração:**

```typescript
// ANTES:
export async function GET(request: NextRequest) {
  try {
    const documents = await prisma.document.findMany();
    return NextResponse.json({ documents });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

// DEPOIS:
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError, AuthenticationError } from '@/lib/errors/api-error';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      throw new AuthenticationError();
    }

    const documents = await prisma.document.findMany();
    if (!documents.length) {
      throw new NotFoundError('Documentos');
    }

    return NextResponse.json({ documents });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Checklist Fase 8

- [ ] Criar `lib/errors/api-error.ts`
- [ ] Criar `lib/errors/error-handler.ts`
- [ ] Criar `components/ErrorBoundary.tsx`
- [ ] Refatorar 5 rotas prioritárias
- [ ] Adicionar ErrorBoundary no layout raiz
- [ ] Testar todos os cenários de erro
- [ ] Atualizar testes (se existirem)
- [ ] Commit

---

## 🧪 FASE 9: Testes Automatizados (Prioridade #2)

**Tempo estimado:** 1 semana
**Impacto:** Alto (previne regressões)
**Complexidade:** Alta

### Objetivos

1. **Setup de testes**
   - Vitest + Testing Library
   - Test database (SQLite ou Docker)
   - Coverage reporting

2. **Testes unitários**
   - `lib/auth.ts` (JWT)
   - `lib/documents.ts` (queries)
   - `lib/utils.ts` (helpers)
   - `lib/validation-schemas.ts`

3. **Testes de integração**
   - APIs de autenticação
   - APIs de documentos
   - Fluxo completo de login

4. **CI/CD**
   - GitHub Actions
   - Rodar testes em PRs
   - Coverage mínimo (80%)

### Arquivos a Criar

#### 1. `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

#### 2. `test/setup.ts`
```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
```

#### 3. `lib/__tests__/auth.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { generateToken, verifyToken } from '../auth';

describe('Auth', () => {
  describe('generateToken', () => {
    it('should generate valid JWT token', async () => {
      const payload = { userId: '123', role: 'student' as const };
      const token = await generateToken(payload);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should include payload in token', async () => {
      const payload = { userId: '123', role: 'student' as const };
      const token = await generateToken(payload);
      const decoded = await verifyToken(token);

      expect(decoded?.userId).toBe('123');
      expect(decoded?.role).toBe('student');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const payload = { userId: '456', role: 'admin' as const };
      const token = await generateToken(payload);
      const decoded = await verifyToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBe('456');
    });

    it('should reject invalid token', async () => {
      const decoded = await verifyToken('invalid-token');
      expect(decoded).toBeNull();
    });

    it('should reject expired token', async () => {
      // Test with mocked time
      // TODO: Implement
    });
  });
});
```

#### 4. `.github/workflows/test.yml`
```yaml
name: Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Run tests
        run: npm test

      - name: Check coverage
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Checklist Fase 9

- [ ] Instalar dependências (vitest, @testing-library/*)
- [ ] Criar configuração Vitest
- [ ] Criar test setup
- [ ] Escrever testes para lib/auth.ts
- [ ] Escrever testes para lib/documents.ts
- [ ] Escrever testes para lib/utils.ts
- [ ] Escrever testes de integração para APIs
- [ ] Setup GitHub Actions CI
- [ ] Alcançar 80%+ coverage
- [ ] Atualizar package.json scripts
- [ ] Commit

---

## 🚀 FASE 10: Cache com Redis (Prioridade #3)

**Tempo estimado:** 1 semana
**Impacto:** Muito Alto (performance)
**Complexidade:** Média

### Objetivos

1. **Setup Redis**
   - Upstash Redis (serverless)
   - Conexão e client setup
   - TTL strategies

2. **Implementar cache**
   - Documentos públicos (TTL: 5min)
   - Course metadata (TTL: 1h)
   - Blog posts (TTL: 15min)
   - Analytics (TTL: 10min)

3. **Invalidação automática**
   - Clear cache após mutations
   - Invalidação parcial (por chave)
   - Background refresh

### Arquivos a Criar

#### 1. `lib/cache/redis.ts`
```typescript
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const CACHE_TTL = {
  DOCUMENTS_PUBLIC: 300, // 5 min
  DOCUMENTS_PRIVATE: 60, // 1 min
  COURSE_METADATA: 3600, // 1 hour
  BLOG_POSTS: 900, // 15 min
  ANALYTICS: 600, // 10 min
  USER_SESSION: 1800, // 30 min
} as const;
```

#### 2. `lib/cache/cache-manager.ts`
```typescript
import { redis, CACHE_TTL } from './redis';
import { apiLogger } from '../logger';

export class CacheManager {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get<T>(this.getKey(key));
      if (data) {
        apiLogger.debug({ key }, 'Cache hit');
      }
      return data;
    } catch (error) {
      apiLogger.error({ err: error, key }, 'Cache get error');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await redis.setex(this.getKey(key), ttl, JSON.stringify(value));
      } else {
        await redis.set(this.getKey(key), JSON.stringify(value));
      }
      apiLogger.debug({ key, ttl }, 'Cache set');
    } catch (error) {
      apiLogger.error({ err: error, key }, 'Cache set error');
    }
  }

  async del(key: string): Promise<void> {
    try {
      await redis.del(this.getKey(key));
      apiLogger.debug({ key }, 'Cache invalidated');
    } catch (error) {
      apiLogger.error({ err: error, key }, 'Cache del error');
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(this.getKey(pattern));
      if (keys.length > 0) {
        await redis.del(...keys);
        apiLogger.debug({ pattern, count: keys.length }, 'Cache pattern invalidated');
      }
    } catch (error) {
      apiLogger.error({ err: error, pattern }, 'Cache delPattern error');
    }
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) return cached;

    const fresh = await fetcher();
    await this.set(key, fresh, ttl);
    return fresh;
  }
}

// Pré-configurados
export const documentsCache = new CacheManager('documents');
export const coursesCache = new CacheManager('courses');
export const blogCache = new CacheManager('blog');
export const analyticsCache = new CacheManager('analytics');
```

#### 3. Exemplo: `lib/documents.ts` com cache
```typescript
import { documentsCache } from './cache/cache-manager';
import { CACHE_TTL } from './cache/redis';

export async function getPublicDocuments(courseId: string) {
  const cacheKey = `public:${courseId}`;

  return documentsCache.getOrSet(
    cacheKey,
    async () => {
      return prisma.document.findMany({
        where: {
          courseId,
          isPublic: true,
        },
        orderBy: { uploadedAt: 'desc' },
      });
    },
    CACHE_TTL.DOCUMENTS_PUBLIC
  );
}

// Invalidar cache após mutation
export async function updateDocument(id: string, data: UpdateDocumentInput) {
  const document = await prisma.document.update({
    where: { id },
    data,
  });

  // Invalidar cache deste curso
  await documentsCache.delPattern(`*:${document.courseId}:*`);

  return document;
}
```

### Checklist Fase 10

- [ ] Setup Upstash Redis account
- [ ] Instalar @upstash/redis
- [ ] Criar lib/cache/redis.ts
- [ ] Criar lib/cache/cache-manager.ts
- [ ] Implementar cache em lib/documents.ts
- [ ] Implementar cache em lib/blog.ts
- [ ] Implementar cache em APIs de analytics
- [ ] Adicionar invalidação em mutations
- [ ] Testar performance (before/after)
- [ ] Adicionar variáveis de ambiente
- [ ] Commit

---

## 📊 FASE 11: Monitoring e Observability (Prioridade #4)

**Tempo estimado:** 3-4 dias
**Impacto:** Alto (detecção proativa)
**Complexidade:** Média

### Objetivos

1. **Error Tracking**
   - Sentry integration
   - Source maps
   - User context

2. **Analytics**
   - Vercel Analytics
   - Custom events
   - Performance metrics

3. **Alertas**
   - Email/Slack notifications
   - Error rate threshold
   - Performance degradation

### Arquivos a Criar

#### 1. `lib/monitoring/sentry.ts`
```typescript
import * as Sentry from '@sentry/nextjs';

export function initSentry() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      beforeSend(event) {
        // Remover dados sensíveis
        if (event.request?.cookies) {
          delete event.request.cookies['auth-token'];
        }
        return event;
      },
    });
  }
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}

export function setUserContext(user: { id: string; email: string; role: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}
```

#### 2. `sentry.client.config.ts` (root)
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
```

#### 3. `lib/monitoring/analytics.ts`
```typescript
export function trackEvent(
  name: string,
  properties?: Record<string, string | number>
) {
  if (typeof window !== 'undefined' && (window as any).va) {
    (window as any).va('track', name, properties);
  }
}

export function trackPageView(url: string) {
  if (typeof window !== 'undefined' && (window as any).va) {
    (window as any).va('pageview', { url });
  }
}

// Custom events
export const events = {
  documentDownload: (documentId: string, courseId: string) =>
    trackEvent('document_download', { documentId, courseId }),

  courseEnrollment: (courseId: string) =>
    trackEvent('course_enrollment', { courseId }),

  searchPerformed: (query: string, results: number) =>
    trackEvent('search', { query, results }),
};
```

### Checklist Fase 11

- [ ] Setup Sentry account
- [ ] Instalar @sentry/nextjs
- [ ] Criar configuração Sentry
- [ ] Integrar Sentry no error handler
- [ ] Setup Vercel Analytics
- [ ] Criar lib/monitoring/analytics.ts
- [ ] Adicionar tracking de eventos críticos
- [ ] Configurar alertas (Sentry + Email)
- [ ] Testar em staging
- [ ] Commit

---

## 📅 Cronograma Proposto

### Semana 1 (Nov 4-8)
- **Fase 8:** Tratamento de Erros (2-3 dias)
- Início da **Fase 9:** Setup de testes

### Semana 2 (Nov 11-15)
- **Fase 9:** Testes Automatizados (completar)

### Semana 3 (Nov 18-22)
- **Fase 10:** Cache com Redis

### Semana 4 (Nov 25-29)
- **Fase 11:** Monitoring e Observability
- Documentação final
- Deploy e validação

---

## ✅ Critérios de Conclusão

### Fase 8 - Completa quando:
- [ ] Sistema de erros customizados criado
- [ ] 10+ rotas refatoradas com error handling
- [ ] ErrorBoundary no layout raiz
- [ ] Todos os status codes corretos
- [ ] Build passing

### Fase 9 - Completa quando:
- [ ] Vitest configurado e funcionando
- [ ] 80%+ code coverage
- [ ] Testes para auth, documents, utils
- [ ] GitHub Actions CI rodando
- [ ] Todos os testes passando

### Fase 10 - Completa quando:
- [ ] Redis configurado (Upstash)
- [ ] Cache implementado em 5+ queries críticas
- [ ] Invalidação automática funcionando
- [ ] Performance melhorada (medição before/after)
- [ ] Build passing

### Fase 11 - Completa quando:
- [ ] Sentry configurado e capturando erros
- [ ] Vercel Analytics ativo
- [ ] 5+ eventos customizados trackados
- [ ] Alertas configurados
- [ ] Dashboard de monitoramento funcional

---

## 🎯 Resultado Final

**Auditoria 100% completa:**
- ✅ 22/22 problemas resolvidos
- ✅ 100% vulnerabilidades eliminadas
- ✅ Testes automatizados (80%+ coverage)
- ✅ Error handling profissional
- ✅ Cache Redis (+70% performance)
- ✅ Monitoring completo (Sentry + Analytics)
- ✅ Production-ready MÁXIMO

---

**📦 Próximo passo:** Começar Fase 8 - Tratamento de Erros
