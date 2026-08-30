/**
 * Error Boundary para capturar erros React no frontend
 *
 * Captura erros durante renderização, lifecycle methods e construtores
 * de componentes filhos. Exibe UI de fallback elegante.
 *
 * Uso:
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */

'use client';

import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Atualiza estado para renderizar UI de fallback
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log do erro
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Callback customizado
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Enviar para Sentry
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });

    // Atualiza estado com errorInfo
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Renderizar UI de fallback customizada
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI de fallback padrão
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
          <div className="max-w-2xl w-full">
            <div className="bg-white rounded-2xl shadow-xl border-2 border-red-200 p-8">
              {/* Icon & Title */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
                  <AlertTriangle className="w-10 h-10 text-red-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Ops! Algo deu errado
                </h1>
                <p className="text-gray-600">
                  Ocorreu um erro inesperado. Nossa equipe foi notificada.
                </p>
              </div>

              {/* Error details (apenas em desenvolvimento) */}
              {isDevelopment && this.state.error && (
                <div className="mb-6">
                  <details className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                      Detalhes do Erro (Dev)
                    </summary>
                    <div className="mt-4 space-y-2">
                      <div>
                        <p className="text-sm font-semibold text-red-600">
                          {this.state.error.name}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {this.state.error.message}
                        </p>
                      </div>
                      {this.state.error.stack && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1">Stack Trace:</p>
                          <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                            {this.state.error.stack}
                          </pre>
                        </div>
                      )}
                      {this.state.errorInfo?.componentStack && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1">
                            Component Stack:
                          </p>
                          <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={this.handleReset}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-surface-page px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  Tentar Novamente
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex items-center justify-center gap-2 bg-gray-600 text-surface-page px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  Recarregar Página
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex items-center justify-center gap-2 bg-white text-gray-700 px-6 py-3 rounded-lg font-semibold border-2 border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <Home className="w-5 h-5" />
                  Ir para Início
                </button>
              </div>

              {/* Help text */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  Se o problema persistir, entre em contato com o suporte em{' '}
                  <a
                    href="mailto:suporte@profdanielbarral.com"
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    suporte@profdanielbarral.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Variant compacta para seções específicas
 */
export function SectionErrorBoundary({
  children,
  title = 'Erro ao carregar seção',
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <p className="text-red-800 font-semibold">{title}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
          >
            Tentar novamente
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
