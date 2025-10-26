require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simula o que o endpoint /api/area-restrita/batch-data faz

async function testBatchAPI() {
  // Simula usuário com matrícula nos cursos 1, 2, 3
  const courseIds = ['1', '2', '3'];

  console.log('\n🔍 Simulando GET /api/area-restrita/batch-data');
  console.log('   courseIds:', courseIds.join(','));
  console.log('═'.repeat(70));

  // Buscar documentos (mesmo código do endpoint)
  const documents = await prisma.document.findMany({
    where: {
      courseId: { in: courseIds },
    },
    orderBy: [
      { uploadedAt: 'desc' },
    ],
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      url: true,
      category: true,
      courseId: true,
      isPublic: true,
      tags: true,
      leiArticles: true,
      size: true,
      uploadedAt: true,
      updatedAt: true,
    },
  });

  console.log(`\n✅ Total de documentos retornados: ${documents.length}`);

  // Agrupar por courseId (como o endpoint faz)
  const groupedDocuments = {};
  courseIds.forEach(courseId => {
    groupedDocuments[courseId] = [];
  });

  documents.forEach(doc => {
    if (doc.courseId && groupedDocuments[doc.courseId]) {
      groupedDocuments[doc.courseId].push(doc);
    }
  });

  // Mostrar resultado por curso
  console.log('\n📊 Documentos por curso:');
  console.log('═'.repeat(70));
  for (const [courseId, docs] of Object.entries(groupedDocuments)) {
    console.log(`\n  Curso ${courseId}: ${docs.length} documentos`);

    // Contar por categoria
    const byCategory = {};
    docs.forEach(doc => {
      byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
    });

    console.log('  Categorias:');
    for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      console.log(`    - ${cat}: ${count} docs`);
    }

    // Mostrar primeiros 3 documentos
    console.log('  Primeiros 3 documentos:');
    docs.slice(0, 3).forEach((doc, i) => {
      console.log(`    ${i + 1}. [${doc.category}] ${doc.title.substring(0, 50)}...`);
    });
  }

  // Verificar especificamente orientacao-normativa
  const onDocs = documents.filter(d => d.category === 'orientacao-normativa');
  console.log(`\n📋 Orientações Normativas encontradas: ${onDocs.length}`);

  if (onDocs.length > 0) {
    console.log('   Exemplos:');
    onDocs.slice(0, 5).forEach((doc, i) => {
      console.log(`   ${i + 1}. ${doc.title.substring(0, 60)}... (Curso ${doc.courseId})`);
    });
  } else {
    console.log('   ⚠️  NENHUMA orientação normativa encontrada!');
  }

  await prisma.$disconnect();
}

testBatchAPI();
