import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { syncSubscribers, isMailChimpConfigured } from '@/lib/mailchimp';
import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/errors/api-error';

/**
 * POST /api/admin/newsletter/sync
 * Sincroniza todos os inscritos ativos do banco de dados local com o MailChimp
 */
export const POST = withAdminApi(async (_request, ctx) => {
  // Verificar se MailChimp está configurado
  if (!isMailChimpConfigured()) {
    throw new ValidationError(
      'MailChimp não configurado',
      'Configure as variáveis de ambiente: MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, MAILCHIMP_AUDIENCE_ID',
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
  ctx.logger.info({ total: subscribers.length }, 'Iniciando sync MailChimp');
  const result = await syncSubscribers(subscribersData);

  if (!result.success) {
    ctx.logger.error({ failed: result.failed, errors: result.errors }, 'Falhas na sincronização MailChimp');
  }

  return NextResponse.json({
    success: result.success,
    message: `Sincronização concluída: ${result.synced} inscritos sincronizados, ${result.failed} falharam`,
    synced: result.synced,
    failed: result.failed,
    errors: result.errors,
    total: subscribers.length,
  });
});
