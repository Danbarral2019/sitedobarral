import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError, NotFoundError } from '@/lib/errors/api-error';
import { awardBadge, BADGE_TYPES, type BadgeType } from '@/lib/gamification';

const ListQuerySchema = z.object({
  type: z.string().optional(),
  userId: z.string().optional(),
  courseId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export const GET = withAdminApi(async (request) => {
  const { searchParams } = new URL(request.url);
  const parsed = ListQuerySchema.safeParse({
    type: searchParams.get('type') ?? undefined,
    userId: searchParams.get('userId') ?? undefined,
    courseId: searchParams.get('courseId') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
  });
  if (!parsed.success) {
    throw new ApiError(422, 'Parâmetros inválidos', 'VALIDATION_ERROR', parsed.error.issues);
  }
  const { type, userId, courseId, limit, cursor } = parsed.data;

  const badges = await prisma.badge.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(userId ? { userId } : {}),
      ...(courseId ? { courseId } : {}),
    },
    orderBy: { awardedAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const userIds = Array.from(new Set(badges.map((b) => b.userId)));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const hasMore = badges.length > limit;
  const items = (hasMore ? badges.slice(0, limit) : badges).map((b) => {
    const catalog = BADGE_TYPES[b.type as BadgeType];
    return {
      id: b.id,
      userId: b.userId,
      userEmail: userMap.get(b.userId)?.email ?? null,
      userName: userMap.get(b.userId)?.name ?? null,
      courseId: b.courseId,
      type: b.type,
      label: catalog?.label ?? b.type,
      icon: catalog?.icon ?? '🏆',
      metadata: b.metadata ? safeJsonParse(b.metadata) : null,
      awardedAt: b.awardedAt,
    };
  });

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
});

const AwardSchema = z.object({
  userEmail: z.string().email('E-mail inválido'),
  type: z.string().min(1),
  courseId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const POST = withAdminApi(async (request) => {
  const body = await request.json();
  const parsed = AwardSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(422, 'Validação falhou', 'VALIDATION_ERROR', parsed.error.issues);
  }
  const { userEmail, type, courseId, metadata } = parsed.data;

  if (!(type in BADGE_TYPES)) {
    throw new ApiError(422, `Tipo de badge desconhecido: ${type}`, 'VALIDATION_ERROR');
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail.toLowerCase() },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    throw new NotFoundError(`Usuário com e-mail ${userEmail}`);
  }

  const created = await awardBadge(user.id, type, courseId ?? null, metadata);
  if (!created) {
    throw new ApiError(409, 'Este usuário já possui esse badge para este curso', 'ALREADY_EXISTS');
  }

  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name },
    type,
    courseId: courseId ?? null,
  });
});

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
