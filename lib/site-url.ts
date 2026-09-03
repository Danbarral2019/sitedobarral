const DEVELOPMENT_SITE_URL = 'http://localhost:3000';

export function getSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();

  if (!configuredUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_BASE_URL deve ser configurada em produção.');
    }

    return new URL(DEVELOPMENT_SITE_URL);
  }

  const url = new URL(configuredUrl);

  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_BASE_URL deve usar HTTPS em produção.');
  }

  return new URL(url.origin);
}
