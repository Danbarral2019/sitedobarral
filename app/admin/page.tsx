'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  QrCode, Plus, Loader2, Download, Calendar,
  Users, CheckCircle, XCircle, BarChart3,
  Edit, Trash2, Mail, MessageCircle, X
} from 'lucide-react';
import { courses } from '@/data/courses';
import { useToast } from '@/hooks/use-toast';
import { QRCardSkeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';


interface QRCodeData {
  id: string;
  code: string;
  qrCodeImage?: string | null;
  courseId: string;
  turma: string;
  validUntil: string;
  maxUses?: number;
  usedCount: number;
  createdAt: string;
}

// Admin QR Code Management Page
export default function AdminPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingQRs, setIsLoadingQRs] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodes, setQrCodes] = useState<QRCodeData[]>([]);
  const [generatedQR, setGeneratedQR] = useState<{ code: string; image: string } | null>(null);

  // Estados para edição e exclusão
  const [editingQR, setEditingQR] = useState<QRCodeData | null>(null);
  const [deletingQR, setDeletingQR] = useState<QRCodeData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    validDays: '',
    maxUses: '',
  });

  // Paginação (agora server-side)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalQRCodes, setTotalQRCodes] = useState(0);
  const itemsPerPage = 6;

  const [formData, setFormData] = useState({
    courseId: '',
    turma: '',
    validDays: '90',
    maxUses: '',
  });

  const verifyAdmin = useCallback(async () => {
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
  }, [router]);

  const loadQRCodes = useCallback(async (page = 1) => {
    setIsLoadingQRs(true);
    try {
      const response = await fetch(`/api/admin/list-qr?page=${page}&limit=${itemsPerPage}`);
      const data = await response.json();
      setQrCodes(data.qrCodes || []);

      // Atualizar paginação com dados do servidor
      if (data.pagination) {
        setCurrentPage(data.pagination.page);
        setTotalPages(data.pagination.totalPages);
        setTotalQRCodes(data.pagination.total);
      }
    } catch (error) {
      console.error('Erro ao carregar QR Codes:', error);
    } finally {
      setIsLoadingQRs(false);
    }
  }, [itemsPerPage]);

  useEffect(() => {
    verifyAdmin();
    loadQRCodes();
  }, [verifyAdmin, loadQRCodes]);

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

  const downloadQRCode = (image?: string, code?: string) => {
    const qrImage = image || generatedQR?.image;
    const qrCode = code || generatedQR?.code;

    if (!qrImage || !qrCode) return;

    const link = document.createElement('a');
    link.download = `qrcode-${qrCode}.png`;
    link.href = qrImage;
    link.click();

    success('QR Code baixado!', 'O arquivo foi salvo no seu computador.');
  };

  const shareWhatsApp = (qr: QRCodeData) => {
    // Primeiro, baixa a imagem do QR Code
    if (qr.qrCodeImage) {
      const link = document.createElement('a');
      link.download = `qrcode-${qr.turma.replace(/\s+/g, '-')}.png`;
      link.href = qr.qrCodeImage;
      link.click();

      success('QR Code baixado!', 'Anexe a imagem no WhatsApp após enviar a mensagem.');
    }

    const course = courses.find(c => c.id === qr.courseId);
    const message = `*ACESSO AO MATERIAL DO CURSO*\n` +
      `${course?.title}\n\n` +
      `*Turma:* ${qr.turma}\n` +
      `*Validade:* ${new Date(qr.validUntil).toLocaleDateString('pt-BR')}\n\n` +
      `*COMO ACESSAR:*\n` +
      `• Escaneie o QR Code em anexo com a camera do celular\n` +
      `• Ou acesse pelo link:\n${window.location.origin}/validar-acesso?code=${qr.code}\n\n` +
      `---\n` +
      `Prof. Daniel Barral\n` +
      `Especialista em Licitacoes e Contratos Publicos`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareEmail = (qr: QRCodeData) => {
    // Primeiro, baixa a imagem do QR Code
    if (qr.qrCodeImage) {
      const link = document.createElement('a');
      link.download = `qrcode-${qr.turma.replace(/\s+/g, '-')}.png`;
      link.href = qr.qrCodeImage;
      link.click();
    }

    const course = courses.find(c => c.id === qr.courseId);
    const subject = `Acesso ao Curso: ${course?.title} - Turma ${qr.turma}`;
    const body = `Olá!\n\n` +
      `Segue o acesso ao material exclusivo do curso "${course?.title}".\n\n` +
      `Turma: ${qr.turma}\n` +
      `Válido até: ${new Date(qr.validUntil).toLocaleDateString('pt-BR')}\n\n` +
      `Para acessar:\n` +
      `1. Escaneie o QR Code (imagem baixada automaticamente - anexe ao email)\n` +
      `2. Ou acesse diretamente: ${window.location.origin}/validar-acesso?code=${qr.code}\n\n` +
      `IMPORTANTE: Anexe a imagem do QR Code que foi baixada automaticamente.\n\n` +
      `Atenciosamente,\n` +
      `Prof. Daniel Barral\n` +
      `Especialista em Licitações e Contratos`;

    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;

    success('Email preparado!', 'A imagem do QR Code foi baixada. Anexe-a ao email antes de enviar.');
  };

  const handleEditQR = (qr: QRCodeData) => {
    setEditingQR(qr);

    // Calcula dias restantes
    const now = new Date();
    const validUntil = new Date(qr.validUntil);
    const daysLeft = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    setEditFormData({
      validDays: daysLeft.toString(),
      maxUses: qr.maxUses?.toString() || '',
    });
  };

  const handleUpdateQR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQR) return;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/admin/update-qr', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingQR.id,
          validDays: editFormData.validDays,
          maxUses: editFormData.maxUses || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      success('QR Code atualizado!', 'As alterações foram salvas.');
      setEditingQR(null);
      loadQRCodes();
    } catch (error) {
      console.error('Erro ao atualizar QR Code:', error);
      errorToast('Erro ao atualizar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteQR = async () => {
    if (!deletingQR) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/delete-qr?code=${deletingQR.code}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      success('QR Code deletado!', 'O código foi removido do sistema.');
      setDeletingQR(null);
      loadQRCodes();
    } catch (error) {
      console.error('Erro ao deletar QR Code:', error);
      errorToast('Erro ao deletar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Paginação agora é server-side, então qrCodes já vem paginado
  const paginatedQRCodes = qrCodes; // Já vem paginado do servidor!

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  return (
    <>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar QR Codes</h2>
            <p className="text-gray-600">Crie e gerencie códigos de acesso para os cursos</p>
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
                      <Image
                        src={generatedQR.image}
                        alt="QR Code"
                        width={256}
                        height={256}
                        className="mx-auto mb-3 border-4 border-white shadow-lg rounded-lg"
                        unoptimized
                      />
                      <p className="text-xs text-gray-700 font-mono mb-3 break-all">
                        {generatedQR.code}
                      </p>
                      <button
                        onClick={() => downloadQRCode()}
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
                          <div className="flex gap-4">
                            {/* Imagem do QR Code */}
                            {qr.qrCodeImage && (
                              <div className="flex-shrink-0">
                                <Image
                                  src={qr.qrCodeImage}
                                  alt={`QR Code ${qr.turma}`}
                                  width={128}
                                  height={128}
                                  className="w-32 h-32 border-4 border-white shadow-lg rounded-lg"
                                  unoptimized
                                />
                                <button
                                  onClick={() => downloadQRCode(qr.qrCodeImage!, qr.code)}
                                  className="w-full mt-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  <Download className="w-3 h-3" />
                                  Baixar
                                </button>
                              </div>
                            )}

                            {/* Informações do QR Code */}
                            <div className="flex-1">
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
                                    {qr.usedCount}{qr.maxUses ? ` / ${qr.maxUses}` : ''}
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

                              {/* Botões de Ação */}
                              <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
                                <button
                                  onClick={() => shareWhatsApp(qr)}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  WhatsApp
                                </button>
                                <button
                                  onClick={() => shareEmail(qr)}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  Email
                                </button>
                                <button
                                  onClick={() => handleEditQR(qr)}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  Editar
                                </button>
                                <button
                                  onClick={() => setDeletingQR(qr)}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Excluir
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>

                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={(page) => loadQRCodes(page)}
                      itemsPerPage={itemsPerPage}
                      totalItems={totalQRCodes}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Edição */}
      {editingQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Editar QR Code</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {courses.find(c => c.id === editingQR.courseId)?.title} - {editingQR.turma}
                </p>
              </div>
              <button
                onClick={() => setEditingQR(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateQR} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Validade (dias a partir de hoje)
                </label>
                <input
                  type="number"
                  value={editFormData.validDays}
                  onChange={(e) => setEditFormData({ ...editFormData, validDays: e.target.value })}
                  min="1"
                  required
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Atualmente válido até: {new Date(editingQR.validUntil).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Limite de usos (opcional)
                </label>
                <input
                  type="number"
                  value={editFormData.maxUses}
                  onChange={(e) => setEditFormData({ ...editFormData, maxUses: e.target.value })}
                  min="0"
                  placeholder="Ilimitado"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Usos atuais: {editingQR.usedCount}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingQR(null)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Excluir QR Code</h3>
                <p className="text-sm text-gray-600 mt-1">Esta ação não pode ser desfeita</p>
              </div>
              <button
                onClick={() => setDeletingQR(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-gray-900 mb-2">
                <strong>Curso:</strong> {courses.find(c => c.id === deletingQR.courseId)?.title}
              </p>
              <p className="text-sm text-gray-900 mb-2">
                <strong>Turma:</strong> {deletingQR.turma}
              </p>
              <p className="text-sm text-gray-900 mb-2">
                <strong>Usos:</strong> {deletingQR.usedCount}{deletingQR.maxUses ? ` / ${deletingQR.maxUses}` : ''}
              </p>
              <p className="text-sm text-gray-900">
                <strong>Código:</strong> <span className="font-mono text-xs">{deletingQR.code}</span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingQR(null)}
                className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteQR}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Excluir Permanentemente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
