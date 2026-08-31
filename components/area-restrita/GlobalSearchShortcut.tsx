'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Listener global para Ctrl+K / Cmd+K em toda a área restrita.
 * Na página principal (/area-restrita), o GlobalSearchBar já tem seu próprio listener
 * que foca o input. Nas demais páginas, este componente redireciona para /area-restrita
 * com focus automático na busca.
 */
export function GlobalSearchShortcut() {
 const pathname = usePathname();
 const router = useRouter();

 useEffect(() => {
 // Na página principal, o GlobalSearchBar já cuida do Ctrl+K
 if (pathname === '/area-restrita') return;

 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 e.preventDefault();
 router.push('/area-restrita?focus=search');
 }
 };

 document.addEventListener('keydown', handleKeyDown);
 return () => document.removeEventListener('keydown', handleKeyDown);
 }, [pathname, router]);

 return null;
}
