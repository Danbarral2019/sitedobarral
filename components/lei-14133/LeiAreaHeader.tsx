'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  History,
  Heart,
  Scale,
  Search,
  Sparkles,
  Filter,
  BookOpen,
  FileText,
  Target,
  Loader2,
} from 'lucide-react';

interface LeiAreaHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAISearch: () => void;
  isAISearching: boolean;
  onlyWithDocuments: boolean;
  onToggleOnlyWithDocs: () => void;
  totalArticles: number;
  totalWithDocs: number;
}

export function LeiAreaHeader({
  searchQuery,
  onSearchChange,
  onAISearch,
  isAISearching,
  onlyWithDocuments,
  onToggleOnlyWithDocs,
  totalArticles,
  totalWithDocs,
}: LeiAreaHeaderProps) {
  const coveragePct = totalArticles > 0 ? Math.round((totalWithDocs / totalArticles) * 100) : 0;
  const aiDisabled = searchQuery.trim().length < 3 || isAISearching;

  return (
    <div className="bg-brand-600 text-surface-page">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/area-restrita"
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Área Restrita</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/area-restrita/historico-ia"
              className="flex items-center gap-2 bg-surface-page/20 px-3 py-1.5 rounded-lg hover:bg-surface-page/30 transition-colors"
            >
              <History className="w-5 h-5" />
              <span className="hidden sm:inline">Histórico</span>
            </Link>
            <Link
              href="/area-restrita/favoritos"
              className="flex items-center gap-2 bg-surface-page/20 px-3 py-1.5 rounded-lg hover:bg-surface-page/30 transition-colors"
            >
              <Heart className="w-5 h-5" />
              <span className="hidden sm:inline">Favoritos</span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <Scale className="w-8 h-8" />
          <div>
            <h1 className="text-3xl font-bold">Lei 14.133/2021 Comentada</h1>
            <p className="text-ink-muted">Nova Lei de Licitações e Contratos Administrativos</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
            <input
              type="text"
              placeholder="Pergunte algo como: 'Quando usar dispensa de licitação?' ou busque por artigo…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !aiDisabled) onAISearch();
              }}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-surface-page text-ink-primary placeholder:text-ink-muted focus:ring-2 focus:ring-amber-accent"
            />
          </div>
          <button
            onClick={onAISearch}
            disabled={aiDisabled}
            className={`px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
              aiDisabled
                ? 'bg-border-strong text-white cursor-not-allowed'
                : 'bg-brand-600 text-white hover:bg-brand-700'
            }`}
            title="Busca semântica com IA"
          >
            {isAISearching ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            <span className="hidden sm:inline">Buscar com IA</span>
          </button>
          <button
            onClick={onToggleOnlyWithDocs}
            className={`px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
              onlyWithDocuments ? 'bg-surface-page text-brand-700' : 'bg-surface-raised0 text-white hover:bg-brand-400'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">{onlyWithDocuments ? 'Mostrar todos' : 'Apenas com docs'}</span>
          </button>
        </div>

        <div className="mt-4 flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>{totalArticles} artigos</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>{totalWithDocs} com documentos</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            <span>{coveragePct}% cobertura</span>
          </div>
        </div>
      </div>
    </div>
  );
}
