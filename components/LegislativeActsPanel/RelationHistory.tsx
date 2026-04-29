import Link from 'next/link';
import type { RelationView } from '@/lib/legislative-acts/relations';

const TYPE_LABELS: Record<string, string> = {
  revoga: 'revoga',
  altera: 'altera',
  regulamenta: 'regulamenta',
  complementa: 'complementa',
  modifica: 'modifica',
};

const TYPE_COLORS: Record<string, string> = {
  revoga: 'bg-red-100 text-red-700 border-red-300',
  altera: 'bg-amber-100 text-amber-700 border-amber-300',
  regulamenta: 'bg-blue-100 text-blue-700 border-blue-300',
  complementa: 'bg-green-100 text-green-700 border-green-300',
  modifica: 'bg-purple-100 text-purple-700 border-purple-300',
};

/**
 * Prioridade entre relationTypes — usada para deduplicar quando o mesmo par
 * (sourceAct, targetAct) gera múltiplas relations (ex: detector heurístico
 * encontra "regulamenta" e "complementa" no mesmo ato em trechos distintos).
 * Menor número = mais específico → vence.
 */
const TYPE_PRIORITY: Record<string, number> = {
  revoga: 0,
  altera: 1,
  modifica: 2,
  regulamenta: 3,
  complementa: 4,
};

function dedupeRelations(rels: RelationView[], side: 'source' | 'target'): RelationView[] {
  const byOtherId = new Map<string, RelationView>();
  for (const rel of rels) {
    const other = side === 'source' ? rel.targetAct : rel.sourceAct;
    if (!other?.id) continue;
    const existing = byOtherId.get(other.id);
    if (!existing) {
      byOtherId.set(other.id, rel);
      continue;
    }
    const exPrio = TYPE_PRIORITY[existing.relationType] ?? 99;
    const newPrio = TYPE_PRIORITY[rel.relationType] ?? 99;
    if (newPrio < exPrio) byOtherId.set(other.id, rel);
  }
  return Array.from(byOtherId.values());
}

export interface RelationHistoryProps {
  alters: RelationView[];
  alteredBy: RelationView[];
}

export function RelationHistory({ alters, alteredBy }: RelationHistoryProps) {
  // Mesmo par (este ato, outro ato) pode ter múltiplas relations no DB quando
  // o detector encontrou verbos diferentes em trechos distintos do texto-fonte
  // (ex: ato cita Lei 14.133 dizendo "regulamenta" no preâmbulo e "complementa"
  // numa cláusula posterior). Deduplicar por outro-ato e manter o relationType
  // de maior especificidade (revoga > altera > modifica > regulamenta > complementa).
  alters = dedupeRelations(alters, 'source');
  alteredBy = dedupeRelations(alteredBy, 'target');

  if (alters.length === 0 && alteredBy.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 my-6">
        <p className="text-sm text-gray-500 italic">
          Sem relações detectadas com outros atos normativos da base.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 my-6 space-y-6">
      {alters.length > 0 && (
        <section>
          <h3 className="font-cinzel font-semibold text-lg text-gray-900 mb-3">
            ✏️ Este ato afeta os seguintes atos:
          </h3>
          <p className="text-xs text-gray-500 mb-3 font-poppins">
            Inclui revogações, alterações, regulamentações, complementações e modificações — o tipo
            específico é indicado pelo selo colorido em cada item.
          </p>
          <ul className="space-y-3">
            {alters.map((rel) => (
              <RelationItem key={rel.id} rel={rel} otherAct={rel.targetAct!} />
            ))}
          </ul>
        </section>
      )}

      {alteredBy.length > 0 && (
        <section>
          <h3 className="font-cinzel font-semibold text-lg text-gray-900 mb-3">
            📌 Este ato é afetado pelos seguintes atos:
          </h3>
          <p className="text-xs text-gray-500 mb-3 font-poppins">
            Inclui atos que revogam, alteram, regulamentam, complementam ou modificam este — o tipo
            específico é indicado pelo selo colorido em cada item.
          </p>
          <ul className="space-y-3">
            {alteredBy.map((rel) => (
              <RelationItem key={rel.id} rel={rel} otherAct={rel.sourceAct!} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RelationItem({
  rel,
  otherAct,
}: {
  rel: RelationView;
  otherAct: { id: string; fullNumber: string; title: string };
}) {
  const typeColor = TYPE_COLORS[rel.relationType] ?? 'bg-gray-100 text-gray-700 border-gray-300';
  return (
    <li className="border border-gray-200 rounded-lg p-3 hover:border-brand-300 transition-colors">
      <div className="flex items-start gap-2 flex-wrap">
        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${typeColor}`}>
          {TYPE_LABELS[rel.relationType] ?? rel.relationType}
        </span>
        {rel.reviewStatus === 'pending' && (
          <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded border bg-yellow-50 text-yellow-700 border-yellow-300">
            ⏳ pendente revisão
          </span>
        )}
        <Link
          href={`/legislacao/${otherAct.id}`}
          className="font-poppins font-semibold text-brand-700 hover:underline"
        >
          {otherAct.fullNumber}
        </Link>
      </div>
      <p className="text-sm text-gray-700 mt-1 font-poppins">{otherAct.title}</p>
      <p className="text-xs text-gray-500 italic mt-1 font-poppins">&ldquo;{rel.excerpt}&rdquo;</p>
    </li>
  );
}
