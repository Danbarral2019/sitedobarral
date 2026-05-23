'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Scale, ArrowLeft, ExternalLink, Calendar, User, Building2,
  Tag, BookOpen, Loader2, Sparkles
} from 'lucide-react';

interface DecisionDetail {
  id: string;
  tribunalCode: string;
  tribunalName: string;
  decisionType: string;
  decisionNumber: string;
  processNumber: string | null;
  title: string;
  ementa: string;
  fullText: string | null;
  summary: string | null;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: string | null;
  dataPublicacao: string | null;
  url: string | null;
  pdfUrl: string | null;
  themes: string;
  leiArticles: string;
  suggestedCourses: string | null;
  sourceRawData: string | null;
}

interface SumulaItem {
  ordem: string;
  texto: string;
  cancelled: boolean;
}
interface SumulaIrr {
  numero: string;
  rrNumero: string | null;
  publicadoEm: string | null;
  relator: string | null;
  titulo: string;
  tese: string;
}
interface SumulaResolucao {
  numero: string;
  ano: number | null;
  tipo: string | null;
  divulgadoEm: string | null;
}
interface SumulaPayload {
  situacao: 'CRIADA' | 'ALTERADA' | 'CANCELADA' | 'REVISTA';
  situacaoMotivo: string | null;
  observacao: string;
  tese: string;
  itens: SumulaItem[];
  irrs: SumulaIrr[];
  resolucoes: SumulaResolucao[];
  leiArticles: string[];
  cltArticles: string[];
}

function parseSumulaPayload(raw: string | null): SumulaPayload | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SumulaPayload;
  } catch {
    return null;
  }
}

const SITUACAO_BADGES: Record<SumulaPayload['situacao'], { label: string; cls: string }> = {
  CRIADA: { label: 'Criada', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  ALTERADA: { label: 'Alterada', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-red-100 text-red-800 border-red-200' },
  REVISTA: { label: 'Revista', cls: 'bg-gray-200 text-gray-800 border-gray-300' },
};

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const arr = JSON.parse(val);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function extractArticleNumbers(articles: string[]): number[] {
  return articles
    .map(a => {
      const match = a.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : NaN;
    })
    .filter(n => !isNaN(n));
}

function tribunalLabel(code: string): string {
  const map: Record<string, string> = {
    'tce-sp': 'TCE-SP',
    'tce-pr': 'TCE-PR',
    'tce-mg': 'TCE-MG',
    'tce-sc': 'TCE-SC',
    'tce-rj': 'TCE-RJ',
    'tce-rs': 'TCE-RS',
    'tce-pe': 'TCE-PE',
    'datajud-stj': 'DataJud (STJ)',
    tst: 'TST',
  };
  return map[code] || code.toUpperCase();
}

function tribunalColor(code: string): string {
  const colors: Record<string, string> = {
    'tce-sp': 'bg-blue-100 text-blue-800',
    'tce-mg': 'bg-green-100 text-green-800',
    'tce-pr': 'bg-purple-100 text-purple-800',
    'tce-sc': 'bg-sky-100 text-sky-800',
    'tce-rj': 'bg-orange-100 text-orange-800',
    'tce-rs': 'bg-violet-100 text-violet-800',
    'tce-pe': 'bg-teal-100 text-teal-800',
    'datajud-stj': 'bg-red-100 text-red-800',
    tst: 'bg-pink-100 text-pink-800',
  };
  return colors[code] || 'bg-gray-100 text-gray-800';
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
          setError('Decisão não encontrada');
        } else {
          setError('Erro ao carregar decisão');
        }
      } catch (err) {
        console.error('Failed to fetch decision:', err);
        setError('Erro ao carregar decisão');
      } finally {
        setLoading(false);
      }
    }

    fetchDecision();
  }, [id]);

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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{error || 'Decisão não encontrada'}</h1>
          <Link href="/jurisprudencia" className="text-blue-600 hover:text-blue-800 font-medium">
            Voltar para Jurisprudência
          </Link>
        </div>
      </main>
    );
  }

  const themes = parseJsonArray(decision.themes);
  const leiArticles = parseJsonArray(decision.leiArticles);
  const articleNumbers = extractArticleNumbers(leiArticles);
  const sourceUrl = decision.pdfUrl || decision.url;
  const isSumula = decision.decisionType === 'sumula';
  const sumula = isSumula ? parseSumulaPayload(decision.sourceRawData) : null;
  const sitBadge = sumula ? SITUACAO_BADGES[sumula.situacao] : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-white/80 mb-6">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <span>/</span>
            <Link href="/jurisprudencia" className="hover:text-white transition-colors">Jurisprudência</Link>
            <span>/</span>
            <span className="text-white">Decisão</span>
          </nav>

          <Link
            href="/jurisprudencia"
            className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Jurisprudência
          </Link>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${tribunalColor(decision.tribunalCode)}`}>
              {tribunalLabel(decision.tribunalCode)}
            </span>
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-sm font-medium rounded-full">
              {isSumula ? `Súmula nº ${decision.decisionNumber}` : decision.decisionType}
            </span>
            {sitBadge && (
              <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${sitBadge.cls}`}>
                {sitBadge.label}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {decision.title || decision.decisionNumber}
          </h1>
          {decision.processNumber && (
            <p className="text-white/80 text-sm">Processo: {decision.processNumber}</p>
          )}
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
          {decision.orgaoJulgador && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Building2 className="w-4 h-4" />
                Órgão Julgador
              </div>
              <div className="font-semibold text-gray-900">{decision.orgaoJulgador}</div>
            </div>
          )}
          {decision.dataJulgamento && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Julgamento
              </div>
              <div className="font-semibold text-gray-900">
                {new Date(decision.dataJulgamento).toLocaleDateString('pt-BR')}
              </div>
            </div>
          )}
          {decision.dataPublicacao && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Publicação
              </div>
              <div className="font-semibold text-gray-900">
                {new Date(decision.dataPublicacao).toLocaleDateString('pt-BR')}
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

        {/* Aviso de súmula cancelada/revista — preserva valor histórico */}
        {sumula && (sumula.situacao === 'CANCELADA' || sumula.situacao === 'REVISTA') && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 mb-6">
            <p className="text-amber-900 font-semibold mb-1">
              ⚠ Esta súmula encontra-se {sumula.situacao === 'CANCELADA' ? 'cancelada' : 'revista'}.
            </p>
            <p className="text-sm text-amber-800">
              O texto integral é preservado por valor histórico e jurisprudencial. Verifique sempre a versão vigente no site do TST antes de utilizar.
            </p>
            {sumula.situacaoMotivo && (
              <p className="text-sm text-amber-700 mt-2 italic">{sumula.situacaoMotivo}</p>
            )}
          </div>
        )}

        {/* Ementa (ou Tese, para súmulas) */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            {isSumula ? 'Tese' : 'Ementa'}
          </h2>
          {sumula && sumula.itens.length > 0 ? (
            <ol className="space-y-3 text-gray-700 leading-relaxed">
              {sumula.itens.map((it) => (
                <li key={it.ordem} className="flex gap-3">
                  <span className={`font-bold shrink-0 ${it.cancelled ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {it.ordem} -
                  </span>
                  <span className={it.cancelled ? 'line-through text-gray-500' : ''}>
                    {it.texto}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{decision.ementa}</p>
          )}
        </div>

        {/* IRRs (Incidentes de Recursos Repetitivos) — quando houver */}
        {sumula && sumula.irrs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Incidente(s) de Recursos Repetitivos (IRR)
            </h2>
            <div className="space-y-4">
              {sumula.irrs.map((irr) => (
                <div key={irr.numero} className="border-l-4 border-blue-300 pl-4">
                  <p className="font-semibold text-gray-900">IRR nº {irr.numero} — {irr.titulo}</p>
                  {irr.rrNumero && (
                    <p className="text-sm text-gray-600 mt-1">
                      {irr.rrNumero}
                      {irr.publicadoEm && ` · publicado em ${irr.publicadoEm}`}
                      {irr.relator && ` · rel. ${irr.relator}`}
                    </p>
                  )}
                  {irr.tese && <p className="text-sm text-gray-700 mt-2">{irr.tese}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resoluções (histórico) */}
        {sumula && sumula.resolucoes.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Histórico de resoluções
            </h2>
            <ul className="space-y-1 text-sm text-gray-700">
              {sumula.resolucoes.map((r, i) => (
                <li key={`${r.numero}-${i}`}>
                  <span className="font-mono font-medium">Res. {r.numero}</span>
                  {r.tipo && r.divulgadoEm && (
                    <span className="text-gray-600"> — {r.tipo} {r.divulgadoEm}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA Teaser */}
        <div className="bg-gradient-to-r from-amber-50 to-blue-50 border border-amber-200 rounded-xl p-5 mb-8 flex items-center gap-4">
          <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-gray-700 flex-1">
            Para análises completas com IA, acesse a{' '}
            <Link href="/planos" className="text-blue-600 font-semibold hover:underline">
              Área do Aluno
            </Link>
          </p>
        </div>

        {/* Themes */}
        {themes.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Temas
            </h2>
            <div className="flex flex-wrap gap-2">
              {themes.map((theme, i) => (
                <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Article References */}
        {articleNumbers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Artigos Relacionados (Lei 14.133/2021)
            </h2>
            <div className="flex flex-wrap gap-2">
              {articleNumbers.map((art) => (
                <Link
                  key={art}
                  href={`/artigo/${art}`}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
                >
                  Art. {art}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Source link */}
        {sourceUrl && (
          <div className="text-center">
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg"
            >
              <ExternalLink className="w-5 h-5" />
              {isSumula ? 'Inteiro teor no site do TST' : 'Ver decisão original'}
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
