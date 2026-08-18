import { describe, it, expect } from 'vitest';
import { parseDataSessao, ehAproveitavel, montarDadosDocument, atingiuAlvo, CATEGORIA_GRAFO } from './backfill-retroativo';

const comum = {
  tipo: 'ACÓRDÃO', numeroAcordao: '3148', anoAcordao: '2025',
  titulo: 'ACÓRDÃO 3148/2025 - Segunda Câmara', sumario: 'Ementa qualquer.',
  colegiado: 'Segunda Câmara', relator: 'FULANO', dataSessao: '10/06/2025',
  urlArquivo: 'https://contas.tcu.gov.br/sagas/Rtf?item0=1',
};

describe('parseDataSessao', () => {
  it('converte dd/mm/aaaa em ISO', () => expect(parseDataSessao('05/12/2023')).toBe('2023-12-05'));
  it('devolve null para vazio', () => expect(parseDataSessao(undefined)).toBeNull());
  it('devolve null para formato inesperado', () => expect(parseDataSessao('2023-12-05')).toBeNull());
});

describe('ehAproveitavel', () => {
  it('aceita acordao comum com RTF', () => expect(ehAproveitavel(comum)).toBe(true));
  it('rejeita acordao de relacao (80% do feed, sem secao de voto)', () =>
    expect(ehAproveitavel({ ...comum, tipo: 'ACÓRDÃO DE RELAÇÃO' })).toBe(false));
  it('rejeita item sem link de RTF', () =>
    expect(ehAproveitavel({ ...comum, urlArquivo: undefined, urlArquivoPDF: undefined })).toBe(false));
  it('rejeita item sem numero ou ano', () =>
    expect(ehAproveitavel({ ...comum, numeroAcordao: undefined })).toBe(false));

  // Whitelist (nao blacklist): so tipo === 'ACORDAO' normalizado passa.
  // Endpoint do TCU tem outros valores de tipo alem de "Acordao de Relacao"
  // (ver lib/tcu-scraper.ts:21) — uma blacklist deixa passar qualquer coisa
  // que nao contenha "RELACAO", inclusive "Decisao" ou tipo ausente.
  it('rejeita tipo "Decisao" (nao e blacklist de relacao, e whitelist de acordao)', () =>
    expect(ehAproveitavel({ ...comum, tipo: 'Decisão' })).toBe(false));
  it('rejeita item sem tipo (undefined)', () =>
    expect(ehAproveitavel({ ...comum, tipo: undefined })).toBe(false));
  it('aceita tipo em minusculas ("acórdão")', () =>
    expect(ehAproveitavel({ ...comum, tipo: 'acórdão' })).toBe(true));
  it('aceita tipo sem acento ("ACORDAO")', () =>
    expect(ehAproveitavel({ ...comum, tipo: 'ACORDAO' })).toBe(true));
  it('aceita tipo com espacos nas bordas ("  ACÓRDÃO  ")', () =>
    expect(ehAproveitavel({ ...comum, tipo: '  ACÓRDÃO  ' })).toBe(true));
});

describe('montarDadosDocument', () => {
  const d = montarDadosDocument(comum)!;

  it('usa a categoria do grafo, nunca acordao', () => {
    expect(d.category).toBe(CATEGORIA_GRAFO);
    expect(d.category).not.toBe('acordao');
  });

  it('nasce invisivel nas superficies do site', () => {
    expect(d.isPublic).toBe(false);
    expect(d.isCommon).toBe(false);
    expect(d.courseId).toBeNull();
  });

  it('ENTRA na fila de embedding, deixando valer o default do schema', () => {
    // Nao define a chave: o @default("pending") do Document e quem manda, e o
    // cron process-index-jobs indexa o no como qualquer outro documento.
    // Definir 'skipped' aqui (comportamento ate 08/2026) deixava ~5 mil
    // acordaos do TCU com sumario real fora da busca semantica.
    expect('embeddingStatus' in d).toBe(false);
  });

  it('nao entra no contador de auto-importacoes', () => {
    expect(d.reviewedBy).toBe('backfill-grafo');
  });

  it('nao mente sobre enriquecimento', () => {
    expect(d.tcuEnriquecimentoStatus).toBe('skipped');
  });

  it('leva o link do RTF, que e o insumo da catalogacao', () => {
    expect(d.tcuLinkPDF).toBe('https://contas.tcu.gov.br/sagas/Rtf?item0=1');
  });

  it('preenche as chaves de deduplicacao', () => {
    expect(d.acordaoNumero).toBe(3148);
    expect(d.acordaoAno).toBe(2025);
    expect(d.tcuOrgaoJulgador).toBe('Segunda Câmara');
  });

  it('devolve null para item nao aproveitavel', () => {
    expect(montarDadosDocument({ ...comum, tipo: 'ACÓRDÃO DE RELAÇÃO' })).toBeNull();
  });
});

describe('atingiuAlvo', () => {
  it('para quando a sessao e anterior a dez/2023', () =>
    expect(atingiuAlvo({ ...comum, dataSessao: '30/11/2023' })).toBe(true));
  it('nao para dentro do alvo', () =>
    expect(atingiuAlvo({ ...comum, dataSessao: '05/12/2023' })).toBe(false));
  it('nao para com data ausente', () =>
    expect(atingiuAlvo({ ...comum, dataSessao: undefined })).toBe(false));
});
