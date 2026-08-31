import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FilaDeRedacao } from '../FilaDeRedacao';
import type { ArtigoNaFila } from '@/lib/lei-14133/fila-redacao';

const art = (
  numero: string,
  documentCount: number,
  professorComment: string | null = null,
): ArtigoNaFila => ({
  numero,
  documentCount,
  professorComment,
  ementa: `Ementa do artigo ${numero}`,
});

function montar(artigos: ArtigoNaFila[], onSelecionar = vi.fn()) {
  render(
    <FilaDeRedacao artigos={artigos} numeroSelecionado={null} onSelecionar={onSelecionar} />,
  );
  return { onSelecionar };
}

describe('FilaDeRedacao', () => {
  it('mostra quantos artigos já foram comentados', () => {
    montar([art('75', 195, 'pronto'), art('40', 20), art('1', 3)]);
    expect(screen.getByText(/de 3 artigos comentados/)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('expõe o progresso de forma acessível', () => {
    montar([art('75', 195, 'pronto'), art('40', 20)]);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('lista os pendentes com os mais citados primeiro', () => {
    const { container } = render(
      <FilaDeRedacao
        artigos={[art('1', 3), art('75', 195), art('40', 20)]}
        numeroSelecionado={null}
        onSelecionar={vi.fn()}
      />,
    );
    // O rótulo do artigo é o único elemento em fonte mono da linha; ler o
    // textContent do botão inteiro grudaria a contagem de documentos ao número.
    const numeros = [...container.querySelectorAll('.font-mono-tech')].map((e) =>
      e.textContent?.replace('art. ', '').trim(),
    );
    expect(numeros).toEqual(['75', '40', '1']);
  });

  it('esconde os já comentados até que se peça para mostrar', () => {
    montar([art('75', 195, 'pronto'), art('40', 20)]);
    expect(screen.queryByText(/art\. 75/)).toBeNull();

    fireEvent.click(screen.getByLabelText(/Mostrar os já comentados/i));
    expect(screen.getByText(/art\. 75/)).toBeInTheDocument();
  });

  it('marca visualmente o que está pendente e o que está feito', () => {
    montar([art('75', 195, 'pronto'), art('40', 20)]);
    fireEvent.click(screen.getByLabelText(/Mostrar os já comentados/i));

    expect(screen.getByLabelText('comentado')).toBeInTheDocument();
    expect(screen.getByLabelText('pendente')).toBeInTheDocument();
  });

  it('avisa quando não há mais nada a comentar', () => {
    montar([art('75', 195, 'pronto')]);
    expect(screen.getByText(/Todos os artigos já têm comentário/)).toBeInTheDocument();
  });

  it('chama a seleção com o número do artigo clicado', () => {
    const { onSelecionar } = montar([art('40', 20)]);
    fireEvent.click(screen.getByText(/art\. 40/).closest('button')!);
    expect(onSelecionar).toHaveBeenCalledWith('40');
  });

  it('mostra a contagem de documentos que citam o artigo', () => {
    montar([art('75', 195)]);
    const item = screen.getByText(/art\. 75/).closest('button')!;
    expect(within(item).getByText('195')).toBeInTheDocument();
  });
});
