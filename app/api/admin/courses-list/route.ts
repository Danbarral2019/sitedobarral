import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { getAllCourses } from '@/lib/courses';
import { handleApiError } from '@/lib/errors/error-handler';

/**
 * GET /api/admin/courses-list
 * Retorna {id, title} de todos os cursos para uso em selects do admin.
 */
export const GET = withAdminAuth(async () => {
  try {
    const courses = getAllCourses().map((c) => ({ id: c.id, title: c.title }));
    return NextResponse.json({ courses });
  } catch (error) {
    return handleApiError(error);
  }
});
