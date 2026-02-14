/**
 * Script para vincular todos os sites ativos a todos os cursos.
 *
 * Problema: 32 dos 40 sites estão "órfãos" (sem registros em SiteToCourse).
 * Solução: Criar registros SiteToCourse para cada combinação site x curso.
 *
 * Uso: npx dotenv -e .env.local -- npx tsx scripts/link-all-sites-to-courses.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COURSE_IDS = ['1', '2', '3', '4', '7', '8', '9', '10'];

async function main() {
  console.log('Buscando sites ativos...');
  const sites = await prisma.recommendedSite.findMany({
    where: { isActive: true },
    select: { id: true, title: true },
  });
  console.log(`${sites.length} sites ativos encontrados.`);

  console.log('Buscando vínculos existentes...');
  const existing = await prisma.siteToCourse.findMany({
    select: { siteId: true, courseId: true },
  });
  const existingSet = new Set(existing.map(e => `${e.siteId}:${e.courseId}`));
  console.log(`${existing.length} vínculos existentes.`);

  const toCreate: { siteId: string; courseId: string }[] = [];

  for (const site of sites) {
    for (const courseId of COURSE_IDS) {
      const key = `${site.id}:${courseId}`;
      if (!existingSet.has(key)) {
        toCreate.push({ siteId: site.id, courseId });
      }
    }
  }

  console.log(`${toCreate.length} novos vínculos a criar.`);

  if (toCreate.length === 0) {
    console.log('Nada a fazer - todos os vínculos já existem.');
    return;
  }

  const result = await prisma.siteToCourse.createMany({
    data: toCreate,
    skipDuplicates: true,
  });

  console.log(`${result.count} vínculos criados com sucesso!`);

  // Verificar resultado final
  const totalLinks = await prisma.siteToCourse.count();
  console.log(`Total de vínculos agora: ${totalLinks}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
