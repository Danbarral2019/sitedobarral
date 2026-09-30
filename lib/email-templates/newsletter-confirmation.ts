/**
 * E-mail de confirmação da inscrição na newsletter (double opt-in).
 *
 * Transacional: usa o shell compartilhado (sem pixel de rastreamento). Quem
 * não pediu a inscrição só precisa ignorar a mensagem; nada é enviado sem a
 * confirmação.
 */

import { escapeHtml, renderButton, wrapEmail } from './shell';

export const NEWSLETTER_CONFIRMATION_SUBJECT = 'Confirme sua inscrição na newsletter';

export function renderNewsletterConfirmationEmail(params: {
  name: string | null;
  confirmUrl: string;
  validForHours: number;
}): { html: string; text: string } {
  const { name, confirmUrl, validForHours } = params;
  const greeting = name ? `Ol&#225;, ${escapeHtml(name)}!` : 'Ol&#225;!';

  const contentHtml = `
    <p style="margin:0 0 16px 0;">${greeting}</p>
    <p style="margin:0 0 16px 0;">Recebemos um pedido de inscri&#231;&#227;o deste e-mail na newsletter do Prof. Daniel Barral. Para come&#231;ar a receber os conte&#250;dos, confirme a inscri&#231;&#227;o no bot&#227;o abaixo.</p>
    ${renderButton('Confirmar inscri&#231;&#227;o', escapeHtml(confirmUrl))}
    <p style="margin:16px 0 8px 0;font-size:13px;color:#4a4d52;">O link vale por ${validForHours} horas. Se o bot&#227;o n&#227;o funcionar, copie e cole este endere&#231;o no navegador:</p>
    <p style="margin:0 0 16px 0;font-size:12px;word-break:break-all;"><a href="${escapeHtml(confirmUrl)}" style="color:#20364e;">${escapeHtml(confirmUrl)}</a></p>
    <p style="margin:0 0 16px 0;font-size:13px;color:#4a4d52;">Se voc&#234; n&#227;o pediu esta inscri&#231;&#227;o, basta ignorar esta mensagem: sem a confirma&#231;&#227;o, nenhum e-mail da newsletter ser&#225; enviado.</p>`;

  const text = [
    name ? `Olá, ${name}!` : 'Olá!',
    '',
    'Recebemos um pedido de inscrição deste e-mail na newsletter do Prof. Daniel Barral.',
    `Para confirmar, acesse (link válido por ${validForHours} horas):`,
    confirmUrl,
    '',
    'Se você não pediu esta inscrição, basta ignorar esta mensagem.',
  ].join('\n');

  return {
    html: wrapEmail({ previewText: 'Confirme sua inscrição na newsletter', contentHtml }),
    text,
  };
}
