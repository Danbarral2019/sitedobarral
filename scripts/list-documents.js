/**
 * Lista todos os documentos do banco de dados
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listDocuments() {
  try {
    const docs = await prisma.document.findMany({
      select: {
        id: true,
        title: true,
        category: true,
        courseId: true,
        isCommon: true,
        uploadedAt: true,
      },
      orderBy: {
        uploadedAt: 'desc'
      },
    });

    console.log('\n📄 DOCUMENTOS NO BANCO:\n');
    console.log('Total:', docs.length);
    console.log('\n');

    docs.forEach((doc, idx) => {
      const curso = doc.isCommon ? 'COMUM' : (doc.courseId || 'sem curso');
      console.log(`${idx + 1}. [${doc.category}] ${doc.title}`);
      console.log(`   Curso: ${curso}`);
      console.log(`   ID: ${doc.id}`);
      console.log('');
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Erro:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

listDocuments();
