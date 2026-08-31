'use client';

import type { ReactNode } from 'react';
import { useSidebar } from './SidebarContext';
import { cn } from '@/lib/planejamento/cn';

/**
 * Wrapper cliente que injeta padding esquerdo quando a sidebar está
 * aberta em desktop (lg+). Assim o conteúdo da página não fica atrás
 * da sidebar permanente.
 */
export function AreaRestritaShell({ children }: { children: ReactNode }) {
 const { desktopOpen, hydrated } = useSidebar();
 const reservePadding = !hydrated || desktopOpen;
 return (
 <div
 className={cn(
 'transition-[padding] duration-200',
 reservePadding && 'lg:pl-72',
 )}
 >
 {children}
 </div>
 );
}
