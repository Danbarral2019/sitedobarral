// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const { mockExtrair, mockOcr } = vi.hoisted(() => ({ mockExtrair: vi.fn(), mockOcr: vi.fn() }));
vi.mock('../../text-extractor', () => ({ extractTextFromPDF: (...a: unknown[]) => mockExtrair(...a) }));
// O OCR real chama o Gemini: nos testes, sempre simulado.
vi.mock('../../ai/ocr-pdf', async (orig) => ({
  ...(await orig<typeof import('../../ai/ocr-pdf')>()),
  transcreverPdfComOcr: (...a: unknown[]) => mockOcr(...a),
}));

import {
  aplicarTeto,
  baixarPdfDecor,
  capturarInteiroTeorDecor,
  ehPdfPublicoDecor,
  MAX_TENTATIVAS_TEXTO_INTEGRAL,
  normalizarTextoPdf,
  selecionarFilaDecor,
  TETO_CHARS_TEXTO_INTEGRAL,
  type DbTextoIntegral,
} from '../inteiro-teor-decor';
import { buildExternalUrl } from '../../conuni-sync';
import { blocosDoInteiroTeor } from '../../tcu/inteiro-teor-exibicao';

/**
 * Trecho REAL do texto que o pdf-parse extrai do Parecer nº 00002/2026/CNCIC
 * (https://cgu.agu.gov.br/decor/arquivos/Parecer1776093267.pdf): as 60
 * primeiras linhas (com a virada da folha 1 para a 2) e o bloco de
 * assinaturas do fim.
 */
const FIXTURE = readFileSync(join(__dirname, 'fixtures', 'parecer-decor-1776093267.txt'), 'utf8');

describe('ehPdfPublicoDecor', () => {
  it('aceita a URL que o sync da CONUNI monta para link .pdf', () => {
    const url = buildExternalUrl({ link_manifestacao: 'Parecer1776093267.pdf' } as never);
    expect(url).toBe('https://cgu.agu.gov.br/decor/arquivos/Parecer1776093267.pdf');
    expect(ehPdfPublicoDecor(url)).toBe(true);
  });

  it('aceita extensão em maiúsculas', () => {
    expect(ehPdfPublicoDecor('https://cgu.agu.gov.br/decor/arquivos/NOTA_123.PDF')).toBe(true);
  });

  it('recusa o Sapiens (exige login) e o fallback da CONUNI', () => {
    expect(ehPdfPublicoDecor(buildExternalUrl({ link_manifestacao: 'abc123' } as never))).toBe(false);
    expect(ehPdfPublicoDecor('https://sapiens.agu.gov.br/valida_publico?id=123')).toBe(false);
    expect(ehPdfPublicoDecor('https://cgu.agu.gov.br/conuni/')).toBe(false);
  });

  it('recusa outro host, http, outro diretório e não-PDF', () => {
    expect(ehPdfPublicoDecor('https://evil.com/decor/arquivos/x.pdf')).toBe(false);
    expect(ehPdfPublicoDecor('https://cgu.agu.gov.br.evil.com/decor/arquivos/x.pdf')).toBe(false);
    expect(ehPdfPublicoDecor('http://cgu.agu.gov.br/decor/arquivos/x.pdf')).toBe(false);
    expect(ehPdfPublicoDecor('https://cgu.agu.gov.br/outro/x.pdf')).toBe(false);
    expect(ehPdfPublicoDecor('https://cgu.agu.gov.br/decor/arquivos/x.doc')).toBe(false);
    expect(ehPdfPublicoDecor('https://cgu.agu.gov.br/decor/arquivos/x.pdf?y=1')).toBe(false);
  });

  it('recusa vazio/nulo', () => {
    expect(ehPdfPublicoDecor(null)).toBe(false);
    expect(ehPdfPublicoDecor(undefined)).toBe(false);
    expect(ehPdfPublicoDecor('')).toBe(false);
  });
});

describe('normalizarTextoPdf (texto real de PDF do DECOR)', () => {
  const texto = normalizarTextoPdf(FIXTURE);
  const paragrafos = texto.split('\n\n');

  it('tira o marcador de página do pdf-parse ("-- 1 of 12 --")', () => {
    expect(FIXTURE).toContain('-- 1 of 12 --');
    expect(texto).not.toMatch(/-- \d+ of \d+ --/);
  });

  // Regressão (26/09/2026): 1 dos 20 primeiros PDFs do passivo trazia 0x00, e o
  // Postgres recusava a gravação ("invalid byte sequence for encoding UTF8").
  it('remove o caractere nulo, que o Postgres não aceita em texto', () => {
    expect(normalizarTextoPdf('PARECER N\u0000º 1/2012\u0000\nTexto do parecer.')).not.toContain('\u0000');
    expect(normalizarTextoPdf('PARECER N\u0000º 1/2012')).toBe('PARECER Nº 1/2012');
  });

  it('não deixa tabulação nem espaços repetidos', () => {
    expect(texto).not.toMatch(/\t/);
    expect(texto).not.toMatch(/ {2,}/);
  });

  it('junta as linhas visuais de um parágrafo numerado', () => {
    const p1 = paragrafos.find((p) => p.startsWith('1. Trata-se'));
    expect(p1).toBeDefined();
    // No PDF, o parágrafo 1 ocupa duas linhas; aqui vira um só.
    expect(p1).toContain('com entidades privadas com fins lucrativos, considerando o advento');
    expect(p1!.endsWith('de 8 de maio de 2025.')).toBe(true);
  });

  it('mantém cada parágrafo numerado e cada título separado', () => {
    expect(paragrafos).toContain('I. RELATÓRIO.');
    expect(paragrafos).toContain('5. É o relato do essencial.');
    expect(paragrafos).toContain('II. ANÁLISE JURÍDICA.');
    expect(paragrafos.some((p) => p.startsWith('2. A matéria ora analisada'))).toBe(true);
    expect(paragrafos.some((p) => p.startsWith('3. Ocorre que'))).toBe(true);
  });

  it('parágrafo que atravessa a folha continua um só', () => {
    // "II.1. Da competência..." é a primeira linha da folha 2, depois do marcador.
    expect(paragrafos).toContain('II.1. Da competência da Câmara Nacional de Convênios e Instrumentos Congêneres.');
  });

  it('separa os blocos de assinatura eletrônica', () => {
    const assinaturas = paragrafos.filter((p) => p.startsWith('Documento assinado eletronicamente por'));
    expect(assinaturas.length).toBeGreaterThanOrEqual(2);
  });

  it('é idempotente', () => {
    expect(normalizarTextoPdf(texto)).toBe(texto);
  });

  it('linha que termina em hífen emenda sem espaço e mantém o hífen', () => {
    // O PDF gerado pelo Sapiens não hifeniza sozinho: hífen no fim da linha
    // é de palavra composta ("Trata-se"), não de separação silábica.
    const linha = 'x'.repeat(100);
    expect(normalizarTextoPdf(`${linha} Trata-\nse de consulta.\n${linha}`)).toContain(' Trata-se de consulta.');
  });

  it('o formatador da página não vê marcador de página e acha os títulos', () => {
    const blocos = blocosDoInteiroTeor(texto);
    expect(blocos.some((b) => /of 12/.test(b.texto))).toBe(false);
    expect(blocos.find((b) => b.texto === 'I. RELATÓRIO.')?.tipo).toBe('titulo');
    expect(blocos.find((b) => b.texto === 'PARECER Nº 00002/2026/CNCIC/CGU/AGU')?.tipo).toBe('titulo');
    expect(blocos.find((b) => b.texto.startsWith('1. Trata-se'))?.tipo).toBe('paragrafo');
  });
});

describe('aplicarTeto', () => {
  it('não mexe em texto abaixo do teto', () => {
    expect(aplicarTeto('abc')).toEqual({ texto: 'abc', truncado: false });
  });

  it('corta em 500 mil chars e marca truncado', () => {
    const r = aplicarTeto('a'.repeat(TETO_CHARS_TEXTO_INTEGRAL + 10));
    expect(r.truncado).toBe(true);
    expect(r.texto.length).toBe(TETO_CHARS_TEXTO_INTEGRAL);
  });
});

function respostaFake(corpo: Buffer | string, init?: { status?: number; headers?: Record<string, string> }) {
  const buf = typeof corpo === 'string' ? Buffer.from(corpo) : corpo;
  return new Response(new Uint8Array(buf), { status: init?.status ?? 200, headers: init?.headers });
}

describe('baixarPdfDecor', () => {
  it('devolve o buffer de um PDF', async () => {
    const f = vi.fn().mockResolvedValue(respostaFake('%PDF-1.7 conteudo'));
    const r = await baixarPdfDecor('https://cgu.agu.gov.br/decor/arquivos/x.pdf', { fetchImpl: f });
    expect(r.ok).toBe(true);
  });

  it('HTTP de erro vira falha, sem lançar', async () => {
    const f = vi.fn().mockResolvedValue(respostaFake('nope', { status: 404 }));
    expect(await baixarPdfDecor('u', { fetchImpl: f })).toEqual({ ok: false, erro: 'HTTP 404' });
  });

  it('recusa o que não é PDF (ex.: página HTML de erro com 200)', async () => {
    const f = vi.fn().mockResolvedValue(respostaFake('<html>erro</html>'));
    expect(await baixarPdfDecor('u', { fetchImpl: f })).toEqual({ ok: false, erro: 'não é PDF' });
  });

  it('barra arquivo acima do teto pelo content-length', async () => {
    const f = vi.fn().mockResolvedValue(respostaFake('%PDF', { headers: { 'content-length': '999' } }));
    const r = await baixarPdfDecor('u', { fetchImpl: f, tetoBytes: 10 });
    expect(r).toEqual({ ok: false, erro: 'excede o teto: 999 bytes' });
  });

  it('barra arquivo acima do teto pelo tamanho real', async () => {
    const f = vi.fn().mockResolvedValue(respostaFake('%PDF-' + 'x'.repeat(50)));
    const r = await baixarPdfDecor('u', { fetchImpl: f, tetoBytes: 10 });
    expect(r.ok).toBe(false);
  });

  it('erro de rede/timeout vira falha, sem lançar', async () => {
    const f = vi.fn().mockRejectedValue(new Error('The operation was aborted due to timeout'));
    expect(await baixarPdfDecor('u', { fetchImpl: f })).toEqual({
      ok: false,
      erro: 'The operation was aborted due to timeout',
    });
  });
});

function dbFake() {
  const findMany = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(0);
  const update = vi.fn().mockResolvedValue({});
  const db = { document: { findMany, count, update } } as unknown as DbTextoIntegral;
  return { db, findMany, count, update };
}

describe('selecionarFilaDecor', () => {
  it('filtra URL DECOR .pdf, texto integral nulo e tentativas < 3', async () => {
    const { db, findMany } = dbFake();
    await selecionarFilaDecor(db, { take: 20 });
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      url: { startsWith: 'https://cgu.agu.gov.br/decor/arquivos/', endsWith: '.pdf', mode: 'insensitive' },
      textoIntegral: null,
      textoIntegralTentativas: { lt: MAX_TENTATIVAS_TEXTO_INTEGRAL },
    });
    expect(MAX_TENTATIVAS_TEXTO_INTEGRAL).toBe(3);
    expect(arg.take).toBe(20);
    expect(arg.select).toEqual({ id: true, title: true, url: true });
    // Quem nunca falhou vai primeiro.
    expect(arg.orderBy[0]).toEqual({ textoIntegralTentativas: 'asc' });
  });

  it('não filtra por `content` — o inteiro teor não mora lá', async () => {
    const { db, findMany } = dbFake();
    await selecionarFilaDecor(db, { take: 1 });
    expect(findMany.mock.calls[0][0].where).not.toHaveProperty('content');
  });
});

describe('capturarInteiroTeorDecor', () => {
  const URL = 'https://cgu.agu.gov.br/decor/arquivos/Parecer1776093267.pdf';
  const doc = { id: 'doc-1', title: 'Parecer 2/2026', url: URL };
  const fetchPdf = () => vi.fn().mockResolvedValue(respostaFake('%PDF-1.7 ...'));

  beforeEach(() => {
    mockExtrair.mockReset();
  });

  it('grava textoIntegral, fonte e data — e nunca content/extractedText', async () => {
    mockExtrair.mockResolvedValue({ success: true, text: FIXTURE });
    const { db, update } = dbFake();
    const r = await capturarInteiroTeorDecor(db, doc, { fetchImpl: fetchPdf() });

    expect(r.status).toBe('ok');
    expect(r.truncado).toBe(false);
    const { where, data } = update.mock.calls[0][0];
    expect(where).toEqual({ id: 'doc-1' });
    expect(data.textoIntegral).toBe(normalizarTextoPdf(FIXTURE));
    expect(data.textoIntegralFonte).toBe(URL);
    expect(data.textoIntegralEm).toBeInstanceOf(Date);
    // O sync mensal da CONUNI sobrescreve `content`; `extractedText` é do embedding.
    expect(data).not.toHaveProperty('content');
    expect(data).not.toHaveProperty('extractedText');
    expect(data).not.toHaveProperty('embeddingStatus');
  });

  it('aplica o teto de 500 mil chars', async () => {
    const grande = Array.from({ length: 6000 }, (_, i) => `${i + 1}. ${'palavra '.repeat(12)}`).join('\n');
    mockExtrair.mockResolvedValue({ success: true, text: grande });
    const { db, update } = dbFake();
    const r = await capturarInteiroTeorDecor(db, doc, { fetchImpl: fetchPdf() });
    expect(r.truncado).toBe(true);
    expect(update.mock.calls[0][0].data.textoIntegral.length).toBe(TETO_CHARS_TEXTO_INTEGRAL);
  });

  it('PDF sem texto (escaneado) cujo OCR falha é falha e gasta tentativa', async () => {
    mockExtrair.mockResolvedValue({ success: true, text: '   \n-- 1 of 1 --\n' });
    mockOcr.mockResolvedValue({ ok: false, erro: 'OCR interrompido: RECITATION' });
    const { db, update } = dbFake();
    const r = await capturarInteiroTeorDecor(db, doc, { fetchImpl: fetchPdf() });
    expect(r.status).toBe('falha');
    expect(r.erro).toMatch(/sem texto extraível; OCR interrompido: RECITATION/);
    expect(update.mock.calls[0][0].data).toEqual({ textoIntegralTentativas: { increment: 1 } });
  });

  it('PDF sem texto (escaneado) passa pelo OCR e grava com a marca de OCR', async () => {
    mockExtrair.mockResolvedValue({ success: true, text: '   \n-- 1 of 1 --\n' });
    const corpo = 'Trata-se de consulta sobre repactuação em contrato de serviço continuado. '.repeat(8).trim();
    const transcricao = [
      'ADVOCACIA-GERAL DA UNIÃO', 'NOTA DECOR/CGU/AGU N° 031/2009', corpo, '2',
      'continuação da NOTA DECOR/CGU/AGU N° 031/2009', 'Fls. 12', '(...)', 'Brasília, 7 de janeiro de 2009.',
    ].join('\n');
    mockOcr.mockResolvedValue({ ok: true, texto: transcricao, tokensEntrada: 2375, tokensSaida: 4943 });
    const { db, update } = dbFake();

    const r = await capturarInteiroTeorDecor(db, doc, { fetchImpl: fetchPdf() });

    expect(r).toMatchObject({ status: 'ok', ocr: true });
    const data = update.mock.calls[0][0].data;
    expect(data.textoIntegralOcr).toBe(true);
    expect(data.textoIntegral).toContain('repactuação');
    expect(data.textoIntegral).toContain('(...)');
    expect(data.textoIntegral).not.toMatch(/continuação da NOTA|Fls\. 12/);
  });

  it('PDF com camada de texto não chama o OCR e grava sem a marca', async () => {
    mockOcr.mockClear();
    mockExtrair.mockResolvedValue({ success: true, text: FIXTURE });
    const { db, update } = dbFake();
    await capturarInteiroTeorDecor(db, doc, { fetchImpl: fetchPdf() });
    expect(mockOcr).not.toHaveBeenCalled();
    expect(update.mock.calls[0][0].data.textoIntegralOcr).toBe(false);
  });

  it('falha de download incrementa tentativas e não grava texto', async () => {
    const { db, update } = dbFake();
    const f = vi.fn().mockResolvedValue(respostaFake('x', { status: 503 }));
    const r = await capturarInteiroTeorDecor(db, doc, { fetchImpl: f });
    expect(r).toEqual({ status: 'falha', erro: 'HTTP 503' });
    expect(mockExtrair).not.toHaveBeenCalled();
    expect(update.mock.calls[0][0].data).toEqual({ textoIntegralTentativas: { increment: 1 } });
  });

  it('falha de extração do pdf-parse incrementa tentativas', async () => {
    mockExtrair.mockResolvedValue({ success: false, text: '', error: 'Invalid PDF structure' });
    const { db, update } = dbFake();
    const r = await capturarInteiroTeorDecor(db, doc, { fetchImpl: fetchPdf() });
    expect(r.status).toBe('falha');
    expect(r.erro).toMatch(/Invalid PDF/);
    expect(update.mock.calls[0][0].data).toEqual({ textoIntegralTentativas: { increment: 1 } });
  });

  it('URL que não é do DECOR não é baixada', async () => {
    const { db } = dbFake();
    const f = vi.fn();
    const r = await capturarInteiroTeorDecor(db, { ...doc, url: 'https://sapiens.agu.gov.br/valida_publico?id=1' }, { fetchImpl: f });
    expect(r.status).toBe('falha');
    expect(f).not.toHaveBeenCalled();
  });

  it('erro do banco ao gravar PROPAGA (infra transitória não gasta tentativa)', async () => {
    mockExtrair.mockResolvedValue({ success: true, text: FIXTURE });
    const { db, update } = dbFake();
    update.mockRejectedValue(new Error('WebSocket closed'));
    await expect(capturarInteiroTeorDecor(db, doc, { fetchImpl: fetchPdf() })).rejects.toThrow('WebSocket closed');
    expect(update).toHaveBeenCalledTimes(1);
  });
});
