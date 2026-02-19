'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Scale, ArrowLeft, ExternalLink, Calendar, User, Building2,
  Tag, BookOpen, Loader2
} from 'lucide-react';

interface DecisionDetail {
  id: string;
  tribunal: string;
  tribunalType: string;
  decisionNumber: string;
  decisionType: string;
  judgeDate: string | null;
  publishDate: string | null;
  relator: string | null;
  orgao: string | null;
  ementa: string;
  summary: string | null;
  themes: string[];
  articleReferences: number[];
  sourceUrl: string | null;
  relevanceScore: number;
}

export default function JurisprudenciaDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [decision, setDecision] = useState<DecisionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function fetchDecision() {
      try {
        const res = await fetch(`/api/jurisprudencia/${id}`);
        if (res.ok) {
          const data = await res.json();
          setDecision(data);
        } else if (res.status === 404) {
          setError('Decisao nao encontrada');
        } else {
          setError('Erro ao carregar decisao');
        }
      } catch (err) {
        console.error('Failed to fetch decision:', err);
        setError('Erro ao carregar decisao');
      } finally {
        setLoading(false);
      }
    }

    fetchDecision();
  }, [id]);

  const tribunalColor = (t: string) => {
    const colors: Record<string, string> = {
      'TCE-SP': 'bg-blue-100 text-blue-800',
      'TCE-MG': 'bg-green-100 text-green-800',
      'TCE-PR': 'bg-purple-100 text-purple-800',
      'TCU': 'bg-red-100 text-red-800',
    };
    return colors[t] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  if (error || !decision) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Scale className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{error || 'Decisao nao encontrada'}</h1>
          <Link href="/jurisprudencia" className="text-blue-600 hover:text-blue-800 font-medium">
            Voltar para Jurisprudencia
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-white/80 mb-6">
            <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
            <span>/</span>
            <Link href="/jurisprudencia" className="hover:text-white transition-colors">Jurisprudencia</Link>
            <span>/</span>
            <span className="text-white">Decisao</span>
          </nav>

          <Link
            href="/jurisprudencia"
            className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Jurisprudencia
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${tribunalColor(decision.tribunal)} bg-opacity-90`}>
              {decision.tribunal}
            </span>
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-sm font-medium rounded-full">
              {decision.decisionType}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {decision.decisionNumber}
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Metadata grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {decision.relator && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <User className="w-4 h-4" />
                Relator
              </div>
              <div className="font-semibold text-gray-900">{decision.relator}</div>
            </div>
          )}
          {decision.orgao && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Building2 className="w-4 h-4" />
                Orgao
              </div>
              <div className="font-semibold text-gray-900">{decision.orgao}</div>
            </div>
          )}
          {decision.judgeDate && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Julgamento
              </div>
              <div className="font-semibold text-gray-900">
                {new Date(decision.judgeDate).toLocaleDateString('pt-BR')}
              </div>
            </div>
          )}
          {decision.publishDate && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Publicacao
              </div>
              <div className="font-semibold text-gray-900">
                {new Date(decision.publishDate).toLocaleDateString('pt-BR')}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        {decision.summary && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Resumo
            </h2>
            <p className="text-blue-800 leading-relaxed">{decision.summary}</p>
          </div>
        )}

        {/* Ementa */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Ementa</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{decision.ementa}</p>
        </div>

        {/* Themes */}
        {decision.themes.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Temas
            </h2>
            <div className="flex flex-wrap gap-2">
              {decision.themes.map((theme, i) => (
                <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Article References */}
        {decision.articleReferences.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Artigos Relacionados
            </h2>
            <div className="flex flex-wrap gap-2">
              {decision.articleReferences.map((art) => (
                <Link
                  key={art}
                  href={`/artigo/${art}`}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
                >
                  Art. {art} da Lei 14.133
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Source link */}
        {decision.sourceUrl && (
          <div className="text-center">
            <a
              href={decision.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg"
            >
              <ExternalLink className="w-5 h-5" />
              Ver decisao original
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
