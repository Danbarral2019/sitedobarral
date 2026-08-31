'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, FileText, Scale, BookOpen, Video, Newspaper, ScrollText, ChevronDown, ChevronUp } from 'lucide-react';

interface NovidadesClientProps {
  year: number;
  month: number;
  documentsByCategory: Record<string, Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    uploadedAt: Date;
  }>>;
  tribunalDecisions: Array<{
    id: string;
    title: string;
    tribunalCode: string;
    summary: string | null;
    ementa: string;
    createdAt: Date;
  }>;
  blogPosts: Array<{
    title: string;
    slug: string;
    excerpt: string;
    publishedAt: Date;
  }>;
  publications: Array<{
    title: string;
    type: string;
    description: string;
    externalUrl: string | null;
    publishedAt: Date;
  }>;
  videos: Array<{
    title: string;
    courseId: string;
    youtubeUrl: string | null;
    createdAt: Date;
  }>;
  legislativeActs: Array<{
    fullNumber: string;
    title: string;
    ementa: string;
    publishDate: Date;
  }>;
  totalItems: number;
}

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const categoryLabels: Record<string, string> = {
  'apostila': 'Apostilas e Material Didático',
  'acordao': 'Acórdãos TCU',
  'parecer': 'Pareceres Jurídicos',
  'edital': 'Editais',
  'artigo': 'Artigos e Doutrinas',
  'orientacao-normativa': 'Orientações Normativas',
  'decor': 'DECOR',
  'enunciado': 'Enunciados',
  'boa_pratica': 'Outros Atos Normativos',
  'sumula': 'Súmulas',
  'legislacao': 'Legislação',
  'outro': 'Outros Documentos',
};

const categoryIcons: Record<string, typeof FileText> = {
  'apostila': BookOpen,
  'acordao': Scale,
  'parecer': FileText,
  'orientacao-normativa': ScrollText,
  'decor': FileText,
  'enunciado': FileText,
};

const tribunalColors: Record<string, string> = {
  'TCU': 'bg-brand-100 text-brand-800',
  'TCE-SP': 'bg-brand-100 text-brand-800',
  'TCE-MG': 'bg-green-100 text-green-800',
  'TCE-PR': 'bg-brand-100 text-brand-800',
  'STJ': 'bg-red-100 text-red-800',
  'STF': 'bg-red-100 text-red-900',
  'CNJ': 'bg-brand-100 text-brand-800',
  'TST': 'bg-rose-100 text-rose-800',
};

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function NovidadesClient({
  year,
  month,
  documentsByCategory,
  tribunalDecisions,
  blogPosts,
  publications,
  videos,
  legislativeActs,
  totalItems,
}: NovidadesClientProps) {
  const router = useRouter();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['author', 'decisions', ...Object.keys(documentsByCategory)]));

  const monthLabel = `${monthNames[month - 1]} de ${year}`;

  const navigateMonth = (direction: -1 | 1) => {
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    const mes = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    router.push(`/novidades?mes=${mes}`);
  };

  const isCurrentMonth = (() => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth() + 1;
  })();

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const hasAuthorContent = blogPosts.length > 0 || publications.length > 0 || videos.length > 0;

  return (
    <div className="min-h-screen bg-surface-raised">
      {/* Header */}
      <div className="bg-[#1e3a5f] to-brand-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Link href="/" className="text-brand-200 hover:text-white text-sm mb-4 inline-block">&larr; Voltar ao site</Link>
          <h1 className="text-3xl font-bold font-serif mb-2">Novidades da Plataforma</h1>
          <p className="text-brand-200">Todos os documentos e conteúdos adicionados no período</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-8 bg-white rounded-[6px] border border-border-subtle p-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="flex items-center gap-1 text-ink-muted hover:text-brand-600 transition-colors px-3 py-2 rounded-[6px] hover:bg-brand-50"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Mês anterior</span>
          </button>
          <div className="text-center">
            <h2 className="text-xl font-bold text-ink-primary">{monthLabel}</h2>
            <p className="text-sm text-ink-muted">{totalItems} documento{totalItems !== 1 ? 's' : ''} no período</p>
          </div>
          <button
            onClick={() => navigateMonth(1)}
            disabled={isCurrentMonth}
            className={`flex items-center gap-1 px-3 py-2 rounded-[6px] transition-colors ${isCurrentMonth ? 'text-ink-muted cursor-not-allowed' : 'text-ink-muted hover:text-brand-600 hover:bg-brand-50'}`}
          >
            <span className="hidden sm:inline">Próximo mês</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Empty state */}
        {totalItems === 0 && !hasAuthorContent && legislativeActs.length === 0 && (
          <div className="text-center py-16 bg-white rounded-[6px] border border-border-subtle">
            <FileText className="w-12 h-12 text-ink-muted mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-ink-muted mb-2">Nenhum conteúdo neste período</h3>
            <p className="text-ink-muted">Navegue para outro mês para ver os documentos disponíveis.</p>
          </div>
        )}

        {/* Author Content */}
        {hasAuthorContent && (
          <Section
            title="Conteúdos do Professor"
            icon={<Newspaper className="w-5 h-5" />}
            count={blogPosts.length + publications.length + videos.length}
            color="border-amber-accent"
            expanded={expandedSections.has('author')}
            onToggle={() => toggleSection('author')}
          >
            {blogPosts.map(post => (
              <div key={post.slug} className="p-4 border border-amber-accent-soft rounded-[6px] bg-amber-accent-soft mb-3">
                <span className="text-xs font-semibold text-amber-accent-deep uppercase tracking-wider">Artigo no Blog</span>
                <h4 className="font-semibold text-ink-primary mt-1">
                  <Link href={`/blog/${post.slug}`} className="hover:text-brand-600">{post.title}</Link>
                </h4>
                <p className="text-sm text-ink-muted mt-1">{post.excerpt.substring(0, 200)}{post.excerpt.length > 200 ? '...' : ''}</p>
                <p className="text-xs text-ink-muted mt-2">{formatDate(post.publishedAt)}</p>
              </div>
            ))}
            {publications.map((pub, i) => (
              <div key={i} className="p-4 border border-amber-accent-soft rounded-[6px] bg-amber-accent-soft mb-3">
                <span className="text-xs font-semibold text-amber-accent-deep uppercase tracking-wider">{pub.type === 'livro' ? 'Livro' : pub.type === 'artigo' ? 'Artigo Publicado' : 'Notícia'}</span>
                <h4 className="font-semibold text-ink-primary mt-1">{pub.title}</h4>
                <p className="text-sm text-ink-muted mt-1">{pub.description.substring(0, 200)}{pub.description.length > 200 ? '...' : ''}</p>
                {pub.externalUrl && (
                  <a href={pub.externalUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-accent-deep font-medium hover:underline mt-2 inline-block">Acessar &rarr;</a>
                )}
              </div>
            ))}
            {videos.map((video, i) => (
              <div key={i} className="p-4 border border-amber-accent-soft rounded-[6px] bg-amber-accent-soft mb-3">
                <span className="text-xs font-semibold text-amber-accent-deep uppercase tracking-wider flex items-center gap-1"><Video className="w-3 h-3" /> Vídeo</span>
                <h4 className="font-semibold text-ink-primary mt-1">{video.title}</h4>
                <a href={video.youtubeUrl ?? ''} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-accent-deep font-medium hover:underline mt-1 inline-block">Assistir &rarr;</a>
              </div>
            ))}
          </Section>
        )}

        {/* Tribunal Decisions */}
        {tribunalDecisions.length > 0 && (
          <Section
            title="Decisões de Tribunais"
            icon={<Scale className="w-5 h-5" />}
            count={tribunalDecisions.length}
            color="border-brand-500"
            expanded={expandedSections.has('decisions')}
            onToggle={() => toggleSection('decisions')}
          >
            {tribunalDecisions.map(decision => (
              <div key={decision.id} className="p-4 border border-border-subtle rounded-[6px] bg-white mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${tribunalColors[decision.tribunalCode] || 'bg-surface-deep text-ink-secondary'}`}>
                    {decision.tribunalCode}
                  </span>
                </div>
                <h4 className="font-semibold text-ink-primary text-sm leading-relaxed">{decision.title}</h4>
                <p className="text-sm text-ink-muted mt-1 line-clamp-3">
                  {decision.summary || decision.ementa.substring(0, 250)}{(!decision.summary && decision.ementa.length > 250) ? '...' : ''}
                </p>
                <p className="text-xs text-ink-muted mt-2">{formatDate(decision.createdAt)}</p>
              </div>
            ))}
          </Section>
        )}

        {/* Document Categories */}
        {Object.entries(documentsByCategory).map(([category, docs]) => {
          const IconComponent = categoryIcons[category] || FileText;
          return (
            <Section
              key={category}
              title={categoryLabels[category] || category}
              icon={<IconComponent className="w-5 h-5" />}
              count={docs.length}
              color={`border-l-4`}
              expanded={expandedSections.has(category)}
              onToggle={() => toggleSection(category)}
            >
              {docs.map((doc, i) => (
                <div key={doc.id} className="p-4 border border-border-subtle rounded-[6px] bg-white mb-3">
                  <h4 className="font-semibold text-ink-primary text-sm">{i + 1}. {doc.title}</h4>
                  {doc.description && (
                    <p className="text-sm text-ink-muted mt-1">{doc.description.substring(0, 200)}{doc.description.length > 200 ? '...' : ''}</p>
                  )}
                  <p className="text-xs text-ink-muted mt-2">{formatDate(doc.uploadedAt)}</p>
                </div>
              ))}
            </Section>
          );
        })}

        {/* Legislative Acts */}
        {legislativeActs.length > 0 && (
          <Section
            title="Alterações Legislativas"
            icon={<ScrollText className="w-5 h-5" />}
            count={legislativeActs.length}
            color="border-red-500"
            expanded={expandedSections.has('legislative')}
            onToggle={() => toggleSection('legislative')}
          >
            {legislativeActs.map((act, i) => (
              <div key={i} className="p-4 border border-red-100 rounded-[6px] bg-red-50 mb-3">
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">{act.fullNumber}</span>
                <h4 className="font-semibold text-ink-primary mt-1">{act.title}</h4>
                <p className="text-sm text-ink-muted mt-1">{act.ementa.substring(0, 250)}{act.ementa.length > 250 ? '...' : ''}</p>
                <p className="text-xs text-ink-muted mt-2">{formatDate(act.publishDate)}</p>
              </div>
            ))}
          </Section>
        )}

        {/* Newsletter CTA */}
        <div className="mt-8 bg-brand-600 rounded-[6px] p-6 text-white text-center">
          <h3 className="text-lg font-bold mb-2">Receba os destaques por email</h3>
          <p className="text-brand-100 text-sm mb-4">
            Assine a newsletter mensal e receba uma curadoria com as decisões mais relevantes e os destaques do mês.
          </p>
          <Link
            href="/blog#newsletter"
            className="inline-block bg-white text-brand-600 font-semibold px-6 py-2.5 rounded-[6px] hover:bg-brand-50 transition-colors"
          >
            Assinar Newsletter
          </Link>
        </div>
      </div>
    </div>
  );
}

// ===========================
// Collapsible Section Component
// ===========================

function Section({
  title,
  icon,
  count,
  color,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`mb-6 bg-white rounded-[6px] border border-border-subtle overflow-hidden ${color ? `border-l-4 ${color}` : ''}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-raised transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-ink-muted">{icon}</span>
          <h3 className="font-bold text-ink-primary">{title}</h3>
          <span className="text-sm text-ink-muted bg-surface-deep px-2 py-0.5 rounded-full">{count}</span>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-ink-muted" /> : <ChevronDown className="w-5 h-5 text-ink-muted" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
