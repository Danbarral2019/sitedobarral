import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import {
  formatSentDateParam,
  listArchiveEntries,
  searchArchive,
  userIsEligibleForClipping,
} from '@/lib/clipping/archive';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clipping TCU — Arquivo' };

interface PageProps {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

function fmtDateLong(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

export default async function ClippingArchivePage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) redirect('/login?next=/area-restrita/clipping');
  const payload = await verifyToken(token);
  if (!payload) redirect('/login?next=/area-restrita/clipping');

  const eligible = await userIsEligibleForClipping(payload.userId);
  if (!eligible) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <h1 className="text-2xl font-bold text-ink-primary mb-3">Clipping TCU — Arquivo</h1>
        <div className="bg-amber-accent-soft border border-amber-accent-soft rounded-md p-4 text-sm text-ink-primary">
          O arquivo de clippings é exclusivo para alunos com matrícula ou assinatura ativa. Se você
          acha que isso é um engano, escreva para{' '}
          <a href="mailto:contato@profdanielbarral.com" className="underline">
            contato@profdanielbarral.com
          </a>
          .
        </div>
      </div>
    );
  }

  const { q, offset: offsetStr } = await searchParams;
  const query = (q || '').trim();
  const offset = Math.max(parseInt(offsetStr || '0', 10) || 0, 0);
  const pageSize = 30;

  const [searchHits, list] = await Promise.all([
    query.length >= 2 ? searchArchive(query, 50) : Promise.resolve([]),
    query.length >= 2 ? Promise.resolve(null) : listArchiveEntries({ limit: pageSize, offset }),
  ]);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-ink-primary mb-2">Clipping TCU — Arquivo</h1>
      <p className="text-sm text-ink-muted mb-5">
        Releia clippings diários enviados anteriormente. Os trechos são extraídos do inteiro teor
        dos acórdãos.
      </p>

      <form method="get" action="/area-restrita/clipping" className="mb-6">
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Buscar por número do acórdão ou palavra na ementa…"
            className="flex-1 border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            className="bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-brand-800"
          >
            Buscar
          </button>
          {query ? (
            <Link
              href="/area-restrita/clipping"
              className="text-sm text-ink-muted self-center px-2 hover:underline"
            >
              limpar
            </Link>
          ) : null}
        </div>
      </form>

      {query.length >= 2 ? (
        <section>
          <p className="text-xs text-ink-muted mb-3">
            {searchHits.length === 0
              ? `Nenhum resultado para "${query}".`
              : `${searchHits.length} ${searchHits.length === 1 ? 'envio' : 'envios'} contém "${query}":`}
          </p>
          <ul className="space-y-3">
            {searchHits.map((hit) => {
              const dateParam = formatSentDateParam(hit.sentDate);
              return (
                <li key={dateParam} className="bg-white border border-border-subtle rounded-md p-4">
                  <Link
                    href={`/area-restrita/clipping/${dateParam}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    {fmtDateLong(hit.sentDate)}
                  </Link>
                  <p className="text-xs text-ink-muted mt-1">
                    {hit.acordaoCount} {hit.acordaoCount === 1 ? 'acórdão' : 'acórdãos'} no envio · matched:{' '}
                    {hit.matchedNumeros.slice(0, 3).join(', ')}
                  </p>
                  {hit.snippet ? (
                    <p className="text-sm text-ink-muted mt-2 line-clamp-2">{hit.snippet}…</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section>
          {list && list.entries.length === 0 ? (
            <p className="text-sm text-ink-muted italic">Nenhum clipping enviado ainda.</p>
          ) : (
            <ul className="space-y-3">
              {list?.entries.map((e) => {
                const dateParam = formatSentDateParam(e.sentDate);
                return (
                  <li key={dateParam} className="bg-white border border-border-subtle rounded-md p-4">
                    <Link
                      href={`/area-restrita/clipping/${dateParam}`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      {fmtDateLong(e.sentDate)}
                    </Link>
                    <p className="text-xs text-ink-muted mt-1">
                      {e.acordaoCount} {e.acordaoCount === 1 ? 'acórdão' : 'acórdãos'}
                      {e.totalSent != null ? ` · enviado a ${e.totalSent}` : ''}
                    </p>
                    {e.preview && e.preview !== '(sem preview)' ? (
                      <p className="text-sm text-ink-muted mt-2 line-clamp-2">{e.preview}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {list && list.total > pageSize ? (
            <nav className="flex justify-between mt-6 text-sm">
              {offset > 0 ? (
                <Link
                  href={`/area-restrita/clipping?offset=${Math.max(offset - pageSize, 0)}`}
                  className="text-brand-700 hover:underline"
                >
                  ← Mais recentes
                </Link>
              ) : (
                <span />
              )}
              {offset + pageSize < list.total ? (
                <Link
                  href={`/area-restrita/clipping?offset=${offset + pageSize}`}
                  className="text-brand-700 hover:underline"
                >
                  Mais antigos →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      )}
    </div>
  );
}
