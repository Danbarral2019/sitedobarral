import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { getAcervoIndex, getAcervoLatest } from '@/lib/acervo-counts';
import HomeSearch from '@/components/home/HomeSearch';

// Revalida de hora em hora: as contagens e o painel de últimas entradas
// mudam com a ingestão diária, não a cada requisição.
export const revalidate = 3600;

const PRECO_BASICO = process.env.NEXT_PUBLIC_PRICE_BASICO || '49,90';
const PRECO_PREMIUM = process.env.NEXT_PUBLIC_PRICE_PREMIUM || '89,90';

/**
 * Remove do texto legal os marcadores de tramitação que o Planalto embute no
 * meio da frase: "(Vide Decreto nº X)", "(Vigência)", "(Redação dada...)".
 * São ruído de publicação, não texto da lei, e quebram a leitura corrida.
 */
function limparTextoLegal(texto: string): string {
  return texto
    .replace(/\((?:Vide|Vigência|Redação dada|Incluído|Revogado)[^)]*\)/gi, '')
    .replace(/\s+Vigência\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatarData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

const ROTULOS: Record<string, string> = {
  informativo: 'Informativo TCU',
  parecer: 'Parecer AGU',
  'parecer-vinculante': 'Parecer vinculante',
  'nota-tecnica': 'Nota AGU',
  despacho: 'Despacho AGU',
  decor: 'DECOR',
  acordao: 'Acórdão TCU',
  'manual-tcu': 'Manual TCU',
  consulta_tcu: 'Consulta TCU',
  sumula: 'Súmula TCU',
  'orientacao-normativa': 'ON AGU',
  enunciados: 'Enunciado',
  'ato-normativo': 'Ato normativo',
};

/**
 * Vitrine do art. 75: mostra o produto em vez de descrevê-lo. O artigo e os
 * documentos relacionados vêm do banco (leiArticlesArr), então a seção
 * acompanha o acervo em vez de congelar um exemplo.
 */
async function getVitrineArt75() {
  try {
    const [artigo, relacionados] = await Promise.all([
      prisma.leiArticle.findFirst({
        where: { numero: '75' },
        select: { ementa: true, secao: true },
      }),
      prisma.document.findMany({
        where: { leiArticlesArr: { has: '75' }, isPublic: true },
        select: { id: true, title: true, category: true },
        take: 3,
      }),
    ]);
    if (!artigo?.ementa) return null;
    const paragrafos = artigo.ementa
      .split('\n\n')
      .slice(0, 3)
      .map(limparTextoLegal)
      .filter(Boolean);
    if (paragrafos.length === 0) return null;
    return { paragrafos, secao: artigo.secao, relacionados };
  } catch {
    return null;
  }
}

export default async function Home() {
  const [acervo, ultimas, vitrine] = await Promise.all([
    getAcervoIndex(),
    getAcervoLatest(4),
    getVitrineArt75(),
  ]);

  const linha = (key: string) => acervo.find((r) => r.key === key)?.count ?? 0;
  const temContagens = acervo.length > 0;

  return (
    <main className="bg-surface-page">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-[68px]">
        <div className="container mx-auto px-4 max-w-[1280px]">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-[72px] items-start">
            <div className="lg:w-[700px] flex-shrink-0">
              <p className="font-label text-ink-muted mb-5">
                Repositório de consulta · Licitações e contratos administrativos
              </p>

              <h1 className="font-display text-[2.5rem] md:text-[3.5rem] text-ink-primary mb-6">
                O texto da lei, o acórdão e o parecer na mesma busca.
              </h1>

              {temContagens && (
                <p className="text-[1.0625rem] leading-relaxed text-ink-secondary max-w-[62ch] mb-8">
                  Os {linha('lei')} artigos da Lei 14.133, {linha('atos').toLocaleString('pt-BR')} atos
                  normativos, {linha('agu').toLocaleString('pt-BR')} pareceres e notas da AGU,{' '}
                  {linha('acordaos').toLocaleString('pt-BR')} acórdãos do TCU e{' '}
                  {linha('tribunais').toLocaleString('pt-BR')} decisões de STF, STJ e Tribunais de
                  Contas. Cada peça com a fonte oficial e a data à vista.
                </p>
              )}

              <HomeSearch />
            </div>

            {ultimas.length > 0 && (
              <aside className="w-full lg:flex-1 bg-surface-raised border border-border-subtle rounded-md px-6 pt-5 pb-2">
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                  <p className="font-label text-ink-muted">Últimas entradas no acervo</p>
                  <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" aria-hidden="true" />
                    diário
                  </span>
                </div>

                {ultimas.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="block py-4 border-b border-border-subtle group"
                  >
                    <span className="flex items-baseline gap-2.5 mb-1.5">
                      <span className="font-mono text-xs text-ink-muted">
                        {formatarData(item.date)}
                      </span>
                      <span className="font-label text-[0.6875rem] text-ink-secondary bg-surface-deep rounded-[3px] px-2 py-0.5">
                        {item.label}
                      </span>
                    </span>
                    <span className="block font-serif text-[0.9375rem] leading-snug text-ink-primary line-clamp-2 group-hover:text-brand-600 transition-colors">
                      {item.title}
                    </span>
                  </Link>
                ))}

                <Link
                  href="/novidades"
                  className="block py-4 text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors"
                >
                  Ver tudo o que entrou
                </Link>
              </aside>
            )}
          </div>
        </div>
      </section>

      {/* ── Índice do acervo ─────────────────────────────────────────────── */}
      {temContagens && (
        <section className="border-t border-border-subtle py-16">
          <div className="container mx-auto px-4 max-w-[1280px]">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
              <div>
                <h2 className="font-heading text-[2rem] text-ink-primary mb-2">O que há no acervo</h2>
                <p className="text-[0.9375rem] text-ink-muted">
                  Selecionado e conferido peça a peça, com fonte e data em cada uma.
                </p>
              </div>
              <Link
                href="/base-conhecimento"
                className="text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors"
              >
                Ver todo o acervo
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16">
              {acervo.map((row) => (
                <Link
                  key={row.key}
                  href={row.href}
                  className="flex gap-5 py-5 border-t border-border-subtle group"
                >
                  <span className="font-mono text-2xl text-brand-600 w-[82px] text-right pr-3.5 border-r border-border-subtle flex-shrink-0 leading-tight">
                    {row.count.toLocaleString('pt-BR')}
                  </span>
                  <span>
                    <span className="block font-heading text-[1.125rem] text-ink-primary mb-0.5 group-hover:text-brand-600 transition-colors">
                      {row.label}
                    </span>
                    <span className="block text-sm leading-relaxed text-ink-muted">
                      {row.description}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Autoria ──────────────────────────────────────────────────────── */}
      <section className="bg-surface-raised border-y border-border-subtle py-11">
        <div className="container mx-auto px-4 max-w-[1280px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-7">
            <Image
              src="/images/professor/sobre.jpg"
              alt="Daniel Barral"
              width={92}
              height={92}
              className="w-[92px] h-[92px] rounded-full object-cover flex-shrink-0 border border-border-subtle"
            />
            <div className="flex-1">
              <p className="font-heading text-[1.375rem] text-ink-primary mb-1">Daniel Barral</p>
              <p className="font-label text-ink-muted mb-3">
                Procurador Federal · Mestre em Direito Público
              </p>
              <p className="font-reading text-ink-secondary max-w-[68ch]">
                O acervo é selecionado e mantido por mim. Cada peça publicada aqui passa por
                conferência de fonte e de data antes de entrar, e o texto oficial é reproduzido na
                íntegra, sem paráfrase.
              </p>
            </div>
            <Link
              href="/sobre"
              className="text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors flex-shrink-0"
            >
              Sobre o autor
            </Link>
          </div>
        </div>
      </section>

      {/* ── Como é uma consulta ──────────────────────────────────────────── */}
      {vitrine && (
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-[1280px]">
            <div className="mb-9">
              <h2 className="font-heading text-[2rem] text-ink-primary mb-2">Como é uma consulta</h2>
              <p className="text-[0.9375rem] text-ink-muted">
                O texto oficial de um lado, o que o acervo já reuniu sobre ele do outro.
              </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-14 items-start">
              <div className="lg:w-[660px] flex-shrink-0">
                <div className="flex flex-wrap items-baseline gap-4 pb-3.5 border-b border-border-subtle mb-5">
                  <span className="font-mono text-2xl text-brand-600">Art. 75</span>
                  {vitrine.secao && <span className="font-label text-ink-muted">{vitrine.secao}</span>}
                </div>

                <div className="bg-surface-raised border-l-4 border-brand-600 px-6 py-5 mb-4">
                  {vitrine.paragrafos.map((p, i) => (
                    <p
                      key={i}
                      className={`font-reading text-ink-primary max-w-[62ch] ${i > 0 ? 'mt-3.5' : ''}`}
                    >
                      {p}
                    </p>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3.5">
                  <span className="text-sm text-ink-muted">Lei 14.133/2021, redação vigente</span>
                  <span className="w-px h-3 bg-border-strong inline-block" aria-hidden="true" />
                  <a
                    href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-amber-accent-deep bg-amber-accent-soft rounded-[3px] px-2.5 py-1 transition-opacity hover:opacity-80"
                  >
                    Texto oficial no Planalto
                  </a>
                </div>

                <Link
                  href="/lei-14133?artigo=75"
                  className="inline-block mt-6 text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors"
                >
                  Abrir o artigo 75 na lei comentada
                </Link>
              </div>

              {vitrine.relacionados.length > 0 && (
                <div className="flex-1 w-full">
                  <p className="font-label text-ink-muted pb-3.5 border-b border-border-subtle">
                    O que o acervo reúne sobre este artigo
                  </p>
                  {vitrine.relacionados.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/documento/${doc.id}`}
                      className="block py-4 border-b border-border-subtle group"
                    >
                      <span className="font-label text-[0.6875rem] text-ink-secondary bg-surface-deep rounded-[3px] px-2 py-0.5 inline-block mb-2">
                        {ROTULOS[doc.category] ?? 'Documento'}
                      </span>
                      <span className="block font-serif text-[0.9375rem] leading-snug text-ink-secondary line-clamp-3 group-hover:text-brand-600 transition-colors">
                        {doc.title}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Acesso ───────────────────────────────────────────────────────── */}
      <section className="border-t border-border-subtle py-16">
        <div className="container mx-auto px-4 max-w-[1280px]">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-heading text-[2rem] text-ink-primary mb-2">Acesso</h2>
              <p className="text-[0.9375rem] text-ink-muted max-w-[74ch]">
                O acervo público fica aberto e continua aberto. A assinatura libera os documentos
                restritos, a análise por IA com as fontes citadas e os cursos.
              </p>
            </div>
            <Link
              href="/planos"
              className="text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors"
            >
              Comparar os planos
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-page border border-border-subtle rounded-md p-7">
              <p className="font-label text-ink-muted mb-3.5">Básico</p>
              <p className="font-heading text-[2rem] text-ink-primary">
                R$ {PRECO_BASICO}
                <span className="text-[0.9375rem] font-sans font-normal text-ink-muted"> por mês</span>
              </p>
              <p className="text-sm leading-relaxed text-ink-secondary my-4">
                Um curso à escolha, acervo restrito liberado e o assistente de IA com citação de
                fontes.
              </p>
              <Link
                href="/planos"
                className="inline-block text-sm font-semibold text-brand-600 border border-border-strong rounded-[3px] px-5 py-2.5 hover:bg-surface-raised transition-colors"
              >
                Assinar o Básico
              </Link>
            </div>

            <div className="bg-surface-page border border-border-strong rounded-md p-7">
              <p className="font-label text-ink-muted mb-3.5">Premium</p>
              <p className="font-heading text-[2rem] text-ink-primary">
                R$ {PRECO_PREMIUM}
                <span className="text-[0.9375rem] font-sans font-normal text-ink-muted"> por mês</span>
              </p>
              <p className="text-sm leading-relaxed text-ink-secondary my-4">
                Todos os cursos, o acervo restrito completo e o assistente de IA sem limite de
                consultas.
              </p>
              <Link
                href="/planos"
                className="inline-block text-sm font-semibold text-surface-page bg-brand-600 rounded-[3px] px-5 py-2.5 hover:bg-brand-800 transition-colors"
              >
                Assinar o Premium
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
