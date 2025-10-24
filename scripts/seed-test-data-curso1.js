const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de dados de teste para Curso 1 (Nova Lei de Licitações)...');

  const courseId = '1'; // Nova Lei de Licitações

  // ========================================
  // 1. DOCUMENTOS DESTACADOS (apostila, conteúdo programático, bibliografia)
  // ========================================

  console.log('\n📚 Criando documentos destacados...');

  const apostila = await prisma.document.create({
    data: {
      title: 'Apostila Completa - Lei 14.133/2021',
      description: 'Material didático completo sobre a Nova Lei de Licitações, com análise detalhada de todos os artigos, jurisprudência e casos práticos.',
      type: 'pdf',
      category: 'apostila',
      courseId,
      isPublic: false,
      url: '/uploads/test/apostila-lei-14133.pdf',
      tags: JSON.stringify(['essencial', 'material-base', 'lei-14133']),
      size: 2500000, // 2.5MB
    },
  });

  const conteudoProgramatico = await prisma.document.create({
    data: {
      title: 'Conteúdo Programático do Curso',
      description: 'Ementa completa com cronograma de aulas, objetivos de aprendizagem e metodologia aplicada.',
      type: 'pdf',
      category: 'conteudo-programatico',
      courseId,
      isPublic: false,
      url: '/uploads/test/conteudo-programatico-lei-14133.pdf',
      tags: JSON.stringify(['essencial', 'ementa', 'cronograma']),
      size: 450000, // 450KB
    },
  });

  const bibliografia = await prisma.document.create({
    data: {
      title: 'Bibliografia Completa do Curso',
      description: 'Referências bibliográficas completas: livros, artigos científicos, legislação correlata e jurisprudência selecionada.',
      type: 'pdf',
      category: 'bibliografia',
      courseId,
      isPublic: false,
      url: '/uploads/test/bibliografia-lei-14133.pdf',
      tags: JSON.stringify(['referências', 'livros', 'artigos', 'legislação']),
      size: 320000, // 320KB
    },
  });

  console.log(`✅ ${apostila.title}`);
  console.log(`✅ ${conteudoProgramatico.title}`);
  console.log(`✅ ${bibliografia.title}`);

  // ========================================
  // 2. ACÓRDÃOS
  // ========================================

  console.log('\n⚖️ Criando acórdãos...');

  const acordaos = [
    {
      title: 'Acórdão TCU 2023/2456 - Dispensa de Licitação',
      description: 'Análise sobre os limites e requisitos para dispensa de licitação nos termos do art. 75 da Lei 14.133/2021.',
      url: '/uploads/test/acordao-tcu-2456-2023.pdf',
      tags: ['TCU', 'dispensa', 'limites'],
    },
    {
      title: 'Acórdão TCU 2023/1834 - Planejamento das Contratações',
      description: 'Orientações sobre o planejamento anual de contratações e estudos técnicos preliminares obrigatórios.',
      url: '/uploads/test/acordao-tcu-1834-2023.pdf',
      tags: ['TCU', 'planejamento', 'ETP'],
    },
    {
      title: 'Acórdão STJ - Pregão Eletrônico na Lei 14.133',
      description: 'Jurisprudência sobre a aplicação do pregão eletrônico como modalidade preferencial na nova lei.',
      url: '/uploads/test/acordao-stj-pregao-2023.pdf',
      tags: ['STJ', 'pregão', 'modalidades'],
    },
  ];

  for (const acordao of acordaos) {
    const doc = await prisma.document.create({
      data: {
        title: acordao.title,
        description: acordao.description,
        type: 'pdf',
        category: 'acordao',
        courseId,
        isPublic: false,
        url: acordao.url,
        tags: JSON.stringify(acordao.tags),
        size: Math.floor(Math.random() * 500000) + 100000, // 100KB - 600KB
      },
    });
    console.log(`✅ ${doc.title}`);
  }

  // ========================================
  // 3. PARECERES
  // ========================================

  console.log('\n📝 Criando pareceres...');

  const pareceres = [
    {
      title: 'Parecer AGU sobre Contratação Integrada',
      description: 'Análise jurídica sobre a aplicação do regime de contratação integrada em obras públicas.',
      url: '/uploads/test/parecer-agu-contratacao-integrada.pdf',
      tags: ['AGU', 'contratação-integrada', 'obras'],
    },
    {
      title: 'Parecer sobre Inversão de Fases na Lei 14.133',
      description: 'Estudo sobre a obrigatoriedade da inversão de fases e seus impactos procedimentais.',
      url: '/uploads/test/parecer-inversao-fases.pdf',
      tags: ['inversão-fases', 'procedimento'],
    },
  ];

  for (const parecer of pareceres) {
    const doc = await prisma.document.create({
      data: {
        title: parecer.title,
        description: parecer.description,
        type: 'pdf',
        category: 'parecer',
        courseId,
        isPublic: false,
        url: parecer.url,
        tags: JSON.stringify(parecer.tags),
        size: Math.floor(Math.random() * 400000) + 150000,
      },
    });
    console.log(`✅ ${doc.title}`);
  }

  // ========================================
  // 4. ARTIGOS
  // ========================================

  console.log('\n📄 Criando artigos...');

  const artigos = [
    {
      title: 'Artigo: Inovações Trazidas pela Lei 14.133/2021',
      description: 'Análise doutrinária das principais inovações legislativas e seus impactos práticos.',
      url: '/uploads/test/artigo-inovacoes-lei14133.pdf',
      tags: ['doutrina', 'inovações', 'análise'],
    },
    {
      title: 'Artigo: O Novo Regime Diferenciado de Contratações',
      description: 'Estudo comparativo entre RDC e os novos procedimentos da Lei 14.133/2021.',
      url: '/uploads/test/artigo-rdc-comparativo.pdf',
      tags: ['RDC', 'comparativo', 'procedimentos'],
    },
  ];

  for (const artigo of artigos) {
    const doc = await prisma.document.create({
      data: {
        title: artigo.title,
        description: artigo.description,
        type: 'pdf',
        category: 'artigo',
        courseId,
        isPublic: false,
        url: artigo.url,
        tags: JSON.stringify(artigo.tags),
        size: Math.floor(Math.random() * 600000) + 200000,
      },
    });
    console.log(`✅ ${doc.title}`);
  }

  // ========================================
  // 5. LINKS ÚTEIS
  // ========================================

  console.log('\n🔗 Criando links úteis...');

  const links = [
    {
      title: 'Portal da Legislação - Lei 14.133/2021',
      description: 'Texto completo e atualizado da Lei 14.133/2021 no portal oficial do Planalto.',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
      tags: ['legislação', 'oficial', 'planalto'],
    },
    {
      title: 'Portal Nacional de Contratações Públicas',
      description: 'Sistema oficial do governo federal para gestão de licitações e contratos (PNCP).',
      url: 'https://www.gov.br/pncp',
      tags: ['PNCP', 'sistema', 'oficial'],
    },
  ];

  for (const link of links) {
    const doc = await prisma.document.create({
      data: {
        title: link.title,
        description: link.description,
        type: 'link',
        category: 'outro',
        courseId,
        isPublic: false,
        url: link.url,
        tags: JSON.stringify(link.tags),
      },
    });
    console.log(`✅ ${doc.title}`);
  }

  // ========================================
  // 6. VÍDEOS DO YOUTUBE
  // ========================================

  console.log('\n🎥 Criando vídeos do YouTube...');

  const videos = [
    {
      title: 'Introdução à Lei 14.133/2021',
      description: 'Visão geral sobre as principais mudanças trazidas pela nova lei de licitações.',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // URL fictícia para teste
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
  // 7. SITES RECOMENDADOS
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
      console.log(`ℹ️ Site já existe: ${recommendedSite.title}`);
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

  // ========================================
  // RESUMO
  // ========================================

  console.log('\n📊 Resumo do seed:');
  const totalDocs = await prisma.document.count({ where: { courseId } });
  const totalVideos = await prisma.courseVideo.count({ where: { courseId } });
  const totalSites = await prisma.siteToCourse.count({ where: { courseId } });

  console.log(`✅ ${totalDocs} documentos criados`);
  console.log(`✅ ${totalVideos} vídeos criados`);
  console.log(`✅ ${totalSites} sites vinculados`);
  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('\nℹ️ Acesse a área restrita com o usuário aluno@teste.com para visualizar.');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
