/**
 * Inteiro teor dos pareceres da AGU publicados em PDF público do DECOR.
 *
 * Cerca de 609 dos ~1.742 itens da CONUNI apontam para
 * `https://cgu.agu.gov.br/decor/arquivos/<arquivo>.pdf` (ver
 * `buildExternalUrl` em lib/conuni-sync.ts). Esses PDFs baixam sem login,
 * têm ~600 KB e texto extraível. Os demais (`sapiens.agu.gov.br/valida_publico`)
 * exigem login e ficam FORA daqui.
 *
 * Núcleo compartilhado pelo cron `catalog-decor-inteiro-teor` (inclusões
 * futuras: o sync da CONUNI cria o documento e ele entra na fila) e pelo
 * script `scripts/backfill-decor-inteiro-teor.ts` (passivo). Mesmo desenho do
 * inteiro teor do TCU (lib/tcu/catalogar-acordao.ts):
 *
 *  - Falha de CONTEÚDO (HTTP ≠ 200, não é PDF, arquivo acima do teto, PDF sem
 *    texto) NUNCA propaga: vira `{ status: 'falha', erro }` + incremento de
 *    `textoIntegralTentativas`. Chegando a 3, o documento sai da fila.
 *  - Falha de INFRAESTRUTURA (o `update` do Prisma lança) PROPAGA sem gastar
 *    tentativa: é transitória, e o chamador decide (o cron captura por item).
 *
 * Onde grava: `textoIntegral` / `textoIntegralFonte` / `textoIntegralEm`.
 * NUNCA em `content` nem em `extractedText` — o sync mensal da CONUNI
 * recalcula e sobrescreve `content`, e `extractedText` é do pipeline de
 * embeddings. O texto é para LEITURA: não entra no retrieval (ver o
 * comentário do campo em prisma/schema.prisma).
 *
 * Sem OCR: PDF sem camada de texto é registrado como falha (OCR custa).
 */
import type { PrismaClient } from '@prisma/client';
import { extractTextFromPDF } from '../text-extractor';

/** Mesmo teto do inteiro teor do TCU (TETO_CHARS_CATALOGO). */
export const TETO_CHARS_TEXTO_INTEGRAL = 500_000;
/** Os PDFs medidos têm ~600 KB; acima de 20 MB é anomalia. */
export const TETO_BYTES_PDF = 20 * 1024 * 1024;
export const TIMEOUT_DOWNLOAD_MS = 60_000;
/** A fila exclui quem já falhou este número de vezes. */
export const MAX_TENTATIVAS_TEXTO_INTEGRAL = 3;
/** Abaixo disto o PDF é tratado como "sem texto" (escaneado). */
const MIN_CHARS_UTEIS = 200;

export const PREFIXO_URL_DECOR = 'https://cgu.agu.gov.br/decor/arquivos/';

/** PDF público do DECOR, exatamente como `buildExternalUrl` o monta. */
const URL_PDF_DECOR = /^https:\/\/cgu\.agu\.gov\.br\/decor\/arquivos\/[^?#]+\.pdf$/i;

export function ehPdfPublicoDecor(url: string | null | undefined): boolean {
  return !!url && URL_PDF_DECOR.test(url.trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalização do texto extraído
// ─────────────────────────────────────────────────────────────────────────────

/** Marcador de página que o pdf-parse v2 insere entre as folhas ("-- 3 of 12 --"). */
const MARCADOR_DE_PAGINA = /^--\s*\d+\s+of\s+\d+\s*--$/i;

/**
 * Linha que abre parágrafo mesmo quando a anterior ocupa a largura toda:
 * numeração de parágrafo ("12. ", "2.2.2. "), seção em romanos ("II. ",
 * "II.1. "), inciso ("III - "), alínea ("a) "), artigo, marcadores de lista
 * que os pareceres usam (➡ ↪ 📝 📍 •), rótulo em maiúsculas ("NUP:",
 * "EMENTA:"), a epígrafe ("PARECER Nº 00002/2026/...") e o bloco de assinatura.
 */
const ABRE_PARAGRAFO =
  /^(?:\d+(?:\.\d+)*\.\s|[IVXLC]+(?:\.\d+)*\.\s|[IVXLC]+(?:-[A-Z])?\s+[-–]\s|[a-z]\)\s|Art\.\s|§\s|➡|↪|📝|📍|•|[A-ZÀ-Ý]{3,}(?: [A-ZÀ-Ý]+)*:(?:\s|$)|(?:PARECER|NOTA|DESPACHO|COTA|INFORMAÇÃO)(?: [A-ZÀ-Ý]+)* N[º°o]|Documento assinado eletronicamente|Atenção, a consulta)/;

/** Linha "cheia" = ao menos esta fração da largura de referência. */
const FRACAO_LINHA_CHEIA = 0.65;

function limparLinha(bruta: string): string {
  return bruta
    .replace(/[\t ]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/**
 * Largura de referência do corpo do texto, em caracteres: o percentil 90 do
 * comprimento das linhas. O PDF quebra a linha no fim da folha; uma linha bem
 * mais curta que isso é a última de um parágrafo (ou um título).
 */
function larguraDeReferencia(linhas: string[]): number {
  const tamanhos = linhas.map((l) => l.length).filter((n) => n > 0).sort((a, b) => a - b);
  if (tamanhos.length === 0) return 0;
  return tamanhos[Math.floor((tamanhos.length - 1) * 0.9)];
}

/**
 * Converte o texto do PDF (uma linha por linha VISUAL da folha) em um
 * parágrafo por bloco, separados por linha em branco — o formato que
 * `blocosDoInteiroTeor` (lib/tcu/inteiro-teor-exibicao.ts) espera, em que
 * cada linha não vazia vira um parágrafo ou título.
 *
 * Tira os marcadores de página do pdf-parse e o excesso de espaços; junta
 * as linhas de um mesmo parágrafo (linha terminada em hífen emenda sem espaço)
 * e mantém as quebras de parágrafo.
 */
export function normalizarTextoPdf(texto: string): string {
  const linhas = texto
    .split(/\r?\n/)
    .map(limparLinha)
    .filter((l) => !MARCADOR_DE_PAGINA.test(l));

  const largura = larguraDeReferencia(linhas);
  const paragrafos: string[] = [];
  let atual = '';
  let anteriorCheia = false;

  const fechar = () => {
    if (atual) paragrafos.push(atual);
    atual = '';
  };

  for (const linha of linhas) {
    if (!linha) {
      // Linha em branco no PDF só aparece em volta do marcador de página: não
      // encerra o parágrafo, que muitas vezes continua na folha seguinte.
      continue;
    }
    if (atual && (!anteriorCheia || ABRE_PARAGRAFO.test(linha))) fechar();

    if (!atual) atual = linha;
    else if (/[A-Za-zÀ-ÿ]-$/.test(atual) && /^[a-zà-ÿ]/.test(linha)) atual = atual + linha; // "Trata-" + "se": mantém o hífen, sem espaço
    else atual = `${atual} ${linha}`;

    anteriorCheia = largura > 0 && linha.length >= largura * FRACAO_LINHA_CHEIA;
  }
  fechar();

  return paragrafos.join('\n\n');
}

export function aplicarTeto(texto: string): { texto: string; truncado: boolean } {
  const truncado = texto.length > TETO_CHARS_TEXTO_INTEGRAL;
  return { texto: truncado ? texto.slice(0, TETO_CHARS_TEXTO_INTEGRAL) : texto, truncado };
}

// ─────────────────────────────────────────────────────────────────────────────
// Download
// ─────────────────────────────────────────────────────────────────────────────

export type ResultadoDownload = { ok: true; buf: Buffer } | { ok: false; erro: string };

/** Baixa o PDF com timeout e teto de tamanho. Nunca lança. */
export async function baixarPdfDecor(
  url: string,
  opts?: { tetoBytes?: number; timeoutMs?: number; fetchImpl?: typeof fetch },
): Promise<ResultadoDownload> {
  const teto = opts?.tetoBytes ?? TETO_BYTES_PDF;
  const f = opts?.fetchImpl ?? fetch;
  try {
    const res = await f(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)' },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUT_DOWNLOAD_MS),
    });
    if (!res.ok) return { ok: false, erro: `HTTP ${res.status}` };

    // Barra o gigante antes de puxar o corpo, quando o servidor declara.
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > teto) return { ok: false, erro: `excede o teto: ${len} bytes` };

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > teto) return { ok: false, erro: `excede o teto: ${buf.length} bytes` };
    if (!buf.subarray(0, 5).toString('latin1').startsWith('%PDF')) {
      return { ok: false, erro: 'não é PDF' };
    }
    return { ok: true, buf };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fila e captura
// ─────────────────────────────────────────────────────────────────────────────

/** Só o que o núcleo usa do Prisma — facilita o mock nos testes. */
export type DbTextoIntegral = Pick<PrismaClient, 'document'>;

export interface DocumentoParaCapturar {
  id: string;
  title: string;
  url: string;
}

/**
 * Filtro da fila: URL de PDF público do DECOR, sem texto integral ainda e
 * com menos de 3 falhas. O filtro no banco é por prefixo/sufixo; a regex
 * (`ehPdfPublicoDecor`) confere de novo no processamento.
 */
export const FILTRO_FILA_DECOR = {
  url: { startsWith: PREFIXO_URL_DECOR, endsWith: '.pdf', mode: 'insensitive' as const },
  textoIntegral: null,
  textoIntegralTentativas: { lt: MAX_TENTATIVAS_TEXTO_INTEGRAL },
};

export async function selecionarFilaDecor(
  db: DbTextoIntegral,
  opts: { take: number },
): Promise<DocumentoParaCapturar[]> {
  return db.document.findMany({
    where: FILTRO_FILA_DECOR,
    select: { id: true, title: true, url: true },
    // Quem nunca falhou vai primeiro; id dá ordem estável entre execuções.
    orderBy: [{ textoIntegralTentativas: 'asc' }, { id: 'asc' }],
    take: opts.take,
  });
}

export async function contarFilaDecor(db: DbTextoIntegral): Promise<number> {
  return db.document.count({ where: FILTRO_FILA_DECOR });
}

export interface ResultadoExtracao {
  ok: boolean;
  erro?: string;
  texto?: string;
  truncado?: boolean;
}

/** Baixa + extrai + normaliza + teto, SEM gravar. Usado pela simulação do backfill. */
export async function extrairInteiroTeorDecor(
  url: string,
  opts?: { fetchImpl?: typeof fetch },
): Promise<ResultadoExtracao> {
  if (!ehPdfPublicoDecor(url)) return { ok: false, erro: 'URL não é PDF público do DECOR' };

  const r = await baixarPdfDecor(url, { fetchImpl: opts?.fetchImpl });
  if (!r.ok) return { ok: false, erro: r.erro };

  const ext = await extractTextFromPDF(r.buf);
  if (!ext.success) return { ok: false, erro: `extração PDF: ${(ext.error ?? '').slice(0, 80)}` };

  const normalizado = normalizarTextoPdf(ext.text);
  if (normalizado.length < MIN_CHARS_UTEIS) {
    // Provável PDF escaneado. Sem OCR (custo): registra falha.
    return { ok: false, erro: `PDF sem texto extraível (${normalizado.length} chars)` };
  }
  const { texto, truncado } = aplicarTeto(normalizado);
  return { ok: true, texto, truncado };
}

export interface ResultadoCaptura {
  status: 'ok' | 'falha';
  erro?: string;
  chars?: number;
  truncado?: boolean;
}

/** Captura e grava o inteiro teor de UM documento. Ver o cabeçalho do módulo. */
export async function capturarInteiroTeorDecor(
  db: DbTextoIntegral,
  doc: DocumentoParaCapturar,
  opts?: { fetchImpl?: typeof fetch },
): Promise<ResultadoCaptura> {
  const r = await extrairInteiroTeorDecor(doc.url, opts);

  if (!r.ok || !r.texto) {
    await db.document.update({
      where: { id: doc.id },
      data: { textoIntegralTentativas: { increment: 1 } },
    });
    return { status: 'falha', erro: r.erro };
  }

  await db.document.update({
    where: { id: doc.id },
    data: {
      textoIntegral: r.texto,
      textoIntegralFonte: doc.url,
      textoIntegralEm: new Date(),
    },
  });
  return { status: 'ok', chars: r.texto.length, truncado: r.truncado };
}
