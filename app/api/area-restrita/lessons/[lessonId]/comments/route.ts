import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, AuthorizationError, NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { CreateLessonCommentSchema } from '@/lib/validation-schemas';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;

    // Auth
    const token = request.cookies.get('auth-token')?.value;
    if (!token) throw new AuthenticationError();
    const payload = await verifyToken(token);
    if (!payload) throw new AuthenticationError();
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new AuthenticationError();

    // Verify lesson exists and get courseId
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } },
    });
    if (!lesson) throw new NotFoundError('Lição');

    // Enrollment check (admin bypasses)
    if (user.role !== 'admin') {
      const enrollment = await prisma.enrollment.findFirst({
        where: { userId: user.id, courseId: lesson.module.courseId },
      });
      if (!enrollment) throw new AuthorizationError('Você não está matriculado neste curso.');
    }

    // Fetch top-level comments with replies
    const comments = await prisma.lessonComment.findMany({
      where: { lessonId, parentId: null },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'asc' }],
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Collect all user IDs for batch lookup
    const userIds = new Set<string>();
    for (const comment of comments) {
      userIds.add(comment.userId);
      for (const reply of comment.replies) {
        userIds.add(reply.userId);
      }
    }

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Format comments with user names and soft-delete handling
    const formatComment = (c: typeof comments[number] | typeof comments[number]['replies'][number]) => ({
      id: c.id,
      content: c.isDeleted ? 'Comentário removido' : c.content,
      userId: c.userId,
      userName: userMap.get(c.userId) ?? 'Usuário',
      isEdited: c.isEdited,
      isPinned: c.isPinned,
      isDeleted: c.isDeleted,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    });

    const threaded = comments.map((c) => ({
      ...formatComment(c),
      replies: c.replies.map(formatComment),
    }));

    apiLogger.info({ lessonId, count: comments.length }, 'Lesson comments fetched');

    return NextResponse.json({ comments: threaded });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;

    // Auth
    const token = request.cookies.get('auth-token')?.value;
    if (!token) throw new AuthenticationError();
    const payload = await verifyToken(token);
    if (!payload) throw new AuthenticationError();
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new AuthenticationError();

    // Verify lesson exists and get courseId
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } },
    });
    if (!lesson) throw new NotFoundError('Lição');

    // Enrollment check (admin bypasses)
    if (user.role !== 'admin') {
      const enrollment = await prisma.enrollment.findFirst({
        where: { userId: user.id, courseId: lesson.module.courseId },
      });
      if (!enrollment) throw new AuthorizationError('Você não está matriculado neste curso.');
    }

    // Parse and validate body
    const body = await request.json();
    const data = CreateLessonCommentSchema.parse(body);

    // If replying, verify parent exists in same lesson
    if (data.parentId) {
      const parent = await prisma.lessonComment.findUnique({
        where: { id: data.parentId },
      });
      if (!parent || parent.lessonId !== lessonId) {
        throw new NotFoundError('Comentário pai');
      }
    }

    const comment = await prisma.lessonComment.create({
      data: {
        lessonId,
        userId: user.id,
        content: data.content,
        parentId: data.parentId ?? null,
      },
    });

    apiLogger.info({ lessonId, commentId: comment.id, userId: user.id }, 'Lesson comment created');

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        userId: comment.userId,
        userName: user.name,
        parentId: comment.parentId,
        isEdited: comment.isEdited,
        isPinned: comment.isPinned,
        isDeleted: comment.isDeleted,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
