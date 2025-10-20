import QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { prisma } from './prisma';
import { QRCode as PrismaQRCode } from '@prisma/client';

// Interface para dados do QR Code
export interface QRCodeData {
  id: string;
  code: string;
  qrCodeImage?: string | null;
  courseId: string;
  turma: string;
  validUntil: string;
  maxUses?: number | null;
  usedCount: number;
  createdAt: string;
}

/**
 * Gera um código único para o QR Code
 */
function generateUniqueCode(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Cria um novo QR Code para um curso
 */
export async function createQRCode(
  courseId: string,
  turma: string,
  validUntilDate: Date,
  maxUses?: number
): Promise<{ code: string; qrCodeImage: string }> {
  const code = generateUniqueCode();

  // Gera a imagem do QR Code
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const qrUrl = `${baseUrl}/validar-acesso?code=${code}`;
  const qrCodeImage = await QRCode.toDataURL(qrUrl);

  // Salva no banco de dados com a imagem
  await prisma.qRCode.create({
    data: {
      code,
      qrCodeImage, // Salva a imagem base64
      courseId,
      turma,
      validUntil: validUntilDate,
      maxUses: maxUses || null,
      usedCount: 0,
    },
  });

  return { code, qrCodeImage };
}

/**
 * Valida um código QR e retorna os dados se válido
 */
export async function validateQRCode(code: string): Promise<QRCodeData | null> {
  const qrData = await prisma.qRCode.findUnique({
    where: { code },
  });

  if (!qrData) {
    return null;
  }

  // Verifica se expirou
  const now = new Date();
  const validUntil = new Date(qrData.validUntil);

  if (now > validUntil) {
    return null;
  }

  // Verifica limite de usos
  if (qrData.maxUses && qrData.usedCount >= qrData.maxUses) {
    return null;
  }

  // Incrementa contador de usos
  await prisma.qRCode.update({
    where: { code },
    data: {
      usedCount: qrData.usedCount + 1,
    },
  });

  return {
    id: qrData.id,
    code: qrData.code,
    courseId: qrData.courseId,
    turma: qrData.turma,
    validUntil: qrData.validUntil.toISOString(),
    maxUses: qrData.maxUses,
    usedCount: qrData.usedCount + 1,
    createdAt: qrData.createdAt.toISOString(),
  };
}

/**
 * Lista todos os QR Codes (para admin)
 */
export async function listQRCodes(): Promise<QRCodeData[]> {
  const qrCodes = await prisma.qRCode.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });

  return qrCodes.map((qr: PrismaQRCode) => ({
    id: qr.id,
    code: qr.code,
    qrCodeImage: qr.qrCodeImage, // Retorna a imagem
    courseId: qr.courseId,
    turma: qr.turma,
    validUntil: qr.validUntil.toISOString(),
    maxUses: qr.maxUses,
    usedCount: qr.usedCount,
    createdAt: qr.createdAt.toISOString(),
  }));
}

/**
 * Lista QR Codes de um curso específico
 */
export async function getQRCodesByCourse(courseId: string): Promise<QRCodeData[]> {
  const qrCodes = await prisma.qRCode.findMany({
    where: { courseId },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return qrCodes.map((qr: PrismaQRCode) => ({
    id: qr.id,
    code: qr.code,
    qrCodeImage: qr.qrCodeImage, // Retorna a imagem
    courseId: qr.courseId,
    turma: qr.turma,
    validUntil: qr.validUntil.toISOString(),
    maxUses: qr.maxUses,
    usedCount: qr.usedCount,
    createdAt: qr.createdAt.toISOString(),
  }));
}

/**
 * Remove um QR Code
 */
export async function deleteQRCode(code: string): Promise<boolean> {
  try {
    await prisma.qRCode.delete({
      where: { code },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtém estatísticas de um QR Code
 */
export async function getQRCodeStats(code: string): Promise<QRCodeData | null> {
  const qrData = await prisma.qRCode.findUnique({
    where: { code },
  });

  if (!qrData) {
    return null;
  }

  return {
    id: qrData.id,
    code: qrData.code,
    qrCodeImage: qrData.qrCodeImage, // Retorna a imagem
    courseId: qrData.courseId,
    turma: qrData.turma,
    validUntil: qrData.validUntil.toISOString(),
    maxUses: qrData.maxUses,
    usedCount: qrData.usedCount,
    createdAt: qrData.createdAt.toISOString(),
  };
}
