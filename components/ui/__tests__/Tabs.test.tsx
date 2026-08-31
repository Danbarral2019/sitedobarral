/**
 * Testes para componente Tabs
 *
 * Testa navegacao entre abas e estado.
 */

/// <reference types="@testing-library/jest-dom/vitest" />

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs, TabList, Tab, TabPanel } from '../Tabs';

describe('Tabs Component', () => {
  describe('Renderizacao Basica', () => {
    it('deve renderizar tabs corretamente', () => {
      render(
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      );

      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
    });

    it('deve mostrar conteudo da tab padrao', () => {
      render(
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    it('deve aplicar className ao container', () => {
      const { container } = render(
        <Tabs defaultTab="tab1" className="custom-tabs">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
          </TabList>
          <TabPanel id="tab1">Content</TabPanel>
        </Tabs>
      );

      expect(container.firstChild).toHaveClass('custom-tabs');
    });
  });

  describe('Navegacao entre Tabs', () => {
    it('deve trocar conteudo ao clicar em outra tab', () => {
      render(
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      );

      // Inicialmente mostra Content 1
      expect(screen.getByText('Content 1')).toBeInTheDocument();

      // Clicar na Tab 2
      fireEvent.click(screen.getByText('Tab 2'));

      // Agora mostra Content 2
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });

    it('deve atualizar estilo da tab ativa', () => {
      render(
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
        </Tabs>
      );

      const tab1 = screen.getByText('Tab 1');
      const tab2 = screen.getByText('Tab 2');

      // Tab 1 deve estar ativa
      expect(tab1).toHaveClass('border-brand-600');
      expect(tab2).toHaveClass('border-transparent');

      // Clicar na Tab 2
      fireEvent.click(tab2);

      // Tab 2 deve estar ativa agora
      expect(tab1).toHaveClass('border-transparent');
      expect(tab2).toHaveClass('border-brand-600');
    });
  });

  describe('Tab com Icon', () => {
    it('deve renderizar icone na tab', () => {
      render(
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1" icon={<span data-testid="icon">Icon</span>}>
              Tab 1
            </Tab>
          </TabList>
          <TabPanel id="tab1">Content</TabPanel>
        </Tabs>
      );

      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });
  });

  describe('Tab com Badge', () => {
    it('deve renderizar badge quando valor > 0', () => {
      render(
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1" badge={5}>Tab 1</Tab>
          </TabList>
          <TabPanel id="tab1">Content</TabPanel>
        </Tabs>
      );

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('nao deve renderizar badge quando valor = 0', () => {
      render(
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1" badge={0}>Tab 1</Tab>
          </TabList>
          <TabPanel id="tab1">Content</TabPanel>
        </Tabs>
      );

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('nao deve renderizar badge quando undefined', () => {
      render(
        <Tabs defaultTab="tab1">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
          </TabList>
          <TabPanel id="tab1">Content</TabPanel>
        </Tabs>
      );

      // Nao deve ter span de badge
      const tab = screen.getByText('Tab 1');
      expect(tab.querySelector('.bg-red-500')).not.toBeInTheDocument();
    });
  });

  describe('TabList', () => {
    it('deve aplicar className customizado', () => {
      render(
        <Tabs defaultTab="tab1">
          <TabList className="custom-list">
            <Tab id="tab1">Tab 1</Tab>
          </TabList>
          <TabPanel id="tab1">Content</TabPanel>
        </Tabs>
      );

      expect(screen.getByText('Tab 1').parentElement).toHaveClass('custom-list');
    });
  });

  describe('Erros de Contexto', () => {
    it('Tab deve lancar erro quando usado fora de Tabs', () => {
      // Suprimir erro esperado no console
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<Tab id="tab1">Tab</Tab>);
      }).toThrow('Tab must be used within Tabs');

      consoleSpy.mockRestore();
    });

    it('TabPanel deve lancar erro quando usado fora de Tabs', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TabPanel id="tab1">Content</TabPanel>);
      }).toThrow('TabPanel must be used within Tabs');

      consoleSpy.mockRestore();
    });
  });

  describe('Multiplas Tabs', () => {
    it('deve funcionar com muitas tabs', () => {
      render(
        <Tabs defaultTab="tab3">
          <TabList>
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
            <Tab id="tab3">Tab 3</Tab>
            <Tab id="tab4">Tab 4</Tab>
            <Tab id="tab5">Tab 5</Tab>
          </TabList>
          <TabPanel id="tab1">Content 1</TabPanel>
          <TabPanel id="tab2">Content 2</TabPanel>
          <TabPanel id="tab3">Content 3</TabPanel>
          <TabPanel id="tab4">Content 4</TabPanel>
          <TabPanel id="tab5">Content 5</TabPanel>
        </Tabs>
      );

      // Deve mostrar Content 3 (defaultTab)
      expect(screen.getByText('Content 3')).toBeInTheDocument();

      // Clicar na Tab 5
      fireEvent.click(screen.getByText('Tab 5'));
      expect(screen.getByText('Content 5')).toBeInTheDocument();

      // Voltar para Tab 1
      fireEvent.click(screen.getByText('Tab 1'));
      expect(screen.getByText('Content 1')).toBeInTheDocument();
    });
  });
});
