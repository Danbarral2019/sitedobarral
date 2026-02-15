/**
 * Testes para componente NewsletterForm
 *
 * Testa formulario de inscricao na newsletter.
 */

/// <reference types="@testing-library/jest-dom/vitest" />

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewsletterForm from '../NewsletterForm';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console.error
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('NewsletterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleErrorSpy.mockClear();
  });

  describe('Renderizacao', () => {
    it('deve renderizar formulario com campos obrigatorios', () => {
      render(<NewsletterForm />);

      expect(screen.getByPlaceholderText(/e-mail/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/nome/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cadastrar/i })).toBeInTheDocument();
    });

    it('deve mostrar interesses quando showInterests=true', () => {
      render(<NewsletterForm showInterests={true} />);

      expect(screen.getByText('Lei 14.133/2021')).toBeInTheDocument();
      expect(screen.getByText('Gestão de Contratos')).toBeInTheDocument();
      expect(screen.getByText('Licitações')).toBeInTheDocument();
    });

    it('nao deve mostrar interesses por padrao', () => {
      render(<NewsletterForm />);

      expect(screen.queryByText('Lei 14.133/2021')).not.toBeInTheDocument();
    });

    it('deve aplicar className customizado', () => {
      const { container } = render(<NewsletterForm className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Variante Inline', () => {
    it('deve renderizar formato inline', () => {
      render(<NewsletterForm variant="inline" />);

      // Na variante inline, nao tem campo de nome
      expect(screen.getByPlaceholderText(/e-mail/i)).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/nome/i)).not.toBeInTheDocument();
    });
  });

  describe('Selecao de Interesses', () => {
    it('deve selecionar/deselecionar interesse ao clicar', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<NewsletterForm showInterests={true} />);

      const interestButton = screen.getByText('Lei 14.133/2021');

      // Inicialmente nao selecionado
      expect(interestButton).toHaveClass('bg-gray-200');

      // Clicar para selecionar
      await user.click(interestButton);
      expect(interestButton).toHaveClass('bg-primary-600');

      // Clicar novamente para deselecionar
      await user.click(interestButton);
      expect(interestButton).toHaveClass('bg-gray-200');
    });

    it('deve permitir selecionar multiplos interesses', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<NewsletterForm showInterests={true} />);

      const interest1 = screen.getByText('Lei 14.133/2021');
      const interest2 = screen.getByText('Licitações');

      await user.click(interest1);
      await user.click(interest2);

      expect(interest1).toHaveClass('bg-primary-600');
      expect(interest2).toHaveClass('bg-primary-600');
    });
  });

  describe('Envio do Formulario', () => {
    it('deve enviar dados corretos', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<NewsletterForm />);

      await user.type(screen.getByPlaceholderText(/e-mail/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/nome/i), 'John Doe');
      await user.click(screen.getByRole('button', { name: /cadastrar/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            name: 'John Doe',
            interests: null,
          }),
        });
      });
    });

    it('deve enviar interesses selecionados', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<NewsletterForm showInterests={true} />);

      await user.type(screen.getByPlaceholderText(/e-mail/i), 'test@example.com');
      await user.click(screen.getByText('Lei 14.133/2021'));
      await user.click(screen.getByRole('button', { name: /cadastrar/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            name: null,
            interests: ['Lei 14.133/2021'],
          }),
        });
      });
    });

    it('deve mostrar estado de loading durante envio', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(promise);

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<NewsletterForm />);

      await user.type(screen.getByPlaceholderText(/e-mail/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /cadastrar/i }));

      expect(screen.getByText(/cadastrando/i)).toBeInTheDocument();

      // Resolver promise
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    it('deve desabilitar campos durante envio', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(promise);

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<NewsletterForm />);

      await user.type(screen.getByPlaceholderText(/e-mail/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /cadastrar/i }));

      expect(screen.getByPlaceholderText(/e-mail/i)).toBeDisabled();
      expect(screen.getByPlaceholderText(/nome/i)).toBeDisabled();

      resolvePromise!({
        ok: true,
        json: async () => ({ success: true }),
      });
    });
  });

  describe('Estado de Sucesso', () => {
    it('deve mostrar mensagem de sucesso apos cadastro', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<NewsletterForm />);

      await user.type(screen.getByPlaceholderText(/e-mail/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /cadastrar/i }));

      await waitFor(() => {
        expect(screen.getByText('Cadastro realizado!')).toBeInTheDocument();
      });
    });

    it('deve limpar formulario apos sucesso', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<NewsletterForm />);

      await user.type(screen.getByPlaceholderText(/e-mail/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/nome/i), 'John');
      await user.click(screen.getByRole('button', { name: /cadastrar/i }));

      // Aguardar timeout e retorno ao formulario
      await vi.advanceTimersByTimeAsync(6000);

      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText(/e-mail/i);
        expect(emailInput).toHaveValue('');
      });
    });
  });

  describe('Tratamento de Erros', () => {
    it('deve mostrar mensagem de erro da API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Email já cadastrado' }),
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<NewsletterForm />);

      await user.type(screen.getByPlaceholderText(/e-mail/i), 'existing@example.com');
      await user.click(screen.getByRole('button', { name: /cadastrar/i }));

      await waitFor(() => {
        expect(screen.getByText('Email já cadastrado')).toBeInTheDocument();
      });
    });

    it('deve mostrar erro generico quando fetch falha', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<NewsletterForm />);

      await user.type(screen.getByPlaceholderText(/e-mail/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /cadastrar/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('deve mostrar erro na variante inline', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Erro de validação' }),
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<NewsletterForm variant="inline" />);

      await user.type(screen.getByPlaceholderText(/e-mail/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /cadastrar/i }));

      await waitFor(() => {
        expect(screen.getByText('Erro de validação')).toBeInTheDocument();
      });
    });
  });

  describe('Validacao HTML5', () => {
    it('campo email deve ser required', () => {
      render(<NewsletterForm />);
      expect(screen.getByPlaceholderText(/e-mail/i)).toBeRequired();
    });

    it('campo email deve ter type=email', () => {
      render(<NewsletterForm />);
      expect(screen.getByPlaceholderText(/e-mail/i)).toHaveAttribute('type', 'email');
    });

    it('campo nome nao deve ser required', () => {
      render(<NewsletterForm />);
      expect(screen.getByPlaceholderText(/nome/i)).not.toBeRequired();
    });
  });
});
