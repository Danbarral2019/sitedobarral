import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Lock } from 'lucide-react';
import CartaoTese from '@/components/teses/CartaoTese';
import { buscarPorChave, type DetalheAcordao } from '@/lib/teses/consultas';
import { resolverAcessoDoDetalhe } from './acesso';

/**
 * A página do acórdão-líder, uma só para toda audiência (spec §8.1).
 *
 * A profundidade varia conforme o acesso: o visitante vê as teses da vitrine e
 * uma chamada para as demais; quem tem acesso ativo vê todas. Duplicar a página
 * separaria por audiência o mesmo conteúdo e dobraria a superfície onde a regra
 * de exibição do colegiado pode divergir.
 */
async function carregar(chave: string): Promise<DetalheAcordao | null> {
  const comAcessoAtivo = await resolverAcessoDoDetalhe();
  return buscarPorChave(chave, comAcessoAtivo);
}

export async function generateMetadata({ params }: { params: Promise<{ chave: string }> }): Promise<Metadata> {
  const { chave } = await params;
  const d = await carregar(chave);

  if (!d) return { title: 'Acórdão não encontrado' };

  const titulo = `Acórdão ${d.numeroAlvo}/${d.anoAlvo} — ${d.assunto}`;

  // Sem tese visível, a página existe mas não é indexada (spec §5): a URL já
  // foi indexada e virar 404 quebraria o que o buscador conhece, enquanto
  // mantê-la no índice ofereceria ao leitor uma página sem conteúdo.
  if (d.teses.length === 0) {
    return { title: titulo, robots: { index: false } };
  }

  return {
    title: titulo,
    description: d.teses[0].enunciado,
  };
}

export default async function AcordaoLiderPage({ params }: { params: Promise<{ chave: string }> }) {
  const { chave } = await params;
  const d = await carregar(chave);

  // Só a chave inexistente dá 404. "Sem tese visível" é caso de noindex, não
  // de erro — a página segue de pé para quem chegar por link antigo.
  if (!d) notFound();

  const colegiado =
    d.nivel === 'oficial'
      ? d.colegiadoAlvo
      : d.nivel === 'convergencia'
        ? `${d.colegiadoAlvo}, segundo os votos de ${d.citantesConcordantes} acórdãos citantes que o informam`
        : 'Colegiado não identificado';

  return (
    <main className="min-h-screen bg-brand-50">
      <div className="bg-brand-600 text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <Link
            href="/teses"
            className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Teses do TCU
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {`Acórdão ${d.numeroAlvo}/${d.anoAlvo}`}
          </h1>
          <p className="text-lg text-white/90 mb-4">{d.assunto}</p>
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap text-sm text-white/80">
            {colegiado && <span>{colegiado}</span>}
            {d.relatorAlvo && <span>{`Relator: ${d.relatorAlvo}`}</span>}
            <span>{`${d.citacoesNoVoto} citações no voto`}</span>
            {d.urlAlvo && (
              <a
                href={d.urlAlvo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline hover:text-white transition-colors"
              >
                Inteiro teor
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {d.teses.length === 0 ? (
          <p className="text-ink-muted text-center py-12">
            Nenhuma tese deste precedente está publicada no momento.
          </p>
        ) : (
          <div className="space-y-6">
            {d.teses.map((tese) => (
              <CartaoTese key={tese.enunciadoId} tese={tese} />
            ))}
          </div>
        )}

        {d.tesesReservadas > 0 && (
          <div className="mt-8 bg-white rounded-[6px] border border-border-subtle p-6 text-center">
            <div className="inline-flex p-2 rounded-[6px] bg-brand-50 text-brand-600 mb-3">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-ink-primary">
              {d.tesesReservadas === 1
                ? 'Mais uma tese deste precedente está no acervo restrito.'
                : `Mais ${d.tesesReservadas} teses deste precedente estão no acervo restrito.`}
            </p>
            <Link
              href="/planos"
              className="inline-block mt-4 px-4 py-2 rounded-[6px] bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors"
            >
              Conhecer os planos
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
