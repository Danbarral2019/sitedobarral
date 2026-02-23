'use client';

import { usePathname } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';

const AUTH_PAGES = ['/admin/login', '/admin/redefinir-senha'];

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (AUTH_PAGES.includes(pathname)) {
    return <>{children}</>;
  }

  return <AdminLayout>{children}</AdminLayout>;
}
