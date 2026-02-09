/**
 * Script para sincronizar sites recomendados conforme curadoria do professor.
 *
 * Uso:
 *   npx tsx scripts/sync-recommended-sites.ts           # executa
 *   npx tsx scripts/sync-recommended-sites.ts --dry-run  # simula sem alterar
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Load .env.local
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

// ==================== DESIRED STATE ====================

interface SiteSpec {
  title: string;
  description: string;
  url: string;
  category: string;
  displayOrder: number;
}

const DESIRED_SITES: SiteSpec[] = [
  // ── Legislação ──
  {
    title: 'Planalto — Lei 14.133/2021 (Nova Lei de Licitações)',
    description: 'Texto integral da Lei nº 14.133/2021 no portal do Planalto',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
    category: 'Legislação',
    displayOrder: 100,
  },
  {
    title: 'Portal da Legislação Federal',
    description: 'Acervo completo de leis, decretos e atos normativos federais',
    url: 'https://legislacao.planalto.gov.br',
    category: 'Legislação',
    displayOrder: 101,
  },
  {
    title: 'LexML Brasil',
    description: 'Rede de informação legislativa e jurídica brasileira',
    url: 'https://www.lexml.gov.br',
    category: 'Legislação',
    displayOrder: 102,
  },
  {
    title: 'Diário Oficial da União (DOU)',
    description: 'Publicações oficiais do Governo Federal',
    url: 'https://www.in.gov.br/servicos/diario-oficial-da-uniao',
    category: 'Legislação',
    displayOrder: 103,
  },
  {
    title: 'Compras Governamentais — NLLC',
    description: 'Portal do governo com informações sobre a Nova Lei de Licitações e Contratos',
    url: 'https://www.gov.br/compras/pt-br/nllc/',
    category: 'Legislação',
    displayOrder: 104,
  },

  // ── Jurisprudência ──
  {
    title: 'TCU — Pesquisa de Jurisprudência',
    description: 'Busca de acórdãos e decisões do Tribunal de Contas da União',
    url: 'https://pesquisa.apps.tcu.gov.br',
    category: 'Jurisprudência',
    displayOrder: 200,
  },
  {
    title: 'STJ — Superior Tribunal de Justiça',
    description: 'Jurisprudência e súmulas do STJ',
    url: 'https://www.stj.jus.br',
    category: 'Jurisprudência',
    displayOrder: 201,
  },
  {
    title: 'STF — Supremo Tribunal Federal',
    description: 'Jurisprudência e decisões do STF',
    url: 'https://www.stf.jus.br',
    category: 'Jurisprudência',
    displayOrder: 202,
  },
  {
    title: 'JusBrasil',
    description: 'Pesquisa de jurisprudência, legislação e doutrinas',
    url: 'https://www.jusbrasil.com.br',
    category: 'Jurisprudência',
    displayOrder: 203,
  },

  // ── Doutrina e produção acadêmica ──
  {
    title: 'Portal de Periódicos CAPES',
    description: 'Acesso a artigos científicos e publicações acadêmicas',
    url: 'https://www.periodicos.capes.gov.br',
    category: 'Doutrina e produção acadêmica',
    displayOrder: 300,
  },
  {
    title: 'Revista de Direito Administrativo (RDA)',
    description: 'Publicação acadêmica de referência em Direito Administrativo',
    url: 'https://bibliotecadigital.fgv.br/ojs/index.php/rda',
    category: 'Doutrina e produção acadêmica',
    displayOrder: 301,
  },

  // ── Órgãos de controle e orientação normativa ──
  {
    title: 'TCU — Manual de Licitações e Contratos',
    description: 'Orientações e jurisprudência do TCU sobre licitações',
    url: 'https://licitacoesecontratos.tcu.gov.br',
    category: 'Órgãos de controle e orientação normativa',
    displayOrder: 400,
  },
  {
    title: 'AGU — Advocacia-Geral da União',
    description: 'Portal institucional da AGU',
    url: 'https://www.gov.br/agu/pt-br',
    category: 'Órgãos de controle e orientação normativa',
    displayOrder: 401,
  },
  {
    title: 'AGU — Orientações Normativas',
    description: 'Orientações normativas e pareceres vinculantes da AGU',
    url: 'https://www.gov.br/agu/pt-br/composicao/cgu/modelos-de-licitacoes-e-contratos',
    category: 'Órgãos de controle e orientação normativa',
    displayOrder: 402,
  },
  {
    title: 'AGU — Modelos de Licitações e Contratos',
    description: 'Modelos padronizados de editais, contratos e atas de registro de preços',
    url: 'https://www.gov.br/agu/pt-br/composicao/consultoria-geral-da-uniao-1/modelos-de-licitacoes-e-contratos',
    category: 'Órgãos de controle e orientação normativa',
    displayOrder: 403,
  },
  {
    title: 'CGU — Controladoria-Geral da União',
    description: 'Portal da CGU — controle interno e combate à corrupção',
    url: 'https://www.gov.br/cgu/pt-br',
    category: 'Órgãos de controle e orientação normativa',
    displayOrder: 404,
  },

  // ── Sistemas e portais de compras ──
  {
    title: 'PNCP — Portal Nacional de Contratações Públicas',
    description: 'Portal oficial de publicidade das contratações públicas',
    url: 'https://www.gov.br/pncp/pt-br',
    category: 'Sistemas e portais de compras',
    displayOrder: 500,
  },
  {
    title: 'Ministério da Gestão — Compras e Contratos',
    description: 'Políticas e normas de contratações do Governo Federal',
    url: 'https://www.gov.br/gestao/pt-br/assuntos/contratacoes-publicas',
    category: 'Sistemas e portais de compras',
    displayOrder: 501,
  },

  // ── Bases de preços e custos referenciais ──
  {
    title: 'Banco de Preços',
    description: 'Plataforma de pesquisa de preços para contratações públicas',
    url: 'https://www.bancodeprecos.com.br',
    category: 'Bases de preços e custos referenciais',
    displayOrder: 600,
  },
  {
    title: 'BPS — Banco de Preços em Saúde',
    description: 'Referência de preços para compras na área de saúde',
    url: 'https://bps.saude.gov.br',
    category: 'Bases de preços e custos referenciais',
    displayOrder: 601,
  },
  {
    title: 'SINAPI — Sistema Nacional de Pesquisa de Custos',
    description: 'Custos e índices da construção civil (IBGE/Caixa)',
    url: 'https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9270-sistema-nacional-de-pesquisa-de-custos-e-indices-da-construcao-civil.html',
    category: 'Bases de preços e custos referenciais',
    displayOrder: 602,
  },
  {
    title: 'SICRO — Sistema de Custos de Obras Rodoviárias',
    description: 'Sistema de custos referenciais de obras rodoviárias (DNIT)',
    url: 'https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/custos-e-pagamentos/custos-e-pagamentos-702/sistemas-de-custos/sicro',
    category: 'Bases de preços e custos referenciais',
    displayOrder: 603,
  },

  // ── Transparência e dados abertos ──
  {
    title: 'Portal da Transparência',
    description: 'Gastos e transferências do Governo Federal',
    url: 'https://portaldatransparencia.gov.br',
    category: 'Transparência e dados abertos',
    displayOrder: 700,
  },
  {
    title: 'Tesouro Nacional Transparente',
    description: 'Dados fiscais e orçamentários do Tesouro Nacional',
    url: 'https://www.tesourotransparente.gov.br',
    category: 'Transparência e dados abertos',
    displayOrder: 701,
  },
  {
    title: 'Painel de Compras do Governo Federal',
    description: 'Dashboard com dados de compras e contratações federais',
    url: 'https://paineldecompras.economia.gov.br',
    category: 'Transparência e dados abertos',
    displayOrder: 702,
  },
  {
    title: 'Portal de Dados Abertos do Governo Federal',
    description: 'Dados abertos para transparência e inovação',
    url: 'https://dados.gov.br',
    category: 'Transparência e dados abertos',
    displayOrder: 703,
  },

  // ── Capacitação e comunidade ──
  {
    title: 'INCP Brasil',
    description: 'Instituto Nacional de Contratações Públicas — cursos e eventos',
    url: 'https://incpbrasil.com.br/',
    category: 'Capacitação e comunidade',
    displayOrder: 800,
  },
  {
    title: 'ENAP — Escola Nacional de Administração Pública',
    description: 'Capacitação de servidores públicos',
    url: 'https://www.enap.gov.br',
    category: 'Capacitação e comunidade',
    displayOrder: 801,
  },
  {
    title: 'ENAP — Cursos sobre Licitações e Contratos',
    description: 'Cursos gratuitos online sobre contratações públicas',
    url: 'https://www.escolavirtual.gov.br',
    category: 'Capacitação e comunidade',
    displayOrder: 802,
  },
  {
    title: 'Comunidade de Compras (Gov.br)',
    description: 'Comunidade de prática para profissionais de compras públicas',
    url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/comunidade-de-compras',
    category: 'Capacitação e comunidade',
    displayOrder: 803,
  },
  {
    title: 'Fórum Nacional de Contratações Públicas',
    description: 'Espaço de debate e padronização das contratações públicas',
    url: 'https://www.gov.br/agu/pt-br/composicao/consultoria-geral-da-uniao-1/forum-nacional',
    category: 'Capacitação e comunidade',
    displayOrder: 804,
  },

  // ── Referências internacionais ──
  {
    title: 'UNCITRAL — Nações Unidas',
    description: 'Legislação modelo de compras públicas internacionais',
    url: 'https://uncitral.un.org/en/texts/procurement',
    category: 'Referências internacionais',
    displayOrder: 900,
  },
  {
    title: 'OCDE — Compras Públicas',
    description: 'Boas práticas e estudos da OCDE sobre contratações públicas',
    url: 'https://www.oecd.org/governance/public-procurement/',
    category: 'Referências internacionais',
    displayOrder: 901,
  },
];

// URLs to keep (normalized to compare)
const desiredUrls = new Set(DESIRED_SITES.map((s) => normalizeUrl(s.url)));

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove trailing slash, lowercase host
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

function getFaviconUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}/favicon.ico`;
  } catch {
    return '';
  }
}

async function main() {
  console.log(`\n🔄 Sincronizando sites recomendados${dryRun ? ' (DRY RUN)' : ''}...\n`);

  // 1. Fetch current sites
  const currentSites = await prisma.recommendedSite.findMany({
    include: { courses: true },
  });

  console.log(`📊 Sites atuais no banco: ${currentSites.length}`);
  console.log(`📊 Sites desejados: ${DESIRED_SITES.length}\n`);

  // Build map: normalizedUrl → existing site
  const currentByUrl = new Map<string, typeof currentSites[0]>();
  for (const site of currentSites) {
    currentByUrl.set(normalizeUrl(site.url), site);
  }

  // 2. Delete sites not in desired list
  let deletedCount = 0;
  for (const site of currentSites) {
    const normUrl = normalizeUrl(site.url);
    if (!desiredUrls.has(normUrl)) {
      console.log(`  ❌ Remover: ${site.title} (${site.url})`);
      if (!dryRun) {
        await prisma.recommendedSite.delete({ where: { id: site.id } });
      }
      deletedCount++;
    }
  }

  // 3. Create or update sites
  let createdCount = 0;
  let updatedCount = 0;

  for (const spec of DESIRED_SITES) {
    const normUrl = normalizeUrl(spec.url);
    const existing = currentByUrl.get(normUrl);

    if (existing) {
      // Update if title, description, category, or order changed
      const needsUpdate =
        existing.title !== spec.title ||
        existing.description !== spec.description ||
        existing.category !== spec.category ||
        existing.displayOrder !== spec.displayOrder;

      if (needsUpdate) {
        console.log(`  🔄 Atualizar: ${spec.title} (cat: ${spec.category}, order: ${spec.displayOrder})`);
        if (!dryRun) {
          await prisma.recommendedSite.update({
            where: { id: existing.id },
            data: {
              title: spec.title,
              description: spec.description,
              category: spec.category,
              displayOrder: spec.displayOrder,
              isActive: true,
            },
          });
        }
        updatedCount++;
      }
    } else {
      // Create new
      console.log(`  ✅ Criar: ${spec.title} (${spec.category})`);
      if (!dryRun) {
        const site = await prisma.recommendedSite.create({
          data: {
            title: spec.title,
            description: spec.description,
            url: spec.url,
            faviconUrl: getFaviconUrl(spec.url),
            category: spec.category,
            displayOrder: spec.displayOrder,
            isActive: true,
          },
        });
        // Associate with all courses (course "1" at minimum)
        await prisma.siteToCourse.create({
          data: { siteId: site.id, courseId: '1' },
        });
      }
      createdCount++;
    }
  }

  console.log(`\n📊 Resultado:`);
  console.log(`  ✅ Criados: ${createdCount}`);
  console.log(`  🔄 Atualizados: ${updatedCount}`);
  console.log(`  ❌ Removidos: ${deletedCount}`);
  console.log(`  📊 Total final: ${DESIRED_SITES.length}\n`);

  if (dryRun) {
    console.log('⚠️  Modo dry-run — nenhuma alteração foi realizada.\n');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
