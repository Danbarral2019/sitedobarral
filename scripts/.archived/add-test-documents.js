const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Adicionando documentos de teste...\n');

  // Verificar se já existem documentos similares
  const existingConteudo = await prisma.document.findFirst({
    where: {
      courseId: '1',
      category: 'conteudo-programatico'
    }
  });

  const existingBibliografia = await prisma.document.findFirst({
    where: {
      courseId: '1',
      category: 'bibliografia'
    }
  });

  // Criar Conteúdo Programático se não existir
  if (!existingConteudo) {
    const conteudo = await prisma.document.create({
      data: {
        title: 'Conteúdo Programático - Nova Lei de Licitações',
        description: 'Ementa completa do curso com cronograma de aulas, temas abordados e metodologia de ensino. Documento essencial para acompanhamento do curso.',
        type: 'pdf',
        category: 'conteudo-programatico',
        courseId: '1',
        isPublic: false,
        url: '/uploads/test/conteudo-programatico-lei-14133.pdf', // URL fictícia
        tags: JSON.stringify(['essencial', 'ementa', 'cronograma'])
      }
    });
    console.log('✅ Conteúdo Programático criado:', conteudo.title);
  } else {
    console.log('⏭️  Conteúdo Programático já existe, pulando...');
  }

  // Criar Bibliografia se não existir
  if (!existingBibliografia) {
    const bibliografia = await prisma.document.create({
      data: {
        title: 'Bibliografia Completa do Curso',
        description: 'Referências bibliográficas completas utilizadas no curso, incluindo livros, artigos científicos, legislação comentada e jurisprudência selecionada. Material de apoio para estudos complementares.',
        type: 'pdf',
        category: 'bibliografia',
        courseId: '1',
        isPublic: false,
        url: '/uploads/test/bibliografia-lei-14133.pdf', // URL fictícia
        tags: JSON.stringify(['referências', 'livros', 'artigos'])
      }
    });
    console.log('✅ Bibliografia criada:', bibliografia.title);
  } else {
    console.log('⏭️  Bibliografia já existe, pulando...');
  }

  console.log('\n✨ Processo concluído!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
