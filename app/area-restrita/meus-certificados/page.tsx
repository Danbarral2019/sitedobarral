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
 <div className="min-h-screen bg-surface-raised flex items-center justify-center">
 <div className="text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-accent mx-auto mb-4"></div>
 <p className="text-ink-secondary">Carregando certificados...</p>
 </div>
 </div>
 );
 }

 return (
 <main className="min-h-screen bg-surface-raised py-12 px-4">
 <div className="max-w-5xl mx-auto">
 {/* Header */}
 <div className="mb-8">
 <button
 onClick={() => router.push('/area-restrita')}
 className="flex items-center gap-2 text-ink-secondary hover:text-brand-600 mb-6 font-medium transition-colors"
 >
 <ArrowLeft className="w-5 h-5" />
 Voltar para a área restrita
 </button>

 <div className="flex items-center gap-4 mb-4">
 <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center">
 <Award className="w-8 h-8 text-brand-600" />
 </div>
 <div>
 <h1 className="text-3xl font-bold text-ink-primary">Meus Certificados</h1>
 <p className="text-ink-secondary">
 {certificates.length}{' '}
 {certificates.length === 1 ? 'certificado emitido' : 'certificados emitidos'}
 </p>
 </div>
 </div>
 </div>

 {/* Conteudo */}
 {certificates.length === 0 ? (
 <div className="bg-surface-page rounded-md p-12 text-center border border-border-subtle">
 <Award className="w-16 h-16 text-border-strong mx-auto mb-4" />
 <h2 className="text-2xl font-bold text-ink-primary mb-2">Nenhum certificado ainda</h2>
 <p className="text-ink-secondary mb-6">
 Complete um curso para obter seu certificado!
 </p>
 <button
 onClick={() => router.push('/area-restrita')}
 className="bg-surface-raised text-ink-primary px-6 py-3 rounded-md font-bold hover: transition-all border-b border-border-subtle"
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
 className={`rounded-md p-6 transition-shadow ${
 revoked
 ? 'bg-surface-raised border-2 border-dashed border-border-subtle opacity-80'
 : 'bg-surface-raised border border-border-subtle '
 }`}
 >
 <div className="flex items-start gap-4">
 <div
 className={`w-12 h-12 rounded-[3px] flex items-center justify-center flex-shrink-0 ${
 revoked ? 'bg-surface-deep text-semantic-error' : 'bg-amber-accent-soft text-amber-accent'
 }`}
 >
 {revoked ? <Ban className="w-6 h-6" /> : <Award className="w-6 h-6" />}
 </div>

 <div className="flex-1 min-w-0">
 <div className="flex flex-wrap items-center gap-2 mb-1">
 <h3 className="text-lg font-bold text-ink-primary">{cert.courseTitle}</h3>
 {revoked && (
 <span className="inline-flex items-center gap-1 bg-surface-deep text-semantic-error px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
 <Ban className="w-3 h-3" />
 Revogado
 </span>
 )}
 </div>
 <p className="text-sm text-ink-secondary mb-1">
 Numero: <span className="font-mono font-medium">{cert.certificateNumber}</span>
 </p>
 <div className="flex flex-wrap items-center gap-4 text-sm text-ink-secondary mb-4">
 <span>Emitido em: {new Date(cert.issuedAt).toLocaleDateString('pt-BR')}</span>
 {cert.estimatedHours && <span>Carga horaria: {cert.estimatedHours}h</span>}
 {revoked && cert.revokedAt && (
 <span className="text-semantic-error">
 Revogado em: {new Date(cert.revokedAt).toLocaleDateString('pt-BR')}
 </span>
 )}
 </div>
 {revoked && cert.revokeReason && (
 <div className="bg-surface-raised border border-border-subtle rounded-[3px] p-3 mb-4 text-sm text-ink-primary">
 <strong>Motivo:</strong> {cert.revokeReason}
 </div>
 )}

 <div className="flex flex-wrap gap-3">
 {!revoked && (
 <>
 <button
 onClick={() => handleDownload(cert)}
 disabled={downloadingId === cert.id}
 className="inline-flex items-center gap-2 bg-amber-accent text-surface-page px-4 py-2 rounded-[3px] font-medium text-sm hover:bg-amber-accent transition-colors disabled:opacity-50"
 >
 {downloadingId === cert.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
 Download PDF
 </button>
 <button
 onClick={() => handleLinkedIn(cert)}
 className="inline-flex items-center gap-2 border border-border-strong text-brand-700 px-4 py-2 rounded-[3px] font-medium text-sm hover:bg-surface-deep transition-colors"
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
 className={`inline-flex items-center gap-2 border px-4 py-2 rounded-[3px] font-medium text-sm transition-colors ${
 revoked
 ? 'border-border-strong text-ink-secondary hover:bg-surface-deep'
 : 'border-border-strong text-amber-accent-deep hover:bg-amber-accent-soft'
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
