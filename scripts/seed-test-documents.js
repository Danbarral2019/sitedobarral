import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTestDocuments() {
  // Usar o ID do curso de data/courses.ts, não o slug
  const courseId = '1'; // Nova Lei de Licitações

  console.log('\n📚 Criando documentos de teste...\n');

  const documents = [
    // Apostilas
    {
      title: 'Apostila Completa - Lei 14.133/2021',
      description: 'Material didático completo sobre a Nova Lei de Licitações, com comentários artigo por artigo e casos práticos.',
      type: 'pdf',
      url: '/uploads/apostila-lei-14133.pdf',
      category: 'apostila',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['lei 14.133', 'material didático', 'completo']),
    },
    {
      title: 'Resumo Esquematizado - Principais Mudanças',
      description: 'Resumo em formato de esquemas e mapas mentais das principais alterações trazidas pela nova lei.',
      type: 'pdf',
      url: '/uploads/resumo-lei-14133.pdf',
      category: 'apostila',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['resumo', 'esquema', 'mudanças']),
    },

    // Acórdãos
    {
      title: 'Acórdão TCU 1234/2023 - Contratação Direta por Dispensa',
      description: 'Importante decisão do TCU sobre os limites e requisitos para contratação direta por dispensa de licitação.',
      type: 'pdf',
      url: '/uploads/acordao-tcu-1234-2023.pdf',
      category: 'acordao',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['TCU', 'dispensa', 'contratação direta']),
    },
    {
      title: 'Acórdão TCU 5678/2024 - Pregão Eletrônico',
      description: 'Orientações do TCU sobre a condução de pregão eletrônico sob a égide da Lei 14.133/2021.',
      type: 'pdf',
      url: '/uploads/acordao-tcu-5678-2024.pdf',
      category: 'acordao',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['TCU', 'pregão', 'eletrônico']),
    },

    // Pareceres
    {
      title: 'Parecer AGU nº 100/2023 - Renovação de Contratos',
      description: 'Parecer da Advocacia-Geral da União sobre prorrogação e renovação de contratos administrativos.',
      type: 'pdf',
      url: '/uploads/parecer-agu-100-2023.pdf',
      category: 'parecer',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['AGU', 'renovação', 'prorrogação']),
    },
    {
      title: 'Parecer AGU nº 200/2024 - Garantias Contratuais',
      description: 'Análise jurídica sobre as garantias contratuais previstas na nova lei de licitações.',
      type: 'pdf',
      url: '/uploads/parecer-agu-200-2024.pdf',
      category: 'parecer',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['AGU', 'garantias', 'contratos']),
    },

    // Editais
    {
      title: 'Modelo de Edital - Pregão Eletrônico',
      description: 'Modelo completo de edital de pregão eletrônico adaptado à Lei 14.133/2021.',
      type: 'doc',
      url: '/uploads/modelo-edital-pregao.docx',
      category: 'edital',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['modelo', 'pregão', 'eletrônico']),
    },
    {
      title: 'Modelo de Edital - Concorrência',
      description: 'Modelo de edital para modalidade concorrência com todas as cláusulas necessárias.',
      type: 'doc',
      url: '/uploads/modelo-edital-concorrencia.docx',
      category: 'edital',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['modelo', 'concorrência', 'edital']),
    },

    // Artigos
    {
      title: 'Artigo - Inovações na Nova Lei de Licitações',
      description: 'Artigo científico sobre as principais inovações trazidas pela Lei 14.133/2021.',
      type: 'pdf',
      url: '/uploads/artigo-inovacoes-lei-14133.pdf',
      category: 'artigo',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['artigo', 'inovações', 'análise']),
    },

    // Links externos
    {
      title: 'Portal da Legislação - Lei 14.133/2021',
      description: 'Acesso direto à lei no portal oficial do Planalto.',
      type: 'link',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
      category: 'outro',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['legislação', 'lei', 'oficial']),
    },
    {
      title: 'TCU - Jurisprudência sobre Licitações',
      description: 'Portal de jurisprudência do TCU filtrado por temas relacionados à Lei 14.133/2021.',
      type: 'link',
      url: 'https://portal.tcu.gov.br/jurisprudencia/',
      category: 'acordao',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['TCU', 'jurisprudência', 'portal']),
    },

    // Vídeos
    {
      title: 'Videoaula - Introdução à Lei 14.133/2021',
      description: 'Aula inaugural do curso apresentando os aspectos gerais da nova lei de licitações.',
      type: 'video',
      url: 'https://www.youtube.com/watch?v=exemplo1',
      category: 'outro',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['videoaula', 'introdução', 'aula']),
    },
    {
      title: 'Videoaula - Modalidades de Licitação',
      description: 'Explicação detalhada sobre as modalidades de licitação previstas na lei.',
      type: 'video',
      url: 'https://www.youtube.com/watch?v=exemplo2',
      category: 'outro',
      courseId,
      isPublic: false,
      tags: JSON.stringify(['videoaula', 'modalidades', 'aula']),
    },

    // Documentos públicos (para testar visibilidade)
    {
      title: 'Cartilha Introdutória - Lei 14.133/2021',
      description: 'Material público de introdução à nova lei de licitações (disponível para todos).',
      type: 'pdf',
      url: '/uploads/cartilha-publica.pdf',
      category: 'apostila',
      courseId,
      isPublic: true, // Público
      tags: JSON.stringify(['cartilha', 'introdução', 'público']),
    },
  ];

  try {
    console.log(`Criando ${documents.length} documentos de exemplo...\n`);

    for (const doc of documents) {
      const created = await prisma.document.create({
        data: doc,
      });

      const visibility = doc.isPublic ? '🌐 PÚBLICO' : '🔒 RESTRITO';
      console.log(`✅ ${visibility} - ${doc.title}`);
      console.log(`   Tipo: ${doc.type} | Categoria: ${doc.category}\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ DOCUMENTOS DE TESTE CRIADOS COM SUCESSO!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📚 Total: ${documents.length} documentos`);
    console.log(`🔒 Restritos: ${documents.filter(d => !d.isPublic).length}`);
    console.log(`🌐 Públicos: ${documents.filter(d => d.isPublic).length}\n`);
    console.log('📊 Por categoria:');

    const categories = [...new Set(documents.map(d => d.category))];
    categories.forEach(cat => {
      const count = documents.filter(d => d.category === cat).length;
      console.log(`   - ${cat}: ${count}`);
    });

    console.log('\n📖 Por tipo:');
    const types = [...new Set(documents.map(d => d.type))];
    types.forEach(type => {
      const count = documents.filter(d => d.type === type).length;
      console.log(`   - ${type}: ${count}`);
    });

    console.log('\n🌐 TESTE AGORA:');
    console.log('   Login: http://localhost:3001/login');
    console.log('   Email: aluno@teste.com');
    console.log('   Senha: aluno123\n');

  } catch (error) {
    console.error('\n❌ Erro ao criar documentos:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestDocuments();
