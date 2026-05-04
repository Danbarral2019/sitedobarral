import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 50;

let cachedTaxonomy: Record<string, Record<string, string[]>> | null = null;
function loadTaxonomy() {
  if (cachedTaxonomy) return cachedTaxonomy;
  const p = path.join(process.cwd(), 'data', 'tcu-taxonomy.json');
  cachedTaxonomy = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return cachedTaxonomy!;
}

export const GET = withAdminAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const area = searchParams.get('area') || undefined;
  const onlyNewTerms = searchParams.get('onlyNewTerms') === 'true';

  const where = {
    category: 'acordao',
    tcuNumeroAcordao: { not: null },
    tcuRevisadoPorAdmin: false,
    tcuClassificadoEm: { not: null },
    ...(area ? { tcuArea: area } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      select: {
        id: true,
        tcuNumeroAcordao: true,
        title: true,
        tcuArea: true,
        tcuTema: true,
        tcuSubtema: true,
        tcuRelator: true,
        tcuOrgaoJulgador: true,
        tcuDataJulgamento: true,
        tcuClassificadoEm: true,
        tcuLinkPDF: true,
        summary: true,
      },
      orderBy: [{ tcuClassificadoEm: 'desc' }, { tcuDataJulgamento: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  let filteredItems = items;
  if (onlyNewTerms) {
    const taxonomy = loadTaxonomy();
    filteredItems = items.filter(d => {
      if (!d.tcuArea || !d.tcuTema) return false;
      const temaExiste = !!taxonomy[d.tcuArea]?.[d.tcuTema];
      const subtemaExiste = d.tcuSubtema
        ? (taxonomy[d.tcuArea]?.[d.tcuTema] || []).includes(d.tcuSubtema)
        : true;
      return !temaExiste || !subtemaExiste;
    });
  }

  return NextResponse.json({
    items: filteredItems,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
});
