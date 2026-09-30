'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { ConviteLoginIA } from '@/components/ia/ConviteLoginIA';
import { ArrowLeft, Scale, Search, Sparkles, Filter, BookOpen, FileText, Target } from 'lucide-react';

interface LeiPreviewHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onlyWithDocuments: boolean;
  onToggleOnlyWithDocs: () => void;
  totalArticles: number;
  totalWithDocs: number;
}

export function LeiPreviewHeader({
  searchQuery,
  onSearchChange,
  onlyWithDocuments,
  onToggleOnlyWithDocs,
  totalArticles,
  totalWithDocs,
}: LeiPreviewHeaderProps) {
  const { isAuthenticated } = useAuth();
  const [mostrarConvite, setMostrarConvite] = useState(false);
  const coveragePct = totalArticles > 0 ? Math.round((totalWithDocs / totalArticles) * 100) : 0;
  const LEI_COM_IA = '/area-restrita/lei-comentada';

  return (
    <div className="bg-brand-700 text-white border border-border-subtle">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Início</span>
          </Link>
          <Link
            href="/area-restrita"
            className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-[6px] hover:bg-white/30 transition-colors text-sm"
          >
            Área Restrita
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <Scale className="w-8 h-8" />
          <div>
            <h1 className="text-3xl font-bold">Lei 14.133/2021 Comentada</h1>
            <p className="text-brand-100">Nova Lei de Licitações e Contratos Administrativos</p>
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
              className="w-full pl-10 pr-4 py-3 rounded-[6px] bg-white text-ink-primary placeholder-ink-muted focus:ring-2 focus:ring-brand-300"
            />
          </div>
          {/* A busca com IA exige login: quem está logado vai para a Lei
              comentada da área restrita; o visitante vê o convite. */}
          {isAuthenticated ? (
            <Link
              href={LEI_COM_IA}
              className="px-4 py-3 rounded-[6px] flex items-center gap-2 transition-colors bg-brand-600 text-white hover:bg-brand-700"
              title="Busca semântica com IA"
            >
              <Sparkles className="w-5 h-5" />
              <span className="hidden sm:inline">Buscar com IA</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setMostrarConvite((v) => !v)}
              aria-expanded={mostrarConvite}
              className="px-4 py-3 rounded-[6px] flex items-center gap-2 transition-colors bg-brand-600 text-white hover:bg-brand-700"
              title="Busca semântica com IA (requer login)"
            >
              <Sparkles className="w-5 h-5" />
              <span className="hidden sm:inline">Buscar com IA</span>
            </button>
          )}
          <button
            onClick={onToggleOnlyWithDocs}
            className={`px-4 py-3 rounded-[6px] flex items-center gap-2 transition-colors ${
              onlyWithDocuments ? 'bg-white text-brand-700' : 'bg-brand-500 text-white hover:bg-brand-400'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">{onlyWithDocuments ? 'Mostrar todos' : 'Apenas com docs'}</span>
          </button>
        </div>

        {mostrarConvite && !isAuthenticated && (
          <div className="mt-4 bg-white rounded-[6px] border border-border-subtle">
            <ConviteLoginIA returnTo={LEI_COM_IA} />
          </div>
        )}

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
