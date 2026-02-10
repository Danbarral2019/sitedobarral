import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ numero: string }>;
}): Promise<Metadata> {
  const { numero } = await params;
  return {
    title: `Certificado ${numero} - Prof. Daniel Barral`,
    description: `Verificacao de autenticidade do certificado ${numero}`,
  };
}

export default async function CertificateVerificationPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero } = await params;

  const certificate = await prisma.certificate.findUnique({
    where: { certificateNumber: numero },
    select: {
      certificateNumber: true,
      studentName: true,
      courseTitle: true,
      estimatedHours: true,
      issuedAt: true,
    },
  });

  if (!certificate) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Certificado Nao Encontrado</h1>
            <p className="text-sm text-gray-500 mb-6">
              O numero <strong className="font-mono">{numero}</strong> nao corresponde a nenhum certificado emitido.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-semibold text-sm"
            >
              Ir para o site
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-8 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">Certificado Verificado</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-white/90">Autenticidade confirmada</span>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase mb-1">Aluno(a)</p>
              <p className="text-base font-semibold text-gray-900">{certificate.studentName}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400 font-medium uppercase mb-1">Curso</p>
              <p className="text-base font-semibold text-gray-900">{certificate.courseTitle}</p>
              {certificate.estimatedHours && (
                <p className="text-sm text-gray-500 mt-0.5">
                  Carga horaria: {certificate.estimatedHours}h
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400 font-medium uppercase mb-1">Data de Emissao</p>
              <p className="text-base font-semibold text-gray-900">
                {new Date(certificate.issuedAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-400 font-medium uppercase mb-1">Numero do Certificado</p>
              <p className="text-base font-mono font-semibold text-gray-900">
                {certificate.certificateNumber}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 text-center">
            <p className="text-xs text-gray-400">
              Prof. Daniel Barral — Direito Administrativo, Licitacoes e Contratos
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
