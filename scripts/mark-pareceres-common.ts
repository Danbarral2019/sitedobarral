import { prisma } from '../lib/prisma';

async function main() {
  const r = await prisma.document.updateMany({
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'] },
      isCommon: false,
    },
    data: { isCommon: true },
  });
  console.log('Marcados como comuns:', r.count);

  const after = await prisma.document.count({
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'] },
      isCommon: true,
    },
  });
  console.log('Total isCommon=true agora:', after);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
