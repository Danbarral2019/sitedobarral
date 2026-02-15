/**
 * Testes para componente Pagination
 *
 * Testa navegacao entre paginas e exibicao de numeros.
 */

/// <reference types="@testing-library/jest-dom/vitest" />

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../pagination';

describe('Pagination Component', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 10,
    onPageChange: vi.fn(),
    itemsPerPage: 10,
    totalItems: 100,
  };

  describe('Renderizacao Basica', () => {
    it('deve renderizar contador de itens', () => {
      render(<Pagination {...defaultProps} />);

      // Verifica texto completo do contador
      expect(screen.getByText(/Mostrando/)).toBeInTheDocument();
      expect(screen.getByText(/de/)).toBeInTheDocument();
      expect(screen.getByText(/resultados/)).toBeInTheDocument();
    });

    it('deve renderizar botoes de navegacao', () => {
      render(<Pagination {...defaultProps} />);

      expect(screen.getByRole('button', { name: /anterior/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /próxima/i })).toBeInTheDocument();
    });

    it('nao deve renderizar quando totalPages <= 1', () => {
      const { container } = render(
        <Pagination {...defaultProps} totalPages={1} totalItems={5} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Estado dos Botoes', () => {
    it('deve desabilitar botao Anterior na primeira pagina', () => {
      render(<Pagination {...defaultProps} currentPage={1} />);

      expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
    });

    it('deve desabilitar botao Proxima na ultima pagina', () => {
      render(<Pagination {...defaultProps} currentPage={10} />);

      expect(screen.getByRole('button', { name: /próxima/i })).toBeDisabled();
    });

    it('deve habilitar ambos os botoes em pagina intermediaria', () => {
      render(<Pagination {...defaultProps} currentPage={5} />);

      expect(screen.getByRole('button', { name: /anterior/i })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /próxima/i })).not.toBeDisabled();
    });
  });

  describe('Navegacao', () => {
    it('deve chamar onPageChange ao clicar em Anterior', () => {
      const onPageChange = vi.fn();
      render(<Pagination {...defaultProps} currentPage={5} onPageChange={onPageChange} />);

      fireEvent.click(screen.getByRole('button', { name: /anterior/i }));

      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('deve chamar onPageChange ao clicar em Proxima', () => {
      const onPageChange = vi.fn();
      render(<Pagination {...defaultProps} currentPage={5} onPageChange={onPageChange} />);

      fireEvent.click(screen.getByRole('button', { name: /próxima/i }));

      expect(onPageChange).toHaveBeenCalledWith(6);
    });

    it('deve chamar onPageChange ao clicar em numero de pagina', () => {
      const onPageChange = vi.fn();
      render(<Pagination {...defaultProps} currentPage={1} onPageChange={onPageChange} />);

      // Clicar no numero 3
      const buttons = screen.getAllByRole('button');
      const pageButton = buttons.find(b => b.textContent === '3');
      if (pageButton) {
        fireEvent.click(pageButton);
        expect(onPageChange).toHaveBeenCalledWith(3);
      }
    });
  });

  describe('Calculo de Itens', () => {
    it('deve mostrar range correto para primeira pagina', () => {
      render(<Pagination {...defaultProps} currentPage={1} />);

      // Verifica que o texto do contador contem os numeros corretos
      const counterText = screen.getByText(/Mostrando/).parentElement?.textContent;
      expect(counterText).toContain('1');
      expect(counterText).toContain('10');
      expect(counterText).toContain('100');
    });

    it('deve mostrar range correto para pagina intermediaria', () => {
      render(
        <Pagination
          {...defaultProps}
          currentPage={3}
          itemsPerPage={10}
          totalItems={100}
        />
      );

      // Pagina 3: itens 21-30
      const counterText = screen.getByText(/Mostrando/).parentElement?.textContent;
      expect(counterText).toContain('21');
      expect(counterText).toContain('30');
    });

    it('deve mostrar range correto para ultima pagina incompleta', () => {
      render(
        <Pagination
          {...defaultProps}
          currentPage={5}
          totalPages={5}
          itemsPerPage={10}
          totalItems={45}
        />
      );

      // Pagina 5: itens 41-45
      const counterText = screen.getByText(/Mostrando/).parentElement?.textContent;
      expect(counterText).toContain('41');
      expect(counterText).toContain('45');
    });
  });

  describe('Numeros de Pagina', () => {
    it('deve mostrar todas as paginas quando totalPages <= 7', () => {
      render(<Pagination {...defaultProps} totalPages={5} totalItems={50} />);

      // Verifica que existem botoes para cada pagina
      const buttons = screen.getAllByRole('button');
      // Deve ter: Anterior, paginas 1-5, Proxima = 7 botoes
      const pageButtons = buttons.filter(b => !b.textContent?.includes('Anterior') && !b.textContent?.includes('Próxima'));
      expect(pageButtons.length).toBe(5);
    });

    it('deve mostrar elipses quando totalPages > 7 e pagina no inicio', () => {
      render(<Pagination {...defaultProps} currentPage={2} totalPages={20} totalItems={200} />);

      // Deve ter "..."
      expect(screen.getByText('...')).toBeInTheDocument();
    });

    it('deve mostrar elipses no inicio quando pagina no final', () => {
      render(<Pagination {...defaultProps} currentPage={19} totalPages={20} totalItems={200} />);

      expect(screen.getByText('...')).toBeInTheDocument();
    });

    it('deve mostrar elipses em ambos lados quando pagina no meio', () => {
      render(<Pagination {...defaultProps} currentPage={10} totalPages={20} totalItems={200} />);

      // Deve ter dois "..."
      const ellipses = screen.getAllByText('...');
      expect(ellipses).toHaveLength(2);
    });

    it('deve destacar pagina atual', () => {
      render(<Pagination {...defaultProps} currentPage={3} totalPages={5} totalItems={50} />);

      const pageButton = screen.getAllByRole('button').find(b => b.textContent === '3');
      expect(pageButton).toHaveClass('bg-gradient-to-r');
    });
  });

  describe('Validacao de Inputs', () => {
    it('deve tratar totalItems NaN', () => {
      render(
        <Pagination {...defaultProps} totalItems={NaN} />
      );

      // Deve renderizar com valor seguro (0)
      const counterText = screen.getByText(/Mostrando/).parentElement?.textContent;
      expect(counterText).toContain('0');
    });

    it('deve tratar currentPage invalido', () => {
      render(<Pagination {...defaultProps} currentPage={-1} />);

      // Deve usar valor seguro (1)
      const anteriorBtn = screen.getByRole('button', { name: /anterior/i });
      expect(anteriorBtn).toBeDisabled();
    });

    it('deve tratar itemsPerPage = 0', () => {
      render(<Pagination {...defaultProps} itemsPerPage={0} totalItems={10} />);

      // Nao deve quebrar
      expect(screen.getByText(/Mostrando/)).toBeInTheDocument();
    });

    it('deve tratar totalPages = 0', () => {
      const { container } = render(
        <Pagination {...defaultProps} totalPages={0} />
      );

      // Nao deve renderizar nada (totalPages <= 1)
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Acessibilidade', () => {
    it('botoes devem ter labels descritivos', () => {
      render(<Pagination {...defaultProps} />);

      expect(screen.getByRole('button', { name: /anterior/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /próxima/i })).toBeInTheDocument();
    });

    it('botoes desabilitados devem ter cursor-not-allowed', () => {
      render(<Pagination {...defaultProps} currentPage={1} />);

      const anteriorBtn = screen.getByRole('button', { name: /anterior/i });
      expect(anteriorBtn).toHaveClass('disabled:cursor-not-allowed');
    });
  });
});
