'use client';

import { useAuth } from '@/hooks/use-auth';
import EnrollmentStatusBanner from '@/components/EnrollmentStatusBanner';
import Link from 'next/link';
import { CheckCircle, Clock } from 'lucide-react';

interface CourseEnrollmentInfoProps {
  courseId: string;
}

export default function CourseEnrollmentInfo({ courseId }: CourseEnrollmentInfoProps) {
  const { user, isLoading, isEnrolledIn, getEnrollmentStatus } = useAuth();

  if (isLoading) {
    return null; // ou skeleton
  }

  // Usuário não autenticado ou não matriculado
  if (!user || !isEnrolledIn(courseId)) {
    return null;
  }

  const enrollmentStatus = getEnrollmentStatus(courseId);

  if (!enrollmentStatus) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 mb-8 relative z-10">
      <div className="max-w-6xl mx-auto">
        {/* Banner de Status */}
        <EnrollmentStatusBanner courseId={courseId} />

        {/* Card de Acesso Rápido */}
        <div className="bg-white rounded-[6px] p-4 border-2 border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-ink-primary">
                Você está matriculado neste curso
              </p>
              {enrollmentStatus.expiresAt && !enrollmentStatus.isLifetime && (
                <p className="text-xs text-ink-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {enrollmentStatus.daysRemaining} dias restantes
                </p>
              )}
            </div>
          </div>

          <Link
            href="/area-restrita"
            className="bg-brand-600 text-white px-6 py-2 rounded-[6px] font-bold hover:from-brand-700 hover:to-brand-700 transition-all text-sm border border-border-subtle"
          >
            Ir para Área Restrita
          </Link>
        </div>
      </div>
    </div>
  );
}
