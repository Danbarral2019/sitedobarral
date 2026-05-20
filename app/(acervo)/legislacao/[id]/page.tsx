import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  Calendar,
  Scale,
  Building,
  ExternalLink,
  Download,
  FileText,
  FileDown,
  ArrowLeft,
  Eye,
  BookOpen
} from 'lucide-react';
import MarkdownContent from '@/components/MarkdownContent';
import { normalizeTextContent } from '@/lib/utils';
import { parseLeiArticles, getLeiArticles } from '@/lib/lei-articles';
import { formatLegalContent } from '@/lib/format-legal-content';
import { getRelationsForAct } from '@/lib/legislative-acts/relations';
import { RelationHistory } from '@/components/LegislativeActsPanel/RelationHistory';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Annex {
  name: string;
  url: string;
  type: string;
}

async function getLegislativeAct(id: string) {
  const act = await prisma.legislativeAct.findUnique({
    where: { id },
  });

  if (act) {
    await prisma.legislativeAct.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
    return act;
  }

  // Fallback: check Document table (for boas-praticas items)
  const doc = await prisma.document.findUnique({
    where: { id },
  });

  if (doc && (doc.category === 'boa_pratica' || doc.category === 'orientacao_procedimento')) {
    return {
      id: doc.id,
      type: doc.category,
      number: null,
      year: null,
      fullNumber: doc.title,
      title: doc.title,
      ementa: doc.description || '',
      summary: null,
      content: doc.content || null,
      issuer: doc.issuerOrg || 'Não informado',
      publishDate: doc.douData || doc.uploadedAt,
      effectiveDate: null,
      hierarchyLevel: null,
      leiArticles:
        doc.leiArticlesArr.length > 0 ? JSON.stringify(doc.leiArticlesArr) : '[]',
      officialUrl: doc.douUrl || doc.url || null,
      pdfUrl: doc.url || null,
      viewCount: 0,
      status: 'active',
      annexesJson: null,
      createdAt: doc.uploadedAt,
      updatedAt: doc.uploadedAt,
    };
  }

  return null;
}

const TYPE_LABELS: Record<string, string> = {
  'decreto': 'Decreto',
  'portaria': 'Portaria',
  'in': 'Instrução Normativa',
  'ordem-servico': 'Ordem de Serviço',
  'lei': 'Lei',
  'medida-provisoria': 'Medida Provisória',
  'boa_pratica': 'Outro Ato Normativo',
  'orientacao_procedimento': 'Orientação',
  'resolucao': 'Resolução',
};

const TYPE_COLORS: Record<string, string> = {
  'decreto': 'bg-blue-100 text-blue-800 border-blue-300',
  'portaria': 'bg-green-100 text-green-800 border-green-300',
  'in': 'bg-purple-100 text-purple-800 border-purple-300',
  'ordem-servico': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'lei': 'bg-red-100 text-red-800 border-red-300',
  'medida-provisoria': 'bg-orange-100 text-orange-800 border-orange-300',
  'boa_pratica': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'orientacao_procedimento': 'bg-amber-100 text-amber-800 border-amber-300',
  'resolucao': 'bg-teal-100 text-teal-800 border-teal-300',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const act = await getLegislativeAct(resolvedParams.id);

  if (!act) {
    return {
      title: 'Ato Legislativo não encontrado',
    };
  }

  return {
    title: `${act.fullNumber} - ${act.title} | Prof. Daniel Barral`,
    description: act.summary || act.ementa.substring(0, 160),
  };
}

export default async function LegislativeActPage({ params }: PageProps) {
  const resolvedParams = await params;
  const act = await getLegislativeAct(resolvedParams.id);

  if (!act) {
    notFound();
  }

  const typeLabel = TYPE_LABELS[act.type] || act.type.toUpperCase();
  const typeColor = TYPE_COLORS[act.type] || 'bg-gray-100 text-gray-800 border-gray-300';

  // Parse leiArticles JSON string to array
  const leiArticlesArray: string[] = getLeiArticles(act);

  // Buscar relações entre atos (revoga/altera/regulamenta/etc.)
  // Se vier do fallback Document (não LegislativeAct), retorna vazio sem custo significativo
  const relations = await getRelationsForAct(act.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link
          href="/legislacao"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Legislação
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${typeColor}`}>
                  {typeLabel}
                </span>
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {act.viewCount} visualizações
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {act.fullNumber}
              </h1>
              <h2 className="text-xl text-gray-700 mb-4">
                {act.title}
              </h2>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <Building className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Órgão Emissor</p>
                <p className="text-sm font-medium text-gray-900">{act.issuer}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Publicação</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(act.publishDate).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {act.effectiveDate && (
              <div className="flex items-start gap-3">
                <Scale className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Vigência</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(act.effectiveDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Links */}
          {(act.officialUrl || act.pdfUrl) && (
            <div className="flex flex-wrap gap-3 mt-6">
              {act.officialUrl && (
                <a
                  href={act.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver no Planalto
                </a>
              )}
              {act.pdfUrl && (
                <a
                  href={act.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </a>
              )}
            </div>
          )}
        </div>

        {/* Ementa */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            Ementa
          </h3>
          <div className="prose prose-slate max-w-none prose-p:text-gray-700 prose-p:leading-relaxed prose-p:text-justify prose-p:mb-3">
            {normalizeTextContent(act.ementa).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        {/* Resumo Didático (se existir) */}
        {act.summary && (
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl shadow-lg overflow-hidden mb-6">
            {/* Header destacado */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <h3 className="flex items-center gap-3 text-lg font-bold text-white">
                <BookOpen className="w-6 h-6" />
                Resumo Didático
              </h3>
            </div>
            {/* Conteúdo com Markdown */}
            <div className="p-6">
              <MarkdownContent content={act.summary} />
            </div>
          </div>
        )}

        {/* Conteúdo Completo */}
        {act.content ? (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-6">
              <Scale className="w-5 h-5 text-blue-600" />
              Texto Integral
            </h3>
            <MarkdownContent content={formatLegalContent(act.content)} />

            {/* Anexos */}
            {(() => {
              let annexes: Annex[] = [];
              try {
                if (act.annexesJson) {
                  annexes = JSON.parse(act.annexesJson);
                }
              } catch { /* ignore invalid JSON */ }

              if (annexes.length === 0) return null;

              return (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-600" />
                    Anexos
                  </h4>
                  <div className="space-y-2">
                    {annexes.map((annex, i) => (
                      <a
                        key={i}
                        href={annex.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-blue-300 transition-colors group"
                      >
                        {annex.type === 'pdf' ? (
                          <FileDown className="w-5 h-5 text-red-500 flex-shrink-0" />
                        ) : (
                          <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        )}
                        <span className="flex-1 text-sm text-gray-700 group-hover:text-blue-700">
                          {annex.name}
                        </span>
                        <span className="text-xs text-gray-400 uppercase font-medium">
                          {annex.type}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Texto integral ainda não disponível
                </h3>
                <p className="text-gray-500 max-w-md">
                  O texto completo deste ato normativo ainda não foi incorporado à nossa base.
                  {act.officialUrl && ' Você pode consultar o texto na fonte oficial.'}
                </p>
              </div>
              {act.officialUrl && (
                <a
                  href={act.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Consultar fonte oficial
                </a>
              )}
            </div>
          </div>
        )}

        {/* Histórico de relações (este ato altera / é alterado por outros) */}
        <RelationHistory
          alters={relations.alters}
          alteredBy={relations.alteredBy}
          currentHierarchyLevel={act.hierarchyLevel ?? undefined}
        />

        {/* Artigos Relacionados da Lei 14.133 */}
        {leiArticlesArray.length > 0 && (
          <div className="bg-amber-50 border-l-4 border-amber-600 rounded-xl shadow-md p-6 mt-6">
            <h3 className="text-lg font-bold text-amber-900 mb-3">
              🔗 Artigos Relacionados da Lei 14.133/2021
            </h3>
            <div className="flex flex-wrap gap-2">
              {leiArticlesArray.map((articleNum) => (
                <Link
                  key={articleNum}
                  href={`/artigos?numero=${articleNum}`}
                  className="inline-flex items-center px-3 py-1 bg-white border border-amber-300 rounded-lg text-amber-800 hover:bg-amber-100 transition-colors text-sm font-medium"
                >
                  Art. {articleNum}º
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
