import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  fetchUnifiedList,
  type JurisprudenciaFilters,
} from '@/lib/jurisprudencia/unified-query';
import { handleApiError } from '@/lib/errors/error-handler';
import { apiLogger } from '@/lib/logger';

const TRIBUNAL_CODES = [
  'TCU',
  'TCE-SP',
  'TCE-PR',
  'TCE-MG',
  'TCE-RS',
  'TCE-SC',
  'TCE-RJ',
  'TCE-PE',
  'STJ',
  'STF',
  'TST',
] as const;

const DECISION_TYPES = [
  'acordao',
  'decisao',
  'parecer_previo',
  'sumula',
] as const;

const querySchema = z.object({
  tribunal: z.enum(TRIBUNAL_CODES).optional(),
  ano: z.coerce.number().int().min(1900).max(2100).optional(),
  tema: z.string().min(1).max(200).optional(),
  artigo: z.string().min(1).max(50).optional(),
  decisionType: z.enum(DECISION_TYPES).optional(),
  relator: z.string().min(1).max(200).optional(),
  orgao: z.string().min(1).max(200).optional(),
  dataFrom: z.coerce.date().optional(),
  dataTo: z.coerce.date().optional(),
  q: z.string().min(1).max(200).optional(),
  excludeInactive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).default(10).transform(v => Math.min(v, 50)),
  sort: z.enum(['recent', 'oldest', 'numero', 'relevance']).optional(),
});

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = querySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, pageSize, sort, ...filters } = parsed.data;
    const jurisFilters: JurisprudenciaFilters = filters;

    const { items, total } = await fetchUnifiedList(jurisFilters, {
      page,
      pageSize,
      sort,
    });

    const formatted = items.map(item => ({
      id: item.id,
      tribunalCode: item.tribunalCode,
      tribunalName: item.tribunalName,
      decisionType: item.decisionType,
      decisionNumber: item.decisionNumber,
      title: item.title,
      ementa: truncate(item.ementa, 300),
      summary: item.summary,
      relator: item.relator,
      orgaoJulgador: item.orgaoJulgador,
      dataJulgamento: item.dataJulgamento,
      themes: item.themes,
      leiArticles: item.leiArticles,
      url: item.url,
      sourceType: item.sourceType,
    }));

    apiLogger.info(
      {
        total,
        page,
        pageSize,
        filters: jurisFilters,
      },
      'jurisprudencia/list answered'
    );

    return NextResponse.json({
      items: formatted,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
