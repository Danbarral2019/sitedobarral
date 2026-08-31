'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import {
  QrCode, ChevronLeft, ChevronRight, BarChart3, Mail, MessageSquare, Send, GraduationCap, Globe, BookOpen, Menu, X, FileText, PenSquare, FileSpreadsheet, Filter, Inbox, Scale, Activity, Sparkles, Network, Map, Grid3X3, Award, HelpCircle, Megaphone
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({ contatos: 0, depoimentos: 0, documentos: 0, tcuHighlights: 0, tribunalHighlights: 0, douPending: 0 });
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/admin') return pathname === '/admin';
    return pathname === path || pathname.startsWith(path + '/');
  };

  // Buscar contadores de notificações
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [contatosRes, depoimentosRes, documentosRes, tcuHighlightsRes, tribunalHighlightsRes, douPendingRes, douAutoApprovedRes] = await Promise.all([
          fetch('/api/admin/contatos?unreadOnly=true'),
          fetch('/api/admin/depoimentos?status=pending'),
          fetch('/api/admin/documents/recent-auto-imports-count'),
          fetch('/api/admin/tcu-highlights?countOnly=true'),
          fetch('/api/admin/tribunal-highlights?countOnly=true'),
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

        if (tribunalHighlightsRes.ok) {
          const tribunalData = await tribunalHighlightsRes.json();
          setUnreadCounts(prev => ({ ...prev, tribunalHighlights: tribunalData.count || 0 }));
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

  // Menu reorganizado em 6 seções (consolidado 2026-05-04 — ver docs/ADMIN_NAVIGATION.md)
  const menuItems = [
    // === VISÃO GERAL ===
    { divider: true, label: '\u{1F4CA} Visao geral' },
    {
      path: '/admin',
      label: 'Dashboard (QR Codes)',
      icon: QrCode,
    },
    {
      path: '/admin/monitoring',
      label: 'Monitoramento',
      icon: Activity,
    },

    // === JURISPRUDÊNCIA ===
    { divider: true, label: '\u{2696}\u{FE0F} Jurisprudencia' },
    {
      path: '/admin/tcu',
      label: 'TCU (Acordaos + Destaques)',
      icon: Scale,
      badge: unreadCounts.tcuHighlights,
    },
    {
      path: '/admin/lei-14133',
      label: 'Lei 14.133',
      icon: Sparkles,
    },
    {
      path: '/admin/legislacao',
      label: 'Legislacao',
      icon: BookOpen,
    },
    {
      path: '/admin/importacao',
      label: 'Importacao (TCU/AGU)',
      icon: FileSpreadsheet,
    },
    {
      path: '/admin/dou-filtros',
      label: 'DOU Filtros',
      icon: Filter,
      badge: unreadCounts.douPending,
    },
    {
      path: '/admin/clipping-dou',
      label: 'Clipping DOU',
      icon: Inbox,
    },
    {
      path: '/admin/pareceres-revisao',
      label: 'Pareceres CONUNI',
      icon: FileText,
    },
    {
      path: '/admin/legislative-relations',
      label: 'Relacoes entre atos',
      icon: Network,
    },

    // === DOCUMENTOS ===
    { divider: true, label: '\u{1F4C1} Documentos' },
    {
      path: '/admin/docs',
      label: 'Documentos',
      icon: FileText,
      badge: unreadCounts.documentos,
    },

    // === LMS ===
    { divider: true, label: '\u{1F393} LMS' },
    {
      path: '/admin/lms',
      label: 'Cursos & Licoes',
      icon: GraduationCap,
    },
    {
      path: '/admin/badges',
      label: 'Badges (Gamificacao)',
      icon: Award,
    },
    {
      path: '/admin/planejamento/trilhas',
      label: 'Planejamento — Trilhas',
      icon: Map,
    },
    {
      path: '/admin/planejamento/matriz',
      label: 'Planejamento — Matriz',
      icon: Grid3X3,
    },
    {
      path: '/admin/planejamento/anunciar',
      label: 'Planejamento — Anunciar',
      icon: Megaphone,
    },

    // === CONTEÚDO ===
    { divider: true, label: '\u{270D}\u{FE0F} Conteudo' },
    {
      path: '/admin/blog-social',
      label: 'Blog & Social',
      icon: PenSquare,
    },
    {
      path: '/admin/publicacoes',
      label: 'Publicacoes',
      icon: BookOpen,
    },
    {
      path: '/admin/glossario',
      label: 'Glossario',
      icon: BookOpen,
    },
    {
      path: '/admin/faq',
      label: 'FAQ',
      icon: HelpCircle,
    },
    {
      path: '/admin/recursos',
      label: 'Recursos Externos',
      icon: Globe,
    },

    // === GESTÃO ===
    { divider: true, label: '\u{2699}\u{FE0F} Gestao' },
    {
      path: '/admin/analytics-hub',
      label: 'Analytics',
      icon: BarChart3,
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
    <div className="flex min-h-screen bg-surface-raised">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-white rounded-[6px] border-2 border-border-subtle hover:bg-surface-raised transition-colors"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? (
          <X className="w-6 h-6 text-ink-primary" />
        ) : (
          <Menu className="w-6 h-6 text-ink-primary" />
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
                  src="/brand/logo-icon-96.png"
                  alt="Logo"
                  width={40}
                  height={40}
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
                src="/brand/logo-icon-96.png"
                alt="Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-[6px] hover:bg-brand-500 transition-colors ml-auto hidden lg:block"
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
                  className={`flex items-center gap-2 px-3 py-2 rounded-[6px] text-sm font-medium transition-colors ${
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
              className="flex items-center gap-3 px-4 py-3 rounded-[6px] text-white hover:bg-brand-500 font-medium transition-colors"
              title={isCollapsed ? 'Area do Aluno (abre em nova aba)' : ''}
            >
              <GraduationCap className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <div className="flex items-center gap-2">
                  <span>Area do Aluno</span>
                  <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              )}
            </Link>
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-[6px] text-brand-200 hover:bg-brand-500 hover:text-white font-medium transition-colors"
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
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        } ml-0 flex-1 transition-all duration-300 pb-20 lg:pb-0`}
      >
        {/* Spacer for mobile hamburger button */}
        <div className="h-16 lg:hidden" />
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <AdminBottomNav unreadCounts={unreadCounts} />
    </div>
  );
}
