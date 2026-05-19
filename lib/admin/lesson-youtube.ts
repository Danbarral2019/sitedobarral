/**
 * Extrai o YouTube video ID de URLs ou de IDs nus.
 *
 * Aceita formatos:
 *  - https://www.youtube.com/watch?v=ID
 *  - https://youtu.be/ID
 *  - https://www.youtube.com/embed/ID
 *  - ID puro (exatamente 11 chars [a-zA-Z0-9_-])
 */

const PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /^([a-zA-Z0-9_-]{11})$/,
] as const;

export function extractYoutubeId(url: string): string | null {
  for (const pattern of PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
