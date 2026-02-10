import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ValidarAcessoForm from './ValidarAcessoForm';

/**
 * Valida QR Code no servidor
 * Retorna null se inválido, ou dados do QR se válido
 */
async function validateQRCodeServer(code: string) {
  try {
    const qrCode = await prisma.qRCode.findUnique({
      where: { code },
    });

    if (!qrCode) {
      return null;
    }

    // Verificar se ainda é válido
    if (new Date() > new Date(qrCode.validUntil)) {
      return null;
    }

    // Verificar número de usos
    if (qrCode.maxUses && qrCode.usedCount >= qrCode.maxUses) {
      return null;
    }

    return {
      courseId: qrCode.courseId,
      qrCode: code,
    };
  } catch (error) {
    console.error('Erro ao validar QR code:', error);
    return null;
  }
}

/**
 * Server Component - Valida QR automaticamente se veio na URL
 */
export default async function ValidarAcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  // Se veio com código na URL, valida no servidor
  if (resolvedSearchParams.code) {
    const result = await validateQRCodeServer(resolvedSearchParams.code);

    if (result) {
      // QR válido - redireciona para registro/login
      // Precisamos verificar se o usuário já existe
      // Por enquanto, sempre redireciona para registro (otimização futura: verificar se já tem conta)
      redirect(`/registro?qr=${encodeURIComponent(result.qrCode)}&curso=${result.courseId}`);
    }

    // Se chegou aqui, QR inválido - renderiza formulário com erro
  }

  // Prepara mensagem de erro se houver
  const initialError = resolvedSearchParams.error === 'expired'
    ? 'Sua sessão expirou. Por favor, valide novamente seu código.'
    : resolvedSearchParams.code
    ? 'Código inválido ou expirado'
    : '';

  // Renderiza formulário Client Component
  return <ValidarAcessoForm initialError={initialError} />;
}
