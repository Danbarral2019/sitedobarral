import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { CertificateActions } from './CertificateActions';

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.profdanielbarral.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ numero: string }>;
}): Promise<Metadata> {
  const { numero } = await params;
  const cert = await prisma.certificate.findUnique({
    where: { certificateNumber: numero },
    select: { studentName: true, courseTitle: true, revokedAt: true },
  });
  if (!cert) {
    return {
      title: `Certificado ${numero} — Prof. Daniel Barral`,
      description: 'Verificação de autenticidade de certificado.',
    };
  }
  const title = cert.revokedAt
    ? `Certificado ${numero} (revogado) — Prof. Daniel Barral`
    : `Certificado de ${cert.studentName} — ${cert.courseTitle}`;
  const description = cert.revokedAt
    ? 'Este certificado foi revogado.'
    : `${cert.studentName} concluiu ${cert.courseTitle} com o Prof. Daniel Barral. Verificação de autenticidade.`;
  const ogImage = `${baseUrl}/api/og/certificate/${numero}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/certificado/${numero}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  };
}

async function generateQrDataUrl(value: string): Promise<string | null> {
  try {
    const QRCode = (await import('qrcode')).default;
    return await QRCode.toDataURL(value, {
      width: 280,
      margin: 1,
      color: { dark: '#20364e', light: '#ffffff' },
    });
  } catch {
    return null;
  }
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
      revokedAt: true,
      revokeReason: true,
      issuedById: true,
    },
  });

  if (!certificate) {
    return <NotFoundView numero={numero} />;
  }

  // Increment viewCount fire-and-forget (não bloqueia render)
  prisma.certificate
    .update({
      where: { certificateNumber: numero },
      data: { viewCount: { increment: 1 }, lastViewAt: new Date() },
    })
    .catch(() => undefined);

  const verificationUrl = `${baseUrl}/certificado/${numero}`;
  const qrDataUrl = await generateQrDataUrl(verificationUrl);
  const revoked = Boolean(certificate.revokedAt);
  const issuedDate = new Date(certificate.issuedAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Status header */}
        {revoked ? (
          <div className="bg-red-600 text-surface-page rounded-t-2xl px-8 py-5 flex items-center justify-center gap-3 shadow-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="font-bold text-lg uppercase tracking-wide">Certificado revogado</p>
          </div>
        ) : (
          <div className="bg-emerald-600 text-surface-page rounded-t-2xl px-8 py-5 flex items-center justify-center gap-3 shadow-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="font-bold text-base uppercase tracking-wide">Certificado verificado e autêntico</p>
          </div>
        )}

        {/* Card principal */}
        <div className="bg-white rounded-b-2xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Hero navy */}
          <div className="bg-gradient-to-br from-[#20364e] to-[#142232] px-8 py-12 text-center text-surface-page relative">
            <div className="absolute top-4 right-4 text-xs uppercase tracking-widest text-slate-300/60">
              Autenticação
            </div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-300 mb-3">Prof. Daniel Barral</p>
            <p className="text-sm font-light text-slate-200 mb-2">Certifica que</p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{certificate.studentName}</h1>
            <p className="text-sm font-light text-slate-200 mb-2">concluiu o curso</p>
            <p className="text-xl md:text-2xl font-semibold text-surface-page mb-6">{certificate.courseTitle}</p>
            {certificate.estimatedHours ? (
              <p className="inline-block text-xs uppercase tracking-widest text-slate-200 border border-slate-400/40 px-4 py-1.5 rounded-full">
                Carga horária: {certificate.estimatedHours} h
              </p>
            ) : null}
          </div>

          {/* Detalhes */}
          <div className="grid md:grid-cols-2 gap-0 border-t border-slate-200">
            <div className="px-8 py-6 border-b md:border-b-0 md:border-r border-slate-200">
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 font-medium">Data de emissão</dt>
                  <dd className="text-base text-slate-900 font-semibold mt-1">{issuedDate}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 font-medium">Número do certificado</dt>
                  <dd className="text-base font-mono text-slate-900 font-semibold mt-1">
                    {certificate.certificateNumber}
                  </dd>
                </div>
                {revoked && certificate.revokedAt ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-red-700 font-medium">Revogado em</dt>
                    <dd className="text-base text-red-900 font-semibold mt-1">
                      {new Date(certificate.revokedAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </dd>
                  </div>
                ) : null}
                {revoked && certificate.revokeReason ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-red-700 font-medium">Motivo</dt>
                    <dd className="text-sm text-red-900 mt-1 italic">{certificate.revokeReason}</dd>
                  </div>
                ) : null}
                {certificate.issuedById && !revoked ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500 font-medium">Modo de emissão</dt>
                    <dd className="text-sm text-slate-700 mt-1">Emissão administrativa</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            <div className="px-8 py-6 flex flex-col items-center justify-center bg-slate-50">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code de verificação"
                  width={180}
                  height={180}
                  className="rounded-md border border-slate-200 bg-white p-2"
                />
              ) : (
                <div className="w-[180px] h-[180px] bg-slate-200 rounded-md" aria-hidden />
              )}
              <p className="text-xs text-slate-500 mt-3 text-center max-w-[200px]">
                Aponte a câmera para verificar a autenticidade
              </p>
            </div>
          </div>

          {/* CTAs */}
          <div className="px-8 py-6 border-t border-slate-200 bg-white">
            {revoked ? (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-900 text-center">
                <p className="font-semibold">Este certificado não é mais válido.</p>
                <p className="text-xs mt-1 text-red-800">
                  Em caso de dúvidas, escreva para{' '}
                  <a href="mailto:contato@profdanielbarral.com" className="underline">
                    contato@profdanielbarral.com
                  </a>
                  .
                </p>
              </div>
            ) : (
              <CertificateActions
                certificate={{
                  certificateNumber: certificate.certificateNumber,
                  studentName: certificate.studentName,
                  courseTitle: certificate.courseTitle,
                  estimatedHours: certificate.estimatedHours,
                  issuedAt: certificate.issuedAt.toISOString(),
                }}
              />
            )}
          </div>
        </div>

        {/* Marketing footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-600 mb-3">
            Especialização em Direito Administrativo, Licitações e Contratos
          </p>
          <Link
            href="/cursos"
            className="inline-block text-sm font-semibold text-[#20364e] hover:underline"
          >
            Conheça os cursos do Prof. Daniel Barral →
          </Link>
        </div>
      </div>
    </main>
  );
}

function NotFoundView({ numero }: { numero: string }) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Certificado não encontrado</h1>
        <p className="text-sm text-slate-600 mb-6">
          O número <strong className="font-mono">{numero}</strong> não corresponde a nenhum certificado emitido.
        </p>
        <Link href="/" className="inline-flex items-center gap-2 text-[#20364e] hover:underline font-semibold text-sm">
          Ir para o site
        </Link>
      </div>
    </main>
  );
}
