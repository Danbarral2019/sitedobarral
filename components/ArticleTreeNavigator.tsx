'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Scale,
  BookOpen,
  Users,
  ClipboardList,
  Layers,
  Target,
  ListOrdered,
  Megaphone,
  FileCheck,
  ShieldCheck,
  Zap,
  Wrench,
  Database,
  ArrowRightLeft,
  FileSignature,
  RefreshCw,
  CreditCard,
  AlertTriangle,
  MessageCircle,
  Eye,
  XCircle,
  Gavel,
  Flag,
  Search,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatArticleNumber } from '@/lib/article-utils';
import { useLeiArticles } from '@/hooks/useLeiArticles';

interface ArticleStats {
  [articleNum: string]: {
    documentCount: number;
    viewCount: number;
  };
}

interface ArticleTreeNavigatorProps {
  stats?: ArticleStats;
  onArticleClick?: (articleNum: string) => void;
  basePath?: string;
}

interface Theme {
  id: string;
  label: string;
  articles: string[];
  icon: LucideIcon;
  gradient: string;
}

const THEMES: Theme[] = [
  { id: 'gerais', label: 'Disposições Gerais e Princípios', articles: ['1','2','3','4','5'], icon: Scale, gradient: 'from-brand-500 to-brand-600' },
  { id: 'definicoes', label: 'Definições', articles: ['6'], icon: BookOpen, gradient: 'from-brand-600 to-brand-700' },
  { id: 'agentes', label: 'Agentes de Contratação', articles: ['7','8','9','10','11','12','13'], icon: Users, gradient: 'from-brand-500 to-brand-600' },
  { id: 'planejamento', label: 'Planejamento e Fase Preparatória', articles: ['14','15','16','17','18','19','20','21','22','23','24','25','26','27'], icon: ClipboardList, gradient: 'from-green-500 to-green-600' },
  { id: 'modalidades', label: 'Modalidades de Licitação', articles: ['28','29','30','31','32'], icon: Layers, gradient: 'from-emerald-500 to-emerald-600' },
  { id: 'julgamento', label: 'Critérios de Julgamento', articles: ['33','34','35','36','37','38','39'], icon: Target, gradient: 'from-brand-500 to-brand-600' },
  { id: 'procedimentos', label: 'Procedimentos Licitatórios', articles: ['40','41','42','43','44','45','46','47','48','49','50','51','52','53'], icon: ListOrdered, gradient: 'from-brand-500 to-brand-600' },
  { id: 'divulgacao', label: 'Divulgação e Edital', articles: ['54','55','56'], icon: Megaphone, gradient: 'from-brand-500 to-brand-600' },
  { id: 'propostas', label: 'Apresentação de Propostas e Julgamento', articles: ['57','58','59','60','61'], icon: FileCheck, gradient: 'from-brand-500 to-brand-600' },
  { id: 'habilitacao', label: 'Habilitação', articles: ['62','63','64','65','66','67','68','69','70','71'], icon: ShieldCheck, gradient: 'from-brand-500 to-brand-600' },
  { id: 'direta', label: 'Contratação Direta', articles: ['72','73','74','75'], icon: Zap, gradient: 'from-amber-accent to-amber-accent' },
  { id: 'auxiliares', label: 'Procedimentos Auxiliares', articles: ['76','77','78','79','80','81'], icon: Wrench, gradient: 'from-amber-accent to-amber-accent' },
  { id: 'registro-precos', label: 'Registro de Preços', articles: ['82','83','84','85','86'], icon: Database, gradient: 'from-rose-500 to-rose-600' },
  { id: 'alienacoes', label: 'Alienações', articles: ['87','88'], icon: ArrowRightLeft, gradient: 'from-brand-500 to-brand-600' },
  { id: 'contratos', label: 'Contratos Administrativos', articles: ['89','90','91','92','93','94','95','96','97','98','99','100','101','102','103','104','105','106','107','108','109','110','111','112','113','114','115','116','117','118','119','120','121','122','123','124'], icon: FileSignature, gradient: 'from-brand-500 to-brand-600' },
  { id: 'alteracao', label: 'Alteração e Extinção de Contratos', articles: ['124','125','126','127','128','129','130','131','132','133','134','135','136','137','138'], icon: RefreshCw, gradient: 'from-red-500 to-red-600' },
  { id: 'recebimento', label: 'Recebimento e Pagamento', articles: ['139','140','141','142','143','144','145','146','147','148','149','150','151','152','153','154'], icon: CreditCard, gradient: 'from-brand-500 to-brand-600' },
  { id: 'sancoes', label: 'Sanções', articles: ['155','156','157','158','159','160','161','162','163'], icon: AlertTriangle, gradient: 'from-red-600 to-red-700' },
  { id: 'impugnacoes', label: 'Impugnações e Pedidos de Esclarecimento', articles: ['164','165','166','167','168'], icon: MessageCircle, gradient: 'from-brand-800 to-brand-800' },
  { id: 'controle', label: 'Controle', articles: ['169','170','171','172','173'], icon: Eye, gradient: 'from-brand-800 to-brand-800' },
  { id: 'irregularidades', label: 'Irregularidades', articles: ['174','175','176','177'], icon: XCircle, gradient: 'from-red-500 to-rose-600' },
  { id: 'crimes', label: 'Crimes em Licitações', articles: ['178','179','180','181','182','183'], icon: Gavel, gradient: 'from-brand-800 to-brand-800' },
  { id: 'finais', label: 'Disposições Finais e Transitórias', articles: ['184','184-A','185','186','187','188','189','190','191','192','193','194'], icon: Flag, gradient: 'from-brand-800 to-brand-800' },
];

function getArticleRange(articles: string[]): string {
  if (articles.length === 0) return '';
  if (articles.length === 1) return `Art. ${articles[0]}`;
  return `Art. ${articles[0]}-${articles[articles.length - 1]}`;
}

function getColorIndicator(count: number): string {
  if (count >= 10) return 'bg-green-500';
  if (count >= 3) return 'bg-brand-500';
  return 'bg-border-strong';
}

function truncateEmenta(ementa: string, maxLen: number = 80): string {
  // Remove the "Art. Nº " prefix for display
  const cleaned = ementa.replace(/^Art\.\s*\d+[º°]?\s*/, '');
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.substring(0, maxLen) + '...';
}

export function ArticleTreeNavigator({
  stats = {},
  onArticleClick,
  basePath = '/artigo',
}: ArticleTreeNavigatorProps) {
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { articles: artigos } = useLeiArticles();

  const filteredThemes = useMemo(() => {
    if (!searchTerm.trim()) return THEMES;

    const term = searchTerm.trim().toLowerCase();

    // Check if user typed a number (article search)
    const numMatch = term.match(/^(\d+)/);
    if (numMatch) {
      const num = numMatch[1];
      return THEMES.filter((theme) =>
        theme.articles.some((a) => a === num || a.startsWith(num))
      );
    }

    // Text search: filter themes by label
    return THEMES.filter((theme) =>
      theme.label.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const getThemeDocCount = (articles: string[]): number => {
    return articles.reduce((sum, articleNum) => {
      return sum + (stats[articleNum]?.documentCount || 0);
    }, 0);
  };

  const toggleTheme = (themeId: string) => {
    setExpandedTheme((prev) => (prev === themeId ? null : themeId));
  };

  return (
    <div className="bg-white rounded-[6px] border-2 border-border-subtle p-4">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-ink-primary flex items-center gap-2">
          <Scale className="w-5 h-5 text-brand-600" />
          Temas da Lei 14.133
        </h3>
        <p className="text-xs text-ink-muted mt-1">
          Navegue pelos temas da Lei de Licitações e Contratos
        </p>
      </div>

      {/* Search Field */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar artigo ou tema..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border-subtle rounded-[6px] focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-ink-muted"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 pb-4 border-b border-border-subtle">
        <p className="text-xs font-medium text-ink-secondary mb-2">Legenda:</p>
        <div className="flex flex-wrap gap-3 text-[10px] text-ink-muted">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>&ge;10 docs</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-brand-500"></div>
            <span>3-9 docs</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-border-strong"></div>
            <span>&lt;3 docs</span>
          </div>
        </div>
      </div>

      {/* Theme Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
        {filteredThemes.map((theme) => {
          const Icon = theme.icon;
          const isExpanded = expandedTheme === theme.id;
          const totalDocs = getThemeDocCount(theme.articles);

          return (
            <div key={theme.id} className={isExpanded ? 'md:col-span-2' : ''}>
              {/* Theme Card */}
              <button
                onClick={() => toggleTheme(theme.id)}
                className="w-full flex items-center gap-3 p-3 bg-surface-raised hover:bg-surface-deep rounded-[6px] transition-colors text-left group border border-border-subtle"
              >
                {/* Icon Circle */}
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-full ${theme.gradient} flex items-center justify-center`}
                >
                  <Icon className="w-4.5 h-4.5 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink-primary group-hover:text-brand-700 truncate">
                      {theme.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-ink-muted">
                      {getArticleRange(theme.articles)}
                    </span>
                    <span className="text-[10px] text-ink-muted">
                      ({theme.articles.length} {theme.articles.length === 1 ? 'artigo' : 'artigos'})
                    </span>
                  </div>
                </div>

                {/* Doc Count & Expand Indicator */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {totalDocs > 0 && (
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${getColorIndicator(totalDocs)}`}></div>
                      <span className="text-[10px] text-ink-muted">{totalDocs}</span>
                    </div>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-ink-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-ink-muted" />
                  )}
                </div>
              </button>

              {/* Expanded Article List */}
              {isExpanded && (
                <div className="mt-2 ml-2 mr-1 mb-1 space-y-1 border-l-2 border-border-subtle pl-3">
                  {theme.articles.map((articleNum) => {
                    const article = artigos[articleNum];
                    const docCount = stats[articleNum]?.documentCount || 0;

                    return (
                      <Link
                        key={articleNum}
                        href={`${basePath}/${articleNum}`}
                        onClick={() => onArticleClick?.(articleNum)}
                        className="block p-2 hover:bg-brand-50 rounded-[6px] transition-colors group/article"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-bold text-ink-primary group-hover/article:text-brand-600">
                                {formatArticleNumber(articleNum)}
                              </span>
                              {docCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <div className={`w-1.5 h-1.5 rounded-full ${getColorIndicator(docCount)}`}></div>
                                  <span className="text-[10px] text-ink-muted">{docCount}</span>
                                </div>
                              )}
                            </div>
                            {article && (
                              <p className="text-[10px] text-ink-muted leading-tight line-clamp-2">
                                {truncateEmenta(article.ementa)}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredThemes.length === 0 && (
          <div className="md:col-span-2 text-center py-8 text-sm text-ink-muted">
            Nenhum tema encontrado para &ldquo;{searchTerm}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
