import { prisma } from '@/lib/prisma';

export interface Dispositivo {
  numero: string;
  texto: string;
}

export interface ExtractResult {
  dispositivos: Dispositivo[];
  method: 'ementa_regex' | 'pdf_parse' | 'cached' | 'failed';
  pdfFetchFailed?: boolean;
}

const PDF_FETCH_TIMEOUT_MS = 8000;
const MAX_DISPOSITIVOS_PER_ACORDAO = 3;
const MAX_TEXTO_LENGTH = 1500;

const DISPOSITIVO_REGEX = /(^|\n)\s*(9\.\d+(?:\.\d+)*)\s*\.?\s+([^\n][\s\S]*?)(?=\n\s*9\.\d+(?:\.\d+)*\s*\.?\s+|\n\s*ACORD[AÃ]M|\n\s*Ata\s|\n\s*Senado|\Z)/g;

function cleanDispositivoText(raw: string): string {
  let cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length > MAX_TEXTO_LENGTH) {
    cleaned = cleaned.slice(0, MAX_TEXTO_LENGTH).replace(/\s+\S*$/, '') + '...';
  }
  return cleaned;
}

function runRegex(text: string): Dispositivo[] {
  if (!text) return [];
  const dispositivos: Dispositivo[] = [];
  const matches = text.matchAll(DISPOSITIVO_REGEX);
  for (const m of matches) {
    const numero = m[2];
    const texto = cleanDispositivoText(m[3]);
    if (texto.length < 20) continue;
    if (!/^[a-záéíóúâêôãõç]/i.test(texto)) continue;
    dispositivos.push({ numero, texto });
    if (dispositivos.length >= MAX_DISPOSITIVOS_PER_ACORDAO) break;
  }
  return dispositivos;
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function normalizeToPdfUrl(rawUrl: string): string {
  return rawUrl.replace(/SvlVisualizarRelVotoAcRtf(?=\?)/, 'SvlVisualizarRelVotoAc');
}

async function fetchPdfText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PDF_FETCH_TIMEOUT_MS);
  try {
    const pdfUrl = normalizeToPdfUrl(url);
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
  } | null;
}

export async function extractDispositivos(doc: DocumentLike): Promise<ExtractResult> {
  if (doc.clippingExtract) {
    const cached = doc.clippingExtract;
    if (cached.extractMethod !== 'failed' && cached.dispositivos) {
      try {
        const parsed: Dispositivo[] = JSON.parse(cached.dispositivos);
        return { dispositivos: parsed, method: 'cached' };
      } catch {
        // fallthrough to re-extract
      }
    }
    if (cached.pdfFetchFailed) {
      const fromEmenta = runRegex(doc.tcuEmentaCompleta || '');
      return { dispositivos: fromEmenta, method: fromEmenta.length ? 'ementa_regex' : 'failed', pdfFetchFailed: true };
    }
  }

  const fromEmenta = runRegex(doc.tcuEmentaCompleta || '');
  if (fromEmenta.length > 0) {
    await persistExtract(doc.id, fromEmenta, 'ementa_regex', false);
    return { dispositivos: fromEmenta, method: 'ementa_regex' };
  }

  if (doc.tcuLinkPDF) {
    const text = await fetchPdfText(doc.tcuLinkPDF);
    if (text) {
      const fromPdf = runRegex(text);
      if (fromPdf.length > 0) {
        await persistExtract(doc.id, fromPdf, 'pdf_parse', false);
        return { dispositivos: fromPdf, method: 'pdf_parse' };
      }
      await persistExtract(doc.id, [], 'failed', false);
      return { dispositivos: [], method: 'failed' };
    }
    await persistExtract(doc.id, [], 'failed', true);
    return { dispositivos: [], method: 'failed', pdfFetchFailed: true };
  }

  await persistExtract(doc.id, [], 'failed', false);
  return { dispositivos: [], method: 'failed' };
}

async function persistExtract(
  documentId: string,
  dispositivos: Dispositivo[],
  method: 'ementa_regex' | 'pdf_parse' | 'failed',
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

export async function extractMany(
  docs: DocumentLike[],
  concurrency = 3,
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
