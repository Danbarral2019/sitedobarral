'use client';

import type { ReactNode } from 'react';
import { SidebarProvider } from './SidebarContext';
import { AreaRestritaSidebar } from './AreaRestritaSidebar';
import { AreaRestritaShell } from './AreaRestritaShell';

export function AcervoAuthShell({
 isAuthed,
 children,
}: {
 isAuthed: boolean;
 children: ReactNode;
}) {
 if (!isAuthed) return <>{children}</>;
 return (
 <SidebarProvider>
 <AreaRestritaSidebar />
 <AreaRestritaShell>{children}</AreaRestritaShell>
 </SidebarProvider>
 );
}
