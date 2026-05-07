import { prisma } from '@/lib/prisma';
import { generateAiBullets, shouldEnrichWithAi } from './ai-bullets';

export interface Dispositivo {
  numero: string;
  texto: string;
}

export interface ExtractResult {
  dispositivos: Dispositivo[];
  method: 'ementa_regex' | 'rtf_parse' | 'pdf_parse' | 'cached' | 'failed';
  pdfFetchFailed?: boolean;
  /** Texto bruto extraído do inteiro teor (RTF/PDF), passado para a camada IA. */
  inteiroTeorText?: string;
  /** Bullets editoriais gerados por IA quando os dispositivos extraídos estão secos. */
  aiBullets?: string[];
}

const FETCH_TIMEOUT_MS = 30000;
const MAX_DISPOSITIVOS_PER_ACORDAO = 15;
const MAX_TEXTO_LENGTH = 5000;

// Aceita espaços extras dentro do número (TCU às vezes formata "9. 4 ." em vez de "9.4.")
const DISPOSITIVO_REGEX = /(?:^|[\n\s;.])(9\.\s*\d+(?:\s*\.\s*\d+)*)\s*\.?\s+([^\n][\s\S]*?)(?=\s+9\.\s*\d+(?:\s*\.\s*\d+)*\s*\.?\s+|\s+(?:10|11|12)\.\s+(?:Ata|Data|C[óo]digo)|\s+Ata\s+n[°º]|\n\s*Senado|$)/g;

function cleanDispositivoText(raw: string): string {
  let cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length > MAX_TEXTO_LENGTH) {
    cleaned = cleaned.slice(0, MAX_TEXTO_LENGTH).replace(/\s+\S*$/, '') + '...';
  }
  return cleaned;
}

/**
 * Isola o bloco "ACORDAM os Ministros... em: <dispositivos> 10. Ata"
 * (ou similar) para evitar pegar citações de "9.X" no relatório/voto
 * que precedem o dispositivo final do acórdão.
 *
 * Em alguns casos há múltiplos votos (relator + revisor) — preferimos o
 * último bloco "ACORDAM" (que costuma ser a deliberação final do colegiado).
 */
function isolateAcordamBlock(text: string): string {
  const re = /ACORDAM\s+os\s+[mM]inistros[\s\S]*?(?:em:|em\s*[—–-]?\s*)/g;
  let lastIdx = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < 0) return text;
  // A partir de "em:", capturar até "10. Ata" / "Ata n°" / final
  const tail = text.slice(lastIdx);
  const endMatch = tail.match(/\s+(?:10|11|12)\.\s+(?:Ata|Data|C[óo]digo)|\s+Ata\s+n[°º]/);
  return endMatch && endMatch.index !== undefined ? tail.slice(0, endMatch.index) : tail;
}

function compareNumeros(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const va = partsA[i] ?? 0;
    const vb = partsB[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function runRegex(text: string): Dispositivo[] {
  if (!text) return [];
  const block = isolateAcordamBlock(text);
  const dispositivos: Dispositivo[] = [];
  const seen = new Set<string>();
  const matches = block.matchAll(DISPOSITIVO_REGEX);
  for (const m of matches) {
    const numero = m[1].replace(/\s+/g, ''); // normaliza "9. 4" → "9.4"
    if (seen.has(numero)) continue;
    const texto = cleanDispositivoText(m[2]);
    if (texto.length < 20) continue;
    if (!/^[a-záéíóúâêôãõç]/i.test(texto)) continue;
    seen.add(numero);
    dispositivos.push({ numero, texto });
    if (dispositivos.length >= MAX_DISPOSITIVOS_PER_ACORDAO) break;
  }
  dispositivos.sort((a, b) => compareNumeros(a.numero, b.numero));
  return dispositivos;
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function toRtfUrl(rawUrl: string): string {
  if (/SvlVisualizarRelVotoAcRtf(?=\?)/.test(rawUrl)) return rawUrl;
  return rawUrl.replace(/SvlVisualizarRelVotoAc(?=\?)/, 'SvlVisualizarRelVotoAcRtf');
}

function toPdfUrl(rawUrl: string): string {
  return rawUrl.replace(/SvlVisualizarRelVotoAcRtf(?=\?)/, 'SvlVisualizarRelVotoAc');
}

function rtfToText(rtf: string): string {
  let text = rtf;
  // Symbol escapes: \~ (nbsp), \- (soft hyphen), \_ (nbsp hyphen), \: (subentry)
  text = text.replace(/\\~/g, ' ').replace(/\\-/g, '').replace(/\\_/g, '-').replace(/\\:/g, ':');
  // Hex escapes (cp1252): \'XX → char
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
    const code = parseInt(hex, 16);
    // Map cp1252 specifics that diverge from latin1
    const cp1252: Record<number, number> = {
      0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
      0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
      0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
      0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
      0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
      0x9e: 0x017e, 0x9f: 0x0178,
    };
    return String.fromCharCode(cp1252[code] ?? code);
  });
  // Unicode escapes \uNNNN? (RTF: signed int16; ? is fallback char)
  text = text.replace(/\\u(-?\d+)\??/g, (_, n) => {
    const code = Number(n);
    return String.fromCharCode(code < 0 ? code + 65536 : code);
  });
  // Control words: \word optional digits, optional space
  text = text.replace(/\\\*?[a-zA-Z]+-?\d*\s?/g, ' ');
  // Escaped braces and backslashes
  text = text.replace(/\\([{}\\])/g, '$1');
  // Strip remaining braces
  text = text.replace(/[{}]/g, ' ');
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

async function fetchRtfText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const rtfUrl = toRtfUrl(url);
    const res = await fetch(rtfUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/rtf,text/rtf,application/x-download,*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null;
    const head = buf.slice(0, 6).toString('latin1');
    if (!head.startsWith('{\\rtf')) return null;
    return rtfToText(buf.toString('latin1'));
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchPdfText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const pdfUrl = toPdfUrl(url);
    const res = await fetch(pdfUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/pdf,*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream') && !contentType.includes('x-download')) {
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100 || !buf.slice(0, 5).toString('latin1').startsWith('%PDF')) {
      return null;
    }
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    try {
      const result = await parser.getText();
      return result.text || null;
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface DocumentLike {
  id: string;
  tcuEmentaCompleta: string | null;
  tcuLinkPDF: string | null;
  clippingExtract?: {
    dispositivos: string | null;
    extractMethod: string;
    pdfFetchFailed: boolean;
    aiBullets?: string | null;
  } | null;
}

function parseAiBullets(raw: string | null | undefined): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : undefined;
  } catch {
    return undefined;
  }
}

async function maybeEnrich(
  documentId: string,
  result: ExtractResult,
  ementa: string,
  cachedAiBullets: string[] | undefined,
): Promise<ExtractResult> {
  if (cachedAiBullets) {
    return { ...result, aiBullets: cachedAiBullets };
  }
  const should = shouldEnrichWithAi({
    dispositivos: result.dispositivos,
    ementa,
    hasInteiroTeor: Boolean(result.inteiroTeorText),
  });
  if (!should || !result.inteiroTeorText) return result;
  const bullets = await generateAiBullets({
    ementa,
    inteiroTeor: result.inteiroTeorText,
    dispositivos: result.dispositivos,
  });
  if (bullets.length > 0) {
    await persistAiBullets(documentId, bullets);
    return { ...result, aiBullets: bullets };
  }
  return result;
}

export async function extractDispositivos(doc: DocumentLike): Promise<ExtractResult> {
  const ementa = doc.tcuEmentaCompleta || '';
  const cachedAiBullets = parseAiBullets(doc.clippingExtract?.aiBullets);

  if (doc.clippingExtract) {
    const cached = doc.clippingExtract;
    if (cached.extractMethod !== 'failed' && cached.dispositivos) {
      try {
        const parsed: Dispositivo[] = JSON.parse(cached.dispositivos);
        return { dispositivos: parsed, method: 'cached', aiBullets: cachedAiBullets };
      } catch {
        // fallthrough to re-extract
      }
    }
    if (cached.pdfFetchFailed) {
      const fromEmenta = runRegex(ementa);
      return {
        dispositivos: fromEmenta,
        method: fromEmenta.length ? 'ementa_regex' : 'failed',
        pdfFetchFailed: true,
        aiBullets: cachedAiBullets,
      };
    }
  }

  const fromEmenta = runRegex(ementa);
  if (fromEmenta.length > 0) {
    await persistExtract(doc.id, fromEmenta, 'ementa_regex', false);
    return maybeEnrich(doc.id, { dispositivos: fromEmenta, method: 'ementa_regex' }, ementa, cachedAiBullets);
  }

  if (doc.tcuLinkPDF) {
    const rtf = await fetchRtfText(doc.tcuLinkPDF);
    if (rtf && rtf.length > 200) {
      const fromRtf = runRegex(rtf);
      if (fromRtf.length > 0) {
        await persistExtract(doc.id, fromRtf, 'rtf_parse', false);
        return maybeEnrich(
          doc.id,
          { dispositivos: fromRtf, method: 'rtf_parse', inteiroTeorText: rtf },
          ementa,
          cachedAiBullets,
        );
      }
      await persistExtract(doc.id, [], 'failed', false);
      return maybeEnrich(
        doc.id,
        { dispositivos: [], method: 'failed', inteiroTeorText: rtf },
        ementa,
        cachedAiBullets,
      );
    }
    const pdf = await fetchPdfText(doc.tcuLinkPDF);
    if (pdf) {
      const fromPdf = runRegex(pdf);
      if (fromPdf.length > 0) {
        await persistExtract(doc.id, fromPdf, 'pdf_parse', false);
        return maybeEnrich(
          doc.id,
          { dispositivos: fromPdf, method: 'pdf_parse', inteiroTeorText: pdf },
          ementa,
          cachedAiBullets,
        );
      }
      await persistExtract(doc.id, [], 'failed', false);
      return maybeEnrich(
        doc.id,
        { dispositivos: [], method: 'failed', inteiroTeorText: pdf },
        ementa,
        cachedAiBullets,
      );
    }
    await persistExtract(doc.id, [], 'failed', true);
    return { dispositivos: [], method: 'failed', pdfFetchFailed: true, aiBullets: cachedAiBullets };
  }

  await persistExtract(doc.id, [], 'failed', false);
  return { dispositivos: [], method: 'failed', aiBullets: cachedAiBullets };
}

async function persistExtract(
  documentId: string,
  dispositivos: Dispositivo[],
  method: 'ementa_regex' | 'rtf_parse' | 'pdf_parse' | 'failed',
  pdfFetchFailed: boolean,
) {
  const payload = dispositivos.length > 0 ? JSON.stringify(dispositivos) : null;
  await prisma.clippingItemExtract.upsert({
    where: { documentId },
    create: {
      documentId,
      dispositivos: payload,
      extractMethod: method,
      pdfFetchFailed,
    },
    update: {
      dispositivos: payload,
      extractMethod: method,
      pdfFetchFailed,
      extractedAt: new Date(),
    },
  });
}

async function persistAiBullets(documentId: string, bullets: string[]) {
  await prisma.clippingItemExtract.update({
    where: { documentId },
    data: { aiBullets: JSON.stringify(bullets), aiGeneratedAt: new Date() },
  });
}

export async function extractMany(
  docs: DocumentLike[],
  concurrency = 1,
): Promise<Map<string, ExtractResult>> {
  const results = new Map<string, ExtractResult>();
  const queue = [...docs];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const doc = queue.shift();
      if (!doc) break;
      const r = await extractDispositivos(doc);
      results.set(doc.id, r);
    }
  });
  await Promise.all(workers);
  return results;
}
