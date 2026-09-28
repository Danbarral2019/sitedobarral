'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, memo, useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown, LogIn } from 'lucide-react';
import { courses } from '@/data/courses';

// Itens que ficam à vista na barra a partir de lg. A barra completa (13 itens,
// com ícones) ocupava cerca de 1490 px e transbordava abaixo de 1536 px; os
// itens institucionais foram para o menu "Mais", e o rodapé também os lista.
const PRIMARY_LINKS = [
  { href: '/base-conhecimento', label: 'Base de Conhecimento' },
  { href: '/legislacao', label: 'Legislação' },
  { href: '/jurisprudencia', label: 'Jurisprudência' },
  { href: '/teses', label: 'Teses' },
  { href: '/planos', label: 'Planos' },
];

const MORE_LINKS = [
  { href: '/sobre', label: 'Sobre' },
  { href: '/blog', label: 'Blog' },
  { href: '/glossario', label: 'Glossário' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contato', label: 'Contato' },
];

const MOBILE_LINKS = [
  { href: '/', label: 'Início' },
  { href: '/sobre', label: 'Sobre o Professor' },
  { href: '/cursos', label: 'Cursos' },
  { href: '/base-conhecimento', label: 'Base de Conhecimento' },
  { href: '/legislacao', label: 'Legislação' },
  { href: '/jurisprudencia', label: 'Jurisprudência' },
  { href: '/teses', label: 'Teses' },
  { href: '/blog', label: 'Blog' },
  { href: '/glossario', label: 'Glossário' },
  { href: '/faq', label: 'FAQ' },
  { href: '/planos', label: 'Planos' },
  { href: '/contato', label: 'Contato' },
];

const focusRing =
  'focus-visible:ring-2 focus-visible:ring-surface-page focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600';

const navItemClass = (active: boolean) =>
  `rounded font-sans text-sm transition-colors ${focusRing} ${active ? 'text-surface-page font-semibold' : 'text-surface-page/90 hover:text-surface-page'}`;

const dropdownLinkClass = (active: boolean) =>
  `block px-4 py-2 text-sm hover:bg-brand-50 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 ${active ? 'font-semibold text-brand-700' : 'text-ink-secondary'}`;

interface NavDropdownProps {
  id: string;
  label: string;
  active: boolean;
  align: 'left' | 'right';
  panelClassName: string;
  children: ReactNode;
}

// Disclosure de navegação (padrão WAI-ARIA): o botão expõe aria-expanded e o
// painel é uma lista comum de links, percorrida com Tab.
function NavDropdown({ id, label, active, align, panelClassName, children }: NavDropdownProps) {
  const pathname = usePathname();
  // Guarda a rota em que o painel foi aberto: ao navegar (inclusive pelo botão
  // Voltar), a rota muda e o painel fecha sozinho.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const isOpen = openOn === pathname;
  const containerRef = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenOn(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenOn(null);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <li
      ref={containerRef}
      className="relative"
      onBlur={(event) => {
        // Fecha quando o Tab leva o foco para fora. Foco que vai para o body
        // (relatedTarget nulo) fica a cargo do clique fora, para não esconder o
        // painel entre o mousedown e o click num link dele.
        const next = event.relatedTarget as Node | null;
        if (next && !event.currentTarget.contains(next)) setOpenOn(null);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={() => setOpenOn(isOpen ? null : pathname)}
        className={`flex items-center gap-1 ${navItemClass(active)}`}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className={`w-4 h-4 transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Só existe no DOM enquanto aberto: oculto, repetiria em toda página os
          títulos dos cursos e os rótulos do "Mais", e getByText(...).first()
          nos testes de fluxo acharia o link invisível do cabeçalho. */}
      {isOpen && (
        <div
          id={id}
          onClick={(event) => {
            // Fecha já no clique, sem esperar a troca de rota (e também quando o
            // link aponta para a página atual).
            if ((event.target as Element).closest('a')) setOpenOn(null);
          }}
          className={`absolute top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} ${panelClassName} bg-surface-page rounded-[6px] py-2 z-[9999] border border-border-subtle`}
        >
          {children}
        </div>
      )}
    </li>
  );
}

export const Header = memo(function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="bg-brand-600 border border-border-subtle">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[10000] focus:bg-white focus:text-brand-700 focus:px-4 focus:py-2 focus:rounded-[6px] focus:font-bold focus: border border-border-subtle"
      >
        Pular para o conteúdo principal
      </a>
      <nav aria-label="Navegação principal" className="container mx-auto px-4">
        <div className="flex justify-between items-center gap-x-4 h-20 sm:h-24">
          <Link href="/" className="flex items-center flex-shrink-0" aria-label="Página inicial - Prof. Daniel Barral">
            <div className="w-20 h-20 sm:w-24 sm:h-24 relative flex-shrink-0">
              <Image
                src="/brand/logo-icon-96.png"
                alt="Logo Prof. Daniel Barral"
                width={96}
                height={96}
                className="object-contain w-full h-full"
                priority
              />
            </div>
          </Link>

          <div className="flex items-center gap-x-3 lg:gap-x-5 xl:gap-x-6">
            <ul className="hidden lg:flex items-center lg:gap-x-5 xl:gap-x-6">
              <NavDropdown
                id="cabecalho-menu-cursos"
                label="Cursos"
                active={isActive('/cursos')}
                align="left"
                panelClassName="w-80 max-h-96 overflow-y-auto"
              >
                <Link
                  href="/cursos"
                  aria-current={pathname === '/cursos' ? 'page' : undefined}
                  className="block px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
                >
                  Ver todos os cursos
                </Link>
                <div className="border-t border-border-subtle my-2"></div>
                <ul>
                  {courses.map((course) => {
                    const href = `/cursos/${course.slug}`;
                    return (
                      <li key={course.id}>
                        <Link
                          href={href}
                          aria-current={isActive(href) ? 'page' : undefined}
                          className={dropdownLinkClass(isActive(href))}
                        >
                          {course.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </NavDropdown>

              {PRIMARY_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive(href) ? 'page' : undefined}
                    className={navItemClass(isActive(href))}
                  >
                    {label}
                  </Link>
                </li>
              ))}

              <NavDropdown
                id="cabecalho-menu-mais"
                label="Mais"
                active={MORE_LINKS.some(({ href }) => isActive(href))}
                align="right"
                panelClassName="w-48"
              >
                <ul>
                  {MORE_LINKS.map(({ href, label }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={isActive(href) ? 'page' : undefined}
                        className={dropdownLinkClass(isActive(href))}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </NavDropdown>
            </ul>

            {/* Fica na barra em todas as larguras, inclusive com o menu móvel. */}
            <Link
              href="/login"
              className={`flex items-center gap-x-1 flex-shrink-0 bg-surface-page/10 hover:bg-surface-page/20 px-3 sm:px-4 py-2 rounded-[6px] text-surface-page transition-colors font-sans text-sm ${focusRing}`}
            >
              <LogIn aria-hidden="true" className="w-4 h-4" />
              <span>Área do Aluno</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`lg:hidden p-2 flex-shrink-0 rounded text-surface-page ${focusRing}`}
              aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={isMenuOpen}
              aria-controls="cabecalho-menu-movel"
            >
              {isMenuOpen ? <X aria-hidden="true" className="w-6 h-6" /> : <Menu aria-hidden="true" className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div id="cabecalho-menu-movel" className="lg:hidden py-4 border-t border-brand-500 bg-brand-600">
            {MOBILE_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={`block py-3 px-2 rounded transition-colors font-sans ${isActive(href) ? 'text-surface-page font-semibold bg-brand-500' : 'text-surface-page/90 hover:text-surface-page hover:bg-brand-500'}`}
                onClick={() => setIsMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
});
