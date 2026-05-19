import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { BADGE_TYPES, type BadgeType } from '@/lib/gamification';

export const GET = withAdminApi(async () => {
  const grouped = await prisma.badge.groupBy({
    by: ['type'],
    _count: { _all: true },
  });
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);

  const byType: Record<string, number> = {};
  for (const g of grouped) {
    byType[g.type] = g._count._all;
  }

  const catalog = Object.values(BADGE_TYPES).map((b) => ({
    type: b.type,
    label: b.label,
    icon: b.icon,
    description: b.description,
    award: b.award,
    count: byType[b.type as BadgeType] ?? 0,
  }));

  return NextResponse.json({
    total,
    catalog,
  });
});
