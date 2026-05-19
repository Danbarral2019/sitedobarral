import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getCourseBySlug, getIdFromSlug } from '@/lib/courses';
import CertificateCard from '@/components/lms/CertificateCard';

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const courseId = getIdFromSlug(courseSlug);
  const course = getCourseBySlug(courseSlug);

  if (!courseId || !course) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Curso nao encontrado.</p>
          <Link
            href="/area-restrita"
            className="text-brand-600 hover:text-brand-700 font-semibold text-sm"
          >
            Voltar para Area Restrita
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href={`/area-restrita/curso/${courseSlug}`}
            className="p-2 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-xs text-gray-400">{course.title.split('(')[0].trim()}</p>
            <h1 className="text-lg font-bold text-gray-900">Certificado de Conclusao</h1>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <CertificateCard courseId={courseId} courseSlug={courseSlug} />
      </div>
    </main>
  );
}
