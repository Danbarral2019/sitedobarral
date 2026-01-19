/**
 * Testes para componente ErrorBoundary
 *
 * Testa captura de erros e renderização de fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, SectionErrorBoundary } from '../ErrorBoundary';

// Mock console.error para não poluir output
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Componente que lança erro para testes
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
}

// Componente com erro no render
function BrokenComponent() {
  throw new Error('Component render error');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  describe('Renderizacao Normal', () => {
    it('deve renderizar children quando nao ha erro', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('deve renderizar multiplos children', () => {
      render(
        <ErrorBoundary>
          <div>First child</div>
          <div>Second child</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('First child')).toBeInTheDocument();
      expect(screen.getByText('Second child')).toBeInTheDocument();
    });
  });

  describe('Captura de Erros', () => {
    it('deve capturar erro e mostrar fallback padrao', () => {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
      expect(screen.getByText(/Ocorreu um erro inesperado/)).toBeInTheDocument();
    });

    it('deve mostrar fallback customizado quando fornecido', () => {
      render(
        <ErrorBoundary fallback={<div>Custom fallback</div>}>
          <BrokenComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom fallback')).toBeInTheDocument();
      expect(screen.queryByText('Ops! Algo deu errado')).not.toBeInTheDocument();
    });

    it('deve chamar onError callback quando erro ocorre', () => {
      const onErrorMock = vi.fn();

      render(
        <ErrorBoundary onError={onErrorMock}>
          <BrokenComponent />
        </ErrorBoundary>
      );

      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('deve logar erro no console', () => {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Botoes de Acao', () => {
    it('deve mostrar botao Tentar Novamente', () => {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /Tentar Novamente/i })).toBeInTheDocument();
    });

    it('deve mostrar botao Recarregar Pagina', () => {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /Recarregar Página/i })).toBeInTheDocument();
    });

    it('deve mostrar botao Ir para Inicio', () => {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /Ir para Início/i })).toBeInTheDocument();
    });

    it('deve resetar estado ao clicar em Tentar Novamente', () => {
      // Componente com estado controlavel
      let shouldError = true;
      const ControlledComponent = () => {
        if (shouldError) throw new Error('Test error');
        return <div>Success!</div>;
      };

      const { rerender } = render(
        <ErrorBoundary>
          <ControlledComponent />
        </ErrorBoundary>
      );

      // Deve mostrar erro
      expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();

      // Mudar estado para nao lancar erro
      shouldError = false;

      // Clicar em tentar novamente - isso vai resetar o estado do ErrorBoundary
      fireEvent.click(screen.getByRole('button', { name: /Tentar Novamente/i }));

      // Forcar re-render com novo estado
      rerender(
        <ErrorBoundary>
          <div>Recovered content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Recovered content')).toBeInTheDocument();
    });
  });

  describe('Link de Suporte', () => {
    it('deve mostrar link para email de suporte', () => {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      const link = screen.getByRole('link', { name: /suporte@profdanielbarral.com/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'mailto:suporte@profdanielbarral.com');
    });
  });
});

describe('SectionErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar children quando nao ha erro', () => {
    render(
      <SectionErrorBoundary>
        <div>Section content</div>
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Section content')).toBeInTheDocument();
  });

  it('deve mostrar fallback compacto quando erro ocorre', () => {
    render(
      <SectionErrorBoundary>
        <BrokenComponent />
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Erro ao carregar seção')).toBeInTheDocument();
  });

  it('deve aceitar titulo customizado', () => {
    render(
      <SectionErrorBoundary title="Erro na galeria">
        <BrokenComponent />
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Erro na galeria')).toBeInTheDocument();
  });

  it('deve mostrar botao tentar novamente no fallback compacto', () => {
    render(
      <SectionErrorBoundary>
        <BrokenComponent />
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
  });
});
