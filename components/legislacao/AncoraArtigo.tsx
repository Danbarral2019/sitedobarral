'use client';

import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { rotuloDoId } from '@/lib/legislacao/ancoras';

/**
 * Botão junto ao rótulo do artigo no texto integral: copia o link direto para
 * o dispositivo (/legislacao/[id]#art-75) e o põe na barra de endereço.
 */
export function AncoraArtigo({ id }: { id: string }) {
  const [copiado, setCopiado] = useState(false);
  const rotulo = rotuloDoId(id);

  async function copiar() {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    window.history.replaceState(null, '', `#${id}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de área de transferência: o link fica na barra de endereço.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="ancora-artigo"
      data-copiado={copiado || undefined}
      aria-label={`Copiar link do ${rotulo}`}
      title={copiado ? 'Link copiado' : `Copiar link do ${rotulo}`}
    >
      {copiado ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">{copiado ? 'Link copiado' : ''}</span>
    </button>
  );
}
