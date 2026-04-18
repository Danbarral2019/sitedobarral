/**
 * Stub email templates for subscription lifecycle.
 * These will be replaced with real HTML templates in Task 14.
 */

export function renderWelcomeEmail(p: { name: string; plan: string; billingCycle: string }) {
  return { subject: '', html: '' };
}

export function renderReceiptEmail(p: { name: string; plan: string; billingCycle: string; nextBillingDate: Date }) {
  return { subject: '', html: '' };
}

export function renderCardFailedEmail(p: { name: string }) {
  return { subject: '', html: '' };
}

export function renderPixMandateFailedEmail(p: { name: string }) {
  return { subject: '', html: '' };
}

export function renderCanceledEmail(p: { name: string }) {
  return { subject: '', html: '' };
}
