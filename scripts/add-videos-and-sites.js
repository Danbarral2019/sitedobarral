const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🎥 Adicionando vídeos e sites ao Curso 1...\n');

  const courseId = '1';

  // ========================================
  // VÍDEOS DO YOUTUBE
  // ========================================

  console.log('📹 Criando vídeos do YouTube...');

  const videos = [
    {
      title: 'Introdução à Lei 14.133/2021',
      description: 'Visão geral sobre as principais mudanças trazidas pela nova lei de licitações.',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      youtubeId: 'dQw4w9WgXcQ',
      thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    },
    {
      title: 'Modalidades de Licitação - Análise Prática',
      description: 'Análise detalhada das modalidades previstas na Lei 14.133: pregão, concorrência e outras.',
      youtubeUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
      youtubeId: '9bZkp7q19f0',
      thumbnailUrl: 'https://img.youtube.com/vi/9bZkp7q19f0/maxresdefault.jpg',
    },
    {
      title: 'Contratação Direta: Dispensa e Inexigibilidade',
      description: 'Explicação sobre os casos de contratação direta previstos na nova legislação.',
      youtubeUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      youtubeId: 'jNQXAC9IVRw',
      thumbnailUrl: 'https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
    },
  ];

  for (const [index, video] of videos.entries()) {
    const vid = await prisma.courseVideo.create({
      data: {
        courseId,
        title: video.title,
        description: video.description,
        youtubeUrl: video.youtubeUrl,
        youtubeId: video.youtubeId,
        thumbnailUrl: video.thumbnailUrl,
        displayOrder: index,
        isActive: true,
      },
    });
    console.log(`✅ ${vid.title}`);
  }

  // ========================================
  // SITES RECOMENDADOS
  // ========================================

  console.log('\n🌐 Criando sites recomendados...');

  const sites = [
    {
      title: 'Tribunal de Contas da União',
      description: 'Jurisprudência, acórdãos e orientações técnicas sobre licitações e contratos.',
      url: 'https://portal.tcu.gov.br',
      faviconUrl: 'https://portal.tcu.gov.br/favicon.ico',
      category: 'jurisprudencia',
    },
    {
      title: 'Portal da Legislação',
      description: 'Repositório oficial de leis, decretos e normas do governo federal.',
      url: 'https://www4.planalto.gov.br/legislacao',
      faviconUrl: 'https://www.planalto.gov.br/favicon.ico',
      category: 'legislacao',
    },
    {
      title: 'ComprasNet (PNCP)',
      description: 'Portal Nacional de Contratações Públicas - sistema oficial de licitações.',
      url: 'https://www.gov.br/pncp',
      faviconUrl: 'https://www.gov.br/favicon.ico',
      category: 'sistemas',
    },
    {
      title: 'Consulta CNJ',
      description: 'Jurisprudência do Superior Tribunal de Justiça e tribunais estaduais.',
      url: 'https://www.cnj.jus.br',
      faviconUrl: 'https://www.cnj.jus.br/favicon.ico',
      category: 'jurisprudencia',
    },
  ];

  for (const [index, site] of sites.entries()) {
    // Criar o site (ou buscar se já existir)
    let recommendedSite = await prisma.recommendedSite.findFirst({
      where: { url: site.url },
    });

    if (!recommendedSite) {
      recommendedSite = await prisma.recommendedSite.create({
        data: {
          title: site.title,
          description: site.description,
          url: site.url,
          faviconUrl: site.faviconUrl,
          category: site.category,
          displayOrder: index,
          isActive: true,
        },
      });
      console.log(`✅ Site criado: ${recommendedSite.title}`);
    } else {
      console.log(`ℹ️  Site já existe: ${recommendedSite.title}`);
    }

    // Vincular ao curso 1 (se ainda não estiver vinculado)
    const existingLink = await prisma.siteToCourse.findUnique({
      where: {
        siteId_courseId: {
          siteId: recommendedSite.id,
          courseId,
        },
      },
    });

    if (!existingLink) {
      await prisma.siteToCourse.create({
        data: {
          siteId: recommendedSite.id,
          courseId,
          displayOrder: index,
        },
      });
      console.log(`  ↳ Vinculado ao curso 1`);
    } else {
      console.log(`  ↳ Já vinculado ao curso 1`);
    }
  }

  // Resumo final
  console.log('\n📊 Resumo:');
  const totalVideos = await prisma.courseVideo.count({ where: { courseId } });
  const totalSites = await prisma.siteToCourse.count({ where: { courseId } });

  console.log(`✅ ${totalVideos} vídeos`);
  console.log(`✅ ${totalSites} sites vinculados`);
  console.log('\n🎉 Concluído!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
