'use client';

import { useState, useEffect } from 'react';
import { Award, Download, ExternalLink, Loader2, Lock, CheckCircle, Linkedin } from 'lucide-react';

interface EligibilityData {
  eligible: boolean;
  totalLessons: number;
  completedLessons: number;
  totalQuizzes: number;
  passedQuizzes: number;
  certificate: {
    id: string;
    certificateNumber: string;
    issuedAt: string;
    studentName: string;
    courseTitle: string;
    estimatedHours: number | null;
  } | null;
}

interface CertificateCardProps {
  courseId: string;
  courseSlug: string;
}

export default function CertificateCard({ courseId }: CertificateCardProps) {
  const [data, setData] = useState<EligibilityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/area-restrita/courses/${courseId}/certificate`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [courseId]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/area-restrita/courses/${courseId}/certificate`, {
        method: 'POST',
      });
      if (res.ok) {
        await res.json();
        // Re-fetch full eligibility to get certificate details
        const eligRes = await fetch(`/api/area-restrita/courses/${courseId}/certificate`);
        if (eligRes.ok) {
          setData(await eligRes.json());
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!data?.certificate) return;
    setIsDownloading(true);
    try {
      const { generateCertificatePDF } = await import('@/lib/pdf-generator');
      const baseUrl = window.location.origin;
      const verificationUrl = `${baseUrl}/certificado/${data.certificate.certificateNumber}`;
      const pdfBuffer = await generateCertificatePDF({
        studentName: data.certificate.studentName,
        courseTitle: data.certificate.courseTitle,
        certificateNumber: data.certificate.certificateNumber,
        issuedAt: new Date(data.certificate.issuedAt),
        estimatedHours: data.certificate.estimatedHours,
        verificationUrl,
      });
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado-${data.certificate.certificateNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-ink-muted text-sm py-4 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        Verificando certificado...
      </div>
    );
  }

  if (!data) return null;

  // Has certificate
  if (data.certificate) {
    return (
      <div className="bg-amber-accent-soft rounded-[6px] border border-amber-accent-soft p-6">
        <div className="flex items-center gap-3 mb-4">
          <Award className="w-6 h-6 text-amber-accent-deep" />
          <h3 className="text-lg font-bold text-ink-primary">Certificado de Conclusao</h3>
        </div>
        <p className="text-sm text-ink-muted mb-1">
          Numero: <strong className="font-mono">{data.certificate.certificateNumber}</strong>
        </p>
        <p className="text-sm text-ink-muted mb-4">
          Emitido em:{' '}
          {new Date(data.certificate.issuedAt).toLocaleDateString('pt-BR')}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 bg-amber-accent text-white px-4 py-2 rounded-[6px] font-medium text-sm hover:bg-amber-accent transition-colors disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download PDF
          </button>
          <a
            href={`/certificado/${data.certificate.certificateNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-amber-accent text-ink-primary px-4 py-2 rounded-[6px] font-medium text-sm hover:bg-amber-accent-soft transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Verificar
          </a>
          <button
            onClick={() => {
              const issued = new Date(data.certificate!.issuedAt);
              const year = issued.getFullYear();
              const month = issued.getMonth() + 1;
              const verificationUrl = `${window.location.origin}/certificado/${data.certificate!.certificateNumber}`;
              const linkedinUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(data.certificate!.courseTitle)}&organizationName=${encodeURIComponent('Prof. Daniel Barral')}&issueYear=${year}&issueMonth=${month}&certUrl=${encodeURIComponent(verificationUrl)}&certId=${encodeURIComponent(data.certificate!.certificateNumber)}`;
              window.open(linkedinUrl, '_blank');
            }}
            className="inline-flex items-center gap-2 border border-brand-300 text-brand-700 px-4 py-2 rounded-[6px] font-medium text-sm hover:bg-brand-100 transition-colors"
          >
            <Linkedin className="w-4 h-4" />
            LinkedIn
          </button>
        </div>
      </div>
    );
  }

  // Eligible but no certificate yet
  if (data.eligible) {
    return (
      <div className="bg-green-50 rounded-[6px] border border-green-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Award className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-bold text-ink-primary">Certificado Disponivel!</h3>
        </div>
        <p className="text-sm text-ink-muted mb-4">
          Parabens! Voce completou todos os requisitos. Gere seu certificado agora.
        </p>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-[6px] font-medium text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Award className="w-4 h-4" />
          )}
          {isGenerating ? 'Gerando...' : 'Gerar Certificado'}
        </button>
      </div>
    );
  }

  // Not eligible yet
  return (
    <div className="bg-surface-raised rounded-[6px] border border-border-subtle p-6">
      <div className="flex items-center gap-3 mb-4">
        <Lock className="w-5 h-5 text-ink-muted" />
        <h3 className="text-base font-bold text-ink-secondary">Certificado</h3>
      </div>
      <p className="text-sm text-ink-muted mb-3">
        Complete todos os requisitos para obter seu certificado:
      </p>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          {data.completedLessons >= data.totalLessons ? (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-border-subtle flex-shrink-0" />
          )}
          <span
            className={
              data.completedLessons >= data.totalLessons
                ? 'text-green-700'
                : 'text-ink-muted'
            }
          >
            Aulas: {data.completedLessons}/{data.totalLessons}
          </span>
        </div>
        {data.totalQuizzes > 0 && (
          <div className="flex items-center gap-2">
            {data.passedQuizzes >= data.totalQuizzes ? (
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-border-subtle flex-shrink-0" />
            )}
            <span
              className={
                data.passedQuizzes >= data.totalQuizzes
                  ? 'text-green-700'
                  : 'text-ink-muted'
              }
            >
              Questionarios: {data.passedQuizzes}/{data.totalQuizzes}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
