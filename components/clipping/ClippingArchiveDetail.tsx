import Link from 'next/link';
import type { ClippingGroup, ClippingItemRendered } from '@/lib/email-templates/daily-clipping';
import { identificacaoDoJulgado } from '@/lib/email-templates/daily-clipping';
import { getTribunalBrand } from '@/lib/clipping/tribunal-branding';

interface ClippingArchiveDetailProps {
  referenceDate: Date;
  groups: ClippingGroup[];
  missingIds: string[];
  backHref?: string;
  showSiteHeader?: boolean;
}

/**
 * `dataJulgamento` é data de calendário gravada à meia-noite UTC, e formatá-la
 * em `America/Sao_Paulo` (UTC-3) devolvia 21h do dia anterior: um acórdão
 * julgado em 19/08 aparecia como 18/08. `referenceDate` chega às 03:00 UTC
 * (00:00 de Brasília, ver `startOfBrasiliaDay`) e cai no mesmo dia nos dois
 * fusos.
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

/**
 * Espelha `renderItemHtmlV2` do e-mail: mesma identificação do julgado, mesma
 * ordem de blocos. O arquivo web e o e-mail mostram o mesmo conteúdo, e a
 * identificação vem da mesma função — foi a duplicação de leitores desse mesmo
 * campo que deixou este arquivo vazio por três meses.
 */
function ItemBlock({ rendered }: { rendered: ClippingItemRendered }) {
  const { item, aiBullets, dispositivos } = rendered;
  const dataStr = fmtDate(item.dataJulgamento);
  const meta = [
    item.orgaoJulgador,
    item.relator ? `Relator: ${item.relator}` : null,
    dataStr ? `Julgamento: ${dataStr}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="border-b border-border-subtle pb-6 mb-6 last:border-b-0 last:mb-0 last:pb-0">
      <h2 className="text-lg font-bold text-ink-primary mb-1">{identificacaoDoJulgado(item)}</h2>
      {meta ? <p className="text-xs text-ink-muted mb-3">{meta}</p> : null}
      {item.ementa ? (
        <>
          <p className="text-sm font-semibold text-ink-primary mt-3 mb-1">Ementa:</p>
          <p className="text-sm text-ink-secondary italic leading-relaxed mb-3">{item.ementa}</p>
        </>
      ) : null}
      {dispositivos && dispositivos.length > 0 ? (
        <>
          <p className="text-sm font-semibold text-ink-primary mt-3 mb-1">Dispositivos:</p>
          <ul className="list-none pl-0 space-y-2 mb-3">
            {dispositivos.map((d, i) => (
              <li key={i} className="text-sm text-ink-secondary leading-relaxed">
                <strong className="text-ink-primary">{d.numero}.</strong> {d.texto}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {aiBullets && aiBullets.length > 0 ? (
        <div className="my-3 px-4 py-3 bg-surface-raised border-l-4 border-brand-500 rounded">
          <p className="text-xs font-semibold tracking-wider text-brand-600 mb-1">
            CONTEXTO E TESE <span className="font-normal text-ink-muted">(síntese editorial)</span>
          </p>
          <ul className="list-disc pl-5 m-0 space-y-1">
            {aiBullets.map((b, i) => (
              <li key={i} className="text-sm text-ink-secondary leading-relaxed">
                {b}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-sm mt-2 space-x-3">
        {item.linkPdf ? (
          <a
            href={item.linkPdf}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-700 font-semibold no-underline hover:underline"
          >
            Inteiro teor (PDF) →
          </a>
        ) : null}
        {item.linkExternal ? (
          <a
            href={item.linkExternal}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-muted no-underline hover:underline"
          >
            Ver no tribunal
          </a>
        ) : null}
      </p>
    </article>
  );
}

function GroupBlock({ group }: { group: ClippingGroup }) {
  const brand = getTribunalBrand(group.tribunalCode);
  const count = group.items.length;
  return (
    <section className="mb-6 last:mb-0">
      <div
        className="flex items-center justify-between rounded-md px-3.5 py-2.5 mb-4"
        style={{ backgroundColor: brand.color }}
      >
        <span className="text-sm font-bold tracking-wide text-white">{brand.code}</span>
        <span className="text-xs text-white/85">
          {count} {count === 1 ? 'decisão' : 'decisões'}
        </span>
      </div>
      {group.items.map((rendered) => (
        <ItemBlock key={`${rendered.item.sourceKind}:${rendered.item.sourceId}`} rendered={rendered} />
      ))}
    </section>
  );
}

export function ClippingArchiveDetail({
  referenceDate,
  groups,
  missingIds,
  backHref,
  showSiteHeader,
}: ClippingArchiveDetailProps) {
  const dataRef = fmtDate(referenceDate);
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  const tribunais = groups.length;

  return (
    <div className="min-h-screen bg-surface-deep py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-[6px] overflow-hidden border border-border-subtle">
        <header className="bg-brand-900 px-8 py-7 text-ink-muted">
          <p className="text-xs uppercase tracking-widest text-ink-muted mb-1">
            {showSiteHeader ? 'Prof. Daniel Barral' : 'Arquivo do Clipping'}
          </p>
          <h1 className="text-2xl font-bold text-white m-0">Clipping Jurídico</h1>
          <p className="text-sm text-ink-muted mt-1">
            Decisões publicadas em {dataRef} · {count} {count === 1 ? 'destaque' : 'destaques'}
            {tribunais > 1 ? ` · ${tribunais} tribunais` : ''}
          </p>
        </header>
        <div className="px-8 py-7">
          {backHref ? (
            <p className="mb-4">
              <Link href={backHref} className="text-sm text-brand-700 no-underline hover:underline">
                ← Voltar ao arquivo
              </Link>
            </p>
          ) : null}
          {count === 0 ? (
            <p className="text-sm text-ink-muted italic">Nenhuma decisão neste envio.</p>
          ) : (
            groups.map((g) => <GroupBlock key={g.tribunalCode} group={g} />)
          )}
          {missingIds.length > 0 ? (
            <p className="text-xs text-ink-muted italic mt-6">
              {missingIds.length}{' '}
              {missingIds.length === 1 ? 'decisão indisponível' : 'decisões indisponíveis'} (removidas da
              base após o envio).
            </p>
          ) : null}
        </div>
        <footer className="bg-surface-raised px-8 py-4 border-t border-border-subtle text-center">
          <p className="text-xs text-ink-muted m-0">Prof. Daniel Barral · profdanielbarral.com</p>
        </footer>
      </div>
    </div>
  );
}
