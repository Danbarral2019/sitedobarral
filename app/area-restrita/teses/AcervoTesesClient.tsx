'use client';

import { useMemo, useState } from 'react';
import { Search, ScrollText } from 'lucide-react';
import CartaoTese from '@/components/teses/CartaoTese';
import type { TeseCard } from '@/lib/teses/consultas';

/** Sem acento e em minúsculas, para o filtro casar "prescricao" com "prescrição". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function AcervoTesesClient({ teses }: { teses: TeseCard[] }) {
  const [filtro, setFiltro] = useState('');

  const visiveis = useMemo(() => {
    const termo = normalizar(filtro.trim());
    if (!termo) return teses;
    return teses.filter(
      (t) =>
        normalizar(t.enunciado).includes(termo) ||
        normalizar(t.inovacao).includes(termo) ||
        normalizar(`${t.numeroAlvo}/${t.anoAlvo}`).includes(termo),
    );
  }, [teses, filtro]);

  return (
    <main className="min-h-screen bg-brand-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-[6px] bg-brand-50 text-brand-600">
            <ScrollText className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-ink-primary">Acervo de teses do TCU</h1>
        </div>
        <p className="text-sm text-ink-muted mb-6">
          Enunciados destilados de como os votos posteriores do Tribunal invocam cada precedente, com os trechos citantes que os sustentam. O colegiado do precedente só é afirmado quando confirmado no registro do Tribunal.
        </p>

        <div className="relative mb-6">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar por enunciado, matéria ou número do acórdão"
            aria-label="Filtrar teses"
            className="w-full pl-9 pr-3 py-2 border border-border-subtle rounded-[6px] text-sm bg-white"
          />
        </div>

        <p className="text-xs text-ink-muted mb-4">
          {visiveis.length === 1 ? '1 tese' : `${visiveis.length} teses`}
          {filtro.trim() && ` de ${teses.length}`}
        </p>

        {visiveis.length === 0 ? (
          <p className="text-ink-muted text-center py-12">Nenhuma tese corresponde ao filtro.</p>
        ) : (
          <div className="space-y-6">
            {visiveis.map((tese) => (
              <CartaoTese key={tese.enunciadoId} tese={tese} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
