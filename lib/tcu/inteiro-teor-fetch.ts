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

import { FiltroGruposBinarios } from './rtf-filtro-binario';

/** O maior visto no spike tem 14,5 MB. Acima de 20 MB é anomalia. */
export const TETO_BYTES = 20 * 1024 * 1024;
/**
 * Com `filtrarBinarios`, o teto vale para o RTF já sem imagens, e este é o
 * limite do arquivo bruto. O maior visto em 30/09/2026 tinha 383 MB, dos
 * quais quase tudo era `\pict`.
 */
export const TETO_BRUTO_BYTES = 600 * 1024 * 1024;
const TIMEOUT_MS = 60_000;

export type FetchResult = { ok: true; buf: Buffer } | { ok: false; erro: string };

export async function fetchInteiroTeor(
  url: string,
  opts?: {
    tetoBytes?: number;
    timeoutMs?: number;
    /**
     * Descarta imagens e objetos embutidos durante o download (rtf-filtro-binario.ts),
     * e o teto passa a valer para o que sobra. Para scripts: um RTF de centenas de MB
     * leva muitos minutos para descer do TCU, o que não cabe no cron.
     */
    filtrarBinarios?: boolean;
  }
): Promise<FetchResult> {
  const teto = opts?.tetoBytes ?? TETO_BYTES;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)' },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, erro: `HTTP ${res.status}` };
    if (opts?.filtrarBinarios) return await baixarFiltrando(res, teto);

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

async function baixarFiltrando(res: Response, teto: number): Promise<FetchResult> {
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > TETO_BRUTO_BYTES) return { ok: false, erro: `excede o teto bruto: ${len} bytes` };
  if (!res.body) return { ok: false, erro: 'resposta sem corpo' };

  const filtro = new FiltroGruposBinarios();
  let cabecalho = '';
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    if (cabecalho.length < 5) {
      cabecalho += chunk.subarray(0, 5 - cabecalho.length).toString('latin1');
      if (cabecalho.length >= 5 && !cabecalho.startsWith('{\\rtf')) {
        await reader.cancel();
        return { ok: false, erro: 'não é RTF' };
      }
    }
    filtro.push(chunk);
    if (filtro.bytesEntrada > TETO_BRUTO_BYTES) {
      await reader.cancel();
      return { ok: false, erro: `excede o teto bruto: mais de ${TETO_BRUTO_BYTES} bytes` };
    }
    if (filtro.bytesSaida > teto) {
      await reader.cancel();
      return { ok: false, erro: `excede o teto sem imagens: mais de ${teto} bytes` };
    }
  }
  if (!cabecalho.startsWith('{\\rtf')) return { ok: false, erro: 'não é RTF' };
  return { ok: true, buf: filtro.end() };
}
