'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  QrCode, FileSpreadsheet, ChevronLeft, ChevronRight, BarChart3, Mail, MessageSquare, Send, GraduationCap, Youtube, Globe
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({ contatos: 0, depoimentos: 0 });
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  // Buscar contadores de notificações
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [contatosRes, depoimentosRes] = await Promise.all([
          fetch('/api/admin/contatos?unreadOnly=true'),
          fetch('/api/admin/depoimentos?status=pending'),
        ]);

        if (contatosRes.ok) {
          const contatosData = await contatosRes.json();
          setUnreadCounts(prev => ({ ...prev, contatos: contatosData.total || 0 }));
        }

        if (depoimentosRes.ok) {
          const depoimentosData = await depoimentosRes.json();
          setUnreadCounts(prev => ({ ...prev, depoimentos: depoimentosData.total || 0 }));
        }
      } catch (error) {
        console.error('Erro ao carregar contadores:', error);
      }
    };

    loadCounts();
    const interval = setInterval(loadCounts, 60000); // Atualiza a cada minuto
    return () => clearInterval(interval);
  }, []);

  // Menus em ORDEM ALFABÉTICA
  const menuItems = [
    {
      path: '/admin/analytics',
      label: 'Analytics',
      icon: BarChart3,
    },
    {
      path: '/admin/blog',
      label: 'Blog',
      icon: (props: Record<string, unknown>) => (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      path: '/admin/contatos',
      label: 'Contatos',
      icon: Mail,
      badge: unreadCounts.contatos,
    },
    {
      path: '/admin/depoimentos',
      label: 'Depoimentos',
      icon: MessageSquare,
      badge: unreadCounts.depoimentos,
    },
    {
      path: '/admin/documentos',
      label: 'Documentos',
      icon: (props: Record<string, unknown>) => (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      path: '/admin/importar',
      label: 'Importar Excel',
      icon: FileSpreadsheet,
    },
    {
      path: '/admin/newsletter',
      label: 'Newsletter',
      icon: Send,
    },
    {
      path: '/admin/publicacoes',
      label: 'Publicações',
      icon: (props: Record<string, unknown>) => (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      path: '/admin',
      label: 'QR Codes',
      icon: QrCode,
    },
    {
      path: '/admin/sites',
      label: 'Sites Recomendados',
      icon: Globe,
    },
    {
      path: '/admin/videos',
      label: 'Vídeos YouTube',
      icon: Youtube,
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-white border-r border-gray-200 fixed h-full overflow-y-auto transition-all duration-300 z-40`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-gray-900">Painel Admin</h1>
              <p className="text-xs text-gray-600 mt-0.5">Prof. Daniel Barral</p>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors ml-auto"
            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 flex-1 overflow-y-auto">
          <div className="space-y-0.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                            <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && (
                    <div className="flex items-center gap-2 flex-1">
                      <span>{item.label}</span>
                      {item.badge && item.badge > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                  {isCollapsed && item.badge && item.badge > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 space-y-1">
            <Link
              href="/area-restrita"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-blue-700 hover:bg-blue-50 font-medium transition-colors"
              title={isCollapsed ? 'Área do Aluno (abre em nova aba)' : ''}
            >
              <GraduationCap className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <div className="flex items-center gap-2">
                  <span>Área do Aluno</span>
                  <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              )}
            </Link>
            <Link
              href="/"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
              title={isCollapsed ? 'Voltar ao Site' : ''}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {!isCollapsed && <span>Voltar ao Site</span>}
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main
        className={`${
          isCollapsed ? 'ml-20' : 'ml-64'
        } flex-1 transition-all duration-300`}
      >
        {children}
      </main>
    </div>
  );
}
