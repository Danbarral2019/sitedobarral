/**
 * Script para enrollar o aluno de teste nos cursos.
 *
 * Busca o usuario aluno@teste.com e cria Enrollment para cada curso do
 * catalogo (data/courses.ts) com expiracao de 1 ano. Usa upsert para nao
 * duplicar.
 *
 * Uso:
 *   npx tsx scripts/enroll-test-user.ts
 *   npx tsx scripts/enroll-test-user.ts --dry-run
 */

import { prisma } from '../lib/prisma';
import { courses } from '../data/courses';

const isDryRun = process.argv.includes('--dry-run');

const TEST_EMAIL = 'aluno@teste.com';

// Todos os cursos do catalogo (ver COURSE_IDS_REFERENCE.md)
const COURSES = courses.map(({ id, title }) => ({ id, title }));

async function main() {
  console.log('Enrollando aluno de teste nos cursos...\n');

  // 1. Buscar usuario
  const user = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    console.error(`Usuario "${TEST_EMAIL}" nao encontrado no banco.`);
    console.error('Crie o usuario primeiro ou verifique o email.');
    process.exit(1);
  }

  console.log(`Usuario: ${user.name} (${user.email})`);
  console.log(`ID: ${user.id}\n`);

  console.log(`Cursos para enrollment: ${COURSES.length}`);
  COURSES.forEach(c => console.log(`  - [${c.id}] ${c.title}`));
  console.log('');

  if (isDryRun) {
    console.log('[DRY RUN] Enrollments que seriam criados:');
    for (const course of COURSES) {
      console.log(`  - ${user.email} -> ${course.title} (expira em 1 ano)`);
    }
    console.log('\n[DRY RUN] Nenhuma alteracao feita.');
    return;
  }

  // 2. Criar enrollments com upsert
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  let created = 0;
  let existing = 0;

  for (const course of COURSES) {
    const enrollment = await prisma.enrollment.upsert({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: course.id,
        },
      },
      update: {}, // nao altera se ja existe
      create: {
        userId: user.id,
        courseId: course.id,
        expiresAt,
      },
    });

    // Verificar se foi criado agora ou ja existia (comparando datas)
    const isNew = Math.abs(enrollment.enrolledAt.getTime() - Date.now()) < 5000;
    if (isNew) {
      created++;
      console.log(`  Criado: ${course.title} (expira ${expiresAt.toLocaleDateString('pt-BR')})`);
    } else {
      existing++;
      console.log(`  Ja existia: ${course.title}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Enrollments criados: ${created}`);
  console.log(`Ja existentes: ${existing}`);
  console.log(`Total de cursos: ${COURSES.length}`);
}

main()
  .catch(error => {
    console.error('Erro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
