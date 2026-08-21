import Link from 'next/link';
import type { ClippingAcordao } from '@/lib/email-templates/daily-clipping';

interface ClippingArchiveDetailProps {
  referenceDate: Date;
  acordaos: ClippingAcordao[];
  missingIds: string[];
  backHref?: string;
  showSiteHeader?: boolean;
}

/**
 * `dataSessao` é data de calendário gravada à meia-noite UTC, e formatá-la em
 * `America/Sao_Paulo` (UTC-3) devolvia 21h do dia anterior: um acórdão julgado
 * em 19/08 aparecia como 18/08. `referenceDate` chega às 03:00 UTC (00:00 de
 * Brasília, ver `startOfBrasiliaDay`) e cai no mesmo dia nos dois fusos.
 */
function fmtDate(d: Date | null): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function AcordaoBlock({ a }: { a: ClippingAcordao }) {
  const dataStr = fmtDate(a.dataSessao);
  const meta = [a.relator ? `Relator: ${a.relator}` : null, dataStr ? `Sessão: ${dataStr}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <article className="border-b border-slate-200 pb-6 mb-6 last:border-b-0 last:mb-0 last:pb-0">
      <h2 className="text-lg font-bold text-slate-900 mb-1">
        Acórdão {a.numeroAcordao} — {a.colegiado || 'TCU'}
      </h2>
      {meta ? <p className="text-xs text-slate-500 mb-3">{meta}</p> : null}
      {a.ementa ? (
        <>
          <p className="text-sm font-semibold text-slate-900 mt-3 mb-1">Ementa (sumário oficial):</p>
          <p className="text-sm text-slate-700 italic leading-relaxed mb-3">{a.ementa}</p>
        </>
      ) : null}
      {a.dispositivos.length > 0 ? (
        <>
          <p className="text-sm font-semibold text-slate-900 mt-3 mb-1">Dispositivos:</p>
          <ul className="list-none pl-0 space-y-2 mb-3">
            {a.dispositivos.map((d, i) => (
              <li key={i} className="text-sm text-slate-800 leading-relaxed">
                <strong className="text-slate-900">{d.numero}.</strong> {d.texto}
              </li>
            ))}
          </ul>
        </>
      ) : a.extractMethod === 'failed' && (!a.aiBullets || a.aiBullets.length === 0) ? (
        <p className="text-xs italic text-slate-400 my-2">
          Dispositivos não pôde ser extraído automaticamente — consulte o inteiro teor.
        </p>
      ) : null}
      {a.aiBullets && a.aiBullets.length > 0 ? (
        <div className="my-3 px-4 py-3 bg-slate-50 border-l-4 border-indigo-500 rounded">
          <p className="text-xs font-semibold tracking-wider text-indigo-600 mb-1">
            CONTEXTO E TESE <span className="font-normal text-slate-400">(síntese editorial)</span>
          </p>
          <ul className="list-disc pl-5 m-0 space-y-1">
            {a.aiBullets.map((b, i) => (
              <li key={i} className="text-sm text-slate-700 leading-relaxed">
                {b}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-sm mt-2 space-x-3">
        {a.linkPdf ? (
          <a
            href={a.linkPdf}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 font-semibold no-underline hover:underline"
          >
            Inteiro teor (PDF) →
          </a>
        ) : null}
        {a.linkInternal ? (
          <a
            href={a.linkInternal}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 no-underline hover:underline"
          >
            Ver no site
          </a>
        ) : null}
      </p>
    </article>
  );
}

export function ClippingArchiveDetail({
  referenceDate,
  acordaos,
  missingIds,
  backHref,
  showSiteHeader,
}: ClippingArchiveDetailProps) {
  const dataRef = fmtDate(referenceDate);
  const count = acordaos.length;
  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm overflow-hidden">
        <header className="bg-gradient-to-br from-slate-900 to-blue-900 px-8 py-7 text-slate-50">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">
            {showSiteHeader ? 'Prof. Daniel Barral' : 'Arquivo do Clipping'}
          </p>
          <h1 className="text-2xl font-bold text-white m-0">Clipping TCU</h1>
          <p className="text-sm text-slate-300 mt-1">
            Decisões publicadas em {dataRef} · {count} {count === 1 ? 'destaque' : 'destaques'}
          </p>
        </header>
        <div className="px-8 py-7">
          {backHref ? (
            <p className="mb-4">
              <Link href={backHref} className="text-sm text-blue-700 no-underline hover:underline">
                ← Voltar ao arquivo
              </Link>
            </p>
          ) : null}
          {acordaos.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Nenhum acórdão neste envio.</p>
          ) : (
            acordaos.map((a) => <AcordaoBlock key={a.documentId} a={a} />)
          )}
          {missingIds.length > 0 ? (
            <p className="text-xs text-slate-400 italic mt-6">
              {missingIds.length}{' '}
              {missingIds.length === 1 ? 'acórdão indisponível' : 'acórdãos indisponíveis'} (removidos da
              base após o envio).
            </p>
          ) : null}
        </div>
        <footer className="bg-slate-50 px-8 py-4 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500 m-0">
            Prof. Daniel Barral · profdanielbarral.com
          </p>
        </footer>
      </div>
    </div>
  );
}
