import type { ReactNode } from 'react';
import Link from 'next/link';
import { subtituloDoAto } from '@/lib/legislacao/cabecalho';
import type { RelationView } from '@/lib/legislative-acts/relations';

/** Verbo da relação visto de cada lado: "regulamenta X" / "regulamentado por X". */
const ACTIVE_LABELS: Record<string, string> = {
  revoga: 'revoga',
  altera: 'altera',
  regulamenta: 'regulamenta',
  complementa: 'complementa',
  modifica: 'modifica',
};

const PASSIVE_LABELS: Record<string, string> = {
  revoga: 'revogado por',
  altera: 'alterado por',
  regulamenta: 'regulamentado por',
  complementa: 'complementado por',
  modifica: 'modificado por',
};

/**
 * Tipos de relação onde a hierarquia importa: o source SÓ pode revogar/alterar
 * um target de nível igual ou inferior (hierarchyLevel >= source.hierarchyLevel,
 * já que números maiores são níveis mais baixos).
 *
 * Para `regulamenta` o sentido é INVERTIDO: source regulamenta target de nível
 * SUPERIOR (decreto regulamenta lei). Anomalia: source.hl < target.hl.
 *
 * `complementa` e `modifica` têm semântica frouxa — não checamos.
 */
const HIERARCHY_SENSITIVE_DOWN = new Set(['revoga', 'altera']);
const HIERARCHY_SENSITIVE_UP = new Set(['regulamenta']);

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

/**
 * Determina se uma relação é hierarquicamente atípica.
 * `direction`: 'down' = source revoga/altera target (source deveria ser >= target em força).
 * 'up' = source regulamenta target (source deveria ser <= target em força — decreto regulamenta lei).
 *
 * Lembrando: hierarchyLevel 1=Lei, 2=Decreto, 3=Portaria, 4=IN, 5=OS (menor = mais forte).
 */
function isAtypical(
  relationType: string,
  sourceLevel: number | undefined,
  targetLevel: number | undefined,
): boolean {
  if (sourceLevel == null || targetLevel == null) return false;
  if (HIERARCHY_SENSITIVE_DOWN.has(relationType)) {
    // source revoga/altera target → atípico se source é mais fraco (level maior) que target
    return sourceLevel > targetLevel;
  }
  if (HIERARCHY_SENSITIVE_UP.has(relationType)) {
    // source regulamenta target → atípico se source é MAIS FORTE que target (lei regulamenta decreto não faz sentido)
    return sourceLevel < targetLevel;
  }
  return false;
}

export interface RelationHistoryProps {
  alters: RelationView[];
  alteredBy: RelationView[];
  /** Nível hierárquico do ato corrente (necessário pra detectar incongruências). */
  currentHierarchyLevel?: number;
}

/**
 * Relações do ato com outros atos da base, para a página pública.
 *
 * As relações vêm do detector automático e, em sua maioria, ainda não passaram
 * por revisão; o estado de revisão é assunto interno e não aparece item a
 * item. A página avisa uma vez que as relações foram identificadas no texto.
 * Relação hierarquicamente atípica (IN "altera" lei) é quase sempre falso
 * positivo do detector e fica fora da lista pública.
 */
export function RelationHistory({ alters, alteredBy, currentHierarchyLevel }: RelationHistoryProps) {
  // Mesmo par (este ato, outro ato) pode ter múltiplas relations no DB quando
  // o detector encontrou verbos diferentes em trechos distintos do texto-fonte
  // (ex: ato cita Lei 14.133 dizendo "regulamenta" no preâmbulo e "complementa"
  // numa cláusula posterior). Deduplicar por outro-ato e manter o relationType
  // de maior especificidade (revoga > altera > modifica > regulamenta > complementa).
  alters = dedupeRelations(alters, 'source').filter(
    (rel) => !isAtypical(rel.relationType, currentHierarchyLevel, rel.targetAct?.hierarchyLevel),
  );
  alteredBy = dedupeRelations(alteredBy, 'target').filter(
    (rel) => !isAtypical(rel.relationType, rel.sourceAct?.hierarchyLevel, currentHierarchyLevel),
  );

  if (alters.length === 0 && alteredBy.length === 0) return null;

  return (
    <section className="bg-white border border-border-subtle rounded-[6px] px-4 py-6 sm:p-8 mb-6">
      <h2 className="text-lg font-bold text-ink-primary">Relações com outros atos</h2>
      <p className="text-sm text-ink-muted mt-1">
        Identificadas automaticamente no texto dos atos. Confira no texto oficial.
      </p>

      {alters.length > 0 && (
        <RelationGroup title="Atos afetados por este">
          {alters.map((rel) => (
            <RelationItem
              key={rel.id}
              verb={ACTIVE_LABELS[rel.relationType] ?? rel.relationType}
              otherAct={rel.targetAct!}
            />
          ))}
        </RelationGroup>
      )}

      {alteredBy.length > 0 && (
        <RelationGroup title="Atos que afetam este">
          {alteredBy.map((rel) => (
            <RelationItem
              key={rel.id}
              verb={PASSIVE_LABELS[rel.relationType] ?? rel.relationType}
              otherAct={rel.sourceAct!}
            />
          ))}
        </RelationGroup>
      )}
    </section>
  );
}

function RelationGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-ink-secondary mb-2">{title}</h3>
      <ul className="divide-y divide-border-subtle border-y border-border-subtle">{children}</ul>
    </div>
  );
}

function RelationItem({
  verb,
  otherAct,
}: {
  verb: string;
  otherAct: { id: string; fullNumber: string; title: string };
}) {
  // Título que só repete a epígrafe não acrescenta nada ao número.
  const subtitulo = subtituloDoAto(otherAct.title);
  return (
    <li className="py-2.5 flex flex-col sm:flex-row sm:items-baseline gap-x-3 gap-y-0.5">
      <span className="text-sm text-ink-muted sm:w-36 shrink-0">{verb}</span>
      <span className="min-w-0">
        <Link
          href={`/legislacao/${otherAct.id}`}
          className="font-semibold text-brand-700 hover:underline"
        >
          {otherAct.fullNumber}
        </Link>
        {subtitulo && <span className="text-sm text-ink-secondary">{' · '}{subtitulo}</span>}
      </span>
    </li>
  );
}
