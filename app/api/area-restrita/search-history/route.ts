import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.valid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const history = await prisma.searchHistory.findMany({
      where: { userId: authResult.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching search history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.valid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { query, aiAnswer, sources, legalSources } = body;

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const entry = await prisma.searchHistory.create({
      data: {
        userId: authResult.user.userId,
        query: query.trim(),
        aiAnswer: aiAnswer || null,
        sources: sources ? JSON.stringify(sources) : null,
        legalSources: legalSources ? JSON.stringify(legalSources) : null,
      },
    });

    return NextResponse.json({ id: entry.id }, { status: 201 });
  } catch (error) {
    console.error('Error saving search history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.valid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Verify ownership
    const entry = await prisma.searchHistory.findUnique({ where: { id } });
    if (!entry || entry.userId !== authResult.user.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.searchHistory.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting search history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
