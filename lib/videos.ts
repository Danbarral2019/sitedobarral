/**
 * Course Videos Data Fetching (Fase 7)
 */

import { prisma } from './prisma';
import { PaginatedResult } from './types/admin-list';

export interface CourseVideo {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  youtubeUrl: string;
  youtubeId: string;
  thumbnailUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function fetchCourseVideosPaginated(params: {
  page?: string;
  pageSize?: string;
  courseId?: string;
  isActive?: string;
  search?: string;
}): Promise<PaginatedResult<CourseVideo>> {
  const page = parseInt(params.page || '1');
  const pageSize = parseInt(params.pageSize || '50');
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (params.courseId && params.courseId !== 'all') {
    where.courseId = params.courseId;
  }

  if (params.isActive !== undefined && params.isActive !== '') {
    where.isActive = params.isActive === 'true';
  }

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [total, videos] = await Promise.all([
    prisma.courseVideo.count({ where }),
    prisma.courseVideo.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { displayOrder: 'asc' },
    }),
  ]);

  return {
    items: videos,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function deleteCourseVideo(id: string): Promise<void> {
  await prisma.courseVideo.delete({ where: { id } });
}
