const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const stats = await prisma.document.groupBy({
    by: ['category'],
    _count: { _all: true }
  });

  console.log('📊 DOCUMENTOS POR CATEGORIA:\n');

  const nomes = {
    'acordao': 'Acórdãos TCU',
    'orientacao-normativa': 'Orientações Normativas (ON)',
    'parecer': 'Pareceres AGU',
    'apostila': 'Apostilas/Material',
    'artigo': 'Artigos',
    'edital': 'Editais/Modelos',
    'outro': 'Outros/Legislação'
  };

  stats.forEach(s => {
    console.log('   ', nomes[s.category] || s.category, ':', s._count._all);
  });

  await prisma.$disconnect();
})();
