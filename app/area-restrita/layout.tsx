import { GlobalSearchShortcut } from '@/components/area-restrita/GlobalSearchShortcut';

export default function AreaRestritaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <GlobalSearchShortcut />
      {children}
    </>
  );
}
