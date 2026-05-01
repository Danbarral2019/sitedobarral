'use client';

/**
 * LegalSidebar — TOC navegável, fundo elevado pra contraste com main.
 */

import { useEffect, useState } from 'react';
import type { LeiTitle } from '@/data/lei-14133-capitulos';
import type { ChapterCounts } from '@/lib/lei-14133/queries';

interface LegalSidebarProps {
  titulos: readonly LeiTitle[];
  chapterCounts: Record<string, ChapterCounts>;
}

export function LegalSidebar({ titulos, chapterCounts }: LegalSidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (intersecting.length > 0) {
          setActiveId(intersecting[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );

    const sections = document.querySelectorAll<HTMLElement>('[data-chapter-section]');
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Índice da Lei 14.133"
      className="hidden lg:block w-64 xl:w-72 flex-shrink-0 bg-surface-raised border-r border-border-subtle"
    >
      <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-8 px-6">
        <p className="font-label text-amber-accent-deep mb-1">Sumário</p>
        <p className="font-serif italic text-sm text-ink-muted mb-6">Lei 14.133/2021</p>
        <ol className="space-y-6">
          {titulos.map((titulo) => (
            <li key={titulo.id}>
              <a
                href={`#${titulo.chapters[0]?.id ?? titulo.id}`}
                className="block group mb-2"
              >
                <span className="block font-serif text-sm font-semibold text-ink-primary group-hover:text-amber-accent-deep transition-colors leading-tight">
                  Título {titulo.number}
                </span>
                <span className="block font-sans text-xs text-ink-secondary leading-tight mt-0.5">
                  {titulo.name}
                </span>
              </a>
              <ol className="ml-1 space-y-0.5 border-l-2 border-border-subtle">
                {titulo.chapters.map((cap) => {
                  const isActive = activeId === cap.id;
                  const count = chapterCounts[cap.id];
                  const refs = (count?.acordaos ?? 0) + (count?.pareceresOns ?? 0);
                  return (
                    <li key={cap.id}>
                      <a
                        href={`#${cap.id}`}
                        className={`block pl-3 py-1.5 text-xs transition-all -ml-[2px] border-l-2 ${
                          isActive
                            ? 'text-amber-accent-deep border-amber-accent font-semibold bg-amber-accent-soft/40'
                            : 'text-ink-secondary border-transparent hover:text-ink-primary hover:border-border-strong'
                        }`}
                      >
                        <span className="font-serif italic mr-1.5">{cap.number}</span>
                        <span className="font-sans">{cap.title}</span>
                        {refs > 0 && (
                          <span className="block font-mono text-[10px] text-amber-accent-deep mt-0.5 tabular-nums">
                            {refs} ref{refs === 1 ? '' : 's'}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
