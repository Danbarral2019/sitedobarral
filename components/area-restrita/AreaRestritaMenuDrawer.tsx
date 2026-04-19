'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  X,
  Home,
  GraduationCap,
  LineChart,
  Award,
  BookOpen,
  Sparkles,
  Clock,
  Search,
  Scale,
  FileText,
  Gavel,
  BookMarked,
  CreditCard,
  Heart,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

interface MenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: 'novo';
  description?: string;
  external?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const SECTIONS: MenuSection[] = [
  {
    title: 'Meus estudos',
    items: [
      { label: 'Início', href: '/area-restrita', icon: Home },
      { label: 'Meu progresso', href: '/area-restrita/meu-progresso', icon: LineChart },
      {
        label: 'Meus certificados',
        href: '/area-restrita/meus-certificados',
        icon: Award,
      },
    ],
  },
  {
    title: 'Planejamento',
    items: [
      {
        label: 'Nova contratação',
        href: '/area-restrita/planejamento/nova',
        icon: FileText,
        badge: 'novo',
        description: 'Elaborar ETP e TR com IA',
      },
      {
        label: 'Minhas contratações',
        href: '/area-restrita/planejamento',
        icon: Scale,
      },
    ],
  },
  {
    title: 'Lei 14.133 e referência',
    items: [
      {
        label: 'Lei 14.133 comentada',
        href: '/area-restrita/lei-comentada',
        icon: BookOpen,
      },
      { label: 'Glossário', href: '/glossario', icon: BookMarked },
    ],
  },
  {
    title: 'Ferramentas de IA',
    items: [
      { label: 'Assistente IA', href: '/area-restrita/assistente', icon: Sparkles },
      {
        label: 'Histórico de IA',
        href: '/area-restrita/historico-ia',
        icon: Clock,
      },
      {
        label: 'Busca global',
        href: '/area-restrita?focus=search',
        icon: Search,
      },
    ],
  },
  {
    title: 'Acervo',
    items: [
      { label: 'Atos normativos', href: '/legislacao', icon: FileText },
      { label: 'Jurisprudência', href: '/jurisprudencia', icon: Gavel },
      { label: 'Publicações', href: '/publicacoes', icon: GraduationCap },
    ],
  },
  {
    title: 'Minha conta',
    items: [
      { label: 'Meu plano', href: '/planos', icon: CreditCard },
      { label: 'Favoritos', href: '/area-restrita/favoritos', icon: Heart },
      { label: 'Histórico', href: '/area-restrita/historico', icon: Clock },
      { label: 'Sair', href: '/api/auth/logout', icon: LogOut, external: true },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AreaRestritaMenuDrawer({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    // previne scroll do body enquanto o drawer está aberto
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const content = (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label="Menu de navegação"
        className="fixed right-0 top-0 z-[70] flex h-screen w-full max-w-sm flex-col border-l border-gray-200 bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Navegação
            </p>
            <h2 className="font-serif text-lg text-brand-900">
              Tudo que o site oferece
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {SECTIONS.map((section) => (
            <section key={section.title} className="mb-4">
              <h3 className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {section.title}
              </h3>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    {item.external ? (
                      <a
                        href={item.href}
                        onClick={onClose}
                        className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-800 transition hover:bg-brand-50 hover:text-brand-800"
                      >
                        <MenuIcon Icon={item.icon} />
                        <span className="flex-1">
                          <span className="block font-medium">{item.label}</span>
                          {item.description && (
                            <span className="block text-[11px] text-gray-500">
                              {item.description}
                            </span>
                          )}
                        </span>
                        {item.badge === 'novo' && <NewBadge />}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-800 transition hover:bg-brand-50 hover:text-brand-800"
                      >
                        <MenuIcon Icon={item.icon} />
                        <span className="flex-1">
                          <span className="block font-medium">{item.label}</span>
                          {item.description && (
                            <span className="block text-[11px] text-gray-500">
                              {item.description}
                            </span>
                          )}
                        </span>
                        {item.badge === 'novo' && <NewBadge />}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </aside>
    </>
  );

  return createPortal(content, document.body);
}

function MenuIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function NewBadge() {
  return (
    <span className="ml-2 shrink-0 self-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
      Novo
    </span>
  );
}

export default AreaRestritaMenuDrawer;
