/**
 * Transactional email templates for the subscription lifecycle.
 *
 * Each render function returns { subject, html, text } — the plain-text
 * variant improves deliverability and is accepted by the Resend wrapper.
 */

import {
  baseUrl,
  escapeHtml,
  formatBillingCycle,
  formatCurrencyFromCents,
  formatDatePtBr,
  formatPlan,
  renderButton,
  wrapEmail,
} from './shell';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ── Welcome (checkout.session.completed) ──────────────────────────────────

export interface WelcomeParams {
  name: string;
  plan: string;
  billingCycle: string;
}

export function renderWelcomeEmail(p: WelcomeParams): RenderedEmail {
  const safeName = escapeHtml(p.name || '');
  const planLabel = formatPlan(p.plan);
  const cycleLabel = formatBillingCycle(p.billingCycle);
  const cta = `${baseUrl}/area-restrita`;

  const subject = `Bem-vindo ao plano ${planLabel} — Prof. Daniel Barral`;

  const contentHtml = `
    <h2 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;color:#1e3a5f;font-size:22px;">Seja bem-vindo${safeName ? ', ' + safeName : ''}!</h2>
    <p style="margin:0 0 14px 0;">Sua assinatura <strong>${escapeHtml(planLabel)}</strong> (cobran&ccedil;a ${escapeHtml(cycleLabel)}) foi ativada com sucesso.</p>
    <p style="margin:0 0 8px 0;">Voc&ecirc; j&aacute; pode acessar todo o conte&uacute;do dispon&iacute;vel para o seu plano na &aacute;rea restrita.</p>
    ${renderButton('Acessar a área restrita', cta)}
    <p style="margin:16px 0 0 0;font-size:13px;color:#64748b;">Se voc&ecirc; tiver qualquer d&uacute;vida, basta responder a este email.</p>
  `;

  const html = wrapEmail({
    previewText: `Sua assinatura ${planLabel} foi ativada. Acesse agora a área restrita.`,
    contentHtml,
  });

  const text = [
    `Seja bem-vindo${p.name ? ', ' + p.name : ''}!`,
    ``,
    `Sua assinatura ${planLabel} (cobrança ${cycleLabel}) foi ativada com sucesso.`,
    `Acesse a área restrita: ${cta}`,
    ``,
    `Se tiver qualquer dúvida, responda a este email.`,
    ``,
    `— Prof. Daniel Barral`,
  ].join('\n');

  return { subject, html, text };
}

// ── Receipt (invoice.paid) ────────────────────────────────────────────────

export interface ReceiptParams {
  name: string;
  plan: string;
  billingCycle: string;
  nextBillingDate: Date;
  amountPaidCents: number;
  currency: string;
  invoiceUrl?: string | null;
}

export function renderReceiptEmail(p: ReceiptParams): RenderedEmail {
  const safeName = escapeHtml(p.name || '');
  const planLabel = formatPlan(p.plan);
  const cycleLabel = formatBillingCycle(p.billingCycle);
  const amount = formatCurrencyFromCents(p.amountPaidCents, p.currency);
  const nextDate = formatDatePtBr(p.nextBillingDate);
  const accountCta = `${baseUrl}/area-restrita`;

  const subject = `Pagamento recebido — ${planLabel} (${amount})`;

  const invoiceLinkHtml = p.invoiceUrl
    ? `<p style="margin:8px 0 0 0;font-size:13px;"><a href="${p.invoiceUrl}" style="color:#2563eb;text-decoration:underline;">Ver a fatura detalhada</a></p>`
    : '';

  const contentHtml = `
    <h2 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;color:#1e3a5f;font-size:22px;">Recibo de pagamento</h2>
    <p style="margin:0 0 14px 0;">Ol&aacute;${safeName ? ', ' + safeName : ''}. Recebemos o pagamento da sua assinatura.</p>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #e2e8f0;border-radius:6px;margin:16px 0;">
      <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">Plano</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;"><strong>${escapeHtml(planLabel)}</strong></td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">Cobran&ccedil;a</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(cycleLabel)}</td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">Valor pago</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;"><strong>${escapeHtml(amount)}</strong></td></tr>
      <tr><td style="padding:12px 16px;color:#64748b;font-size:13px;">Pr&oacute;xima cobran&ccedil;a</td><td style="padding:12px 16px;text-align:right;">${escapeHtml(nextDate)}</td></tr>
    </table>
    ${invoiceLinkHtml}
    ${renderButton('Acessar minha conta', accountCta)}
  `;

  const html = wrapEmail({
    previewText: `Recibo: ${amount} — próxima cobrança em ${nextDate}.`,
    contentHtml,
  });

  const text = [
    `Olá${p.name ? ', ' + p.name : ''}. Recebemos o pagamento da sua assinatura.`,
    ``,
    `Plano: ${planLabel}`,
    `Cobrança: ${cycleLabel}`,
    `Valor pago: ${amount}`,
    `Próxima cobrança: ${nextDate}`,
    p.invoiceUrl ? `\nFatura detalhada: ${p.invoiceUrl}` : '',
    ``,
    `Acessar sua conta: ${accountCta}`,
    ``,
    `— Prof. Daniel Barral`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}

// ── Card failed (invoice.payment_failed, paymentMethod = card) ────────────

export interface CardFailedParams {
  name: string;
  billingPortalUrl: string;
}

export function renderCardFailedEmail(p: CardFailedParams): RenderedEmail {
  const safeName = escapeHtml(p.name || '');
  const subject = 'Falha no pagamento da sua assinatura';

  const contentHtml = `
    <h2 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;color:#1e3a5f;font-size:22px;">N&atilde;o conseguimos processar seu pagamento</h2>
    <p style="margin:0 0 14px 0;">Ol&aacute;${safeName ? ', ' + safeName : ''}. A cobran&ccedil;a no seu cart&atilde;o n&atilde;o foi autorizada, e sua assinatura est&aacute; marcada como <strong>pendente</strong>.</p>
    <p style="margin:0 0 14px 0;">Para manter o seu acesso, atualize os dados do seu cart&atilde;o ou escolha outro meio de pagamento no portal de cobran&ccedil;a.</p>
    ${renderButton('Atualizar meio de pagamento', p.billingPortalUrl)}
    <p style="margin:16px 0 0 0;font-size:13px;color:#64748b;">Assim que o pagamento for concluído, seu acesso ser&aacute; reativado automaticamente.</p>
  `;

  const html = wrapEmail({
    previewText: 'Atualize seu meio de pagamento para manter o acesso.',
    contentHtml,
  });

  const text = [
    `Olá${p.name ? ', ' + p.name : ''}.`,
    ``,
    `A cobrança no seu cartão não foi autorizada e sua assinatura está pendente.`,
    `Para manter o acesso, atualize os dados do cartão no portal de cobrança:`,
    `${p.billingPortalUrl}`,
    ``,
    `Assim que o pagamento for concluído, o acesso será reativado automaticamente.`,
    ``,
    `— Prof. Daniel Barral`,
  ].join('\n');

  return { subject, html, text };
}

// ── Pix mandate failed (invoice.payment_failed, paymentMethod = pix) ──────

export type PixMandateFailedParams = CardFailedParams;

export function renderPixMandateFailedEmail(p: PixMandateFailedParams): RenderedEmail {
  const safeName = escapeHtml(p.name || '');
  // Linha de assunto é texto puro: entidades HTML não são decodificadas pelo
  // cliente de e-mail e apareceriam cruas na caixa de entrada.
  const subject = 'Sua autorização de Pix precisa ser renovada';

  const contentHtml = `
    <h2 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;color:#1e3a5f;font-size:22px;">Autoriza&ccedil;&atilde;o de Pix expirada</h2>
    <p style="margin:0 0 14px 0;">Ol&aacute;${safeName ? ', ' + safeName : ''}. N&atilde;o conseguimos cobrar a mensalidade porque a autoriza&ccedil;&atilde;o recorrente de Pix expirou ou foi cancelada.</p>
    <p style="margin:0 0 14px 0;">Para reativar sua assinatura, basta renovar a autoriza&ccedil;&atilde;o no portal de cobran&ccedil;a.</p>
    ${renderButton('Renovar autorização de Pix', p.billingPortalUrl)}
    <p style="margin:16px 0 0 0;font-size:13px;color:#64748b;">Voc&ecirc; tamb&eacute;m pode trocar por outro meio de pagamento no mesmo portal.</p>
  `;

  const html = wrapEmail({
    previewText: 'Renove a autorização de Pix para manter o acesso.',
    contentHtml,
  });

  const text = [
    `Olá${p.name ? ', ' + p.name : ''}.`,
    ``,
    `Não conseguimos cobrar sua mensalidade porque a autorização recorrente de Pix expirou ou foi cancelada.`,
    `Renove a autorização (ou troque o meio de pagamento) no portal de cobrança:`,
    `${p.billingPortalUrl}`,
    ``,
    `— Prof. Daniel Barral`,
  ].join('\n');

  return { subject, html, text };
}

// ── Canceled (customer.subscription.deleted) ──────────────────────────────

export interface CanceledParams {
  name: string;
  accessEndsAt: Date | null;
}

export function renderCanceledEmail(p: CanceledParams): RenderedEmail {
  const safeName = escapeHtml(p.name || '');
  const subject = 'Confirmamos o cancelamento da sua assinatura';
  const endsAtLabel = p.accessEndsAt ? formatDatePtBr(p.accessEndsAt) : null;
  const endsAtLine = endsAtLabel
    ? `<p style="margin:0 0 14px 0;">Seu acesso continua ativo at&eacute; <strong>${escapeHtml(endsAtLabel)}</strong>.</p>`
    : `<p style="margin:0 0 14px 0;">Seu acesso &agrave; assinatura foi encerrado.</p>`;
  const endsAtLineText = endsAtLabel
    ? `Seu acesso continua ativo até ${endsAtLabel}.`
    : `Seu acesso à assinatura foi encerrado.`;

  const contentHtml = `
    <h2 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;color:#1e3a5f;font-size:22px;">Assinatura cancelada</h2>
    <p style="margin:0 0 14px 0;">Ol&aacute;${safeName ? ', ' + safeName : ''}. Confirmamos o cancelamento da sua assinatura.</p>
    ${endsAtLine}
    <p style="margin:0 0 14px 0;">Sentiremos sua falta. Se mudar de ideia, voc&ecirc; pode reativar a qualquer momento pelo nosso site.</p>
    ${renderButton('Voltar ao site', baseUrl)}
    <p style="margin:16px 0 0 0;font-size:13px;color:#64748b;">Se o cancelamento n&atilde;o foi solicitado por voc&ecirc;, responda este email e vamos averiguar.</p>
  `;

  const html = wrapEmail({
    previewText: endsAtLabel
      ? `Cancelamento confirmado. Acesso ativo até ${endsAtLabel}.`
      : `Cancelamento confirmado.`,
    contentHtml,
  });

  const text = [
    `Olá${p.name ? ', ' + p.name : ''}. Confirmamos o cancelamento da sua assinatura.`,
    ``,
    endsAtLineText,
    ``,
    `Se mudar de ideia, pode reativar a qualquer momento: ${baseUrl}`,
    ``,
    `Se o cancelamento não foi solicitado por você, responda este email.`,
    ``,
    `— Prof. Daniel Barral`,
  ].join('\n');

  return { subject, html, text };
}
