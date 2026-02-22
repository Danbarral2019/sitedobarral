require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdminDocs() {
  // Buscar admin
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@profdanielbarral.com' },
    include: {
      enrollments: true
    }
  });

  if (!admin) {
    console.log('\n❌ Admin não encontrado!');
    await prisma.$disconnect();
    return;
  }

  console.log('\n✅ Admin encontrado:');
  console.log(`   Email: ${admin.email}`);
  console.log(`   Role: ${admin.role}`);
  console.log(`   Matrículas: ${admin.enrollments.length}`);

  // Para admin, deve ter acesso a TODOS os cursos (1-10)
  const allCourseIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  console.log('\n📊 Simulando acesso do admin aos documentos:');
  console.log('═'.repeat(70));

  // Buscar documentos como a API faz
  const documents = await prisma.document.findMany({
    where: {
      courseId: { in: allCourseIds },
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
    },
  });

  console.log(`\n✅ Total documentos retornados: ${documents.length}`);

  // Agrupar por curso
  const byCourse = {};
  allCourseIds.forEach(id => byCourse[id] = []);
  documents.forEach(doc => {
    if (byCourse[doc.courseId]) {
      byCourse[doc.courseId].push(doc);
    }
  });

  // Mostrar por curso
  for (const [courseId, docs] of Object.entries(byCourse)) {
    const onDocs = docs.filter(d => d.category === 'orientacao-normativa');
    const otherDocs = docs.filter(d => d.category !== 'orientacao-normativa');

    console.log(`\nCurso ${courseId}:`);
    console.log(`  Total: ${docs.length} docs`);
    console.log(`  ONs: ${onDocs.length} docs`);
    console.log(`  Outros: ${otherDocs.length} docs`);

    if (docs.length > 0) {
      console.log(`  Primeiras 3:`);
      docs.slice(0, 3).forEach(d => {
        console.log(`    - [${d.category}] ${d.title.substring(0, 50)}...`);
      });
    }
  }

  // Verificar se há filtro de public
  const publicDocs = documents.filter(d => d.isPublic);
  const privateDocs = documents.filter(d => !d.isPublic);

  console.log(`\n📋 Visibilidade dos documentos:`);
  console.log(`  Públicos: ${publicDocs.length}`);
  console.log(`  Privados: ${privateDocs.length}`);

  // Verificar categoria específica
  const onDocs = documents.filter(d => d.category === 'orientacao-normativa');
  console.log(`\n📋 Orientações Normativas:`);
  console.log(`  Total: ${onDocs.length}`);
  console.log(`  Públicas: ${onDocs.filter(d => d.isPublic).length}`);
  console.log(`  Privadas: ${onDocs.filter(d => !d.isPublic).length}`);

  if (onDocs.length > 0) {
    console.log(`\n  Exemplos (primeiros 5):`);
    onDocs.slice(0, 5).forEach((doc, i) => {
      console.log(`    ${i+1}. ${doc.title.substring(0, 60)}...`);
      console.log(`       Curso: ${doc.courseId} | Public: ${doc.isPublic} | Type: ${doc.type}`);
    });
  }

  await prisma.$disconnect();
}

checkAdminDocs();
