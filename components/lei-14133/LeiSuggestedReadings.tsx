'use client';

import type { SuggestedReading } from '@/hooks/use-lei14133-preview';

interface LeiSuggestedReadingsProps {
  readings: SuggestedReading[];
}

function buildReadingHref(r: SuggestedReading): string {
  if (r.kind === 'internal') {
    if (r.internalType === 'blog') return `/blog/${r.internalId}`;
    if (r.internalType === 'glossary') return `/glossario/${r.internalId}`;
    if (r.internalType === 'legislative-act') return `/atos-normativos/${r.internalId}`;
    if (r.internalType === 'document') return `/documento/${r.internalId}`;
    return '#';
  }
  return r.externalUrl || '#';
}

export function LeiSuggestedReadings({ readings }: LeiSuggestedReadingsProps) {
  if (readings.length === 0) return null;

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-md p-5">
      <h3 className="text-lg font-bold text-ink-primary mb-3 flex items-center gap-2">
        🔗 Sugestões de leitura
      </h3>
      <ul className="space-y-2">
        {readings.map((r) => {
          const href = buildReadingHref(r);
          const isExternal = r.kind === 'external';
          return (
            <li key={r.id}>
              <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="block bg-surface-page border border-border-subtle rounded-lg p-3 hover:border-border-strong hover:shadow-sm transition-all"
              >
                <p className="text-sm font-medium text-ink-primary">{r.title || r.externalUrl}</p>
                {r.author && <p className="text-xs text-ink-secondary mt-0.5">por {r.author}</p>}
                {r.description && <p className="text-xs text-ink-secondary mt-1 line-clamp-2">{r.description}</p>}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { buildReadingHref };
