import { readFile } from 'node:fs/promises';

export interface ExtractedPdf {
  rawText: string;
  urls: Map<number, string>;
}

interface PdfPage {
  getTextContent(): Promise<{ items: Array<{ str: string; transform: number[] }> }>;
  getAnnotations(): Promise<
    Array<{
      subtype?: string;
      url?: string;
      rect?: [number, number, number, number];
    }>
  >;
}

interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}

interface PdfJsModule {
  getDocument(arg: { data: Uint8Array }): { promise: Promise<PdfDocument> };
}

async function loadPdfjs(): Promise<PdfJsModule> {
  // pdfjs-dist ships ESM-only — usamos dynamic import.
  // O entry "legacy/build/pdf.mjs" funciona em ambientes Node.
  const mod: unknown = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Em Node, aponta o worker para o arquivo .mjs distribuído. Sem isso o pdfjs
  // dispara "fake worker" e falha procurando um workerSrc.
  const opts = (mod as { GlobalWorkerOptions?: { workerSrc: string } })
    .GlobalWorkerOptions;
  if (opts) {
    // require.resolve não está disponível em ESM; usamos createRequire.
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    opts.workerSrc = req.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  }
  return mod as unknown as PdfJsModule;
}

function getY(transform: number[]): number {
  // transform = [a, b, c, d, e, f] — f é o Y (baseline) em coords PDF (origem
  // no canto inferior esquerdo).
  return transform[5];
}

/**
 * Extrai o texto plano do PDF preservando quebras de linha aproximadas (uma
 * heurística leve baseada na coordenada Y).
 */
export async function extractTstPdf(pdfPath: string): Promise<ExtractedPdf> {
  const buf = await readFile(pdfPath);
  // Cópia em Uint8Array independente do Buffer subjacente — pdfjs muta o array.
  const data = new Uint8Array(buf.byteLength);
  data.set(buf);
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data }).promise;

  const textChunks: string[] = [];
  const urls = new Map<number, string>();
  // Sentinela para casar cada anotação URI à próxima ocorrência de "Súmula nº N"
  // anterior. Como percorremos em ordem de página/posição, basta lembrar do
  // último número visto.
  let currentSumula: number | null = null;

  for (let pageIdx = 1; pageIdx <= doc.numPages; pageIdx++) {
    const page = await doc.getPage(pageIdx);
    const [textContent, annotations] = await Promise.all([
      page.getTextContent(),
      page.getAnnotations(),
    ]);

    // Reconstrói texto da página agrupando por baseline Y aproximada.
    const items = textContent.items;
    // Ordena por Y desc, depois X (transform[4]) asc
    const sorted = [...items].sort((a, b) => {
      const yDiff = getY(b.transform) - getY(a.transform);
      if (Math.abs(yDiff) > 1) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    // Junta itens — quando Y muda (≥ 4pt), insere \n.
    let lastY = sorted.length > 0 ? getY(sorted[0].transform) : 0;
    const lines: string[] = [];
    let buffer = '';
    for (const it of sorted) {
      const y = getY(it.transform);
      if (Math.abs(y - lastY) > 4 && buffer.trim()) {
        lines.push(buffer.trimEnd());
        buffer = '';
      }
      buffer += it.str;
      lastY = y;
    }
    if (buffer.trim()) lines.push(buffer.trimEnd());

    const pageText = lines.join('\n');
    textChunks.push(pageText);

    // Atualiza currentSumula com base no texto da página (ordem de leitura).
    // Encontra todas ocorrências de "Súmula nº N" em ordem.
    const sumulaMatches: Array<{ numero: number; idx: number }> = [];
    const re = /Súmula\s+nº\s+(\d+)\s+do\s+TST/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(pageText)) !== null) {
      sumulaMatches.push({ numero: Number(m[1]), idx: m.index });
    }

    // Acha anotações URI da página. Importante: cada hyperlink "Inteiro teor"
    // gera ~5 rectangles separados (um por palavra) no PDF do TST. Deduplicamos
    // por URL+linha, mantendo só o primeiro rect de cada link visual.
    const rawLinks = annotations
      .filter((a) => a.subtype === 'Link' && typeof a.url === 'string' && a.rect)
      .sort((a, b) => {
        const ay = (a.rect as number[])[1];
        const by = (b.rect as number[])[1];
        if (Math.abs(by - ay) > 4) return by - ay;
        return (a.rect as number[])[0] - (b.rect as number[])[0];
      });
    const linkAnns: typeof rawLinks = [];
    let prevUrl: string | null = null;
    let prevY: number | null = null;
    for (const ann of rawLinks) {
      const y = (ann.rect as number[])[1];
      const sameLink =
        ann.url === prevUrl && prevY !== null && Math.abs(prevY - y) < 4;
      if (!sameLink) {
        linkAnns.push(ann);
        prevUrl = ann.url ?? null;
        prevY = y;
      }
    }

    // Sequência de súmulas em ordem visual na página: [currentSumula?] + matches.
    // Caso `currentSumula` ainda esteja "aberto" (continuação da página anterior),
    // ele recebe o primeiro link da página corrente — depois cada match
    // subsequente recebe o próximo link em ordem.
    const sequence: number[] = [];
    if (currentSumula !== null && !urls.has(currentSumula)) sequence.push(currentSumula);
    for (const s of sumulaMatches) sequence.push(s.numero);

    let cursor = 0;
    for (const ann of linkAnns) {
      const url = ann.url!;
      const numero = sequence[cursor];
      if (numero != null && !urls.has(numero)) {
        urls.set(numero, url);
      }
      cursor++;
      // Não passa do fim — links extra (raros) caem na última súmula vista.
      if (cursor >= sequence.length) cursor = sequence.length - 1;
    }

    if (sumulaMatches.length > 0) {
      currentSumula = sumulaMatches[sumulaMatches.length - 1].numero;
    }
  }

  return { rawText: textChunks.join('\n'), urls };
}
