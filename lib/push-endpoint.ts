/**
 * Validação do endpoint de uma assinatura Web Push.
 *
 * O servidor faz POST para o endpoint salvo ao enviar notificações; aceitar
 * qualquer URL transformaria o envio em SSRF. Só entram URLs https dos
 * serviços de push dos navegadores.
 */

const EXACT_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);

const HOST_SUFFIXES = ['.notify.windows.com', '.push.apple.com'];

export const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 10;

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== '443') return false;

  const host = url.hostname.toLowerCase();
  if (EXACT_HOSTS.has(host)) return true;
  return HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}
