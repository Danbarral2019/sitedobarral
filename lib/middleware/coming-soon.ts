/**
 * Lógica do coming-soon de pré-lançamento.
 * Funções puras testadas em isolation; consumidas pelo middleware.ts.
 */

const ALLOWLIST_EXACT = new Set([
  // Auth e validação de acesso
  '/login', '/registro', '/esqueci-senha', '/redefinir-senha',
  '/verificar-email', '/validar-acesso', '/cancelar-newsletter',
  // Páginas legais
  '/privacidade', '/termos',
  // Pagamento/upgrade
  '/upgrade', '/planos',
  // Blog (vitrine permitida)
  '/blog',
  // Próprias do gate
  '/coming-soon', '/preview',
  // Assets/infra
  '/favicon.ico', '/manifest.webmanifest', '/robots.txt',
  '/sitemap.xml', '/sitemap-artigos.xml',
]);

const ALLOWLIST_PREFIXES = [
  '/_next/',
  '/api/',
  '/blog/',
  '/area-restrita/',
  '/admin/',
  '/certificado/',
  '/assinatura/',
  '/upgrade/',
  '/icons/',
  '/images/',
];

/**
 * Decide se uma rota está permitida durante o modo coming-soon.
 * Tudo o que não estiver explicitamente listado é considerado vitrine
 * e cai no coming-soon para visitantes anônimos.
 */
export function isAllowlistedRoute(pathname: string): boolean {
  // Normaliza trailing slash (exceto raiz)
  const normalized = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;

  if (ALLOWLIST_EXACT.has(normalized)) return true;
  return ALLOWLIST_PREFIXES.some(p => normalized.startsWith(p));
}

/**
 * Hash SHA-256 hex de uma string usando Web Crypto API.
 * Compatível com Edge Runtime do Next.js (não usa node:crypto).
 */
export async function hashPreviewKey(key: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compara o cookie de preview com o hash esperado da chave.
 * Cookie deve conter o hash hex da chave (não a chave em plaintext).
 */
export async function hasValidPreviewCookie(
  cookieValue: string | undefined,
  expectedKey: string | undefined,
): Promise<boolean> {
  if (!cookieValue || !expectedKey) return false;
  const expected = await hashPreviewKey(expectedKey);
  return cookieValue === expected;
}
