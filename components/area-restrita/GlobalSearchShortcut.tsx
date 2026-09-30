'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { isSearchShortcut, useModifierLabel } from './search-shortcut';

/**
 * Listener global para Ctrl+K / Cmd+K em toda a área restrita.
 * Na página principal (/area-restrita), o GlobalSearchBar já tem seu próprio listener
 * que foca o input. Nas demais páginas, este componente redireciona para /area-restrita
 * com ?focus=search (lido pelo GlobalSearchBar, que foca o campo em qualquer largura)
 * e exibe um botão fixo com o atalho, que também serve de indicativo visual.
 */
export function GlobalSearchShortcut() {
  const pathname = usePathname();
  const router = useRouter();
  const modifier = useModifierLabel();
  const isHome = pathname === '/area-restrita';

  useEffect(() => {
    // Na página principal, o GlobalSearchBar já cuida do Ctrl+K
    if (isHome) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSearchShortcut(e)) {
        e.preventDefault();
        router.push('/area-restrita?focus=search');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHome, router]);

  if (isHome) return null;

  return (
    <button
      type="button"
      onClick={() => router.push('/area-restrita?focus=search')}
      className="hidden lg:flex fixed bottom-4 right-4 z-30 items-center gap-2 rounded-full border border-border-subtle bg-white/95 px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      title="Buscar em todo o acervo"
      aria-label="Buscar em todo o acervo"
      aria-keyshortcuts="Control+K Meta+K"
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      <span>Buscar</span>
      <kbd className="rounded border border-border-subtle bg-surface-deep px-1.5 py-0.5 font-mono text-[10px]">
        {modifier} K
      </kbd>
    </button>
  );
}
