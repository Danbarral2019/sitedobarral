import Link from 'next/link';
import { Search, ArrowUpDown } from 'lucide-react';

export type FilterPills = {
  /** Label do grupo (ex: "Tipo", "Vigência") */
  label: string;
  /** Querystring key (ex: "tipo", "vigencia") */
  param: string;
  /** Opções como tuplas [value, label]. value vazio = "Todos". */
  options: ReadonlyArray<{ value: string; label: string; tone?: 'neutral' | 'red' | 'amber' | 'green' }>;
  /** Valor atualmente selecionado (vazio = nenhum) */
  current: string;
};

export type SortOption = {
  value: string;
  label: string;
};

export interface ListFiltersProps {
  /** Base URL da página (ex: '/legislacao') */
  basePath: string;
  /** Estado completo dos searchParams atuais — pra preservar ao navegar */
  searchParams: Record<string, string | undefined>;
  /** Texto de busca atual (controla input) */
  searchQuery: string;
  /** Placeholder do input de busca */
  searchPlaceholder?: string;
  /** Pílulas de filtro */
  pills: ReadonlyArray<FilterPills>;
  /** Opções de ordenação. Param fixo é "ordem" (ou customize) */
  sortOptions?: ReadonlyArray<SortOption>;
  /** Param key da ordenação (default 'ordem') */
  sortParam?: string;
  /** Valor atual de ordenação */
  currentSort?: string;
  /** Total de resultados pra mostrar contagem */
  totalResults?: number;
  /** Mostra botão Limpar quando há ao menos um filtro ativo */
  hasAnyActive: boolean;
}

/**
 * Constrói URL preservando params atuais e aplicando mudanças.
 * Sempre reseta `page` quando muda algum filtro.
 */
function buildUrl(
  basePath: string,
  current: Record<string, string | undefined>,
  changes: Record<string, string | undefined>,
): string {
  const merged: Record<string, string | undefined> = { ...current, ...changes, page: undefined };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (typeof v === 'string' && v.length > 0) params.set(k, v);
  }
  const qs = params.toString();
  return `${basePath}${qs ? `?${qs}` : ''}`;
}

const TONE_ACTIVE: Record<NonNullable<FilterPills['options'][number]['tone']>, string> = {
  neutral: 'bg-brand-600 text-white',
  red: 'bg-red-600 text-white',
  amber: 'bg-amber-600 text-white',
  green: 'bg-green-600 text-white',
};

/**
 * Componente de filtros + busca + ordenação reusável pra páginas de listagem.
 *
 * Server Component (sem state). Toda interação navega via Link com querystring.
 * Filtros são aplicados via SQL no server (responsabilidade da página chamadora).
 */
export function ListFilters({
  basePath,
  searchParams,
  searchQuery,
  searchPlaceholder = 'Buscar...',
  pills,
  sortOptions,
  sortParam = 'ordem',
  currentSort,
  totalResults,
  hasAnyActive,
}: ListFiltersProps) {
  return (
    <div className="space-y-4 mb-6">
      {/* Busca */}
      <form method="get" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder={searchPlaceholder}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base font-poppins"
            aria-label="Buscar"
          />
        </div>
        {/* Preserva todos os filtros ativos como hidden inputs */}
        {Object.entries(searchParams).map(([k, v]) =>
          k !== 'q' && k !== 'page' && v ? (
            <input key={k} type="hidden" name={k} value={v} />
          ) : null,
        )}
      </form>

      {/* Pílulas */}
      {pills.map((p) => (
        <div key={p.param} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600 font-medium mr-1 min-w-[70px]">{p.label}:</span>
          <Link
            href={buildUrl(basePath, searchParams, { [p.param]: undefined })}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              !p.current
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:border-brand-400'
            }`}
          >
            Todos
          </Link>
          {p.options.map((opt) => {
            const isActive = p.current === opt.value;
            const activeClass = isActive ? TONE_ACTIVE[opt.tone ?? 'neutral'] : 'bg-white border border-gray-300 text-gray-700 hover:border-brand-400';
            return (
              <Link
                key={opt.value}
                href={buildUrl(basePath, searchParams, { [p.param]: opt.value })}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${activeClass}`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      ))}

      {/* Ordenação + contagem + limpar */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {sortOptions && sortOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 font-medium">Ordenar:</span>
            <div className="flex flex-wrap gap-1">
              {sortOptions.map((o) => (
                <Link
                  key={o.value}
                  href={buildUrl(basePath, searchParams, { [sortParam]: o.value === sortOptions[0].value ? undefined : o.value })}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    (currentSort || sortOptions[0].value) === o.value
                      ? 'bg-gray-800 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {o.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {typeof totalResults === 'number' && (
          <span className="text-sm text-gray-500 ml-auto">
            {totalResults.toLocaleString('pt-BR')} {totalResults === 1 ? 'resultado' : 'resultados'}
          </span>
        )}

        {hasAnyActive && (
          <Link
            href={basePath}
            className="text-xs font-medium text-gray-500 hover:text-brand-700 underline"
          >
            Limpar filtros
          </Link>
        )}
      </div>
    </div>
  );
}
