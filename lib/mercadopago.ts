import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
import { courses } from '@/data/courses';

const ALL_COURSE_IDS = courses.map(c => c.id);

let _client: MercadoPagoConfig | null = null;

export function getMPClient(): MercadoPagoConfig {
  if (!_client) {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
    }
    _client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
  }
  return _client;
}

export type PlanType = 'basico' | 'premium';

export function getPlanConfig(plan: PlanType) {
  const configs = {
    basico: { name: 'Básico', price: 49.90, description: 'Acesso a 1 curso específico' },
    premium: { name: 'Premium', price: 89.90, description: 'Acesso a todos os cursos + Assistente IA' },
  };
  return configs[plan];
}

/**
 * Cria preferência de checkout (redireciona para Mercado Pago)
 */
export async function createCheckoutPreference({
  userId, email, name, plan, courseId, returnUrl,
}: {
  userId: string; email: string; name: string;
  plan: PlanType; courseId?: string; returnUrl: string;
}): Promise<string> {
  const client = getMPClient();
  const preference = new Preference(client);
  const planConfig = getPlanConfig(plan);

  const result = await preference.create({
    body: {
      items: [{
        id: `plan-${plan}`,
        title: `Plano ${planConfig.name} - Prof. Daniel Barral`,
        description: planConfig.description,
        quantity: 1,
        unit_price: planConfig.price,
        currency_id: 'BRL',
      }],
      payer: { email, name },
      back_urls: {
        success: `${returnUrl}/assinatura/sucesso`,
        failure: `${returnUrl}/assinatura/cancelado`,
        pending: `${returnUrl}/assinatura/pendente`,
      },
      auto_return: 'approved',
      external_reference: JSON.stringify({ userId, plan, courseId: courseId || '' }),
      notification_url: `${returnUrl}/api/pagamento/webhook`,
    },
  });

  apiLogger.info({ userId, plan, preferenceId: result.id }, 'MP checkout preference created');
  return result.init_point!;
}

/**
 * Cria pagamento PIX direto
 */
export async function createPixPayment({
  userId, email, name, plan, courseId,
}: {
  userId: string; email: string; name: string;
  plan: PlanType; courseId?: string;
}): Promise<{ qrCode: string; qrCodeBase64: string; ticketUrl: string; paymentId: number }> {
  const client = getMPClient();
  const payment = new Payment(client);
  const planConfig = getPlanConfig(plan);

  const result = await payment.create({
    body: {
      transaction_amount: planConfig.price,
      description: `Plano ${planConfig.name} - Prof. Daniel Barral`,
      payment_method_id: 'pix',
      payer: {
        email,
        first_name: name.split(' ')[0],
        last_name: name.split(' ').slice(1).join(' ') || name,
      },
      external_reference: JSON.stringify({ userId, plan, courseId: courseId || '' }),
    },
  });

  const qrCode = result.point_of_interaction?.transaction_data?.qr_code || '';
  const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64 || '';
  const ticketUrl = result.point_of_interaction?.transaction_data?.ticket_url || '';

  apiLogger.info({ userId, plan, paymentId: result.id }, 'PIX payment created');
  return { qrCode, qrCodeBase64, ticketUrl, paymentId: result.id! };
}

/**
 * Cria enrollments para uma subscription
 * - Basico: 1 enrollment para o courseId
 * - Premium: enrollment para TODOS os cursos
 */
export async function createSubscriptionEnrollments(
  userId: string,
  plan: PlanType,
  courseId?: string
): Promise<void> {
  const courseIds = plan === 'premium' ? ALL_COURSE_IDS : courseId ? [courseId] : [];

  await prisma.$transaction(async (tx) => {
    for (const cId of courseIds) {
      const existing = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: cId } },
      });

      if (!existing) {
        await tx.enrollment.create({
          data: { userId, courseId: cId, expiresAt: null },
        });
      } else if (existing.expiresAt) {
        await tx.enrollment.update({
          where: { id: existing.id },
          data: { expiresAt: null },
        });
      }
    }
  });

  apiLogger.info({ userId, plan, courseIds }, 'Subscription enrollments created');
}

/**
 * Remove enrollments quando subscription cancelada
 * Apenas remove se o enrollment nao foi presencial (sem qrCodeId)
 */
export async function handleSubscriptionCanceled(
  userId: string,
  plan: PlanType,
  courseId?: string
): Promise<void> {
  const courseIds = plan === 'premium' ? ALL_COURSE_IDS : courseId ? [courseId] : [];

  await prisma.$transaction(async (tx) => {
    for (const cId of courseIds) {
      const enrollment = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: cId } },
      });

      if (enrollment && !enrollment.qrCodeId) {
        await tx.enrollment.delete({ where: { id: enrollment.id } });
      }
    }
  });

  apiLogger.info({ userId, plan }, 'Subscription enrollments removed');
}
