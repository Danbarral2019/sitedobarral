'use client';

import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { courses as ALL_COURSES } from '@/data/courses';

export interface EnrolledCourse {
  id: string;
  slug: string;
  title: string;
  isLifetime: boolean;
  expiresAt: string | null;
}

/**
 * Fonte única de verdade pra "cursos do usuário". Sidebar, header e
 * dashboard divergiam (4/3/2 cursos) por aplicarem critérios diferentes.
 *
 * Admin → catálogo completo.
 * Aluno → enrollment ativo E courseId existe em data/courses (descarta
 * órfãos de cursos removidos). Ativo segue o critério do servidor
 * (hasCourseAccess em lib/auth.ts): vitalício, sem prazo (matrícula de
 * assinatura, cujo fim a Stripe controla) ou com prazo no futuro.
 */
export function useEnrolledCourses(): EnrolledCourse[] {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) return [];

    if (user.role === 'admin') {
      return ALL_COURSES.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        isLifetime: true,
        expiresAt: null,
      }));
    }

    const now = new Date();
    return (user.enrollments ?? [])
      .filter((e) => e.isLifetime || e.expiresAt === null || new Date(e.expiresAt) >= now)
      .map((e) => {
        const course = ALL_COURSES.find((c) => c.id === e.courseId);
        if (!course) return null;
        return {
          id: course.id,
          slug: course.slug,
          title: course.title,
          isLifetime: e.isLifetime,
          expiresAt: e.expiresAt,
        };
      })
      .filter((c): c is EnrolledCourse => c !== null);
  }, [user]);
}
