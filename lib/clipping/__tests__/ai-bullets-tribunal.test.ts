// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldGenerateBulletsForTribunal } from '../ai-bullets';
import type { ClippingItem } from '../sources/types';

function makeItem(overrides: Partial<ClippingItem>): ClippingItem {
  return {
    sourceKind: 'tribunal-decision',
    sourceId: 'td-1',
    tribunalCode: 'TCE-PE',
    tribunalName: 'TCE-PE',
    decisionType: 'parecer',
    decisionNumber: '698/26',
    title: 't',
    dataJulgamento: null,
    relator: null,
    orgaoJulgador: null,
    ementa: 'e',
    fullText: null,
    linkExternal: null,
    linkPdf: null,
    relevanceScore: 80,
    publishedAt: new Date(),
    ...overrides,
  };
}

describe('shouldGenerateBulletsForTribunal', () => {
  it('false para TCU (passa por pipeline diferente)', () => {
    expect(
      shouldGenerateBulletsForTribunal(makeItem({ sourceKind: 'document-tcu', fullText: 'x'.repeat(2000) }))
    ).toBe(false);
  });

  it('false quando fullText é null (TCE-SP, STJ DataJud, etc.)', () => {
    expect(shouldGenerateBulletsForTribunal(makeItem({ fullText: null }))).toBe(false);
  });

  it('false quando fullText < 800 chars (TCE-RS típico ~97 chars)', () => {
    expect(shouldGenerateBulletsForTribunal(makeItem({ fullText: 'x'.repeat(500) }))).toBe(false);
  });

  it('true quando fullText >= 800 chars (TCE-PE)', () => {
    expect(shouldGenerateBulletsForTribunal(makeItem({ fullText: 'x'.repeat(800) }))).toBe(true);
    expect(shouldGenerateBulletsForTribunal(makeItem({ fullText: 'x'.repeat(5000) }))).toBe(true);
  });

  it('exatamente no threshold (800 chars) deve passar', () => {
    expect(shouldGenerateBulletsForTribunal(makeItem({ fullText: 'a'.repeat(800) }))).toBe(true);
  });
});

describe('generateAiBulletsForTribunal — gate por fullText', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"bullets":["Bullet teste primeiro item editorial razoavelmente longo para passar o filtro."]}' }] } }],
      }), { status: 200 }) as never
    );
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it('retorna [] sem chamar Gemini quando fullText é curto', async () => {
    const { generateAiBulletsForTribunal } = await import('../ai-bullets');
    const result = await generateAiBulletsForTribunal(makeItem({ fullText: 'curto demais' }));
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('retorna [] sem chamar Gemini quando fullText é null', async () => {
    const { generateAiBulletsForTribunal } = await import('../ai-bullets');
    const result = await generateAiBulletsForTribunal(makeItem({ fullText: null }));
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('chama Gemini e retorna bullets quando fullText >= 800 chars', async () => {
    const { generateAiBulletsForTribunal } = await import('../ai-bullets');
    const result = await generateAiBulletsForTribunal(
      makeItem({ fullText: 'A '.repeat(500) }) // 1000 chars
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('Bullet teste');
  });
});

/**
 * O bloco "CONTEXTO E TESE" nunca aparecia para STF, STJ e TCE-PE: o gate
 * exigia `fullText` >= 800 e nenhum desses conectores grava inteiro teor —
 * medido em 21/08/2026, 0 dos 4.006 TribunalDecision tinham bullets, e desses
 * tribunais nenhum registro chegava a 500 chars de fullText.
 *
 * A matéria-prima que existe é a ementa: os 847 itens aprovados de STF (254),
 * STJ (267) e TCE-PE (326) têm ementa acima de 400 caracteres.
 */

/** Ementa realista, densa como a de produção — não `'x'.repeat(n)`. */
function ementaDensa(chars: number): string {
  let s = '';
  while (s.length < chars) {
    s +=
      'ADMINISTRATIVO. LICITAÇÃO. CONTRATO ADMINISTRATIVO. ALEGADA OFENSA AO ART. 37 DA CONSTITUIÇÃO. ' +
      'MATÉRIA INFRACONSTITUCIONAL. REEXAME DE FATOS E PROVAS. SÚMULA 279. AGRAVO DESPROVIDO. ';
  }
  return s.slice(0, chars);
}

describe('shouldGenerateBulletsForTribunal — ementa como matéria-prima', () => {
  it('aceita item sem fullText quando a ementa é densa (STF, STJ, TCE-PE)', () => {
    expect(
      shouldGenerateBulletsForTribunal(
        makeItem({ fullText: null, ementa: ementaDensa(1200), tribunalCode: 'STF' })
      )
    ).toBe(true);
  });

  it('barra ementa curta demais para destilar (TCE-RS, média de 97 chars)', () => {
    expect(
      shouldGenerateBulletsForTribunal(
        makeItem({ fullText: null, ementa: ementaDensa(97), tribunalCode: 'TCE-RS' })
      )
    ).toBe(false);
  });

  it('continua aceitando quem tem inteiro teor, mesmo com ementa curta', () => {
    expect(
      shouldGenerateBulletsForTribunal(makeItem({ fullText: 'A '.repeat(500), ementa: 'curta' }))
    ).toBe(true);
  });

  it('não gera para TCU nem com ementa densa (pipeline próprio de dispositivos)', () => {
    expect(
      shouldGenerateBulletsForTribunal(
        makeItem({ sourceKind: 'document-tcu', fullText: null, ementa: ementaDensa(1200) })
      )
    ).toBe(false);
  });
});

describe('prompt enviado ao Gemini', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let spy: ReturnType<typeof vi.spyOn>;

  const promptEnviado = () => {
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    return body.contents[0].parts[0].text as string;
  };

  beforeEach(() => {
    spy = vi.spyOn(global, 'fetch');
    spy.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"bullets":["Bullet editorial suficientemente longo para atravessar o filtro de tamanho."]}' }] } }],
        }),
        { status: 200 }
      ) as never
    );
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(() => {
    spy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it('não anuncia um inteiro teor que não existe', async () => {
    const { generateAiBulletsForTribunal } = await import('../ai-bullets');
    await generateAiBulletsForTribunal(makeItem({ fullText: null, ementa: ementaDensa(1200) }));
    expect(promptEnviado()).not.toContain('TEXTO INTEGRAL DA DECISÃO');
  });

  it('inclui o inteiro teor quando ele existe', async () => {
    const { generateAiBulletsForTribunal } = await import('../ai-bullets');
    await generateAiBulletsForTribunal(
      makeItem({ fullText: 'INTEIRO TEOR RELEVANTE. '.repeat(50), ementa: ementaDensa(500) })
    );
    expect(promptEnviado()).toContain('TEXTO INTEGRAL DA DECISÃO');
  });

  it('manda não repetir a ementa, que o leitor já tem logo abaixo', async () => {
    const { generateAiBulletsForTribunal } = await import('../ai-bullets');
    await generateAiBulletsForTribunal(makeItem({ fullText: null, ementa: ementaDensa(1200) }));
    expect(promptEnviado().toLowerCase()).toContain('não repita');
  });

  it('avisa quando o texto chega cortado, para não inventar o desfecho', async () => {
    const { generateAiBulletsForTribunal } = await import('../ai-bullets');
    // corte no meio da frase, como as monocráticas do STF (6.000) e o TCE-PE (2.000)
    await generateAiBulletsForTribunal(
      makeItem({ fullText: null, ementa: ementaDensa(1200).slice(0, 1190) + ' e por consequência o relator determin' })
    );
    expect(promptEnviado()).toContain('truncado');
  });

  it('não avisa truncamento quando o texto termina inteiro', async () => {
    const { generateAiBulletsForTribunal } = await import('../ai-bullets');
    await generateAiBulletsForTribunal(
      makeItem({ fullText: null, ementa: ementaDensa(1200).trim() + ' Recurso conhecido e desprovido.' })
    );
    expect(promptEnviado()).not.toContain('chega truncado');
  });
});

describe('teto de tamanho do prompt', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(global, 'fetch');
    spy.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"bullets":["Bullet editorial suficientemente longo para atravessar o filtro de tamanho."]}' }] } }],
        }),
        { status: 200 }
      ) as never
    );
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(() => {
    spy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it('corta a ementa gigante no mesmo teto que já vale para o inteiro teor', async () => {
    const { generateAiBulletsForTribunal } = await import('../ai-bullets');
    // 31.069 chars é a maior ementa observada no corpus do STF
    await generateAiBulletsForTribunal(makeItem({ fullText: null, ementa: ementaDensa(31069) }));
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    const prompt = body.contents[0].parts[0].text as string;
    expect(prompt).toContain('[...truncado]');
    expect(prompt.length).toBeLessThan(20000);
  });
});
