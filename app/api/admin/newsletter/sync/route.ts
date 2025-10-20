import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { PrismaClient } from '@prisma/client';
import { syncSubscribers, isMailChimpConfigured } from '@/lib/mailchimp';

const prisma = new PrismaClient();

/**
 * POST /api/admin/newsletter/sync
 * Sincroniza todos os inscritos ativos do banco de dados local com o MailChimp
 */
export const POST = withAdminAuth(async (_request: NextRequest) => {
  try {
    // Verificar se MailChimp está configurado
    if (!isMailChimpConfigured()) {
      return NextResponse.json(
        {
          error: 'MailChimp não configurado',
          message: 'Configure as variáveis de ambiente: MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, MAILCHIMP_AUDIENCE_ID',
        },
        { status: 400 }
      );
    }

    // Buscar todos os inscritos ativos
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: {
        email: true,
        name: true,
        interests: true,
      },
    });

    if (subscribers.length === 0) {
      return NextResponse.json({
        message: 'Nenhum inscrito ativo para sincronizar',
        synced: 0,
      });
    }

    // Preparar dados para sincronização
    const subscribersData = subscribers.map((sub: { email: string; name: string | null; interests: string | null }) => ({
      email: sub.email,
      name: sub.name || undefined,
      interests: sub.interests ? JSON.parse(sub.interests) : undefined,
    }));

    // Sincronizar com MailChimp
    const result = await syncSubscribers(subscribersData);

    return NextResponse.json({
      success: result.success,
      message: `Sincronização concluída: ${result.synced} inscritos sincronizados, ${result.failed} falharam`,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors,
      total: subscribers.length,
    });
  } catch (error) {
    console.error('Erro ao sincronizar inscritos:', error);
    return NextResponse.json(
      { error: 'Erro ao sincronizar inscritos com MailChimp' },
      { status: 500 }
    );
  }
});
