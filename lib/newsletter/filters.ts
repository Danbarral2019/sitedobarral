/**
 * Filtros de estado do NewsletterSubscriber (double opt-in), sem dependências
 * além dos tipos do Prisma, para uso em qualquer consulta.
 *
 * - confirmado: isActive = true,  confirmedAt != null (recebe os envios)
 * - pendente:   isActive = true,  confirmedAt = null  (aguarda o clique no link)
 * - cancelado:  isActive = false
 *
 * Toda consulta que monta lista de envio a inscritos deve usar
 * CONFIRMED_SUBSCRIBER_WHERE.
 */

import type { Prisma } from '@prisma/client';

export const CONFIRMED_SUBSCRIBER_WHERE = {
  isActive: true,
  confirmedAt: { not: null },
} satisfies Prisma.NewsletterSubscriberWhereInput;

export const PENDING_SUBSCRIBER_WHERE = {
  isActive: true,
  confirmedAt: null,
} satisfies Prisma.NewsletterSubscriberWhereInput;

export function subscriberStatus(s: {
  isActive: boolean;
  confirmedAt: Date | null;
}): 'active' | 'pending' | 'unsubscribed' {
  if (!s.isActive) return 'unsubscribed';
  return s.confirmedAt ? 'active' : 'pending';
}
