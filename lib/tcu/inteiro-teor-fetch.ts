/**
 * Baixa o inteiro teor do acórdão do TCU.
 *
 * O campo se chama `tcuLinkPDF` mas serve **RTF** — o endpoint é
 * SvlVisualizarRelVotoAcRtf (Relatório, Voto, Acórdão). Medido em 15/07:
 * HTTP 200 em 7 de 8, arquivos de 227 KB a 14,5 MB.
 *
 * Nunca lança: devolve `{ ok: false, erro }`. Um acórdão que falha não pode
 * derrubar o backfill dos outros 1.834 nem quebrar o cron diário.
 */

/** O maior visto no spike tem 14,5 MB. Acima de 20 MB é anomalia. */
export const TETO_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 60_000;

export type FetchResult = { ok: true; buf: Buffer } | { ok: false; erro: string };

export async function fetchInteiroTeor(
  url: string,
  opts?: { tetoBytes?: number; timeoutMs?: number }
): Promise<FetchResult> {
  const teto = opts?.tetoBytes ?? TETO_BYTES;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)' },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, erro: `HTTP ${res.status}` };

    // Barra o gigante antes de puxar o corpo, quando o servidor declara.
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > teto) return { ok: false, erro: `excede o teto: ${len} bytes` };

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > teto) return { ok: false, erro: `excede o teto: ${buf.length} bytes` };
    if (!buf.subarray(0, 5).toString('latin1').startsWith('{\\rtf')) {
      return { ok: false, erro: 'não é RTF' };
    }
    return { ok: true, buf };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
