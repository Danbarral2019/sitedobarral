import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchInteiroTeor, TETO_BYTES } from './inteiro-teor-fetch';

const RTF = Buffer.from('{\\rtf1 ok}', 'latin1');

function mockFetch(body: Buffer, init?: { status?: number; headers?: Record<string, string> }) {
  return vi.fn().mockResolvedValue({
    ok: (init?.status ?? 200) < 400,
    status: init?.status ?? 200,
    headers: { get: (h: string) => (init?.headers ?? {})[h.toLowerCase()] ?? null },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  });
}

describe('fetchInteiroTeor', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('baixa e devolve o buffer', async () => {
    vi.stubGlobal('fetch', mockFetch(RTF));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.buf.toString()).toContain('rtf1');
  });

  it('identifica-se com User-Agent do projeto', async () => {
    const f = mockFetch(RTF);
    vi.stubGlobal('fetch', f);
    await fetchInteiroTeor('https://x/y');
    expect(f.mock.calls[0][1].headers['User-Agent']).toContain('SiteDoBarral');
  });

  it('recusa HTTP de erro sem lançar', async () => {
    vi.stubGlobal('fetch', mockFetch(RTF, { status: 404 }));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r).toEqual({ ok: false, erro: 'HTTP 404' });
  });

  it('recusa quem passa do teto ANTES de baixar (content-length): não chega a consumir o corpo', async () => {
    const arrayBufferSpy = vi.fn(async () =>
      RTF.buffer.slice(RTF.byteOffset, RTF.byteOffset + RTF.byteLength)
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h.toLowerCase() === 'content-length' ? String(TETO_BYTES + 1) : null) },
        arrayBuffer: arrayBufferSpy,
      })
    );
    const r = await fetchInteiroTeor('https://x/y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('excede o teto');
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it('pina o teto em 20 MB — acórdãos reais chegam a 14,5 MB', () => {
    expect(TETO_BYTES).toBe(20 * 1024 * 1024);
  });

  it('recusa quem passa do teto sem declarar content-length', async () => {
    const grande = Buffer.alloc(1024);
    vi.stubGlobal('fetch', mockFetch(grande));
    const r = await fetchInteiroTeor('https://x/y', { tetoBytes: 512 });
    expect(r.ok).toBe(false);
  });

  it('recusa o que não é RTF (magic bytes)', async () => {
    vi.stubGlobal('fetch', mockFetch(Buffer.from('<html>erro</html>')));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('não é RTF');
  });

  it('devolve erro em vez de estourar quando a rede falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('ECONNRESET');
  });
});

describe('fetchInteiroTeor com filtrarBinarios', () => {
  beforeEach(() => vi.restoreAllMocks());

  /** Resposta com corpo em fluxo, em pedaços de `tamanho` bytes. */
  function mockFluxo(body: Buffer, tamanho: number, headers: Record<string, string> = {}) {
    let pos = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pos >= body.length) return controller.close();
        controller.enqueue(new Uint8Array(body.subarray(pos, pos + tamanho)));
        pos += tamanho;
      },
    });
    return vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (h: string) => headers[h.toLowerCase()] ?? null },
      body: stream,
    });
  }

  const IMAGEM = '0'.repeat(4096);
  const RTF_COM_IMAGEM = Buffer.from(`{\\rtf1 Texto{\\pict\\pngblip ${IMAGEM}} fim}`, 'latin1');

  it('descarta a imagem durante o download e aplica o teto ao que sobra', async () => {
    vi.stubGlobal('fetch', mockFluxo(RTF_COM_IMAGEM, 100, { 'content-length': String(RTF_COM_IMAGEM.length) }));
    const r = await fetchInteiroTeor('https://x/y', { tetoBytes: 512, filtrarBinarios: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.buf.toString('latin1')).toBe('{\\rtf1 Texto fim}');
  });

  it('sem o filtro, o mesmo arquivo continua barrado pelo teto', async () => {
    vi.stubGlobal('fetch', mockFetch(RTF_COM_IMAGEM));
    const r = await fetchInteiroTeor('https://x/y', { tetoBytes: 512 });
    expect(r.ok).toBe(false);
  });

  it('barra o texto que passa do teto mesmo depois do filtro', async () => {
    const grande = Buffer.from(`{\\rtf1 ${'a'.repeat(2048)}}`, 'latin1');
    vi.stubGlobal('fetch', mockFluxo(grande, 256));
    const r = await fetchInteiroTeor('https://x/y', { tetoBytes: 512, filtrarBinarios: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('excede o teto sem imagens');
  });

  it('recusa o que não é RTF', async () => {
    vi.stubGlobal('fetch', mockFluxo(Buffer.from('<html>erro</html>'), 3));
    const r = await fetchInteiroTeor('https://x/y', { filtrarBinarios: true });
    expect(r).toEqual({ ok: false, erro: 'não é RTF' });
  });
});
