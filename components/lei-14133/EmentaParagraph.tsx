/**
 * Renderiza um parágrafo da ementa de um artigo da Lei 14.133.
 *
 * Detecta `(VETADO)` (~17 ocorrências no source: arts. 6º, 10, 20, 32,
 * 38, 42, 60, 76 etc.) e aplica estilo distinto pra deixar visualmente
 * claro que aquele inciso/parágrafo/alínea foi vetado pelo Executivo
 * antes da publicação da Lei.
 *
 * Padrões cobertos:
 *   - "§ 3º (VETADO)."        → parágrafo inteiro vetado
 *   - "I - (VETADO);"         → inciso inteiro vetado
 *   - "d) (VETADO)."          → alínea inteira vetada
 *
 * Caso raro: "(VETADO)" inline no meio de prosa — o span é estilizado
 * mas o resto do parágrafo segue normal.
 */

import { Ban } from 'lucide-react';

interface EmentaParagraphProps {
  text: string;
  className?: string;
}

const VETO_MARKER_REGEX = /^\s*(?:§\s*\d+(?:º|o)?(?:-[A-Z])?\.?|[IVXLCDM]+\s*[-–—]|[a-z]\)|Parágrafo único\.?)\s*\(VETADO\)\.?\s*;?\s*$/;

export function EmentaParagraph({ text, className = 'text-ink-primary' }: EmentaParagraphProps) {
  const trimmed = text.trim();

  // Caso 1: parágrafo é inteiramente um veto (marker + (VETADO) + pontuação)
  if (VETO_MARKER_REGEX.test(trimmed)) {
    return (
      <p
        className={`${className} italic text-ink-muted flex items-center gap-1.5`}
        title="Dispositivo vetado pelo Poder Executivo na sanção da Lei"
      >
        <Ban className="w-3.5 h-3.5 text-ink-muted flex-shrink-0" aria-hidden="true" />
        {text}
      </p>
    );
  }

  // Caso 2: "(VETADO)" inline em prosa — wrap só o marker em span
  if (trimmed.includes('(VETADO)')) {
    const parts = text.split(/(\(VETADO\))/);
    return (
      <p className={className}>
        {parts.map((part, i) =>
          part === '(VETADO)' ? (
            <span key={i} className="italic text-ink-muted" title="Trecho vetado">
              (VETADO)
            </span>
          ) : (
            part
          )
        )}
      </p>
    );
  }

  // Caso 3: parágrafo normal
  return <p className={className}>{text}</p>;
}
