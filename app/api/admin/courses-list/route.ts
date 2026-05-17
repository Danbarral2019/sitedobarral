import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { getAllCourses } from '@/lib/courses';

/**
 * GET /api/admin/courses-list
 * Retorna {id, title} de todos os cursos para uso em selects do admin.
 */
export const GET = withAdminApi(async () => {
  const courses = getAllCourses().map((c) => ({ id: c.id, title: c.title }));
  return NextResponse.json({ courses });
});
