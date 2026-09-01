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
      revoked: false,
      revokedNote: null,
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
  'decreto': 'bg-brand-100 text-brand-800 border-brand-300',
  'portaria': 'bg-green-100 text-green-800 border-green-300',
  'in': 'bg-brand-100 text-brand-800 border-brand-300',
  'ordem-servico': 'bg-amber-accent-soft text-amber-accent-deep border-amber-accent',
  'lei': 'bg-red-100 text-red-800 border-red-300',
  'medida-provisoria': 'bg-amber-accent-soft text-amber-accent-deep border-amber-accent',
  'boa_pratica': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'orientacao_procedimento': 'bg-amber-accent-soft text-amber-accent-deep border-amber-accent',
  'resolucao': 'bg-brand-100 text-brand-800 border-brand-300',
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
    title: `${act.fullNumber} - ${act.title}`,
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
  const typeColor = TYPE_COLORS[act.type] || 'bg-surface-deep text-ink-secondary border-border-subtle';

  // Parse leiArticles JSON string to array
  const leiArticlesArray: string[] = getLeiArticles(act);

  // Buscar relações entre atos (revoga/altera/regulamenta/etc.)
  // Se vier do fallback Document (não LegislativeAct), retorna vazio sem custo significativo
  const relations = await getRelationsForAct(act.id);
  const hasRelations = relations.alters.length > 0 || relations.alteredBy.length > 0;

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link
          href="/legislacao"
          className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Legislação
        </Link>

        {/* Banner de ato revogado — o ato continua acessível por link direto,
            mas com aviso destacado (não aparece em buscas/listagens públicas). */}
        {act.revoked && (
          <div className="mb-6 rounded-[6px] border-2 border-red-300 bg-red-50 p-5 flex items-start gap-3">
            <span className="text-2xl leading-none" aria-hidden="true">🚫</span>
            <div>
              <p className="font-bold text-red-800">Ato revogado</p>
              <p className="text-sm text-red-700 mt-1">
                {act.revokedNote
                  ? act.revokedNote
                  : 'Este ato normativo foi revogado e não está mais em vigor. Mantido na base apenas para consulta histórica.'}
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-[6px] p-8 mb-6 border border-border-subtle">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${typeColor}`}>
                  {typeLabel}
                </span>
                <span className="text-sm text-ink-muted flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {act.viewCount} visualizações
                </span>
              </div>
              <h1 className="text-3xl font-bold text-ink-primary mb-2">
                {act.fullNumber}
              </h1>
              <h2 className="text-xl text-ink-secondary mb-4">
                {act.title}
              </h2>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-surface-raised rounded-[6px]">
            <div className="flex items-start gap-3">
              <Building className="w-5 h-5 text-ink-muted mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-ink-muted uppercase tracking-wide">Órgão Emissor</p>
                <p className="text-sm font-medium text-ink-primary">{act.issuer}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-ink-muted mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-ink-muted uppercase tracking-wide">Publicação</p>
                <p className="text-sm font-medium text-ink-primary">
                  {new Date(act.publishDate).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {act.effectiveDate && (
              <div className="flex items-start gap-3">
                <Scale className="w-5 h-5 text-ink-muted mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-ink-muted uppercase tracking-wide">Vigência</p>
                  <p className="text-sm font-medium text-ink-primary">
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-[6px] hover:bg-brand-700 transition-colors"
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-[6px] hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </a>
              )}
            </div>
          )}
        </div>

        {/* Relações com outros atos — exibidas no topo para destaque imediato
            (revogações, alterações, regulamentações etc.). Só renderiza se houver. */}
        {hasRelations && (
          <RelationHistory
            alters={relations.alters}
            alteredBy={relations.alteredBy}
            currentHierarchyLevel={act.hierarchyLevel ?? undefined}
          />
        )}

        {/* Ementa */}
        <div className="bg-white rounded-[6px] p-8 mb-6 border border-border-subtle">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ink-primary mb-4">
            <FileText className="w-5 h-5 text-brand-600" />
            Ementa
          </h3>
          {/* Ementa de ato normativo é leitura prolongada — mesma
              tipografia do texto da lei. */}
          <div className="font-reading text-ink-secondary max-w-[65ch]">
            {normalizeTextContent(act.ementa).map((p, i) => (
              <p key={i} className="mb-3 last:mb-0 text-justify hyphens-auto">{p}</p>
            ))}
          </div>
        </div>

        {/* Resumo Didático (se existir) */}
        {act.summary && (
          <div className="bg-brand-50 rounded-[6px] overflow-hidden mb-6 border border-border-subtle">
            {/* Header destacado */}
            <div className="bg-brand-600 px-6 py-4">
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
          <div className="bg-white rounded-[6px] p-8 border border-border-subtle">
            <h3 className="flex items-center gap-2 text-lg font-bold text-ink-primary mb-6">
              <Scale className="w-5 h-5 text-brand-600" />
              Texto Integral
            </h3>
            <MarkdownContent
              content={formatLegalContent(act.content)}
              variant="planalto"
            />

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
                <div className="mt-8 pt-6 border-t border-border-subtle">
                  <h4 className="text-base font-bold text-ink-primary mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5 text-brand-600" />
                    Anexos
                  </h4>
                  <div className="space-y-2">
                    {annexes.map((annex, i) => (
                      <a
                        key={i}
                        href={annex.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-[6px] border border-border-subtle hover:bg-surface-raised hover:border-brand-300 transition-colors group"
                      >
                        {annex.type === 'pdf' ? (
                          <FileDown className="w-5 h-5 text-red-500 flex-shrink-0" />
                        ) : (
                          <FileText className="w-5 h-5 text-brand-500 flex-shrink-0" />
                        )}
                        <span className="flex-1 text-sm text-ink-secondary group-hover:text-brand-700">
                          {annex.name}
                        </span>
                        <span className="text-xs text-ink-muted uppercase font-medium">
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
          <div className="bg-white rounded-[6px] p-8 text-center border border-border-subtle">
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 bg-surface-deep rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-ink-muted" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-ink-secondary mb-2">
                  Texto integral ainda não disponível
                </h3>
                <p className="text-ink-muted max-w-md">
                  O texto completo deste ato normativo ainda não foi incorporado à nossa base.
                  {act.officialUrl && ' Você pode consultar o texto na fonte oficial.'}
                </p>
              </div>
              {act.officialUrl && (
                <a
                  href={act.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-[6px] hover:bg-brand-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Consultar fonte oficial
                </a>
              )}
            </div>
          </div>
        )}

        {/* Artigos Relacionados da Lei 14.133 */}
        {leiArticlesArray.length > 0 && (
          <div className="bg-amber-accent-soft border-l-4 border-amber-accent rounded-[6px] p-6 mt-6">
            <h3 className="text-lg font-bold text-amber-accent-deep mb-3">
              🔗 Artigos Relacionados da Lei 14.133/2021
            </h3>
            <div className="flex flex-wrap gap-2">
              {leiArticlesArray.map((articleNum) => (
                <Link
                  key={articleNum}
                  href={`/artigos?numero=${articleNum}`}
                  className="inline-flex items-center px-3 py-1 bg-white border border-amber-accent rounded-[6px] text-ink-primary hover:bg-amber-accent-soft transition-colors text-sm font-medium"
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
