/**
 * Popular Sites Recomendados para Licitações e Contratos
 *
 * Lista base curada (~40 sites) + descrições didáticas via Gemini
 * Sites são globais (associados a todos os cursos com matrículas)
 *
 * Uso:
 *   cd sitedobarral
 *   npx tsx scripts/populate-recommended-sites.ts --dry-run    # Simular
 *   npx tsx scripts/populate-recommended-sites.ts --force      # Atualizar existentes
 *   npx tsx scripts/populate-recommended-sites.ts              # Executar
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- CLI args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

function getArgValue(flag: string, defaultValue: number): number {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    const val = parseInt(args[idx + 1], 10);
    return isNaN(val) ? defaultValue : val;
  }
  return defaultValue;
}

const LIMIT = getArgValue('--limit', 0);
const DELAY_MS = 1500;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

// --- Gemini ---
async function callGemini(prompt: string, maxTokens = 4096): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text.trim();
  }
  throw new Error('Resposta do Gemini sem texto');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Lista curada de sites ---
interface SiteEntry {
  title: string;
  url: string;
  category: string;
  description?: string; // Se vazio, será gerado pelo Gemini
}

const CURATED_SITES: SiteEntry[] = [
  // === Legislação e Normas ===
  {
    title: 'Planalto - Lei 14.133/2021',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
    category: 'Legislação',
  },
  {
    title: 'Planalto - Lei 8.666/1993 (revogada)',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8666cons.htm',
    category: 'Legislação',
  },
  {
    title: 'Planalto - Lei 10.520/2002 (Pregão - revogada)',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10520.htm',
    category: 'Legislação',
  },
  {
    title: 'Planalto - Lei Complementar 123/2006 (ME/EPP)',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm',
    category: 'Legislação',
  },
  {
    title: 'Planalto - Decreto 11.462/2023 (Regulamenta a Lei 14.133)',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/d11462.htm',
    category: 'Legislação',
  },
  {
    title: 'Portal da Legislação Federal',
    url: 'https://legislacao.planalto.gov.br',
    category: 'Legislação',
  },
  {
    title: 'LexML Brasil',
    url: 'https://www.lexml.gov.br',
    category: 'Legislação',
  },

  // === Tribunais de Contas ===
  {
    title: 'TCU - Tribunal de Contas da União',
    url: 'https://portal.tcu.gov.br',
    category: 'Controle',
  },
  {
    title: 'TCU - Pesquisa de Jurisprudência',
    url: 'https://pesquisa.apps.tcu.gov.br',
    category: 'Controle',
  },
  {
    title: 'TCU - Manual de Licitações e Contratos',
    url: 'https://licitacoesecontratos.tcu.gov.br',
    category: 'Controle',
  },
  {
    title: 'TCU - Licitações e Contratos (publicações)',
    url: 'https://portal.tcu.gov.br/licitacoes-e-contratos-do-tcu/',
    category: 'Controle',
  },
  {
    title: 'IRB - Instituto Rui Barbosa (Tribunais de Contas)',
    url: 'https://irbcontas.org.br',
    category: 'Controle',
  },

  // === AGU e Advocacia Pública ===
  {
    title: 'AGU - Advocacia-Geral da União',
    url: 'https://www.gov.br/agu/pt-br',
    category: 'Advocacia Pública',
  },
  {
    title: 'AGU - Orientações Normativas',
    url: 'https://www.gov.br/agu/pt-br/composicao/cgu/modelos-de-licitacoes-e-contratos',
    category: 'Advocacia Pública',
  },
  {
    title: 'AGU - Modelos de Licitações e Contratos',
    url: 'https://www.gov.br/agu/pt-br/composicao/consultoria-geral-da-uniao-1/modelos-de-licitacoes-e-contratos',
    category: 'Advocacia Pública',
  },

  // === Sistemas de Compras Públicas ===
  {
    title: 'PNCP - Portal Nacional de Contratações Públicas',
    url: 'https://www.gov.br/pncp/pt-br',
    category: 'Sistemas',
  },
  {
    title: 'ComprasGov (antigo ComprasNet)',
    url: 'https://www.gov.br/compras/pt-br',
    category: 'Sistemas',
  },
  {
    title: 'Painel de Compras do Governo Federal',
    url: 'https://paineldecompras.economia.gov.br',
    category: 'Sistemas',
  },
  {
    title: 'Banco de Preços',
    url: 'https://www.bancodeprecos.com.br',
    category: 'Sistemas',
  },
  {
    title: 'BPS - Banco de Preços em Saúde',
    url: 'https://bps.saude.gov.br',
    category: 'Sistemas',
  },
  {
    title: 'SICRO - Sistema de Custos de Obras Rodoviárias',
    url: 'https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/custos-e-pagamentos/custos-e-pagamentos-702/sistemas-de-custos/sicro',
    category: 'Sistemas',
  },
  {
    title: 'SINAPI - Sistema Nacional de Pesquisa de Custos',
    url: 'https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9270-sistema-nacional-de-pesquisa-de-custos-e-indices-da-construcao-civil.html',
    category: 'Sistemas',
  },

  // === Órgãos e Entidades ===
  {
    title: 'CGU - Controladoria-Geral da União',
    url: 'https://www.gov.br/cgu/pt-br',
    category: 'Controle',
  },
  {
    title: 'ENAP - Escola Nacional de Administração Pública',
    url: 'https://www.enap.gov.br',
    category: 'Capacitação',
  },
  {
    title: 'ENAP - Cursos sobre Licitações e Contratos',
    url: 'https://www.escolavirtual.gov.br',
    category: 'Capacitação',
  },
  {
    title: 'Ministério da Gestão - Compras e Contratos',
    url: 'https://www.gov.br/gestao/pt-br/assuntos/contratacoes-publicas',
    category: 'Governo',
  },
  {
    title: 'Portal de Dados Abertos do Governo Federal',
    url: 'https://dados.gov.br',
    category: 'Governo',
  },

  // === Jurisprudência ===
  {
    title: 'STJ - Superior Tribunal de Justiça',
    url: 'https://www.stj.jus.br',
    category: 'Jurisprudência',
  },
  {
    title: 'STF - Supremo Tribunal Federal',
    url: 'https://www.stf.jus.br',
    category: 'Jurisprudência',
  },
  {
    title: 'CNJ - Conselho Nacional de Justiça',
    url: 'https://www.cnj.jus.br',
    category: 'Jurisprudência',
  },
  {
    title: 'JusBrasil',
    url: 'https://www.jusbrasil.com.br',
    category: 'Jurisprudência',
  },

  // === Referência e Pesquisa ===
  {
    title: 'Zênite - Informação e Consultoria em Licitações',
    url: 'https://www.zenite.blog.br',
    category: 'Referência',
  },
  {
    title: 'Nações Unidas - UNCITRAL (Compras Públicas Internacionais)',
    url: 'https://uncitral.un.org/en/texts/procurement',
    category: 'Referência',
  },
  {
    title: 'OCDE - Compras Públicas',
    url: 'https://www.oecd.org/governance/public-procurement/',
    category: 'Referência',
  },
  {
    title: 'Portal de Periódicos CAPES',
    url: 'https://www.periodicos.capes.gov.br',
    category: 'Referência',
  },
  {
    title: 'Revista de Direito Administrativo (RDA)',
    url: 'https://bibliotecadigital.fgv.br/ojs/index.php/rda',
    category: 'Referência',
  },

  // === Transparência ===
  {
    title: 'Portal da Transparência',
    url: 'https://portaldatransparencia.gov.br',
    category: 'Transparência',
  },
  {
    title: 'Diário Oficial da União (DOU)',
    url: 'https://www.in.gov.br/servicos/diario-oficial-da-uniao',
    category: 'Transparência',
  },
  {
    title: 'Tesouro Nacional Transparente',
    url: 'https://www.tesourotransparente.gov.br',
    category: 'Transparência',
  },

  // === Capacitação Adicional ===
  {
    title: 'Comunidade de Compras (Gov.br)',
    url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/comunidade-de-compras',
    category: 'Capacitação',
  },
  {
    title: 'Fórum Nacional de Contratações Públicas',
    url: 'https://www.gov.br/agu/pt-br/composicao/consultoria-geral-da-uniao-1/forum-nacional',
    category: 'Capacitação',
  },
];

// --- Gerar descrições via Gemini ---
async function generateDescriptions(sites: SiteEntry[]): Promise<Map<string, string>> {
  const descriptions = new Map<string, string>();
  const BATCH_SIZE = 15;

  for (let i = 0; i < sites.length; i += BATCH_SIZE) {
    const batch = sites.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(sites.length / BATCH_SIZE);

    console.log(`Batch ${batchNum}/${totalBatches}: gerando descrições para ${batch.length} sites...`);

    const sitesList = batch
      .map((s, idx) => `${idx + 1}. "${s.title}" — ${s.url} (categoria: ${s.category})`)
      .join('\n');

    const prompt = `Você é um professor de Direito Administrativo que recomenda sites úteis a seus alunos de licitações e contratos.

Para cada site abaixo, escreva uma descrição didática de 2-3 frases que:
- Explique o que o aluno encontrará no site
- Destaque a utilidade prática para quem estuda ou trabalha com licitações e contratos
- Use linguagem acessível e direta

Sites:
${sitesList}

Retorne um JSON array com objetos: { "title": "título exato do site", "description": "descrição gerada" }
Mantenha a mesma ordem e os mesmos títulos.`;

    try {
      const raw = await callGemini(prompt, 4096);
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.title && item.description) {
            descriptions.set(item.title, item.description);
          }
        }
        console.log(`  ✓ ${parsed.length} descrições geradas`);
      }
    } catch (err) {
      console.error(`  ✗ Erro no batch ${batchNum}:`, (err as Error).message);
      // Fallback: use title as description
      for (const site of batch) {
        descriptions.set(site.title, `${site.title} — recurso útil para profissionais e estudantes de licitações e contratos administrativos.`);
      }
      console.log(`  → Fallback: ${batch.length} descrições genéricas`);
    }

    if (i + BATCH_SIZE < sites.length) {
      await sleep(DELAY_MS);
    }
  }

  return descriptions;
}

// --- Favicon helper ---
function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).origin;
    return `${domain}/favicon.ico`;
  } catch {
    return '';
  }
}

// --- Main ---
async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  Popular Sites Recomendados                      ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log();
  console.log(`Configuração:`);
  console.log(`  DRY_RUN: ${DRY_RUN}`);
  console.log(`  FORCE: ${FORCE}`);
  console.log(`  LIMIT: ${LIMIT || 'sem limite'}`);
  console.log(`  Sites na lista curada: ${CURATED_SITES.length}`);

  if (!GEMINI_API_KEY) {
    console.error('\n✗ GEMINI_API_KEY não encontrada em .env.local');
    process.exit(1);
  }

  // Check existing
  const existing = await prisma.recommendedSite.findMany({ select: { url: true, title: true } });
  const existingUrls = new Set(existing.map(s => s.url));
  console.log(`Sites existentes no banco: ${existing.length}`);

  // Filter out already existing URLs
  let sites = CURATED_SITES.filter(s => FORCE || !existingUrls.has(s.url));
  console.log(`Sites novos a processar: ${sites.length}`);

  if (LIMIT > 0) sites = sites.slice(0, LIMIT);

  if (sites.length === 0) {
    console.log('\nNenhum site novo para adicionar. Use --force para atualizar existentes.');
    await prisma.$disconnect();
    return;
  }

  // Generate descriptions via Gemini
  console.log('\n--- Gerando descrições via Gemini ---\n');
  const descriptions = await generateDescriptions(sites);

  // Get all course IDs for global association
  const courseIds = await prisma.enrollment.groupBy({ by: ['courseId'] });
  const allCourseIds = courseIds.map(c => c.courseId);
  console.log(`\nCursos para associação: ${allCourseIds.join(', ') || '(nenhum)'}`);

  // Upsert sites
  console.log('\n--- Inserindo sites ---\n');
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    const description = descriptions.get(site.title) || site.description || `${site.title} — recurso para licitações e contratos.`;
    const faviconUrl = getFaviconUrl(site.url);

    const existingSite = await prisma.recommendedSite.findFirst({ where: { url: site.url } });

    if (existingSite && !FORCE) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] ${existingSite ? 'Atualizaria' : 'Criaria'}: "${site.title}" (${site.category})`);
      if (existingSite) updated++;
      else created++;
      continue;
    }

    const data = {
      title: site.title,
      description,
      url: site.url,
      faviconUrl,
      category: site.category,
      displayOrder: i + existing.length,
      isActive: true,
    };

    let siteRecord;
    if (existingSite) {
      siteRecord = await prisma.recommendedSite.update({
        where: { id: existingSite.id },
        data,
      });
      updated++;
    } else {
      siteRecord = await prisma.recommendedSite.create({ data });
      created++;
    }

    // Create course associations (global: all courses)
    for (const courseId of allCourseIds) {
      const existingLink = await prisma.siteToCourse.findUnique({
        where: { siteId_courseId: { siteId: siteRecord.id, courseId } },
      });
      if (!existingLink) {
        await prisma.siteToCourse.create({
          data: { siteId: siteRecord.id, courseId, displayOrder: i },
        });
      }
    }
  }

  // Also ensure existing sites are linked to all courses
  if (!DRY_RUN && allCourseIds.length > 0) {
    const allSites = await prisma.recommendedSite.findMany({ select: { id: true } });
    let linksCreated = 0;
    for (const site of allSites) {
      for (const courseId of allCourseIds) {
        const existingLink = await prisma.siteToCourse.findUnique({
          where: { siteId_courseId: { siteId: site.id, courseId } },
        });
        if (!existingLink) {
          await prisma.siteToCourse.create({
            data: { siteId: site.id, courseId, displayOrder: 0 },
          });
          linksCreated++;
        }
      }
    }
    if (linksCreated > 0) {
      console.log(`  Links curso adicionais criados: ${linksCreated}`);
    }
  }

  // Summary
  const finalCount = await prisma.recommendedSite.count();
  const linkCount = await prisma.siteToCourse.count();
  const categories = await prisma.recommendedSite.groupBy({
    by: ['category'],
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  });

  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║                   RESUMO FINAL                   ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  Total de sites no banco: ${String(finalCount).padEnd(23)}║`);
  console.log(`║  Criados: ${String(created).padEnd(38)}║`);
  console.log(`║  Atualizados: ${String(updated).padEnd(34)}║`);
  console.log(`║  Pulados: ${String(skipped).padEnd(38)}║`);
  console.log(`║  Links site→curso: ${String(linkCount).padEnd(29)}║`);
  if (DRY_RUN) {
    console.log('║  ⚠️  MODO DRY-RUN (nada gravado)                 ║');
  }
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log('║  Categorias:                                     ║');
  for (const cat of categories) {
    const name = (cat.category || 'Sem categoria').padEnd(35);
    const count = String(cat._count).padStart(4);
    console.log(`║    ${name}${count} ║`);
  }
  console.log('╚═══════════════════════════════════════════════════╝');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\n✗ Erro fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
