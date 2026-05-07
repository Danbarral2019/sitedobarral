'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Award, Download, ExternalLink, Linkedin, Loader2, ArrowLeft, Ban } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface Certificate {
  id: string;
  certificateNumber: string;
  studentName: string;
  courseTitle: string;
  estimatedHours: number | null;
  issuedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

export default function MeusCertificadosPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoadingCerts, setIsLoadingCerts] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    fetch('/api/area-restrita/certificates')
      .then((res) => (res.ok ? res.json() : { certificates: [] }))
      .then((data) => setCertificates(data.certificates || []))
      .catch(() => {})
      .finally(() => setIsLoadingCerts(false));
  }, [user]);

  const handleDownload = async (cert: Certificate) => {
    setDownloadingId(cert.id);
    try {
      const { generateCertificatePDF } = await import('@/lib/pdf-generator');
      const verificationUrl = `${window.location.origin}/certificado/${cert.certificateNumber}`;
      const pdfBuffer = await generateCertificatePDF({
        studentName: cert.studentName,
        courseTitle: cert.courseTitle,
        certificateNumber: cert.certificateNumber,
        issuedAt: new Date(cert.issuedAt),
        estimatedHours: cert.estimatedHours,
        verificationUrl,
      });
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado-${cert.certificateNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setDownloadingId(null);
    }
  };

  const handleLinkedIn = (cert: Certificate) => {
    const issued = new Date(cert.issuedAt);
    const year = issued.getFullYear();
    const month = issued.getMonth() + 1;
    const verificationUrl = `${window.location.origin}/certificado/${cert.certificateNumber}`;
    const linkedinUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(cert.courseTitle)}&organizationName=${encodeURIComponent('Prof. Daniel Barral')}&issueYear=${year}&issueMonth=${month}&certUrl=${encodeURIComponent(verificationUrl)}&certId=${encodeURIComponent(cert.certificateNumber)}`;
    window.open(linkedinUrl, '_blank');
  };

  if (isLoading || isLoadingCerts) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando certificados...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/area-restrita')}
            className="flex items-center gap-2 text-gray-700 hover:text-blue-600 mb-6 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para area restrita
          </button>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
              <Award className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meus Certificados</h1>
              <p className="text-gray-600">
                {certificates.length}{' '}
                {certificates.length === 1 ? 'certificado emitido' : 'certificados emitidos'}
              </p>
            </div>
          </div>
        </div>

        {/* Conteudo */}
        {certificates.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-2 border-gray-200">
            <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Nenhum certificado ainda</h2>
            <p className="text-gray-600 mb-6">
              Complete um curso para obter seu certificado!
            </p>
            <button
              onClick={() => router.push('/area-restrita')}
              className="bg-gradient-to-r from-amber-600 to-yellow-600 text-white px-6 py-3 rounded-xl font-bold hover:from-amber-700 hover:to-yellow-700 transition-all shadow-lg"
            >
              Explorar Cursos
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {certificates.map((cert) => {
              const revoked = Boolean(cert.revokedAt);
              return (
                <div
                  key={cert.id}
                  className={`rounded-2xl p-6 transition-shadow ${
                    revoked
                      ? 'bg-gray-50 border-2 border-dashed border-red-200 opacity-80'
                      : 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        revoked ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                      }`}
                    >
                      {revoked ? <Ban className="w-6 h-6" /> : <Award className="w-6 h-6" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-gray-900">{cert.courseTitle}</h3>
                        {revoked && (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
                            <Ban className="w-3 h-3" />
                            Revogado
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        Numero: <span className="font-mono font-medium">{cert.certificateNumber}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                        <span>Emitido em: {new Date(cert.issuedAt).toLocaleDateString('pt-BR')}</span>
                        {cert.estimatedHours && <span>Carga horaria: {cert.estimatedHours}h</span>}
                        {revoked && cert.revokedAt && (
                          <span className="text-red-700">
                            Revogado em: {new Date(cert.revokedAt).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      {revoked && cert.revokeReason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-900">
                          <strong>Motivo:</strong> {cert.revokeReason}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3">
                        {!revoked && (
                          <>
                            <button
                              onClick={() => handleDownload(cert)}
                              disabled={downloadingId === cert.id}
                              className="inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
                            >
                              {downloadingId === cert.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                              Download PDF
                            </button>
                            <button
                              onClick={() => handleLinkedIn(cert)}
                              className="inline-flex items-center gap-2 border border-blue-300 text-blue-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-100 transition-colors"
                            >
                              <Linkedin className="w-4 h-4" />
                              LinkedIn
                            </button>
                          </>
                        )}
                        <a
                          href={`/certificado/${cert.certificateNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-2 border px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                            revoked
                              ? 'border-gray-300 text-gray-600 hover:bg-gray-100'
                              : 'border-amber-300 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          <ExternalLink className="w-4 h-4" />
                          {revoked ? 'Ver registro público' : 'Verificar'}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
