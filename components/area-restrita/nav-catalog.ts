import {
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

export interface MenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: 'novo';
  description?: string;
  external?: boolean;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

/**
 * Catálogo único usado pela sidebar lateral permanente e pelo drawer
 * mobile. Mantém o agrupamento coerente em qualquer ponto de entrada.
 */
export const NAV_SECTIONS: MenuSection[] = [
  {
    title: 'Meus estudos',
    items: [
      { label: 'Início', href: '/area-restrita', icon: Home },
      { label: 'Meu progresso', href: '/area-restrita/meu-progresso', icon: LineChart },
      { label: 'Meus certificados', href: '/area-restrita/meus-certificados', icon: Award },
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
      { label: 'Histórico de IA', href: '/area-restrita/historico-ia', icon: Clock },
      { label: 'Busca global', href: '/area-restrita?focus=search', icon: Search },
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
