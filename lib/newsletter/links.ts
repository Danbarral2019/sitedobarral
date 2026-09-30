/**
 * Links assinados enviados aos inscritos da newsletter (confirmação e
 * descadastro) e cabeçalhos List-Unsubscribe dos envios.
 */

import { signConfirmationToken, signUnsubscribeToken } from './tokens';

function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || 'https://profdanielbarral.com').replace(/\/+$/, '');
}

export function buildConfirmationUrl(subscriberId: string): string {
  return `${siteBaseUrl()}/confirmar-newsletter?token=${encodeURIComponent(signConfirmationToken(subscriberId))}`;
}

/** Página de descadastro (pede um clique antes de cancelar). Vai no rodapé. */
export function buildUnsubscribeUrl(subscriberId: string): string {
  return `${siteBaseUrl()}/cancelar-newsletter?token=${encodeURIComponent(signUnsubscribeToken(subscriberId))}`;
}

/** Endpoint de descadastro em um clique (RFC 8058), usado no List-Unsubscribe. */
export function buildOneClickUnsubscribeUrl(subscriberId: string): string {
  return `${siteBaseUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(subscriberId))}`;
}

export function buildListUnsubscribeHeaders(subscriberId: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${buildOneClickUnsubscribeUrl(subscriberId)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
