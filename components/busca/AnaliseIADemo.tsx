'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Scale, ArrowRight, FileText } from 'lucide-react';
import { ANALISE_IA_EXEMPLO } from '@/data/analise-ia-exemplo';
import { trechoDeAmostra } from '@/lib/text-preview';
import { formatLine } from '@/components/area-restrita/search-results/search-utils';

/** Quanto da resposta o exemplo mostra antes do corte. */
const LIMITE_AMOSTRA = 700;

interface AnaliseIADemoProps {
  /** Quantos resultados a busca atual devolveu — liga o exemplo à consulta real. */
  totalResultados: number;
}

/**
 * Demonstração da Análise IA para quem ainda não assina.
 *
 * Não responde à pergunta do visitante: mostra, como EXEMPLO, uma resposta
 * real que o assistente produziu para outra pergunta. O rótulo é explícito de
 * propósito — um card com texto fixo, aparentando responder ao que a pessoa
 * acabou de digitar, seria enganoso, e o público aqui é o que confere antes
 * de citar.
 */
export function AnaliseIADemo({ totalResultados }: AnaliseIADemoProps) {
  const [expandido, setExpandido] = useState(false);
  const amostra = trechoDeAmostra(ANALISE_IA_EXEMPLO.resposta, LIMITE_AMOSTRA);
  const texto = expandido ? ANALISE_IA_EXEMPLO.resposta : amostra.trecho;

  return (
    <section className="bg-white rounded-[6px] border-2 border-brand-200 p-8">
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <Sparkles className="w-8 h-8 text-brand-600" />
        <h2 className="text-2xl font-bold text-ink-primary">Análise IA</h2>
        <span className="px-3 py-1 bg-brand-100 text-brand-700 rounded-full text-xs font-bold uppercase tracking-wide">
          Exemplo
        </span>
        <span className="ml-auto text-sm text-ink-muted">disponível na assinatura</span>
      </div>

      <p className="text-sm text-ink-muted mb-5 max-w-3xl">
        Esta <strong>não</strong> é a resposta para a sua busca — é um exemplo real, gerado pelo
        assistente sobre o acervo do site para a pergunta abaixo. Para assinantes, a análise responde
        à pergunta digitada e cita as fontes que usou.
        {totalResultados > 0 && (
          <> Na sua busca atual, ela leria os <strong>{totalResultados} resultados</strong> desta página.</>
        )}
      </p>

      <div className="rounded-[6px] border border-brand-200 bg-brand-50/60 p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-700 mb-1">Pergunta do exemplo</p>
        <p className="text-ink-primary font-semibold mb-5">{ANALISE_IA_EXEMPLO.pergunta}</p>

        {/* Mesmo formatLine do card da área logada: a demonstração precisa
            renderizar igual ao produto, não parecida com ele. */}
        <div className="text-sm text-ink-secondary leading-relaxed">
          {texto.split('\n\n').map((paragrafo, i) => (
            <p key={i} className="mb-3 last:mb-0">
              {paragrafo.split('\n').map((linha, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {formatLine(linha)}
                </Fragment>
              ))}
            </p>
          ))}
        </div>

        {amostra.cortado && (
          <button
            onClick={() => setExpandido(!expandido)}
            className="mt-3 text-brand-700 hover:text-brand-900 text-sm font-semibold transition-colors"
          >
            {expandido ? 'Ver menos' : 'Ver o exemplo completo'}
          </button>
        )}

        <div className="mt-5 pt-4 border-t border-brand-200">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700 mb-3">
            Fontes citadas nesta resposta
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <Link
              href={ANALISE_IA_EXEMPLO.artigoCentral.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-brand-200 rounded-[6px] text-xs font-semibold text-brand-800 hover:border-brand-500 transition-colors"
            >
              <Scale className="w-3.5 h-3.5" />
              {ANALISE_IA_EXEMPLO.artigoCentral.rotulo}
            </Link>
          </div>
          <ul className="space-y-1.5">
            {ANALISE_IA_EXEMPLO.fontes.map(fonte => (
              <li key={fonte.documentoId}>
                <Link
                  href={`/documento/${fonte.documentoId}`}
                  className="inline-flex items-start gap-2 text-sm text-ink-secondary hover:text-brand-700 transition-colors group"
                >
                  <FileText className="w-4 h-4 text-ink-muted group-hover:text-brand-600 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{fonte.titulo}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/planos"
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-[6px] font-bold hover:bg-brand-700 transition-colors"
        >
          Ver os planos
          <ArrowRight className="w-5 h-5" />
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center px-6 py-3 text-ink-secondary border-2 border-border-subtle rounded-[6px] font-bold hover:border-border-strong transition-colors"
        >
          Já sou assinante
        </Link>
      </div>
    </section>
  );
}
