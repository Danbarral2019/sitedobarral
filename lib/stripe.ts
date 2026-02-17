import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
import { courses } from '@/data/courses';

// Lazy initialization — evita erro no build quando env var não existe
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY não configurado');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return _stripe;
}

// Re-export stripe getter como propriedade nomeada para conveniência
export { getStripe as stripe };

// IDs dos cursos derivados de data/courses.ts (fonte única de verdade)
const ALL_COURSE_IDS = courses.map(c => c.id);

export type PlanType = 'basico' | 'premium';

export function getPlanConfig(plan: PlanType) {
  const configs = {
    basico: {
      name: 'Básico',
      priceId: process.env.STRIPE_PRICE_BASICO || '',
      description: 'Acesso a 1 curso específico',
    },
    premium: {
      name: 'Premium',
      priceId: process.env.STRIPE_PRICE_PREMIUM || '',
      description: 'Acesso a todos os cursos + Assistente IA',
    },
  };
  return configs[plan];
}


/**
 * Busca ou cria um Stripe Customer para o usuário
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name: string
): Promise<string> {
  // Verificar se já existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Criar no Stripe
  const customer = await getStripe().customers.create({
    email,
    name,
    metadata: { userId },
  });

  // Salvar no banco
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  apiLogger.info({ userId, customerId: customer.id }, 'Stripe customer created');
  return customer.id;
}

/**
 * Cria uma Checkout Session para assinatura
 */
export async function createCheckoutSession({
  userId,
  email,
  name,
  plan,
  courseId,
  returnUrl,
}: {
  userId: string;
  email: string;
  name: string;
  plan: PlanType;
  courseId?: string;
  returnUrl: string;
}): Promise<string> {
  const customerId = await getOrCreateCustomer(userId, email, name);
  const planConfig = getPlanConfig(plan);

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: planConfig.priceId,
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      plan,
      courseId: courseId || '',
    },
    subscription_data: {
      metadata: {
        userId,
        plan,
        courseId: courseId || '',
      },
    },
    success_url: `${returnUrl}/assinatura/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}/assinatura/cancelado`,
  });

  apiLogger.info({ userId, plan, sessionId: session.id }, 'Checkout session created');
  return session.url!;
}

/**
 * Cria uma sessão do Customer Portal
 */
export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string
): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Cria enrollments para uma subscription
 * - Básico: 1 enrollment para o courseId
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
      // Upsert: se já tem enrollment, não duplicar
      const existing = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: cId } },
      });

      if (!existing) {
        await tx.enrollment.create({
          data: {
            userId,
            courseId: cId,
            // Sem expiresAt — gerenciado pela subscription
            expiresAt: null,
          },
        });
      } else if (existing.expiresAt) {
        // Se tinha enrollment com expiração (trial), remover expiração
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
 * Remove enrollments criados por subscription quando cancelada
 * Apenas remove se o enrollment não tem QR code (não foi presencial)
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

      // Só remove se não foi matrícula presencial (sem qrCodeId)
      if (enrollment && !enrollment.qrCodeId) {
        await tx.enrollment.delete({
          where: { id: enrollment.id },
        });
      }
    }
  });

  apiLogger.info({ userId, plan }, 'Subscription enrollments removed');
}
