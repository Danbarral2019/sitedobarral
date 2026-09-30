import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { alteracoesDoTexto } from '@/lib/legislacao/versoes';
import { resumoDaComparacao, type Alteracao, type Trecho } from '@/lib/legislacao/comparar-textos';
import { dataEmBrasilia } from '@/lib/legislacao/cabecalho';

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Alterações exibidas por versão; o restante fica resumido na contagem. */
const MAX_POR_VERSAO = 60;

const ROTULO_DO_TIPO: Record<Alteracao['tipo'], string> = {
  alterado: 'Nova redação',
  incluido: 'Incluído',
  suprimido: 'Suprimido',
};

async function buscarAto(id: string) {
  return prisma.legislativeAct.findUnique({
    where: { id },
    select: { id: true, fullNumber: true, content: true },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const act = await buscarAto(id);
  return { title: act ? `Alterações do texto: ${act.fullNumber}` : 'Ato normativo não encontrado' };
}

function Trechos({ trechos }: { trechos: Trecho[] }) {
  return (
    <>
      {trechos.map((t, i) => {
        const espaco = i > 0 ? ' ' : '';
        if (t.tipo === 'igual') return <span key={i}>{espaco}{t.texto}</span>;
        if (t.tipo === 'incluido') {
          return (
            <span key={i}>
              {espaco}
              <ins className="texto-incluido">
                <span className="sr-only">[incluído:] </span>
                {t.texto}
              </ins>
            </span>
          );
        }
        return (
          <span key={i}>
            {espaco}
            <del className="texto-suprimido">
              <span className="sr-only">[suprimido:] </span>
              {t.texto}
            </del>
          </span>
        );
      })}
    </>
  );
}

function ItemDeAlteracao({ alteracao, actId }: { alteracao: Alteracao; actId: string }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs mb-2">
        <span className="font-semibold uppercase tracking-wide text-ink-muted">{ROTULO_DO_TIPO[alteracao.tipo]}</span>
        {alteracao.artigo && (
          <Link
            href={`/legislacao/${actId}#${alteracao.artigo.id}`}
            className="text-brand-700 underline underline-offset-2 hover:text-brand-600"
          >
            {alteracao.artigo.rotulo.replace(/^art\./, 'Art.')}
          </Link>
        )}
      </p>
      <p className="font-reading text-ink-secondary max-w-[70ch] leading-relaxed">
        {alteracao.tipo === 'alterado' && <Trechos trechos={alteracao.trechos} />}
        {alteracao.tipo === 'incluido' && (
          <ins className="texto-incluido">
            <span className="sr-only">[incluído:] </span>
            {alteracao.depois}
          </ins>
        )}
        {alteracao.tipo === 'suprimido' && (
          <del className="texto-suprimido">
            <span className="sr-only">[suprimido:] </span>
            {alteracao.antes}
          </del>
        )}
      </p>
    </li>
  );
}

export default async function AlteracoesDoTextoPage({ params }: PageProps) {
  const { id } = await params;
  const act = await buscarAto(id);
  if (!act) notFound();

  const alteracoes = await alteracoesDoTexto(act.id, act.content);

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href={`/legislacao/${act.id}`}
          className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Voltar para o {act.fullNumber}
        </Link>

        <header className="mb-8">
          <p className="text-sm font-medium text-ink-muted">{act.fullNumber}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">Alterações do texto</h1>
          <p className="text-ink-secondary mt-3 max-w-[65ch]">
            O texto de cada ato é conferido na fonte oficial toda semana. Quando muda, a versão anterior fica
            guardada e aparece aqui comparada com a seguinte, dispositivo a dispositivo.
          </p>
          <p className="text-sm text-ink-muted mt-3 flex flex-wrap gap-x-5 gap-y-1" aria-hidden="true">
            <span>
              <ins className="texto-incluido">texto incluído</ins>
            </span>
            <span>
              <del className="texto-suprimido">texto suprimido</del>
            </span>
          </p>
        </header>

        {alteracoes.length === 0 ? (
          <p className="bg-white rounded-[6px] border border-border-subtle px-4 py-6 sm:p-8 text-ink-secondary">
            Nenhuma alteração registrada. O histórico do texto passou a ser guardado no fim de setembro de 2026;
            mudanças anteriores não ficaram registradas.
          </p>
        ) : (
          <ol className="space-y-6">
            {alteracoes.map((a) => {
              const { comparacao } = a;
              const exibidas = comparacao.alteracoes.slice(0, MAX_POR_VERSAO);
              const restantes = comparacao.alteracoes.length - exibidas.length;
              return (
                <li
                  key={a.versaoId}
                  id={`versao-${a.versaoId}`}
                  className="bg-white rounded-[6px] border border-border-subtle px-4 py-6 sm:p-8 scroll-mt-6"
                >
                  <h2 className="text-lg font-semibold text-ink-primary">{dataEmBrasilia(a.em)}</h2>
                  <p className="text-sm text-ink-muted mt-1">
                    {resumoDaComparacao(comparacao)}
                    {a.textoDesde && <> · texto anterior no site desde {dataEmBrasilia(a.textoDesde)}</>}
                  </p>
                  {comparacao.soFormatacao ? (
                    <p className="text-sm text-ink-secondary mt-4 max-w-[65ch]">
                      A fonte oficial mudou espaços, marcação ou a divisão dos parágrafos. Nenhuma palavra do texto
                      mudou.
                    </p>
                  ) : (
                    <ul className="mt-5 divide-y divide-border-subtle">
                      {exibidas.map((alteracao, i) => (
                        <ItemDeAlteracao key={i} alteracao={alteracao} actId={act.id} />
                      ))}
                    </ul>
                  )}
                  {restantes > 0 && (
                    <p className="text-sm text-ink-muted mt-4">
                      Mais {restantes} {restantes === 1 ? 'alteração' : 'alterações'} nesta versão não
                      {restantes === 1 ? ' exibida' : ' exibidas'}. O texto atual está na{' '}
                      <Link href={`/legislacao/${act.id}`} className="underline underline-offset-2">
                        página do ato
                      </Link>
                      .
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
