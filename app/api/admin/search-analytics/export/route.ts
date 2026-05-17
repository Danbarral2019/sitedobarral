import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';

/**
 * GET /api/admin/search-analytics/export?days=30
 *
 * Exporta as últimas N (default 30) janela de dias de SearchHistory como CSV.
 * Inclui email do usuário (join), query, tipo, filtros, feedback, nota,
 * timestamps. Usado pelo botão "Exportar CSV" no admin.
 */
export const GET = withAdminApi(async (req) => {
    const url = new URL(req.url);
    const daysParam = url.searchParams.get('days');
    const days = (() => {
      const n = daysParam ? Number(daysParam) : 30;
      if (!Number.isFinite(n) || n <= 0 || n > 365) return 30;
      return Math.floor(n);
    })();

    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await prisma.searchHistory.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        type: true,
        query: true,
        filters: true,
        feedback: true,
        feedbackNote: true,
        feedbackAt: true,
        aiAnswer: true,
        createdAt: true,
      },
      take: 10_000,
    });

    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    const header = [
      'id',
      'createdAt',
      'userEmail',
      'type',
      'query',
      'filters',
      'feedback',
      'feedbackAt',
      'feedbackNote',
      'hasAiAnswer',
    ];

    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          csvField(r.id),
          csvField(r.createdAt.toISOString()),
          csvField(emailById.get(r.userId) ?? ''),
          csvField(r.type),
          csvField(r.query),
          csvField(r.filters ?? ''),
          csvField(
            r.feedback === 1 ? 'positive' : r.feedback === -1 ? 'negative' : '',
          ),
          csvField(r.feedbackAt ? r.feedbackAt.toISOString() : ''),
          csvField(r.feedbackNote ?? ''),
          csvField(r.aiAnswer ? '1' : '0'),
        ].join(','),
      );
    }

    const csv = lines.join('\n');
    const filename = `search-analytics-${new Date().toISOString().slice(0, 10)}-${days}d.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
});

function csvField(value: string): string {
  if (!value) return '';
  // RFC 4180: envolve em aspas se houver vírgula/aspas/quebra. Anti-CSV-injection:
  // valores que começam com = + - @ tab são escapados (Excel/Sheets podem
  // executar fórmulas).
  const s = value.replace(/\r\n?|\n/g, ' ');
  const needsQuoting = /[",]/.test(s) || /^[=+\-@\t]/.test(s);
  if (!needsQuoting) return s;
  return `"${s.replace(/"/g, '""')}"`;
}
