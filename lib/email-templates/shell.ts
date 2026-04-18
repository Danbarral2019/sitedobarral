/**
 * Shared shell and helpers for transactional emails.
 *
 * Design is aligned with newsletter.ts (same navy→blue gradient, Georgia headings),
 * but the footer is transactional-only (no newsletter unsubscribe, no tracking pixel).
 *
 * HTML inline only: tables + inline styles for Gmail/Outlook compatibility.
 */

export const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL || 'https://profdanielbarral.com';

export function renderHeader(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1e3a5f;">
      <tr>
        <td align="center" style="padding:0;">
          <!--[if mso]>
          <table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#1e3a5f;padding:36px 30px;">
          <![endif]-->
          <!--[if !mso]><!-->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);">
            <tr>
              <td align="center" style="padding:36px 30px;">
          <!--<![endif]-->
                <h1 style="margin:0;font-size:28px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-weight:700;letter-spacing:0.5px;">Prof. Daniel Barral</h1>
                <table cellpadding="0" cellspacing="0" border="0" style="margin:12px auto 0 auto;">
                  <tr>
                    <td style="height:2px;background-color:#60a5fa;font-size:0;line-height:0;width:60px;">&nbsp;</td>
                  </tr>
                </table>
                <p style="margin:12px 0 0 0;font-size:14px;color:#bfdbfe;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;">Direito Administrativo, Licita&#231;&#245;es e Contratos</p>
          <!--[if mso]>
          </td></tr></table>
          <![endif]-->
          <!--[if !mso]><!-->
              </td>
            </tr>
          </table>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

export function renderFooter(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1e293b;">
      <tr>
        <td align="center" style="padding:28px 20px 14px 20px;">
          <p style="margin:0 0 6px 0;font-size:15px;color:#f1f5f9;font-family:Georgia,'Times New Roman',serif;font-weight:700;">Prof. Daniel Barral</p>
          <p style="margin:0 0 14px 0;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">Direito Administrativo, Licita&#231;&#245;es e Contratos</p>
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding:0 8px;">
                <a href="https://www.linkedin.com/in/daniel-de-andrade-oliveira-barral-b5110870/" style="color:#60a5fa;text-decoration:none;font-size:12px;font-family:Arial,Helvetica,sans-serif;">LinkedIn</a>
              </td>
              <td style="color:#475569;font-size:12px;">|</td>
              <td align="center" style="padding:0 8px;">
                <a href="https://instagram.com/danbarral" style="color:#60a5fa;text-decoration:none;font-size:12px;font-family:Arial,Helvetica,sans-serif;">Instagram</a>
              </td>
              <td style="color:#475569;font-size:12px;">|</td>
              <td align="center" style="padding:0 8px;">
                <a href="${baseUrl}" style="color:#60a5fa;text-decoration:none;font-size:12px;font-family:Arial,Helvetica,sans-serif;">Site</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 20px;">
          <table width="80%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="height:1px;background-color:#334155;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:14px 20px 20px 20px;">
          <p style="margin:0 0 6px 0;font-size:11px;color:#64748b;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
            Este &#233; um email transacional referente &#224; sua assinatura.
          </p>
          <p style="margin:0;font-size:11px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
            &copy; ${new Date().getFullYear()} Prof. Daniel Barral. Todos os direitos reservados.
          </p>
        </td>
      </tr>
    </table>`;
}

/**
 * Renders a CTA button. Uses MSO fallback for Outlook.
 */
export function renderButton(text: string, href: string): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
      <tr>
        <td align="center" style="border-radius:6px;background:#2563eb;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="14%" stroke="f" fillcolor="#2563eb">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;">${text}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${href}" style="background:#2563eb;border-radius:6px;color:#ffffff;display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:44px;text-align:center;text-decoration:none;width:240px;mso-hide:all;">${text}</a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

/**
 * Wraps a content block with DOCTYPE, header, body container, and footer.
 */
export function wrapEmail(params: { previewText: string; contentHtml: string }): string {
  const { previewText, contentHtml } = params;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Prof. Daniel Barral</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(previewText)}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
  <tr>
    <td align="center" style="padding:0;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;">
        <tr><td>${renderHeader()}</td></tr>
        <tr>
          <td style="padding:32px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;color:#1e293b;font-size:15px;line-height:1.6;">
            ${contentHtml}
          </td>
        </tr>
        <tr><td>${renderFooter()}</td></tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ── Formatting helpers ────────────────────────────────────────────────────

const planLabels: Record<string, string> = {
  basico: 'B\u00e1sico',
  premium: 'Premium',
};

export function formatPlan(plan: string): string {
  return planLabels[plan] || plan;
}

export function formatBillingCycle(cycle: string): string {
  return cycle === 'yearly' ? 'anual' : 'mensal';
}

/**
 * Formats a currency amount in cents to BRL (e.g., 4990 → "R$ 49,90").
 * Currency code defaults to BRL; other codes fall back to Intl with the given code.
 */
export function formatCurrencyFromCents(amountInCents: number, currency: string = 'brl'): string {
  const amount = amountInCents / 100;
  const upper = currency.toUpperCase();
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: upper }).format(amount);
  } catch {
    return `${upper} ${amount.toFixed(2)}`;
  }
}

export function formatDatePtBr(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

// Minimal HTML escaping for user-provided strings interpolated into attributes/content.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
