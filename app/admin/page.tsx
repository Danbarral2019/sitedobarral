'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  QrCode, Plus, Loader2, Download, Calendar,
  Users, CheckCircle, XCircle, BarChart3, FileSpreadsheet
} from 'lucide-react';
import { courses } from '@/data/courses';
import { useToast } from '@/hooks/use-toast';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { QRCardSkeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';

interface QRCodeData {
  id: string;
  code: string;
  courseId: string;
  turma: string;
  validUntil: string;
  maxUses?: number;
  usedCount: number;
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingQRs, setIsLoadingQRs] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodes, setQrCodes] = useState<QRCodeData[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<{ code: string; image: string } | null>(null);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [formData, setFormData] = useState({
    courseId: '',
    turma: '',
    validDays: '90',
    maxUses: '',
  });

  useEffect(() => {
    verifyAdmin();
    loadQRCodes();
  }, []);

  const verifyAdmin = async () => {
    try {
      const response = await fetch('/api/auth/verify');

      if (!response.ok) {
        router.push('/validar-acesso');
        return;
      }

      const data = await response.json();

      if (data.user.role !== 'admin') {
        router.push('/area-restrita');
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar admin:', error);
      router.push('/validar-acesso');
    } finally {
      setIsLoading(false);
    }
  };

  const loadQRCodes = async () => {
    setIsLoadingQRs(true);
    try {
      const response = await fetch('/api/admin/list-qr');
      const data = await response.json();
      setQrCodes(data.qrCodes || []);
    } catch (error) {
      console.error('Erro ao carregar QR Codes:', error);
    } finally {
      setIsLoadingQRs(false);
    }
  };

  const handleGenerateQR = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const response = await fetch('/api/admin/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setGeneratedQR({
        code: data.code,
        image: data.qrCodeImage,
      });

      success('QR Code gerado com sucesso!', 'O código já está disponível para uso.');

      // Recarrega lista
      loadQRCodes();

      // Reset form
      setFormData({
        courseId: '',
        turma: '',
        validDays: '90',
        maxUses: '',
      });
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      errorToast('Erro ao gerar QR Code', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!generatedQR) return;

    const link = document.createElement('a');
    link.download = `qrcode-${generatedQR.code}.png`;
    link.href = generatedQR.image;
    link.click();

    success('QR Code baixado!', 'O arquivo foi salvo no seu computador.');
  };

  // Calcular paginação
  const totalPages = Math.ceil(qrCodes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedQRCodes = qrCodes.slice(startIndex, endIndex);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  return (
    <main className="py-12 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[{ label: 'Admin' }]}
            className="mb-6"
          />
          <div className="mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Painel Administrativo</h1>
                <p className="text-gray-700">Gerencie QR Codes de acesso aos cursos</p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <a
                  href="/admin/blog"
                  className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:from-orange-700 hover:to-amber-700 transition-all shadow-lg flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Blog
                </a>
                <a
                  href="/admin/publicacoes"
                  className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all shadow-lg flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Publicações
                </a>
                <a
                  href="/admin/importar"
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  Importar Excel
                </a>
                <a
                  href="/admin/documentos"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Gerenciar Documentos
                </a>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Formulário de Geração */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 sticky top-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Gerar QR Code</h2>
                </div>

                <form onSubmit={handleGenerateQR} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Curso
                    </label>
                    <select
                      value={formData.courseId}
                      onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                      required
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                    >
                      <option value="">Selecione um curso</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Turma
                    </label>
                    <input
                      type="text"
                      value={formData.turma}
                      onChange={(e) => setFormData({ ...formData, turma: e.target.value })}
                      placeholder="Ex: Turma 2024-1"
                      required
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Validade (dias)
                    </label>
                    <input
                      type="number"
                      value={formData.validDays}
                      onChange={(e) => setFormData({ ...formData, validDays: e.target.value })}
                      min="1"
                      required
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Limite de usos (opcional)
                    </label>
                    <input
                      type="number"
                      value={formData.maxUses}
                      onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                      min="1"
                      placeholder="Ilimitado"
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-5 h-5" />
                        Gerar QR Code
                      </>
                    )}
                  </button>
                </form>

                {/* QR Code Gerado */}
                {generatedQR && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="bg-gradient-to-r from-green-50 to-teal-100 rounded-xl p-4 text-center">
                      <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-3" />
                      <p className="text-sm font-bold text-gray-900 mb-3">QR Code Gerado!</p>
                      <img
                        src={generatedQR.image}
                        alt="QR Code"
                        className="mx-auto mb-3 border-4 border-white shadow-lg rounded-lg"
                      />
                      <p className="text-xs text-gray-700 font-mono mb-3 break-all">
                        {generatedQR.code}
                      </p>
                      <button
                        onClick={downloadQRCode}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Baixar QR Code
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lista de QR Codes */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">QR Codes Ativos</h2>
                </div>

                {isLoadingQRs ? (
                  <div className="space-y-4">
                    <QRCardSkeleton />
                    <QRCardSkeleton />
                    <QRCardSkeleton />
                  </div>
                ) : qrCodes.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <QrCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>Nenhum QR Code gerado ainda</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {paginatedQRCodes.map((qr) => {
                        const course = courses.find(c => c.id === qr.courseId);
                      const isExpired = new Date(qr.validUntil) < new Date();
                      const isMaxedOut = qr.maxUses && qr.usedCount >= qr.maxUses;

                      return (
                        <div
                          key={qr.id}
                          className={`p-4 rounded-xl border-2 ${
                            isExpired || isMaxedOut
                              ? 'bg-gray-50 border-gray-300'
                              : 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-bold text-gray-900">{course?.title}</h3>
                              <p className="text-sm text-gray-700 font-medium">
                                <Users className="w-4 h-4 inline mr-1" />
                                {qr.turma}
                              </p>
                            </div>
                            {isExpired ? (
                              <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                Expirado
                              </span>
                            ) : isMaxedOut ? (
                              <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-full flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                Limite atingido
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Ativo
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-600 font-medium">Código:</p>
                              <p className="text-gray-900 font-mono text-xs break-all">{qr.code}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 font-medium">Usos:</p>
                              <p className="text-gray-900 font-bold">
                                {qr.usedCount} {qr.maxUses ? `/ ${qr.maxUses}` : ''}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 font-medium">
                                <Calendar className="w-3 h-3 inline mr-1" />
                                Válido até:
                              </p>
                              <p className="text-gray-900 font-medium">
                                {new Date(qr.validUntil).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 font-medium">Criado em:</p>
                              <p className="text-gray-900 font-medium">
                                {new Date(qr.createdAt).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>

                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      itemsPerPage={itemsPerPage}
                      totalItems={qrCodes.length}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
