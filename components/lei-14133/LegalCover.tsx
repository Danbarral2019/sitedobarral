/**
 * LegalCover — capa imponente da Lei. Fundo brand petróleo escuro com
 * tipografia clara. "Capa preta de livro técnico".
 */

import type { LeiStats } from '@/lib/lei-14133/queries';

interface LegalCoverProps {
  stats: LeiStats;
}

export function LegalCover({ stats }: LegalCoverProps) {
  return (
    <header className="relative bg-brand-800 text-surface-page overflow-hidden">
      {/* Padding generoso, padrão sutil opcional */}
      <div className="px-6 lg:px-10 py-14 md:py-16 relative">
        <p className="font-label text-amber-accent mb-4">
          Texto integral · Edição comentada
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.02] font-semibold mb-2">
          Lei nº 14.133
        </h1>
        <p className="font-serif text-2xl md:text-3xl italic leading-tight mb-8 text-brand-100">
          de 1º de abril de 2021
        </p>
        <p className="font-serif text-base md:text-lg text-brand-100/95 leading-relaxed max-w-2xl mb-8">
          Estabelece normas gerais de licitação e contratação para as Administrações Públicas
          diretas, autárquicas e fundacionais da União, dos Estados, do Distrito Federal e dos
          Municípios.
        </p>

        {/* Stats em uma linha tipográfica */}
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 pt-6 border-t border-brand-500/40">
          <Stat label="artigos" value={stats.totalArtigos} highlight />
          <Stat label="capítulos" value={stats.totalCapitulos} highlight />
          {stats.totalAcordaos > 0 && (
            <Stat label="acórdãos" value={stats.totalAcordaos} amber />
          )}
          {stats.totalPareceresOns > 0 && (
            <Stat label="pareceres/ONs" value={stats.totalPareceresOns} amber />
          )}
        </div>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  highlight,
  amber,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  amber?: boolean;
}) {
  const valueColor = amber ? 'text-amber-accent' : highlight ? 'text-surface-page' : 'text-brand-100';
  return (
    <div className="flex items-baseline gap-2">
      <span className={`font-mono text-2xl tabular-nums font-medium ${valueColor}`}>
        {value.toLocaleString('pt-BR')}
      </span>
      <span className="font-label text-brand-200/80">{label}</span>
    </div>
  );
}
