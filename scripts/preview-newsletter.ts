/**
 * Script para gerar preview da newsletter v0.2
 *
 * Conecta ao banco, busca dados dos últimos 30 dias,
 * filtra acórdãos com IA, gera intro, renderiza HTML
 * e salva em /tmp/newsletter-preview.html
 *
 * Uso: npx tsx scripts/preview-newsletter.ts
 * Opções:
 *   --skip-ai   Pula chamadas de IA (usa fallbacks)
 *   --days=N    Busca documentos dos últimos N dias (padrão: 30)
 */

import { prisma } from '../lib/prisma';
import { renderMonthlyNewsletter } from '../lib/email-templates/newsletter';
import { filterByRelevance, type DecisionInput } from '../lib/newsletter/relevance-filter';
import { generateNewsletterIntro } from '../lib/newsletter/intro-generator';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';

const skipAi = process.argv.includes('--skip-ai');
const daysArg = process.argv.find(a => a.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 30;

async function main() {
  console.log(`\n📰 Newsletter v0.2 Preview Generator`);
  console.log(`   Período: últimos ${days} dias`);
  console.log(`   IA: ${skipAi ? 'DESATIVADA (fallbacks)' : 'ATIVADA'}\n`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // 1. Buscar dados
  console.log('🔍 Buscando dados do banco...');

  const [
    newDocuments,
    newTribunalDecisions,
    newBlogPosts,
    newPublications,
    newVideos,
    newLegislativeActs,
  ] = await Promise.all([
    prisma.document.findMany({
      where: { uploadedAt: { gte: cutoffDate }, isPublic: true },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, title: true, description: true, category: true, uploadedAt: true, url: true },
    }),
    prisma.tribunalDecision.findMany({
      where: {
        approvalStatus: { in: ['auto_approved', 'manually_approved'] },
        createdAt: { gte: cutoffDate },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, tribunalCode: true, ementa: true, summary: true, createdAt: true },
    }),
    prisma.blogPost.findMany({
      where: { publishedAt: { gte: cutoffDate }, isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: { title: true, slug: true, excerpt: true, publishedAt: true },
    }),
    prisma.publication.findMany({
      where: { publishedAt: { gte: cutoffDate }, isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: { title: true, type: true, description: true, externalUrl: true, publishedAt: true },
    }),
    prisma.courseVideo.findMany({
      where: { createdAt: { gte: cutoffDate }, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { title: true, courseId: true, youtubeUrl: true },
    }),
    prisma.legislativeAct.findMany({
      where: { publishDate: { gte: cutoffDate } },
      orderBy: { publishDate: 'desc' },
      select: { fullNumber: true, title: true, ementa: true, publishDate: true },
    }),
  ]);

  console.log(`   📄 ${newDocuments.length} documentos`);
  console.log(`   ⚖️  ${newTribunalDecisions.length} decisões de tribunais`);
  console.log(`   ✍️  ${newBlogPosts.length} blog posts`);
  console.log(`   📚 ${newPublications.length} publicações`);
  console.log(`   🎥 ${newVideos.length} vídeos`);
  console.log(`   📜 ${newLegislativeActs.length} atos legislativos`);

  // 2. Separar acórdãos dos demais
  const acordaoDocs = newDocuments.filter(d => d.category === 'acordao');
  const otherDocs = newDocuments.filter(d => d.category !== 'acordao');

  const allDecisions: DecisionInput[] = [
    ...acordaoDocs.map(d => ({
      id: d.id, title: d.title, description: d.description, category: 'acordao' as const,
    })),
    ...newTribunalDecisions.map(td => ({
      id: td.id, title: td.title, description: td.summary || td.ementa.substring(0, 300),
      ementa: td.ementa, summary: td.summary, tribunalCode: td.tribunalCode,
      category: 'tribunal-decisions' as const,
    })),
  ];

  console.log(`\n🎯 ${allDecisions.length} decisões para filtrar (${acordaoDocs.length} acórdãos TCU + ${newTribunalDecisions.length} tribunais)`);

  // 3. Filtrar com IA (ou fallback)
  let filterResult;
  if (skipAi) {
    console.log('⏭️  Pulando IA — usando fallback para decisões...');
    const fakeSelected = allDecisions.slice(0, 15).map(d => ({
      id: d.id,
      title: d.title,
      tribunalCode: d.tribunalCode || 'TCU',
      relevanceScore: 70,
      aiSummary: d.description || d.ementa || 'Decisão relevante para o estudo de licitações e contratos.',
      themes: ['licitações', 'contratos'],
      leiArticles: [],
    }));
    filterResult = { selected: fakeSelected, totalEvaluated: allDecisions.length, totalSelected: fakeSelected.length };
  } else {
    console.log('🤖 Filtrando decisões com Gemini IA...');
    filterResult = await filterByRelevance(allDecisions);
  }

  console.log(`   ✅ ${filterResult.totalSelected}/${filterResult.totalEvaluated} decisões selecionadas`);
  if (filterResult.selected.length > 0) {
    console.log(`   📊 Scores: ${filterResult.selected[0]?.relevanceScore} - ${filterResult.selected[filterResult.selected.length - 1]?.relevanceScore}`);
  }

  // 4. Agrupar demais docs por categoria
  const documentsByCategory = otherDocs.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, typeof otherDocs>);

  // 5. Gerar intro
  const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const now = new Date();
  const monthName = `${monthNames[now.getMonth()]} de ${now.getFullYear()}`;
  const totalItems = newDocuments.length + newTribunalDecisions.length;

  const categorySummary: Record<string, number> = {};
  for (const [cat, docs] of Object.entries(documentsByCategory)) {
    categorySummary[cat] = docs.length;
  }

  let introHtml: string;
  if (skipAi) {
    console.log('⏭️  Pulando IA — usando fallback para intro...');
    introHtml = `Neste mês de ${monthName}, adicionamos <strong>${totalItems} novos documentos</strong> à plataforma, todos relacionados a Licitações e Contratos Públicos. Dentre os destaques, selecionamos <strong>${filterResult.totalSelected} decisões</strong> de tribunais pela sua relevância para o estudo da Lei 14.133/2021. Confira abaixo os principais destaques desta edição.`;
  } else {
    console.log('🤖 Gerando texto introdutório com Gemini IA...');
    introHtml = await generateNewsletterIntro({
      selectedDecisions: filterResult.selected,
      categorySummary,
      authorContent: { blogPosts: newBlogPosts, publications: newPublications, videos: newVideos },
      legislativeChanges: newLegislativeActs,
      monthName,
      totalDocuments: totalItems,
    });
  }

  console.log(`   ✅ Intro gerada (${introHtml.length} chars)`);

  // 6. Renderizar HTML
  console.log('\n🎨 Renderizando newsletter...');

  const sendId = randomUUID();
  const html = renderMonthlyNewsletter({
    sendId,
    introHtml,
    authorContent: {
      blogPosts: newBlogPosts,
      publications: newPublications,
      videos: newVideos,
    },
    selectedDecisions: filterResult.selected,
    documentsByCategory,
    legislativeChanges: newLegislativeActs,
    totalDocuments: totalItems,
  });

  // 7. Salvar arquivo
  const outputPath = join(process.cwd(), 'newsletter-preview.html');
  writeFileSync(outputPath, html.replace('{{NAME}}', 'Daniel'), 'utf-8');

  console.log(`\n✅ Newsletter preview salva em:`);
  console.log(`   ${outputPath}`);
  console.log(`\n📬 Abra no navegador para visualizar.`);
  console.log(`   Seções: ${filterResult.totalSelected} decisões | ${Object.keys(documentsByCategory).length} categorias | ${newBlogPosts.length} posts | ${newLegislativeActs.length} atos\n`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Erro:', e);
  await prisma.$disconnect();
  process.exit(1);
});
