'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, PanelLeftClose, PanelLeftOpen, Menu, GraduationCap } from 'lucide-react';
import { NAV_SECTIONS, type MenuItem } from './nav-catalog';
import { useSidebar } from './SidebarContext';
import { cn } from '@/lib/planejamento/cn';
import { courses as ALL_COURSES } from '@/data/courses';

interface EnrolledCourse {
  id: string;
  slug: string;
  title: string;
}

interface ApiEnrollment {
  courseId: string;
  expiresAt: string | null;
  isLifetime: boolean;
}

/**
 * Sidebar de navegação da área restrita.
 *
 * Comportamento:
 *   - lg+ (desktop): permanente à esquerda, 18rem de largura. Aberto por
 *     default na primeira visita; preferência persiste em localStorage.
 *     Botão de fechar no topo da própria sidebar.
 *   - <lg (mobile/tablet): drawer overlay à esquerda, aberto por botão
 *     no header (hambúrguer). Estado volátil por sessão.
 *
 * Quando fechada em desktop, aparece um botão flutuante no canto superior
 * esquerdo ("Abrir menu"). Em mobile esse botão já existe no header.
 */
export function AreaRestritaSidebar() {
  const { desktopOpen, toggleDesktop, mobileOpen, setMobileOpen, hydrated } =
    useSidebar();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.user?.enrollments) return;
        const now = new Date();
        const active: ApiEnrollment[] = (data.user.enrollments as ApiEnrollment[]).filter(
          (e) => e.isLifetime || (e.expiresAt && new Date(e.expiresAt) >= now),
        );
        const mapped = active
          .map((e) => {
            const course = ALL_COURSES.find(c => c.id === e.courseId);
            if (!course) return null;
            return { id: course.id, slug: course.slug, title: course.title };
          })
          .filter((c): c is EnrolledCourse => c !== null);
        setEnrolledCourses(mapped);
      })
      .catch(() => {
        /* silently ignore — sidebar fixa segue funcional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fecha o drawer mobile ao navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  // Tecla Esc fecha o drawer mobile
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen, setMobileOpen]);

  const sidebarContent = (
    <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section) => (
        <section key={section.title} className="mb-4">
          <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {section.title}
          </h3>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} pathname={pathname ?? ''} />
              </li>
            ))}
            {section.title === 'Meus estudos' && enrolledCourses.length > 0 && (
              <li className="pt-1">
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Meus cursos
                </p>
                <ul className="space-y-0.5">
                  {enrolledCourses.map(course => (
                    <li key={`course-${course.id}`}>
                      <SidebarLink
                        item={{
                          label: course.title,
                          href: `/area-restrita/curso/${course.slug}`,
                          icon: GraduationCap,
                        }}
                        pathname={pathname ?? ''}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </section>
      ))}
    </nav>
  );

  // ----- Mobile drawer (portal) -----
  const mobileDrawer =
    mounted && mobileOpen
      ? createPortal(
          <div className="lg:hidden">
            <div
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <aside
              role="dialog"
              aria-label="Menu de navegação"
              className="fixed left-0 top-0 z-[70] flex h-screen w-[85%] max-w-sm flex-col border-r border-gray-200 bg-white shadow-2xl"
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
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                  aria-label="Fechar menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>
              {sidebarContent}
            </aside>
          </div>,
          document.body,
        )
      : null;

  // ----- Desktop sidebar (static) + floating reopen -----
  return (
    <>
      {mobileDrawer}

      {/* Desktop permanent sidebar (lg+) */}
      <aside
        aria-label="Menu de navegação"
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen w-72 flex-col border-r border-gray-200 bg-white shadow-sm transition-transform duration-200',
          hydrated && desktopOpen ? 'lg:flex lg:translate-x-0' : 'lg:flex lg:-translate-x-full',
        )}
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
            onClick={toggleDesktop}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
            aria-label="Ocultar menu"
            title="Ocultar menu"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </header>
        {sidebarContent}
      </aside>

      {/* Floating button to reopen sidebar in desktop when collapsed */}
      {hydrated && !desktopOpen && (
        <button
          onClick={toggleDesktop}
          className="fixed left-4 top-20 z-40 hidden items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-md hover:border-brand-300 hover:text-brand-700 lg:inline-flex"
          aria-label="Abrir menu"
          title="Abrir menu"
        >
          <PanelLeftOpen className="h-3.5 w-3.5" />
          Menu
        </button>
      )}
    </>
  );
}

/**
 * Botão usado em telas <lg (dentro do header / bottom nav) para abrir
 * o drawer mobile.
 */
export function SidebarMobileTrigger({
  variant = 'header',
}: {
  variant?: 'header' | 'bottom';
}) {
  const { toggleMobile } = useSidebar();

  if (variant === 'bottom') {
    return (
      <button
        onClick={toggleMobile}
        className="flex flex-1 flex-col items-center justify-center h-full text-gray-600 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-medium">Menu</span>
      </button>
    );
  }
  return (
    <button
      onClick={toggleMobile}
      className="flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors font-medium text-sm lg:hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      aria-label="Abrir menu"
    >
      <Menu className="w-4 h-4" />
      <span className="hidden sm:inline">Menu</span>
    </button>
  );
}

function SidebarLink({
  item,
  pathname,
}: {
  item: MenuItem;
  pathname: string;
}) {
  const active =
    pathname === item.href ||
    (item.href.length > '/area-restrita'.length &&
      pathname.startsWith(item.href));
  const Icon = item.icon;
  const className = cn(
    'flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition',
    active
      ? 'bg-brand-50 text-brand-900'
      : 'text-gray-800 hover:bg-brand-50 hover:text-brand-800',
  );
  const content = (
    <>
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          active ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1">
        <span className="block font-medium">{item.label}</span>
        {item.description && (
          <span className="block text-[11px] text-gray-500">{item.description}</span>
        )}
      </span>
      {item.badge === 'novo' && (
        <span className="ml-2 shrink-0 self-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
          Novo
        </span>
      )}
    </>
  );
  if (item.external) {
    return (
      <a href={item.href} className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  );
}
