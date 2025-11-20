/**
 * Script para verificar quantas ONs aparecem em cada curso
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const courses = [
  { id: '1', name: 'Nova Lei de Licitações' },
  { id: '2', name: 'Planejamento das Contratações' },
  { id: '3', name: 'Gestão e Fiscalização' },
  { id: '4', name: 'Processo Sancionador' },
  { id: '5', name: 'Inovação nas Contratações' },
  { id: '6', name: 'Terceirização' },
  { id: '7', name: 'Assessoramento Jurídico' },
  { id: '8', name: 'Revisão, Reajuste e Repactuação' },
  { id: '9', name: 'Alterações Contratuais' },
  { id: '10', name: 'Contratação Direta' }
];

async function main() {
  console.log('🔍 Verificando ONs por curso...\n');

  for (const course of courses) {
    // Buscar ONs que aparecem neste curso
    // (isCommon=true OU courseId=X)
    const count = await prisma.document.count({
      where: {
        category: 'orientacao-normativa',
        OR: [
          { isCommon: true },
          { courseId: course.id }
        ]
      }
    });

    console.log(`📚 ${course.name.padEnd(40)} ${count} ONs`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Todos os cursos devem ter 97 ONs');
  console.log('='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
