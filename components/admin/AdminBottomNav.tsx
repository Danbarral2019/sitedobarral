'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, BarChart3, Mail, QrCode, PenSquare } from 'lucide-react';

interface AdminBottomNavProps {
  unreadCounts: {
    contatos: number;
    depoimentos: number;
    documentos: number;
  };
}

const NAV_ITEMS = [
  { path: '/admin/docs', label: 'Docs', icon: FileText, badgeKey: 'documentos' as const },
  { path: '/admin/analytics-hub', label: 'Analytics', icon: BarChart3, badgeKey: null },
  { path: '/admin', label: 'QR Codes', icon: QrCode, badgeKey: null },
  { path: '/admin/contatos', label: 'Contatos', icon: Mail, badgeKey: 'contatos' as const },
  { path: '/admin/blog-social', label: 'Blog', icon: PenSquare, badgeKey: null },
];

export default function AdminBottomNav({ unreadCounts }: AdminBottomNavProps) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/admin') return pathname === '/admin';
    return pathname === path || pathname.startsWith(path + '/');
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex items-center justify-around px-2 py-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          const badge = item.badgeKey ? unreadCounts[item.badgeKey] : 0;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`relative flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-3 py-2 rounded-lg transition-colors ${
                active
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
              {badge > 0 && (
                <span className="absolute -top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
