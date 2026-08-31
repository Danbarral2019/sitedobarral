'use client';

import { useState } from 'react';
import { Download, Linkedin, Loader2 } from 'lucide-react';

interface Props {
  certificate: {
    certificateNumber: string;
    studentName: string;
    courseTitle: string;
    estimatedHours: number | null;
    issuedAt: string;
  };
}

export function CertificateActions({ certificate }: Props) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { generateCertificatePDF } = await import('@/lib/pdf-generator');
      const verificationUrl = `${window.location.origin}/certificado/${certificate.certificateNumber}`;
      const pdfBuffer = await generateCertificatePDF({
        studentName: certificate.studentName,
        courseTitle: certificate.courseTitle,
        certificateNumber: certificate.certificateNumber,
        issuedAt: new Date(certificate.issuedAt),
        estimatedHours: certificate.estimatedHours,
        verificationUrl,
      });
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado-${certificate.certificateNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setDownloading(false);
    }
  };

  const handleLinkedIn = () => {
    const issued = new Date(certificate.issuedAt);
    const year = issued.getFullYear();
    const month = issued.getMonth() + 1;
    const verificationUrl = `${window.location.origin}/certificado/${certificate.certificateNumber}`;
    const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(certificate.courseTitle)}&organizationName=${encodeURIComponent('Prof. Daniel Barral')}&issueYear=${year}&issueMonth=${month}&certUrl=${encodeURIComponent(verificationUrl)}&certId=${encodeURIComponent(certificate.certificateNumber)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-wrap gap-3 justify-center">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex items-center gap-2 bg-[#20364e] text-white px-5 py-2.5 rounded-[6px] font-semibold text-sm hover:bg-[#142232] transition-colors disabled:opacity-50"
      >
        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Baixar PDF
      </button>
      <button
        onClick={handleLinkedIn}
        className="inline-flex items-center gap-2 border border-[#20364e] text-[#20364e] px-5 py-2.5 rounded-[6px] font-semibold text-sm hover:bg-surface-raised transition-colors"
      >
        <Linkedin className="w-4 h-4" />
        Adicionar ao LinkedIn
      </button>
    </div>
  );
}
