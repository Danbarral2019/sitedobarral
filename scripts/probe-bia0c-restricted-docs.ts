/**
 * BIA-0c — confirma empiricamente se há documentos RESTRITOS (com courseId,
 * não isCommon, não público) que o card de IA poderia expor a alunos não
 * matriculados. filterByEnrollment mantém: isCommon || !courseId || matriculado.
 * Logo, o universo "vazável" = courseId != null AND isCommon = false.
 * Só lê o banco — R$0.
 */
import { prisma } from '@/lib/prisma';

async function main() {
  const total = await prisma.document.count();
  const isCommon = await prisma.document.count({ where: { isCommon: true } });
  const semCourse = await prisma.document.count({ where: { courseId: null } });

  // Universo potencialmente vazável: tem courseId E não é isCommon.
  const restrito = await prisma.document.count({
    where: { courseId: { not: null }, isCommon: false },
  });
  const restritoNaoPublico = await prisma.document.count({
    where: { courseId: { not: null }, isCommon: false, isPublic: false },
  });

  // Quebra por curso (os restritos de fato).
  const porCurso = await prisma.document.groupBy({
    by: ['courseId'],
    where: { courseId: { not: null }, isCommon: false },
    _count: { _all: true },
  });

  console.log('=== Universo de documentos (BIA-0c) ===');
  console.log('Total de documentos:              ', total);
  console.log('isCommon=true (comum a todos):    ', isCommon);
  console.log('courseId=null (sem curso):        ', semCourse);
  console.log('');
  console.log('RESTRITOS (courseId!=null & !isCommon):        ', restrito);
  console.log('  destes, isPublic=false (não vazam por outra via):', restritoNaoPublico);
  console.log('');
  console.log('Restritos por curso:');
  for (const g of porCurso.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  curso ${g.courseId}: ${g._count._all} docs`);
  }
  console.log('');
  console.log(restrito > 0
    ? `⚠️ VULNERABILIDADE REAL: ${restrito} docs restritos podem ser citados no card de IA a alunos NÃO matriculados (${restritoNaoPublico} não são públicos por nenhuma outra via).`
    : '✓ Sem documentos restritos — exposição teórica apenas.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
