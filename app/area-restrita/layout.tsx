import { GlobalSearchShortcut } from '@/components/area-restrita/GlobalSearchShortcut';
import {
 SidebarProvider,
 AreaRestritaSidebar,
 AreaRestritaShell,
} from '@/components/area-restrita';

export default function AreaRestritaLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 return (
 <SidebarProvider>
 <GlobalSearchShortcut />
 <AreaRestritaSidebar />
 <AreaRestritaShell>{children}</AreaRestritaShell>
 </SidebarProvider>
 );
}
