import {
  Home,
  LineChart,
  Award,
  BookOpen,
  Sparkles,
  Clock,
  Scale,
  FileText,
  Gavel,
  CreditCard,
  Heart,
  LogOut,
  Newspaper,
  List,
  Book,
  Library,
  Mail,
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
    title: 'Ferramentas de IA',
    items: [
      { label: 'Assistente IA', href: '/area-restrita/assistente', icon: Sparkles },
      { label: 'Histórico de IA', href: '/area-restrita/historico-ia', icon: Clock },
    ],
  },
  {
    title: 'Acervo',
    items: [
      { label: 'Atos normativos', href: '/legislacao', icon: FileText },
      { label: 'Jurisprudência', href: '/area-restrita/jurisprudencia', icon: Gavel },
      { label: 'Pareceres, Notas e Despachos', href: '/base-conhecimento/pareceres', icon: Library },
      { label: 'Orientações Normativas', href: '/base-conhecimento/orientacoes-normativas', icon: BookOpen },
      { label: 'Enunciados', href: '/base-conhecimento/enunciados', icon: List },
      { label: 'Manual TCU', href: '/base-conhecimento/manual-tcu', icon: Book },
      { label: 'Clipping TCU', href: '/area-restrita/clipping', icon: Mail, badge: 'novo' },
      { label: 'Blog', href: '/blog', icon: Newspaper },
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
    ],
  },
  {
    title: 'Minha conta',
    items: [
      { label: 'Meu plano', href: '/area-restrita/meu-plano', icon: CreditCard },
      { label: 'Favoritos', href: '/area-restrita/favoritos', icon: Heart },
      { label: 'Histórico', href: '/area-restrita/historico', icon: Clock },
      { label: 'Sair', href: '/api/auth/logout', icon: LogOut, external: true },
    ],
  },
];
