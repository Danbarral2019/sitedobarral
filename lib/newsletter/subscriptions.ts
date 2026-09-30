/**
 * Inscrição na newsletter com double opt-in e descadastro por link assinado.
 *
 * Estados de um NewsletterSubscriber:
 * - pendente:   isActive = true,  confirmedAt = null  (aguarda o clique no link)
 * - confirmado: isActive = true,  confirmedAt != null (recebe os envios)
 * - cancelado:  isActive = false (descadastro, bounce ou exclusão lógica)
 *
 * Todos os envios a inscritos devem filtrar por CONFIRMED_SUBSCRIBER_WHERE.
 * A resposta da inscrição é sempre a mesma, para não revelar se um e-mail já
 * está inscrito.
 */

import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/cache/redis-client';
import { sendEmail } from '@/lib/email';
import {
  NEWSLETTER_CONFIRMATION_SUBJECT,
  renderNewsletterConfirmationEmail,
} from '@/lib/email-templates/newsletter-confirmation';
import { addSubscriber, unsubscribeSubscriber, isMailChimpConfigured } from '@/lib/mailchimp';
import { trackServerEvent } from '@/lib/monitoring/events';
import {
  CONFIRMATION_TOKEN_TTL_SECONDS,
  verifyConfirmationToken,
  verifyUnsubscribeToken,
} from './tokens';
import { PENDING_SUBSCRIBER_WHERE } from './filters';
import { buildConfirmationUrl } from './links';

/** Intervalo mínimo entre dois e-mails de confirmação para o mesmo inscrito. */
export const CONFIRMATION_RESEND_COOLDOWN_MS = 5 * 60 * 1000;
/** Teto de e-mails de confirmação por endereço, por hora (Redis). */
export const CONFIRMATION_EMAILS_PER_HOUR = 3;

/** Mensagem única devolvida a qualquer pedido de inscrição válido. */
export const SUBSCRIBE_GENERIC_MESSAGE =
  'Se o e-mail informado ainda não estiver confirmado, você receberá em instantes uma mensagem com o link de confirmação. A inscrição só vale depois do clique no link.';

/** Resposta do endpoint antigo de descadastro por `?email=` (não altera nada). */
export const UNSUBSCRIBE_GENERIC_MESSAGE =
  'Para cancelar a inscrição, use o link "Cancelar inscrição" que está no rodapé de qualquer e-mail da newsletter.';

export function normalizeNewsletterEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

async function sendConfirmationIfAllowed(subscriber: {
  id: string;
  email: string;
  name: string | null;
  confirmationSentAt: Date | null;
}): Promise<boolean> {
  const now = new Date();
  if (
    subscriber.confirmationSentAt &&
    now.getTime() - subscriber.confirmationSentAt.getTime() < CONFIRMATION_RESEND_COOLDOWN_MS
  ) {
    return false;
  }

  const rl = await checkRateLimit(
    `newsletter:confirm:${normalizeNewsletterEmail(subscriber.email)}`,
    CONFIRMATION_EMAILS_PER_HOUR,
    60 * 60,
  );
  if (!rl.allowed) return false;

  await prisma.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { confirmationSentAt: now },
  });

  const { html, text } = renderNewsletterConfirmationEmail({
    name: subscriber.name,
    confirmUrl: buildConfirmationUrl(subscriber.id),
    validForHours: Math.round(CONFIRMATION_TOKEN_TTL_SECONDS / 3600),
  });
  const result = await sendEmail({
    to: subscriber.email,
    subject: NEWSLETTER_CONFIRMATION_SUBJECT,
    html,
    text,
  });
  if (!result.success) {
    apiLogger.error({ subscriberId: subscriber.id, err: result.error }, 'Falha ao enviar confirmação da newsletter');
  }
  return result.success;
}

export interface SubscribeInput {
  email: string;
  name?: string | null;
  interests?: string[] | null;
  source?: string | null;
}

/**
 * Registra (ou renova) o pedido de inscrição e envia o link de confirmação.
 * Não revela o estado do e-mail: quem chama responde sempre a mesma coisa.
 */
export async function requestNewsletterSubscription(input: SubscribeInput): Promise<void> {
  const email = normalizeNewsletterEmail(input.email);
  const name = input.name?.trim() ? input.name.trim().slice(0, 200) : null;
  const interests = input.interests && input.interests.length > 0 ? JSON.stringify(input.interests) : null;

  let subscriber = await prisma.newsletterSubscriber.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });

  if (subscriber && subscriber.isActive && subscriber.confirmedAt) {
    // Já confirmado: nada a fazer e nada a revelar.
    return;
  }

  if (!subscriber) {
    try {
      subscriber = await prisma.newsletterSubscriber.create({
        data: { email, name, interests, source: input.source ?? null, isActive: true, confirmedAt: null },
      });
      trackServerEvent('newsletter_signup');
    } catch (err) {
      if (isUniqueViolation(err)) return; // pedido concorrente para o mesmo e-mail
      throw err;
    }
  } else if (!subscriber.isActive) {
    // Reinscrição de quem tinha cancelado: volta a pendente e exige nova confirmação.
    subscriber = await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: {
        isActive: true,
        confirmedAt: null,
        unsubscribedAt: null,
        name: name ?? subscriber.name,
        interests: interests ?? subscriber.interests,
        source: input.source ?? subscriber.source,
      },
    });
  }

  await sendConfirmationIfAllowed(subscriber);
}

export type ConfirmResult = 'confirmed' | 'already' | 'expired' | 'invalid';
export type ConfirmationTokenState = 'pending' | 'already' | 'expired' | 'invalid';

/**
 * Só lê: diz se o link de confirmação está apto a confirmar, sem alterar nada.
 * Usado pelo GET da página /confirmar-newsletter, que mostra o botão; a
 * confirmação em si acontece no POST (verificadores de link dos provedores
 * fazem GET e não podem confirmar sozinhos).
 */
export async function inspectConfirmationToken(token: unknown): Promise<ConfirmationTokenState> {
  const verified = verifyConfirmationToken(token);
  if (!verified.ok) return verified.reason;

  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { id: verified.subscriberId },
  });
  if (!subscriber || !subscriber.isActive) return 'invalid';
  return subscriber.confirmedAt ? 'already' : 'pending';
}

export async function confirmNewsletterSubscription(token: unknown): Promise<ConfirmResult> {
  const verified = verifyConfirmationToken(token);
  if (!verified.ok) return verified.reason;

  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { id: verified.subscriberId },
  });
  if (!subscriber || !subscriber.isActive) return 'invalid';
  if (subscriber.confirmedAt) return 'already';

  const { count } = await prisma.newsletterSubscriber.updateMany({
    where: { id: subscriber.id, ...PENDING_SUBSCRIBER_WHERE },
    data: { confirmedAt: new Date() },
  });
  if (count === 0) return 'already';

  trackServerEvent('newsletter_confirmed');

  if (isMailChimpConfigured()) {
    const [firstName, ...rest] = (subscriber.name || '').split(' ');
    let interests: string[] | undefined;
    try {
      interests = subscriber.interests ? JSON.parse(subscriber.interests) : undefined;
    } catch {
      interests = undefined;
    }
    try {
      await addSubscriber(subscriber.email, firstName, rest.join(' '), interests);
    } catch (err) {
      apiLogger.error({ err, subscriberId: subscriber.id }, '[MailChimp] Falha ao sincronizar inscrito confirmado');
    }
  }

  return 'confirmed';
}

export type UnsubscribeResult = 'unsubscribed' | 'already' | 'invalid';

/** Só verifica o token, sem alterar nada (usado pela página antes do clique). */
export function isValidUnsubscribeToken(token: unknown): boolean {
  return verifyUnsubscribeToken(token) !== null;
}

export async function unsubscribeNewsletterByToken(token: unknown): Promise<UnsubscribeResult> {
  const subscriberId = verifyUnsubscribeToken(token);
  if (!subscriberId) return 'invalid';

  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { id: subscriberId } });
  if (!subscriber) return 'invalid';
  if (!subscriber.isActive) return 'already';

  await prisma.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { isActive: false, unsubscribedAt: new Date() },
  });

  if (isMailChimpConfigured()) {
    try {
      await unsubscribeSubscriber(subscriber.email);
    } catch (err) {
      apiLogger.error({ err, subscriberId: subscriber.id }, '[MailChimp] Falha ao cancelar inscrito');
    }
  }

  return 'unsubscribed';
}
