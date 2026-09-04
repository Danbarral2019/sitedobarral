// Sem 'use client': a vitrine não tem estado nem interação, e o filtro fica
// para o acervo restrito, onde há noventa itens e crescendo. Aqui são vinte.
import { ScrollText } from 'lucide-react';
import CartaoTese from '@/components/teses/CartaoTese';
import type { TeseCard } from '@/lib/teses/consultas';

export default function TesesClient({ teses }: { teses: TeseCard[] }) {
  return (
    <main className="min-h-screen bg-brand-50">
      <div className="bg-brand-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex p-3 bg-white/20 rounded-[6px] mb-4">
            <ScrollText className="w-10 h-10" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Teses do TCU em Licitações e Contratos
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto mb-4">
            Enunciados em linguagem de súmula, extraídos de como os votos posteriores do próprio Tribunal invocam cada precedente.
          </p>
          <p className="text-sm text-white/70 max-w-3xl mx-auto">
            Cada tese traz os trechos dos acórdãos citantes que a sustentam, com o caminho para o inteiro teor de cada um. O colegiado do precedente só é afirmado quando confirmado no registro do Tribunal.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {teses.length === 0 ? (
          <p className="text-ink-muted text-center py-12">
            Nenhuma tese publicada no momento.
          </p>
        ) : (
          <div className="space-y-6">
            {teses.map((tese) => (
              <CartaoTese key={tese.enunciadoId} tese={tese} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
