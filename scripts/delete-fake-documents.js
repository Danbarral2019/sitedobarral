/**
 * Remove documentos fictícios/de teste do banco de dados
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// IDs dos documentos fictícios identificados
const fakeDocumentIds = [
  '79e364b0-a9e8-4347-833b-a0e2b768b430', // Artigo: O Novo Regime Diferenciado de Contratações
  '0a717a3b-e6ab-48f5-830d-1549e1f0eefe', // Artigo: Inovações Trazidas pela Lei 14.133/2021
  '260ada2c-145d-4ce5-9c5f-15bcb8802f4e', // Parecer sobre Inversão de Fases na Lei 14.133
  '20bfb734-ddde-407a-899d-28532a82e4a4', // Parecer AGU sobre Contratação Integrada
  'a0233200-4840-455d-b4e6-6a5615701312', // Acórdão STJ - Pregão Eletrônico na Lei 14.133
  'f807d296-56fa-4c20-b07c-be6ca37fc734', // Acórdão TCU 2023/1834 - Planejamento das Contratações
  'e600a695-8d1a-4cd2-af88-e32f1b7200f3', // Acórdão TCU 2023/2456 - Dispensa de Licitação
  'd863df0e-c0fd-4d76-ae3d-afcd749fb13c', // Bibliografia Completa do Curso
  '99e4fbbe-d73b-4a3c-a184-16da2f5e9c28', // Conteúdo Programático do Curso
  '43c85763-34e1-4ecb-9826-54a17f3ed536', // Apostila Completa - Lei 14.133/2021
  'be09eabc-3bad-4f88-986a-7b936593fa96', // Modelo de Edital - Concorrência
  '4c013417-84a8-4486-9d7a-de57561ba9d6', // Modelo de Edital - Pregão Eletrônico
  '784a17c2-622a-4c50-b32f-339dd20c7454', // Parecer AGU nº 200/2024 - Garantias Contratuais
  'e3bc682a-0ff5-4a5d-861d-d24efed5c459', // Parecer AGU nº 100/2023 - Renovação de Contratos
  'e8a154ed-b43b-4bc4-8663-3fe155c571e5', // Acórdão TCU 5678/2024 - Pregão Eletrônico
  '14521055-d1c4-4838-9d3b-1b0412e8e833', // Acórdão TCU 1234/2023 - Contratação Direta por Dispensa
  'b7c28e52-07e7-4c12-8818-78bc57166b9f', // Resumo Esquematizado - Principais Mudanças
  '668b2958-6231-4a68-8bc0-c377834a6b06', // Apostila Completa - Lei 14.133/2021 (duplicado)
];

async function deleteFakeDocuments() {
  try {
    console.log('\n🗑️  REMOVENDO DOCUMENTOS FICTÍCIOS...\n');
    console.log(`Total de documentos a remover: ${fakeDocumentIds.length}\n`);

    // Buscar os documentos antes de deletar (para log)
    const docsToDelete = await prisma.document.findMany({
      where: {
        id: {
          in: fakeDocumentIds
        }
      },
      select: {
        id: true,
        title: true,
        category: true,
      }
    });

    console.log('Documentos que serão removidos:\n');
    docsToDelete.forEach((doc, idx) => {
      console.log(`${idx + 1}. [${doc.category}] ${doc.title}`);
    });

    console.log('\n⚠️  CONFIRME: Digite "sim" para deletar estes documentos:');

    // Aguardar confirmação do usuário
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('> ', async (answer) => {
      if (answer.toLowerCase() === 'sim') {
        // Deletar documentos
        const result = await prisma.document.deleteMany({
          where: {
            id: {
              in: fakeDocumentIds
            }
          }
        });

        console.log(`\n✅ ${result.count} documentos removidos com sucesso!\n`);

        // Verificar total restante
        const remaining = await prisma.document.count();
        console.log(`📊 Documentos restantes no banco: ${remaining}\n`);

        await prisma.$disconnect();
        process.exit(0);
      } else {
        console.log('\n❌ Operação cancelada.\n');
        await prisma.$disconnect();
        process.exit(0);
      }
    });

  } catch (error) {
    console.error('Erro:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

deleteFakeDocuments();
