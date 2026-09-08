// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnunciados, mockDestilacao } = vi.hoisted(() => ({
  mockEnunciados: vi.fn(),
  mockDestilacao: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teseEnunciado: { findMany: (...a: unknown[]) => mockEnunciados(...a) },
    teseDestilacao: { findFirst: (...a: unknown[]) => mockDestilacao(...a) },
  },
}));
import { nivelDe, chaveUrl } from './consultas';

describe('nivelDe', () => {
  it('com chave oficial do TCU é nível oficial', () => {
    expect(nivelDe({ acordaoKey: 'ACORDAO-COMPLETO-1', origemIdentidade: 'tcu-oficial' })).toBe('oficial');
  });

  it('sem chave mas com convergência é nível convergência', () => {
    expect(nivelDe({ acordaoKey: null, origemIdentidade: 'convergencia-citantes' })).toBe('convergencia');
  });

  it('sem chave e sem origem é sem-colegiado', () => {
    expect(nivelDe({ acordaoKey: null, origemIdentidade: null })).toBe('sem-colegiado');
  });

  it('a chave oficial manda, mesmo se a origem disser outra coisa', () => {
    // Defesa contra dado inconsistente: acordaoKey só é gravado quando o TCU
    // devolve exatamente um candidato, então ele é o sinal mais forte.
    expect(nivelDe({ acordaoKey: 'ACORDAO-COMPLETO-1', origemIdentidade: 'convergencia-citantes' })).toBe('oficial');
  });
});

describe('chaveUrl', () => {
  it('inclui o colegiado quando conhecido', () => {
    expect(chaveUrl({ numeroAlvo: 1441, anoAlvo: 2016, colegiadoAlvo: 'Plenário' })).toBe('1441-2016-plenario');
  });

  it('omite o colegiado quando não se sabe', () => {
    expect(chaveUrl({ numeroAlvo: 2298, anoAlvo: 2025, colegiadoAlvo: null })).toBe('2298-2025');
  });

  it('normaliza acento e espaço do colegiado', () => {
    expect(chaveUrl({ numeroAlvo: 56, anoAlvo: 2024, colegiadoAlvo: 'Segunda Câmara' })).toBe('56-2024-segunda-camara');
  });
});

const enunciadoDb = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  enunciado: 'A pretensão punitiva subordina-se ao prazo de dez anos.',
  inovacao: 'Fixou o prazo geral.',
  trechosFonte: [0],
  trechos: [
    {
      ordem: 0, trecho: 'Conforme o Acórdão 1441/2016...', origemNumero: 100, origemAno: 2020,
      origemColegiado: 'Plenário', origemUrl: 'https://u/100', origemLinkPDF: null,
      origemDocumentId: 'doc-100', noVoto: true,
    },
  ],
  destilacao: {
    numeroAlvo: 1441, anoAlvo: 2016, colegiadoAlvo: 'Plenário', acordaoKey: 'ACORDAO-COMPLETO-1',
    origemIdentidade: 'tcu-oficial', citantesConcordantes: null, dossieNoVoto: 262, assunto: 'Prescrição',
    relatorAlvo: 'Min. Fulano', urlAlvo: 'https://tcu/1',
  },
  ...over,
});

describe('listarVitrine', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta com o predicado da vitrine, não o da base', async () => {
    const { listarVitrine } = await import('./consultas');
    mockEnunciados.mockResolvedValue([]);
    await listarVitrine();
    const where = mockEnunciados.mock.calls[0][0].where;
    expect(where.veredito).toBe('fiel');
    expect(where.publicado).toBe(true);
    expect(where.vitrinePublica).toBe(true);
    expect(where.destilacao.acordaoKey).toEqual({ not: null });
  });

  it('descarta enunciado com evidência incompleta', async () => {
    const { listarVitrine } = await import('./consultas');
    // declara dois índices, só um persistido
    mockEnunciados.mockResolvedValue([enunciadoDb({ trechosFonte: [0, 1] })]);
    expect(await listarVitrine()).toEqual([]);
  });

  it('monta o cartão com nível e chave de URL', async () => {
    const { listarVitrine } = await import('./consultas');
    mockEnunciados.mockResolvedValue([enunciadoDb()]);
    const [card] = await listarVitrine();
    expect(card.nivel).toBe('oficial');
    expect(card.chaveUrl).toBe('1441-2016-plenario');
    expect(card.citacoesNoVoto).toBe(262);
    expect(card.trechos).toHaveLength(1);
  });
});

describe('listarAcervo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa o predicado da base e exige publicado, sem exigir vitrine', async () => {
    const { listarAcervo } = await import('./consultas');
    mockEnunciados.mockResolvedValue([]);
    await listarAcervo();
    const where = mockEnunciados.mock.calls[0][0].where;
    expect(where.publicado).toBe(true);
    expect(where.vitrinePublica).toBeUndefined();
    expect(where.destilacao.acordaoKey).toBeUndefined();
  });
});

describe('buscarPorChave', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem acesso ativo, devolve só as teses da vitrine e conta as reservadas', async () => {
    const { buscarPorChave } = await import('./consultas');
    mockDestilacao.mockResolvedValue({
      numeroAlvo: 1441, anoAlvo: 2016, colegiadoAlvo: 'Plenário', relatorAlvo: 'Min. Fulano',
      urlAlvo: 'https://tcu/1', acordaoKey: 'ACORDAO-COMPLETO-1', origemIdentidade: 'tcu-oficial',
      citantesConcordantes: null, dossieNoVoto: 262, assunto: 'Prescrição',
      enunciados: [
        { ...enunciadoDb(), id: 'e1', vitrinePublica: true },
        { ...enunciadoDb(), id: 'e2', vitrinePublica: false },
      ],
    });
    const d = await buscarPorChave('1441-2016-plenario', false);
    expect(d?.teses.map(t => t.enunciadoId)).toEqual(['e1']);
    expect(d?.tesesReservadas).toBe(1);
  });

  it('com acesso ativo, devolve todas e não reserva nenhuma', async () => {
    const { buscarPorChave } = await import('./consultas');
    mockDestilacao.mockResolvedValue({
      numeroAlvo: 1441, anoAlvo: 2016, colegiadoAlvo: 'Plenário', relatorAlvo: null,
      urlAlvo: null, acordaoKey: 'ACORDAO-COMPLETO-1', origemIdentidade: 'tcu-oficial',
      citantesConcordantes: null, dossieNoVoto: 262, assunto: 'Prescrição',
      enunciados: [
        { ...enunciadoDb(), id: 'e1', vitrinePublica: true },
        { ...enunciadoDb(), id: 'e2', vitrinePublica: false },
      ],
    });
    const d = await buscarPorChave('1441-2016-plenario', true);
    expect(d?.teses.map(t => t.enunciadoId)).toEqual(['e1', 'e2']);
    expect(d?.tesesReservadas).toBe(0);
  });

  it('chave inexistente devolve null', async () => {
    const { buscarPorChave } = await import('./consultas');
    mockDestilacao.mockResolvedValue(null);
    expect(await buscarPorChave('9999-1999', false)).toBeNull();
  });
});
