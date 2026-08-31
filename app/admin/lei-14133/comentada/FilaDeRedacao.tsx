'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, FileText } from 'lucide-react';
import {
  ordenarFila,
  calcularProgresso,
  temComentario,
  type ArtigoNaFila,
} from '@/lib/lei-14133/fila-redacao';

interface Props {
  artigos: ArtigoNaFila[];
  numeroSelecionado: string | null;
  onSelecionar: (numero: string) => void;
}

/**
 * Fila de redação: por onde começar e onde parou.
 *
 * A árvore da lei ao lado serve para achar um artigo específico. Esta lista
 * serve para o trabalho contínuo de comentar: mostra o que falta, na ordem em
 * que rende mais, e quanto já foi feito.
 */
export function FilaDeRedacao({ artigos, numeroSelecionado, onSelecionar }: Props) {
  const [incluirComentados, setIncluirComentados] = useState(false);

  const progresso = useMemo(() => calcularProgresso(artigos), [artigos]);
  const fila = useMemo(
    () => ordenarFila(artigos, { incluirComentados }),
    [artigos, incluirComentados],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border-subtle">
        <h2 className="text-lg font-bold text-ink-primary">Fila de redação</h2>

        <p className="text-sm text-ink-muted mt-1">
          <strong className="text-ink-primary">{progresso.comentados}</strong> de{' '}
          {progresso.total} artigos comentados
        </p>

        <div
          className="mt-2 h-1.5 w-full rounded-[3px] bg-surface-deep overflow-hidden"
          role="progressbar"
          aria-valuenow={progresso.percentual}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso da redação dos comentários"
        >
          <div
            className="h-full bg-brand-600 transition-all"
            style={{ width: `${progresso.percentual}%` }}
          />
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={incluirComentados}
            onChange={(e) => setIncluirComentados(e.target.checked)}
            className="rounded-[3px] border-border-strong"
          />
          Mostrar os já comentados
        </label>

        <p className="mt-2 text-xs text-ink-muted">
          Ordenado por quantos documentos do acervo citam cada artigo.
        </p>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-border-subtle">
        {fila.length === 0 && (
          <li className="p-6 text-center text-sm text-ink-muted">
            {progresso.total > 0
              ? 'Todos os artigos já têm comentário.'
              : 'Nenhum artigo carregado.'}
          </li>
        )}

        {fila.map((a) => {
          const feito = temComentario(a);
          const ativo = a.numero === numeroSelecionado;
          return (
            <li key={a.numero}>
              <button
                onClick={() => onSelecionar(a.numero)}
                aria-current={ativo ? 'true' : undefined}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                  ativo ? 'bg-brand-50' : 'hover:bg-surface-raised'
                }`}
              >
                {feito ? (
                  <CheckCircle2
                    className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5"
                    aria-label="comentado"
                  />
                ) : (
                  <Circle
                    className="w-4 h-4 text-ink-muted flex-shrink-0 mt-0.5"
                    aria-label="pendente"
                  />
                )}

                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono-tech text-sm text-ink-primary">
                      art. {a.numero}
                    </span>
                    {a.documentCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        {a.documentCount}
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-ink-secondary line-clamp-2 mt-0.5">
                    {a.ementa}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
