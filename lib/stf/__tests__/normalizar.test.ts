// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizarDocumentoStf, LIMITE_TRUNCAMENTO_STF, linkStf } from '../normalizar';
import type { StfDocumentoBruto } from '../types';

const ACORDAO: StfDocumentoBruto = {
  base: 'acordaos',
  id: 'sjur554999',
  titulo: 'ADI 7764',
  processo_numero: '7764',
  processo_classe_processual_unificada_classe_sigla: 'ADI',
  procedencia_geografica_uf_sigla: 'RR',
  relator_processo_nome: 'MINISTRA CÁRMEN LÚCIA',
  orgao_julgador: 'Tribunal Pleno',
  julgamento_data: '2026-02-25',
  publicacao_data: '2026-03-05',
  is_repercussao_geral: false,
  ementa_texto: 'Ementa: DIREITO ADMINISTRATIVO. LICITAÇÃO. Dispensa indevida.',
  documental_legislacao_citada_texto: [
    'LEG-FED   LEI-014133 ANO-2021\n ART-00075\n LEI ORDINÁRIA',
  ],
  documental_tese_texto: 'É inconstitucional a dispensa genérica.',
  documental_tese_tema_texto: 'Tema 1234',
};

const MONOCRATICA: StfDocumentoBruto = {
  base: 'decisoes',
  id: 'sjur999111',
  titulo: 'Rcl 97875',
  processo_classe_processual_unificada_classe_sigla: 'Rcl',
  relator_decisao_nome: 'MINISTRO ALEXANDRE DE MORAES',
  julgamento_data: '2026-08-06',
  decisao_texto: 'x'.repeat(LIMITE_TRUNCAMENTO_STF),
};

describe('normalizarDocumentoStf — acórdão', () => {
  const n = normalizarDocumentoStf(ACORDAO)!;

  it('usa o id nativo como chave de dedup', () => {
    expect(n.sourceId).toBe('sjur554999');
    expect(n.fullIdentifier).toBe('STF sjur554999');
  });

  it('mapeia base=acordaos para decisionType acordao', () => {
    expect(n.decisionType).toBe('acordao');
  });

  it('separa classe e número a partir do título', () => {
    expect(n.classe).toBe('ADI');
    expect(n.decisionNumber).toBe('7764');
    expect(n.title).toBe('ADI 7764');
  });

  it('deriva o ano da data de julgamento', () => {
    expect(n.year).toBe(2026);
    expect(n.dataJulgamento?.toISOString().slice(0, 10)).toBe('2026-02-25');
    expect(n.dataPublicacao?.toISOString().slice(0, 10)).toBe('2026-03-05');
  });

  it('monta o link público do documento', () => {
    expect(n.url).toBe('https://jurisprudencia.stf.jus.br/pages/search/sjur554999/false');
  });

  it('traz os artigos da 14.133 do campo estruturado', () => {
    expect(n.artigos14133).toEqual(['75']);
    expect(n.citaLei14133).toBe(true);
  });

  it('preserva tese e tema oficiais', () => {
    expect(n.tese).toBe('É inconstitucional a dispensa genérica.');
    expect(n.tema).toBe('Tema 1234');
  });

  it('não marca ementa de acórdão como truncada', () => {
    expect(n.ementaTruncada).toBe(false);
  });
});

describe('decisionNumber — casos com sufixos (52% do corpus)', () => {
  it('extrai número de título com sufixo composto (AgR-ED-ED)', () => {
    const n = normalizarDocumentoStf({
      ...ACORDAO,
      titulo: 'ARE 1535561 AgR-ED-ED',
    })!;
    expect(n.decisionNumber).toBe('1535561');
    expect(n.title).toBe('ARE 1535561 AgR-ED-ED');
  });

  it('extrai número de título com sufixo simples (AgR)', () => {
    const n = normalizarDocumentoStf({
      ...ACORDAO,
      titulo: 'RE 1403832 AgR',
    })!;
    expect(n.decisionNumber).toBe('1403832');
  });

  it('cai para título quando não há dígito nenhum', () => {
    const n = normalizarDocumentoStf({
      ...ACORDAO,
      titulo: 'TÍTULO SEM NÚMERO',
    })!;
    expect(n.decisionNumber).toBe('TÍTULO SEM NÚMERO');
  });
});

describe('normalizarDocumentoStf — monocrática', () => {
  const n = normalizarDocumentoStf(MONOCRATICA)!;

  it('mapeia base=decisoes para decisionType decisao', () => {
    expect(n.decisionType).toBe('decisao');
  });

  it('usa decisao_texto como ementa quando não há ementa_texto', () => {
    expect(n.ementa.length).toBe(LIMITE_TRUNCAMENTO_STF);
  });

  it('marca como truncada quando o texto bate no limite de 6000 do índice do STF', () => {
    expect(n.ementaTruncada).toBe(true);
  });

  it('cai para relator_decisao_nome quando não há relator_processo_nome', () => {
    expect(n.relator).toBe('MINISTRO ALEXANDRE DE MORAES');
  });

  it('marca truncamento medindo tamanho bruto, não colapsado', () => {
    // 'palavra ' (8 chars) × 750 = 6000 chars brutos, mas colapsa para ~5999
    const n = normalizarDocumentoStf({
      ...MONOCRATICA,
      decisao_texto: 'palavra '.repeat(750),
    })!;
    expect(n.ementaTruncada).toBe(true);
  });

  it('não marca truncamento para texto curto mesmo com espaços', () => {
    const n = normalizarDocumentoStf({
      ...MONOCRATICA,
      decisao_texto: 'Texto da decisão com espaços e com tamanho suficiente mas bem abaixo do limite de truncamento.',
    })!;
    expect(n.ementaTruncada).toBe(false);
  });
});

describe('year — fallback de publicacao_data', () => {
  it('usa dataPublicacao quando julgamento_data está vazia', () => {
    const n = normalizarDocumentoStf({
      ...ACORDAO,
      julgamento_data: undefined,
      publicacao_data: '2019-05-10',
    })!;
    expect(n.year).toBe(2019);
    expect(n.dataJulgamento).toBeNull();
    expect(n.dataPublicacao?.toISOString().slice(0, 10)).toBe('2019-05-10');
  });

  it('usa ano corrente quando ambas as datas estão vazias', () => {
    const n = normalizarDocumentoStf({
      ...ACORDAO,
      julgamento_data: undefined,
      publicacao_data: undefined,
    })!;
    expect(n.year).toBe(new Date().getUTCFullYear());
    expect(n.dataJulgamento).toBeNull();
    expect(n.dataPublicacao).toBeNull();
  });
});

describe('normalizarDocumentoStf — rejeições', () => {
  it('rejeita documento sem id', () => {
    expect(normalizarDocumentoStf({ ...ACORDAO, id: '' })).toBeNull();
  });

  it('rejeita documento sem texto aproveitável', () => {
    expect(
      normalizarDocumentoStf({ ...ACORDAO, ementa_texto: 'curto', decisao_texto: undefined })
    ).toBeNull();
  });
});

describe('normalização de texto', () => {
  it('junta arrays e colapsa espaços em branco', () => {
    const n = normalizarDocumentoStf({
      ...ACORDAO,
      ementa_texto: ['Ementa:   LICITAÇÃO.', '\n\n  Segundo   trecho relevante do julgado.'],
    })!;
    expect(n.ementa).toBe('Ementa: LICITAÇÃO. Segundo trecho relevante do julgado.');
  });
});

describe('linkStf', () => {
  it('monta a URL pública', () => {
    expect(linkStf('sjur1')).toBe('https://jurisprudencia.stf.jus.br/pages/search/sjur1/false');
  });
});
