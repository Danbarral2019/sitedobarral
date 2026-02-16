'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  QrCode, ChevronLeft, ChevronRight, BarChart3, Mail, MessageSquare, Send, GraduationCap, Youtube, Globe, BookOpen, Menu, X, Search
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({ contatos: 0, depoimentos: 0, documentos: 0, tcuHighlights: 0, douPending: 0 });
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/admin/lms') return pathname === path || pathname.startsWith('/admin/lms/');
    return pathname === path;
  };

  // Buscar contadores de notificações
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [contatosRes, depoimentosRes, documentosRes, tcuHighlightsRes, douPendingRes, douAutoApprovedRes] = await Promise.all([
          fetch('/api/admin/contatos?unreadOnly=true'),
          fetch('/api/admin/depoimentos?status=pending'),
          fetch('/api/admin/documents/recent-auto-imports-count'),
          fetch('/api/admin/tcu-highlights?countOnly=true'),
          fetch('/api/admin/dou/pending'),
          fetch('/api/admin/dou/auto-approved'),
        ]);

        if (contatosRes.ok) {
          const contatosData = await contatosRes.json();
          setUnreadCounts(prev => ({ ...prev, contatos: contatosData.total || 0 }));
        }

        if (depoimentosRes.ok) {
          const depoimentosData = await depoimentosRes.json();
          setUnreadCounts(prev => ({ ...prev, depoimentos: depoimentosData.total || 0 }));
        }

        if (documentosRes.ok) {
          const documentosData = await documentosRes.json();
          setUnreadCounts(prev => ({ ...prev, documentos: documentosData.count || 0 }));
        }

        if (tcuHighlightsRes.ok) {
          const tcuData = await tcuHighlightsRes.json();
          setUnreadCounts(prev => ({ ...prev, tcuHighlights: tcuData.count || 0 }));
        }

        let douTotal = 0;
        if (douPendingRes.ok) {
          const douPendingData = await douPendingRes.json();
          douTotal += douPendingData.count || 0;
        }
        if (douAutoApprovedRes.ok) {
          const douAutoData = await douAutoApprovedRes.json();
          douTotal += douAutoData.count || 0;
        }
        setUnreadCounts(prev => ({ ...prev, douPending: douTotal }));
      } catch (error) {
        console.error('Erro ao carregar contadores:', error);
      }
    };

    loadCounts();
    const interval = setInterval(loadCounts, 60000); // Atualiza a cada minuto
    return () => clearInterval(interval);
  }, []);

  // Menus ORGANIZADOS POR CATEGORIA
  const menuItems = [
    // === JURISPRUDÊNCIA ===
    { divider: true, label: '📚 Jurisprudência' },
    {
      path: '/admin/tcu-manager',
      label: 'TCU Manager',
      icon: (props: Record<string, unknown>) => (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      badge: unreadCounts.tcuHighlights,
    },
    {
      path: '/admin/agu-import',
      label: 'AGU Manager',
      icon: (props: Record<string, unknown>) => (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      path: '/admin/legislacao',
      label: 'Legislação',
      icon: (props: Record<string, unknown>) => (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
      ),
    },
    {
      path: '/admin/dou-filtros',
      label: 'DOU Filtros',
      icon: (props: Record<string, unknown>) => (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      ),
      badge: unreadCounts.douPending,
    },

    // === DOCUMENTOS ===
    { divider: true, label: '📁 Documentos' },
    {
      path: '/admin/adicionar-documentos',
      label: 'Central de Documentos',
      icon: (props: Record<string, unknown>) => (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      badge: unreadCounts.documentos,
    },
    {
      path: '/admin/documentos',
      label: 'Gerenciar Documentos',
      icon: (props: Record<string, unknown>) => (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },

    // === ANALYTICS ===
    { divider: true, label: '📊 Analytics' },
    {
      path: '/admin/analytics',
      label: 'Analytics Geral',
      icon: BarChart3,
    },
    {
      path: '/admin/analytics-documentos',
      label: 'Catalogação',
      icon: (props: Record<string, unknown>) => (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      path: '/admin/search-analytics',
      label: 'Analytics de Busca',
      icon: Search,
    },

    // === LMS ===
    { divider: true, label: '🎓 LMS' },
    {
      path: '/admin/lms',
      label: 'Cursos',
      icon: GraduationCap,
    },

    // === CONTEÚDO ===
    { divider: true, label: '✍️ Conteúdo' },
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
      path: '/admin/publicacoes',
      label: 'Publicações',
      icon: (props: Record<string, unknown>) => (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      path: '/admin/glossario',
      label: 'Glossário',
      icon: BookOpen,
    },
    {
      path: '/admin/videos',
      label: 'Vídeos YouTube',
      icon: Youtube,
    },
    {
      path: '/admin/sites',
      label: 'Sites Recomendados',
      icon: Globe,
    },
    {
      path: '/admin/assistente-social',
      label: 'Redes Sociais',
      icon: (props: Record<string, unknown>) => (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      ),
    },

    // === GESTÃO ===
    { divider: true, label: '⚙️ Gestão' },
    {
      path: '/admin',
      label: 'QR Codes',
      icon: QrCode,
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
      path: '/admin/newsletter',
      label: 'Newsletter',
      icon: Send,
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-white rounded-lg shadow-lg border-2 border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? (
          <X className="w-6 h-6 text-gray-900" />
        ) : (
          <Menu className="w-6 h-6 text-gray-900" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isCollapsed ? 'w-20' : 'w-64'}
          bg-brand-600 border-r border-brand-700 fixed top-0 left-0 h-full transition-all duration-300 z-40
          lg:translate-x-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-brand-500 flex items-center justify-between flex-shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 relative flex-shrink-0">
                <Image
                  src="/brand/logo-icon.png"
                  alt="Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-base font-cinzel font-semibold text-white">Painel Admin</h1>
                <p className="text-xs text-brand-200 mt-0.5 font-poppins">Prof. Daniel Barral</p>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 relative mx-auto">
              <Image
                src="/brand/logo-icon.png"
                alt="Logo"
                fill
                className="object-contain"
              />
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-brand-500 transition-colors ml-auto hidden lg:block"
            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 text-white" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* Navigation - SCROLL ADICIONADO */}
        <nav className="p-3 flex-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          <div className="space-y-0.5">
            {menuItems.map((item, index) => {
              // Render divider
              if (item.divider) {
                return (
                  <div
                    key={`divider-${index}`}
                    className={`${index > 0 ? 'mt-4 pt-3 border-t border-brand-500' : ''}`}
                  >
                    {!isCollapsed && (
                      <div className="px-3 pb-2 text-xs font-semibold text-brand-200 uppercase tracking-wider">
                        {item.label}
                      </div>
                    )}
                    {isCollapsed && (
                      <div className="h-px bg-brand-500 my-2" />
                    )}
                  </div>
                );
              }

              // Render menu item
              const Icon = item.icon!;
              const active = isActive(item.path!);

              return (
                <Link
                  key={item.path}
                  href={item.path!}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-brand-100 hover:bg-brand-500 hover:text-white'
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
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
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-brand-600"></span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-brand-500 space-y-1">
            <Link
              href="/area-restrita"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-white hover:bg-brand-500 font-medium transition-colors"
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
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-brand-200 hover:bg-brand-500 hover:text-white font-medium transition-colors"
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
