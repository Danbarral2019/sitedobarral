import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { parseCSV, filtrarPorTermos, selecionarParaProcessar } from '../tce-pr';
import { DEFAULT_SEARCH_TERMS } from '../utils';

const CABECALHO =
  'DsTipoAto;NrAto;AnoAto;SgUnidAdm;DsClasseProcessual;DsSubClasseProcessual;NrProcesso;AnoProcesso;DsTitulo;DsResumo;NmCategoriaPublicacao;DsColegiado;DsEntidade;DsInteressado;DsVeiculoPublicacao;NmAdvogados;DtPublicacaoDOE;DtSessao;NrDOE;NmRelator;Termos;ReferenciaLegislativas;DsTema;UrlPDF';

function linha(o: { nr: string; ano?: string; classe?: string; titulo?: string; resumo?: string; sessao?: string }): string {
  const c = Array(24).fill('');
  c[0] = 'Acórdão';
  c[1] = o.nr;
  c[2] = o.ano ?? '2026';
  c[4] = o.classe ?? 'Representação';
  c[8] = o.titulo ?? '';
  c[9] = o.resumo ?? '';
  c[17] = o.sessao ?? '01/06/2026 14:00:00';
  return c.map((v) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(';');
}

describe('TCE-PR: parseCSV', () => {
  it('aceita quebra de linha dentro de campo entre aspas sem deslocar colunas', () => {
    const csv =
      '﻿' +
      [CABECALHO, linha({ nr: '10', resumo: 'Primeiro parágrafo.\nSegundo parágrafo; com ponto e vírgula.' }), linha({ nr: '11', resumo: 'Outro' })].join(
        '\r\n',
      );
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].NrAto).toBe('10');
    expect(rows[0].DsResumo).toBe('Primeiro parágrafo.\nSegundo parágrafo; com ponto e vírgula.');
    expect(rows[0].DtSessao).toBe('01/06/2026 14:00:00');
    expect(rows[1].NrAto).toBe('11');
  });

  it('desfaz aspas escapadas', () => {
    const rows = parseCSV([CABECALHO, linha({ nr: '12', titulo: 'Termo "aditivo"' })].join('\n'));
    expect(rows[0].DsTitulo).toBe('Termo "aditivo"');
  });
});

describe('TCE-PR: filtrarPorTermos', () => {
  const rows = parseCSV(
    [
      CABECALHO,
      linha({ nr: '1', resumo: 'Licitação. Pregão eletrônico. Registro de preços.' }),
      linha({ nr: '2', resumo: 'Dispensa de licitação para aquisição emergencial.' }),
      linha({ nr: '3', resumo: 'Aposentadoria de servidor municipal.' }),
      linha({ nr: '4', classe: 'Consulta', resumo: 'Tema de pessoal.' }),
    ].join('\n'),
  );

  it('casa termos sem acento com o texto acentuado da fonte', () => {
    const nrs = filtrarPorTermos(rows, DEFAULT_SEARCH_TERMS).map((r) => r.NrAto);
    expect(nrs).toContain('1');
    expect(nrs).toContain('2');
    expect(nrs).not.toContain('3');
  });

  it('mantém sempre consulta e prejulgado', () => {
    expect(filtrarPorTermos(rows, DEFAULT_SEARCH_TERMS).map((r) => r.NrAto)).toContain('4');
  });
});

describe('TCE-PR: selecionarParaProcessar', () => {
  const d = (n: string, data: string) => ({ decisionNumber: `${n}/2026`, title: '', ementa: '', dataJulgamento: data });

  it('descarta os já existentes ANTES de aplicar o limite', () => {
    const decisoes = [d('1', '01/01/2026'), d('2', '02/01/2026'), d('3', '03/01/2026'), d('4', '04/01/2026')];
    const existentes = new Set(['2/2026', '3/2026', '4/2026']);
    const sel = selecionarParaProcessar(decisoes, (x) => x.decisionNumber, existentes, 2, false);
    expect(sel.map((x) => x.decisionNumber)).toEqual(['1/2026']);
  });

  it('processa do julgamento mais recente para o mais antigo', () => {
    const decisoes = [d('1', '10/01/2026'), d('2', '05/06/2026'), d('3', '20/03/2026')];
    const sel = selecionarParaProcessar(decisoes, (x) => x.decisionNumber, new Set(), 2, false);
    expect(sel.map((x) => x.decisionNumber)).toEqual(['2/2026', '3/2026']);
  });

  it('com forcar, reprocessa os existentes', () => {
    const decisoes = [d('1', '01/01/2026')];
    const sel = selecionarParaProcessar(decisoes, (x) => x.decisionNumber, new Set(['1/2026']), 10, true);
    expect(sel).toHaveLength(1);
  });
});
