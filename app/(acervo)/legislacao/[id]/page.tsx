import { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  Scale,
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
import { getLeiArticles } from '@/lib/lei-articles';
import { formatLegalContent } from '@/lib/format-legal-content';
import { getRelationsForAct } from '@/lib/legislative-acts/relations';
import { RelationHistory } from '@/components/LegislativeActsPanel/RelationHistory';
import { normalizeActType, getOfficialSourceLabel } from '@/lib/legislacao/labels';
import { isIdentificacaoDoAto } from '@/lib/legislative-scrapers/extract-ementa';
import {
  subtituloDoAto,
  dataDoAto,
  dataPorExtenso,
  dataEmBrasilia,
  dataDePublicacao,
  orgaoEmissor,
  rotuloArtigo,
  ementaNoTexto,
} from '@/lib/legislacao/cabecalho';
import { referenciaDoRevogador } from '@/lib/legislacao/revogacao';
import { ultimaAlteracaoDoTexto } from '@/lib/legislacao/versoes';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Annex {
  name: string;
  url: string;
  type: string;
}

// `cache`: generateMetadata e a página leem o ato na mesma requisição com uma
// só consulta. A contagem de visualização fica só na página; antes as duas
// chamadas incrementavam, e cada acesso contava duas vezes.
const getLegislativeAct = cache(async (id: string) => {
  const act = await prisma.legislativeAct.findUnique({
    where: { id },
  });

  if (act) {
    return { ...act, fromDocument: false };
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
      fromDocument: true,
    };
  }

  return null;
});

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const act = await getLegislativeAct(resolvedParams.id);

  if (!act) {
    return {
      title: 'Ato Legislativo não encontrado',
    };
  }

  const subtitulo = subtituloDoAto(act.title);
  return {
    title: subtitulo ? `${act.fullNumber}: ${subtitulo}` : act.fullNumber,
    description: act.summary || act.ementa.substring(0, 160),
  };
}

export default async function LegislativeActPage({ params }: PageProps) {
  const resolvedParams = await params;
  const act = await getLegislativeAct(resolvedParams.id);

  if (!act) {
    notFound();
  }

  if (!act.fromDocument) {
    await prisma.legislativeAct.update({
      where: { id: act.id },
      data: { viewCount: { increment: 1 } },
    });
  }

  const actType = normalizeActType(act.type);
  const typeLabel = TYPE_LABELS[actType] || act.type.toUpperCase();
  // O tipo só entra como sobretítulo quando o número não o diz ("IN" →
  // "Instrução Normativa"; "Lei 8.666/1993" já diz "Lei").
  const showTypeLabel = !act.fullNumber.toLowerCase().startsWith(typeLabel.toLowerCase());
  const subtitulo = subtituloDoAto(act.title);
  const orgao = orgaoEmissor(act.issuer);
  const assinatura = dataDoAto(act.number, [act.title, act.content]);
  const publicacao = dataDePublicacao(act, assinatura);
  const metadados: Array<{ rotulo: string; valor: string }> = [
    ...(orgao ? [{ rotulo: 'Órgão emissor', valor: orgao }] : []),
    ...(assinatura ? [{ rotulo: 'Data do ato', valor: dataPorExtenso(assinatura) }] : []),
    ...(publicacao ? [{ rotulo: 'Publicação', valor: dataPorExtenso(publicacao) }] : []),
    ...(act.effectiveDate ? [{ rotulo: 'Vigência', valor: dataPorExtenso(act.effectiveDate) }] : []),
  ];
  // Ato revogador citado na nota ("Revogado pelo Decreto nº 11.531, de 2023"),
  // quando está na base, vira link no aviso.
  const refRevogador = act.revoked ? referenciaDoRevogador(act.revokedNote) : null;
  const revogador = refRevogador
    ? await prisma.legislativeAct.findFirst({
        where: {
          type: refRevogador.tipo,
          year: refRevogador.ano,
          number: { in: [refRevogador.numero, refRevogador.numero.replace(/\./g, '')] },
        },
        select: { id: true, fullNumber: true },
      })
    : null;

  // A ementa já abre o texto integral, logo abaixo do título do ato; o bloco
  // próprio só aparece quando o texto não a traz.
  const showEmenta = !isIdentificacaoDoAto(act.ementa) && !ementaNoTexto(act.ementa, act.content);

  // Parse leiArticles JSON string to array
  const leiArticlesArray: string[] = getLeiArticles(act);

  // Buscar relações entre atos (revoga/altera/regulamenta/etc.)
  // Se vier do fallback Document (não LegislativeAct), retorna vazio sem custo significativo
  const relations = await getRelationsForAct(act.id, { hideRejected: true });
  // Última mudança do texto (não só de apresentação) registrada no histórico.
  const textoAtualizadoEm = act.fromDocument ? null : await ultimaAlteracaoDoTexto(act.id, act.content);
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

        {/* Aviso de ato revogado. O ato continua acessível por link direto;
            nas buscas e listagens públicas, só o de consulta corrente
            (`revokedVisible`, ver lib/legislacao/visibilidade.ts). */}
        {act.revoked && (
          <div
            role="note"
            className="mb-6 rounded-[6px] border border-status-error-border bg-status-error-soft px-4 py-4 sm:px-6 text-status-error"
          >
            <p className="font-semibold">Ato revogado</p>
            <p className="text-sm mt-1">
              {act.revokedNote ? act.revokedNote.trim().replace(/\.?$/, '.') : 'Este ato normativo foi revogado e não está mais em vigor.'}
              {' '}Mantido na base para consulta.
              {revogador && (
                <>
                  {' '}
                  <Link href={`/legislacao/${revogador.id}`} className="font-semibold underline underline-offset-2">
                    Ver o {revogador.fullNumber}
                  </Link>
                </>
              )}
            </p>
          </div>
        )}

        {/* Header */}
        <header className="bg-white rounded-[6px] px-4 py-6 sm:p-8 mb-6 border border-border-subtle">
          <div className="flex items-center justify-between gap-4 mb-2 text-sm text-ink-muted">
            <span className="font-medium">{showTypeLabel ? typeLabel : null}</span>
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" aria-hidden="true" />
              {act.viewCount.toLocaleString('pt-BR')} visualizações
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink-primary">
            {act.fullNumber}
          </h1>
          {subtitulo && (
            <p className="text-lg text-ink-secondary mt-2 max-w-[65ch]">
              {subtitulo}
            </p>
          )}

          {metadados.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4 mt-6 pt-6 border-t border-border-subtle">
              {metadados.map(({ rotulo, valor }) => (
                <div key={rotulo}>
                  <dt className="text-xs font-medium text-ink-muted">{rotulo}</dt>
                  <dd className="text-sm text-ink-primary mt-0.5">{valor}</dd>
                </div>
              ))}
            </dl>
          )}

          {textoAtualizadoEm && (
            <p className="text-sm text-ink-secondary mt-4">
              Texto atualizado em {dataEmBrasilia(textoAtualizadoEm)}.{' '}
              <Link
                href={`/legislacao/${act.id}/alteracoes`}
                className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-600"
              >
                Ver o que mudou
              </Link>
            </p>
          )}

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
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  {getOfficialSourceLabel(act.officialUrl)}
                </a>
              )}
              {act.pdfUrl && (
                <a
                  href={act.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-border-strong text-ink-primary rounded-[6px] hover:bg-surface-raised transition-colors"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Baixar PDF
                </a>
              )}
            </div>
          )}
        </header>

        {/* Relações com outros atos — exibidas no topo para destaque imediato
            (revogações, alterações, regulamentações etc.). Só renderiza se houver. */}
        {hasRelations && (
          <RelationHistory
            alters={relations.alters}
            alteredBy={relations.alteredBy}
            currentHierarchyLevel={act.hierarchyLevel ?? undefined}
          />
        )}

        {/* Ementa. Ato sem ementa oficial guarda só a própria identificação
            no campo (ex.: IN nº 142/1983); repeti-la sob "Ementa" seria falso.
            Com texto integral que já a traz, o bloco seria repetição. */}
        {showEmenta && (
          <div className="bg-white rounded-[6px] px-4 py-6 sm:p-8 mb-6 border border-border-subtle">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink-primary mb-4">
              <FileText className="w-5 h-5 text-brand-600" aria-hidden="true" />
              Ementa
            </h2>
            {/* Ementa de ato normativo é leitura prolongada — mesma
                tipografia do texto da lei. */}
            <div className="font-reading text-ink-secondary max-w-[65ch]">
              {normalizeTextContent(act.ementa).map((p, i) => (
                <p key={i} className="mb-3 last:mb-0 text-justify hyphens-auto">{p}</p>
              ))}
            </div>
          </div>
        )}

        {/* Resumo Didático (se existir) */}
        {act.summary && (
          <div className="bg-brand-50 rounded-[6px] overflow-hidden mb-6 border border-border-subtle">
            {/* Header destacado */}
            <div className="bg-brand-600 px-6 py-4">
              <h2 className="flex items-center gap-3 text-lg font-bold text-white">
                <BookOpen className="w-6 h-6" aria-hidden="true" />
                Resumo Didático
              </h2>
            </div>
            {/* Conteúdo com Markdown */}
            <div className="p-6">
              <MarkdownContent content={act.summary} />
            </div>
          </div>
        )}

        {/* Conteúdo Completo */}
        {act.content ? (
          <div className="bg-white rounded-[6px] px-4 py-6 sm:p-8 border border-border-subtle">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink-primary mb-6">
              <Scale className="w-5 h-5 text-brand-600" aria-hidden="true" />
              Texto Integral
            </h2>
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
          <section className="bg-white rounded-[6px] px-4 py-6 sm:p-8 mt-6 border border-border-subtle">
            <h2 className="text-lg font-bold text-ink-primary mb-3">
              Artigos relacionados da Lei 14.133/2021
            </h2>
            <ul className="flex flex-wrap gap-2">
              {leiArticlesArray.map((articleNum) => (
                <li key={articleNum}>
                  <Link
                    href={`/artigo/${encodeURIComponent(articleNum)}`}
                    className="inline-flex items-center px-3 py-1 border border-border-subtle rounded-[6px] text-sm font-medium text-brand-700 hover:bg-surface-raised hover:border-border-strong transition-colors"
                  >
                    {rotuloArtigo(articleNum)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
