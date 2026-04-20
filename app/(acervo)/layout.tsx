import { getCurrentUser } from '@/lib/auth';
import { AcervoAuthShell } from '@/components/area-restrita';

export default async function AcervoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return <AcervoAuthShell isAuthed={!!user}>{children}</AcervoAuthShell>;
}
