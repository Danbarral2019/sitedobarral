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
  fullIdentifier?: string;
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

/**
 * Formata o badge "Súmula nº N", "OJ-SBDI-I nº N", "Precedente Normativo nº N" etc.
 * conforme o decisionType + fullIdentifier do documento.
 */
function formatDecisionBadge(
  fullIdentifier: string,
  decisionType: string,
  decisionNumber: string,
): string {
  if (decisionType === 'sumula') {
    return `Súmula nº ${decisionNumber}`;
  }
  if (decisionType === 'precedente_normativo') {
    return `Precedente Normativo nº ${decisionNumber}`;
  }
  if (decisionType === 'orientacao_jurisprudencial') {
    // fullIdentifier ex.: "TST OJ-SBDI-I 31" / "TST OJ-SDC 5" / "TST OJ-TP/OE 1"
    // Extrai a série após "TST " e antes do número final.
    const m = /^TST\s+(OJ-[A-Z0-9/IT-]+(?:\s+Transitória)?)\s+\d+$/i.exec(fullIdentifier);
    if (m) return `${m[1]} nº ${decisionNumber}`;
    return `OJ nº ${decisionNumber}`;
  }
  // Outros tipos (acórdão, decisão, parecer prévio) usam decisionType + número
  return `${decisionType} ${decisionNumber}`;
}

const SITUACAO_BADGES: Record<SumulaPayload['situacao'], { label: string; cls: string }> = {
  CRIADA: { label: 'Criada', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  ALTERADA: { label: 'Alterada', cls: 'bg-amber-accent-soft text-amber-accent-deep border-amber-accent-soft' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-red-100 text-red-800 border-red-200' },
  REVISTA: { label: 'Revista', cls: 'bg-surface-deep text-ink-secondary border-border-subtle' },
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
    'tce-sp': 'bg-brand-100 text-brand-800',
    'tce-mg': 'bg-green-100 text-green-800',
    'tce-pr': 'bg-brand-100 text-brand-800',
    'tce-sc': 'bg-brand-100 text-brand-800',
    'tce-rj': 'bg-amber-accent-soft text-amber-accent-deep',
    'tce-rs': 'bg-brand-100 text-brand-800',
    'tce-pe': 'bg-brand-100 text-brand-800',
    'datajud-stj': 'bg-red-100 text-red-800',
    tst: 'bg-brand-100 text-brand-800',
  };
  return colors[code] || 'bg-surface-deep text-ink-secondary';
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
        <Loader2 className="w-12 h-12 animate-spin text-brand-600" />
      </main>
    );
  }

  if (error || !decision) {
    return (
      <main className="min-h-screen bg-surface-raised flex items-center justify-center">
        <div className="text-center">
          <Scale className="w-16 h-16 text-ink-muted mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-ink-primary mb-2">{error || 'Decisão não encontrada'}</h1>
          <Link href="/jurisprudencia" className="text-brand-600 hover:text-brand-800 font-medium">
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
  // Documentos canônicos do TST (Súmulas, OJs, PNs) usam o mesmo render
  // condicional: badge de situação, banner amarelo p/ canceladas, itens
  // romanos com strike, timeline de resoluções, IRRs (quando houver).
  const CANONICAL_TYPES = ['sumula', 'orientacao_jurisprudencial', 'precedente_normativo'];
  const isCanonical = CANONICAL_TYPES.includes(decision.decisionType);
  const isSumula = decision.decisionType === 'sumula'; // mantido por compatibilidade local
  const sumula = isCanonical ? parseSumulaPayload(decision.sourceRawData) : null;
  const sitBadge = sumula ? SITUACAO_BADGES[sumula.situacao] : null;

  return (
    <main className="min-h-screen bg-brand-50">
      {/* Header */}
      <div className="bg-brand-600 text-white py-12">
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
            <span className="px-3 py-1 bg-white/20 text-sm font-medium rounded-full">
              {isCanonical
                ? formatDecisionBadge(decision.fullIdentifier ?? '', decision.decisionType, decision.decisionNumber)
                : decision.decisionType}
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
            <div className="bg-white rounded-[6px] border p-4">
              <div className="flex items-center gap-2 text-ink-muted text-sm mb-1">
                <User className="w-4 h-4" />
                Relator
              </div>
              <div className="font-semibold text-ink-primary">{decision.relator}</div>
            </div>
          )}
          {decision.orgaoJulgador && (
            <div className="bg-white rounded-[6px] border p-4">
              <div className="flex items-center gap-2 text-ink-muted text-sm mb-1">
                <Building2 className="w-4 h-4" />
                Órgão Julgador
              </div>
              <div className="font-semibold text-ink-primary">{decision.orgaoJulgador}</div>
            </div>
          )}
          {decision.dataJulgamento && (
            <div className="bg-white rounded-[6px] border p-4">
              <div className="flex items-center gap-2 text-ink-muted text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Julgamento
              </div>
              <div className="font-semibold text-ink-primary">
                {new Date(decision.dataJulgamento).toLocaleDateString('pt-BR')}
              </div>
            </div>
          )}
          {decision.dataPublicacao && (
            <div className="bg-white rounded-[6px] border p-4">
              <div className="flex items-center gap-2 text-ink-muted text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Publicação
              </div>
              <div className="font-semibold text-ink-primary">
                {new Date(decision.dataPublicacao).toLocaleDateString('pt-BR')}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        {decision.summary && (
          <div className="bg-brand-50 border border-brand-200 rounded-[6px] p-6 mb-8">
            <h2 className="text-lg font-bold text-brand-900 mb-3 flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Resumo
            </h2>
            <p className="text-brand-800 leading-relaxed">{decision.summary}</p>
          </div>
        )}

        {/* Aviso de súmula cancelada/revista — preserva valor histórico */}
        {sumula && (sumula.situacao === 'CANCELADA' || sumula.situacao === 'REVISTA') && (
          <div className="bg-amber-accent-soft border border-amber-accent rounded-[6px] p-5 mb-6">
            <p className="text-amber-accent-deep font-semibold mb-1">
              ⚠ Esta súmula encontra-se {sumula.situacao === 'CANCELADA' ? 'cancelada' : 'revista'}.
            </p>
            <p className="text-sm text-amber-accent-deep">
              O texto integral é preservado por valor histórico e jurisprudencial. Verifique sempre a versão vigente no site do TST antes de utilizar.
            </p>
            {sumula.situacaoMotivo && (
              <p className="text-sm text-amber-accent-deep mt-2 italic">{sumula.situacaoMotivo}</p>
            )}
          </div>
        )}

        {/* Ementa (ou Tese, para súmulas) */}
        <div className="bg-white rounded-[6px] border p-6 mb-8">
          <h2 className="text-lg font-bold text-ink-primary mb-3">
            {isCanonical ? 'Tese' : 'Ementa'}
          </h2>
          {sumula && sumula.itens.length > 0 ? (
            <ol className="space-y-3 text-ink-secondary leading-relaxed">
              {sumula.itens.map((it) => (
                <li key={it.ordem} className="flex gap-3">
                  <span className={`font-bold shrink-0 ${it.cancelled ? 'line-through text-ink-muted' : 'text-ink-primary'}`}>
                    {it.ordem} -
                  </span>
                  <span className={it.cancelled ? 'line-through text-ink-muted' : ''}>
                    {it.texto}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-ink-secondary leading-relaxed whitespace-pre-line">{decision.ementa}</p>
          )}
        </div>

        {/* IRRs (Incidentes de Recursos Repetitivos) — quando houver */}
        {sumula && sumula.irrs.length > 0 && (
          <div className="bg-white rounded-[6px] border p-6 mb-8">
            <h2 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Incidente(s) de Recursos Repetitivos (IRR)
            </h2>
            <div className="space-y-4">
              {sumula.irrs.map((irr) => (
                <div key={irr.numero} className="border-l-4 border-brand-300 pl-4">
                  <p className="font-semibold text-ink-primary">IRR nº {irr.numero} — {irr.titulo}</p>
                  {irr.rrNumero && (
                    <p className="text-sm text-ink-muted mt-1">
                      {irr.rrNumero}
                      {irr.publicadoEm && ` · publicado em ${irr.publicadoEm}`}
                      {irr.relator && ` · rel. ${irr.relator}`}
                    </p>
                  )}
                  {irr.tese && <p className="text-sm text-ink-secondary mt-2">{irr.tese}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resoluções (histórico) */}
        {sumula && sumula.resolucoes.length > 0 && (
          <div className="bg-white rounded-[6px] border p-6 mb-8">
            <h2 className="text-lg font-bold text-ink-primary mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Histórico de resoluções
            </h2>
            <ul className="space-y-1 text-sm text-ink-secondary">
              {sumula.resolucoes.map((r, i) => (
                <li key={`${r.numero}-${i}`}>
                  <span className="font-mono font-medium">Res. {r.numero}</span>
                  {r.tipo && r.divulgadoEm && (
                    <span className="text-ink-muted"> — {r.tipo} {r.divulgadoEm}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA Teaser */}
        <div className="bg-brand-50 border border-amber-accent-soft rounded-[6px] p-5 mb-8 flex items-center gap-4">
          <Sparkles className="w-5 h-5 text-amber-accent-deep shrink-0" />
          <p className="text-sm text-ink-secondary flex-1">
            Para análises completas com IA, acesse a{' '}
            <Link href="/planos" className="text-brand-600 font-semibold hover:underline">
              Área do Aluno
            </Link>
          </p>
        </div>

        {/* Themes */}
        {themes.length > 0 && (
          <div className="bg-white rounded-[6px] border p-6 mb-8">
            <h2 className="text-lg font-bold text-ink-primary mb-3 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Temas
            </h2>
            <div className="flex flex-wrap gap-2">
              {themes.map((theme, i) => (
                <span key={i} className="px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-sm font-medium">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Article References */}
        {articleNumbers.length > 0 && (
          <div className="bg-white rounded-[6px] border p-6 mb-8">
            <h2 className="text-lg font-bold text-ink-primary mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Artigos Relacionados (Lei 14.133/2021)
            </h2>
            <div className="flex flex-wrap gap-2">
              {articleNumbers.map((art) => (
                <Link
                  key={art}
                  href={`/artigo/${art}`}
                  className="px-3 py-1.5 bg-brand-50 text-brand-700 rounded-[6px] text-sm font-medium hover:bg-brand-100 transition-colors"
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
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-[6px] font-bold hover:bg-brand-700 transition-colors border border-border-subtle"
            >
              <ExternalLink className="w-5 h-5" />
              {isCanonical ? 'Inteiro teor no site do TST' : 'Ver decisão original'}
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
