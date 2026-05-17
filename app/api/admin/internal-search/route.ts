import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError } from '@/lib/errors/api-error';

const VALID_TYPES = ['blog', 'glossary', 'legislative-act', 'document'] as const;
type InternalType = (typeof VALID_TYPES)[number];

interface Result {
  id: string;
  title: string;
  slug?: string;
  snippet?: string;
}

export const GET = withAdminApi(async (request) => {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as InternalType | null;
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '15', 10) || 15, 50);

  if (!type || !VALID_TYPES.includes(type)) {
    throw new ApiError(422, 'type inválido', 'VALIDATION_ERROR', { valid: VALID_TYPES });
  }

  let results: Result[] = [];

  if (type === 'blog') {
    const items = await prisma.blogPost.findMany({
      where: q
        ? { isPublished: true, OR: [{ title: { contains: q, mode: 'insensitive' } }, { excerpt: { contains: q, mode: 'insensitive' } }] }
        : { isPublished: true },
      select: { id: true, title: true, slug: true, excerpt: true },
      take: limit,
      orderBy: { publishedAt: 'desc' },
    });
    results = items.map((b) => ({ id: b.id, title: b.title, slug: b.slug, snippet: b.excerpt || undefined }));
  } else if (type === 'glossary') {
    const items = await prisma.glossaryTerm.findMany({
      where: q
        ? { OR: [{ term: { contains: q, mode: 'insensitive' } }, { definition: { contains: q, mode: 'insensitive' } }] }
        : {},
      select: { id: true, term: true, slug: true, definition: true },
      take: limit,
      orderBy: { term: 'asc' },
    });
    results = items.map((g) => ({
      id: g.id,
      title: g.term,
      slug: g.slug,
      snippet: g.definition?.substring(0, 120) || undefined,
    }));
  } else if (type === 'legislative-act') {
    const items = await prisma.legislativeAct.findMany({
      where: q
        ? { OR: [{ fullNumber: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }, { ementa: { contains: q, mode: 'insensitive' } }] }
        : {},
      select: { id: true, fullNumber: true, title: true, ementa: true },
      take: limit,
      orderBy: { publishDate: 'desc' },
    });
    results = items.map((a) => ({
      id: a.id,
      title: `${a.fullNumber} — ${a.title}`,
      snippet: a.ementa?.substring(0, 120) || undefined,
    }));
  } else if (type === 'document') {
    const items = await prisma.document.findMany({
      where: q
        ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }
        : {},
      select: { id: true, title: true, description: true, category: true },
      take: limit,
      orderBy: { uploadedAt: 'desc' },
    });
    results = items.map((d) => ({
      id: d.id,
      title: d.title,
      snippet: d.description?.substring(0, 120) || undefined,
    }));
  }

  return NextResponse.json({ type, query: q, results });
});
