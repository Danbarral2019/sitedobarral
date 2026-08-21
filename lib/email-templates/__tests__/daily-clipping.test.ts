// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  truncateEmenta,
  renderDailyClippingV2,
  type ClippingGroup,
} from '../daily-clipping';
import type { ClippingItem } from '@/lib/clipping/sources/types';

/**
 * Ementa realista: frases separadas por espaço, como o dado de produção.
 * Deliberadamente NÃO se usa `'x'.repeat(n)` — string sem espaço é imune ao
 * corte em limite de palavra e faria o teste passar sem exercitar o mecanismo.
 */
function ementaLonga(chars: number): string {
  let s = '';
  let i = 0;
  // cada bloco carrega um número — assim o fim da ementa é um trecho único e
  // um `not.toContain` do final prova que aquele pedaço não foi emitido
  while (s.length < chars) {
    s +=
      `ITEM ${++i}. RECURSO EXTRAORDINÁRIO COM AGRAVO. LICITAÇÃO. CONTRATO ADMINISTRATIVO. ` +
      'ALEGAÇÃO DE OFENSA AOS PRINCÍPIOS DA LEGALIDADE E DA MORALIDADE. ' +
      'MATÉRIA INFRACONSTITUCIONAL. REEXAME DE FATOS E PROVAS. SÚMULA 279. ';
  }
  return s.slice(0, chars);
}

function makeItem(ementa: string): ClippingItem {
  return {
    sourceKind: 'tribunal-decision',
    sourceId: 'id-1',
    tribunalCode: 'STF',
    tribunalName: 'Supremo Tribunal Federal',
    decisionType: 'acordao',
    decisionNumber: 'ARE 1600535',
    title: 'ARE 1600535',
    dataJulgamento: new Date('2026-08-03T00:00:00Z'),
    relator: 'Min. Fulano',
    orgaoJulgador: 'Primeira Turma',
    ementa,
    fullText: null,
    linkExternal: 'https://jurisprudencia.stf.jus.br/x',
    linkPdf: 'https://redir.stf.jus.br/x.pdf',
    relevanceScore: 100,
    publishedAt: new Date('2026-08-17T00:00:00Z'),
  };
}

function renderComEmentas(ementas: string[]): string {
  const groups: ClippingGroup[] = [
    {
      tribunalCode: 'STF',
      tribunalName: 'Supremo Tribunal Federal',
      items: ementas.map((e) => ({ item: makeItem(e) })),
    },
  ];
  return renderDailyClippingV2({
    sendId: 'send-1',
    recipientName: 'Daniel',
    unsubscribeToken: 'tok',
    referenceDate: new Date('2026-08-17T00:00:00Z'),
    groups,
  }).html;
}

describe('truncateEmenta', () => {
  it('devolve a ementa intacta quando cabe no limite', () => {
    const curta = 'ACÓRDÃO. LICITAÇÃO. DISPENSA INDEVIDA.';
    expect(truncateEmenta(curta, 2000)).toBe(curta);
  });

  it('respeita o limite exato sem truncar', () => {
    const s = ementaLonga(2000);
    expect(truncateEmenta(s, 2000)).toBe(s);
  });

  it('corta a ementa que excede o limite e sinaliza o corte', () => {
    const s = ementaLonga(31069);
    const out = truncateEmenta(s, 2000);
    expect(out.length).toBeLessThanOrEqual(2000 + ' […]'.length);
    expect(out.endsWith(' […]')).toBe(true);
  });

  it('corta no limite de palavra, sem partir palavra ao meio', () => {
    const s = ementaLonga(5539);
    const out = truncateEmenta(s, 2000);
    const corpo = out.slice(0, -' […]'.length);
    // o caractere seguinte ao corte, no original, é um espaço — prova de que o
    // corte caiu numa fronteira de palavra
    expect(s[corpo.length]).toBe(' ');
  });

  it('corta no limite duro quando a ementa não tem espaço algum', () => {
    const semEspaco = 'A'.repeat(5000);
    const out = truncateEmenta(semEspaco, 2000);
    expect(out).toBe(`${'A'.repeat(2000)} […]`);
  });
});

describe('renderDailyClippingV2 — tamanho do corpo', () => {
  it('não emite a ementa integral quando ela excede o limite', () => {
    const s = ementaLonga(31069);
    const html = renderComEmentas([s]);
    expect(html).not.toContain(s);
    // o trecho final da ementa não pode aparecer no corpo
    expect(html).not.toContain(s.slice(-200));
  });

  it('mantém o corpo longe do limite de ~102 KB em que o Gmail trunca', () => {
    // pior caso realista: o cap global do cron (CLIPPING_MAX_ITEMS_TOTAL=15)
    // cheio de ementas do tamanho máximo já observado no STF
    const html = renderComEmentas(Array.from({ length: 15 }, () => ementaLonga(31069)));
    expect(html.length).toBeLessThan(102 * 1024);
  });

  it('preserva na íntegra a ementa que cabe no limite', () => {
    const s = ementaLonga(1900);
    const html = renderComEmentas([s]);
    expect(html).toContain(s);
  });
});

/**
 * Identificação técnica do julgado no cabeçalho e data do julgamento.
 *
 * Caso real (21/08/2026): o clipping anunciou "Decisao 1608084 — Sessão:
 * 01/06/2026" para um julgado que o STF publica como "ARE 1608084 / SP",
 * julgado em 02/06/2026. Nenhum dos dois erros vinha da coleta: no banco o
 * registro tem title "ARE 1608084" e dataJulgamento 2026-06-02T00:00:00Z.
 *
 * Os títulos abaixo são cópias literais de registros de produção.
 */
function itemDe(over: Partial<ClippingItem>): ClippingItem {
  return { ...makeItem('Ementa qualquer, longa o bastante para o corpo.'), ...over };
}

function renderItens(tribunalCode: string, tribunalName: string, itens: ClippingItem[]): string {
  return renderDailyClippingV2({
    sendId: 'send-1',
    recipientName: 'Daniel',
    unsubscribeToken: 'tok',
    referenceDate: new Date('2026-08-17T00:00:00Z'),
    groups: [{ tribunalCode, tribunalName, items: itens.map((item) => ({ item })) }],
  }).html;
}

describe('renderDailyClippingV2 — identificação do julgado', () => {
  const monocraticaStf = itemDe({
    tribunalCode: 'STF',
    decisionType: 'decisao',
    decisionNumber: '1608084',
    title: 'ARE 1608084',
    orgaoJulgador: null,
    relator: 'LUIZ FUX',
    dataJulgamento: new Date('2026-06-02T00:00:00Z'),
  });

  it('usa a classe processual do julgado, não o tipo interno do banco', () => {
    const html = renderItens('STF', 'Supremo Tribunal Federal', [monocraticaStf]);
    expect(html).toContain('ARE 1608084');
    expect(html).not.toContain('Decisao');
  });

  it('não repete no cabeçalho o tribunal que já titula o grupo', () => {
    const html = renderItens('TCU', 'Tribunal de Contas da União', [
      itemDe({
        tribunalCode: 'TCU',
        tribunalName: 'Tribunal de Contas da União',
        decisionType: 'acordao',
        decisionNumber: '2194/2026',
        title: 'Acórdão TCU 2194/2026 - Plenário',
        orgaoJulgador: 'Plenário',
      }),
    ]);
    expect(html).toContain('Acórdão 2194/2026');
    expect(html).not.toContain('Acórdão TCU 2194/2026');
  });

  it('não repete no cabeçalho o órgão julgador que já está na linha de metadados', () => {
    const html = renderItens('TCU', 'Tribunal de Contas da União', [
      itemDe({
        tribunalCode: 'TCU',
        tribunalName: 'Tribunal de Contas da União',
        decisionType: 'acordao',
        decisionNumber: '2194/2026',
        title: 'Acórdão TCU 2194/2026 - Plenário',
        orgaoJulgador: 'Plenário',
      }),
    ]);
    expect(html).not.toContain('2194/2026 - Plenário');
  });

  it('preserva a classe recursal do STJ e descarta o sufixo do tribunal', () => {
    const html = renderItens('STJ', 'Superior Tribunal de Justiça', [
      itemDe({
        tribunalCode: 'STJ',
        tribunalName: 'Superior Tribunal de Justiça',
        decisionType: 'acordao',
        decisionNumber: '202600138141',
        title: 'AgInt no AREsp 202600138141 - STJ',
        orgaoJulgador: 'SEGUNDA TURMA',
      }),
    ]);
    expect(html).toContain('AgInt no AREsp 202600138141');
    expect(html).not.toContain('202600138141 - STJ');
  });

  it('grafa "Acórdão" por extenso quando a fonte grava o título em caixa alta sem acento', () => {
    const html = renderItens('TCE-PE', 'Tribunal de Contas do Estado de Pernambuco', [
      itemDe({
        tribunalCode: 'TCE-PE',
        tribunalName: 'Tribunal de Contas do Estado de Pernambuco',
        decisionType: 'acordao',
        decisionNumber: '1607/2026',
        title: 'ACORDAO 1607/2026 TCE-PE (Medida Cautelar)',
        orgaoJulgador: '1a. Câmara',
      }),
    ]);
    expect(html).toContain('Acórdão 1607/2026 (Medida Cautelar)');
    expect(html).not.toContain('ACORDAO');
  });

  it('cai no número da decisão quando o título vem vazio', () => {
    const html = renderItens('STF', 'Supremo Tribunal Federal', [
      itemDe({ ...monocraticaStf, title: '' }),
    ]);
    expect(html).toContain('1608084');
  });
});

describe('renderDailyClippingV2 — data do julgamento', () => {
  const emDoisDeJunho = itemDe({
    tribunalCode: 'STF',
    decisionType: 'decisao',
    decisionNumber: '1608084',
    title: 'ARE 1608084',
    orgaoJulgador: null,
    dataJulgamento: new Date('2026-06-02T00:00:00Z'),
  });

  it('imprime o dia em que o julgado foi julgado, não o anterior', () => {
    const { html, text } = renderDailyClippingV2({
      sendId: 'send-1',
      recipientName: 'Daniel',
      unsubscribeToken: 'tok',
      referenceDate: new Date('2026-08-17T00:00:00Z'),
      groups: [{ tribunalCode: 'STF', tribunalName: 'Supremo Tribunal Federal', items: [{ item: emDoisDeJunho }] }],
    });
    expect(html).toContain('02/06/2026');
    expect(html).not.toContain('01/06/2026');
    expect(text).toContain('02/06/2026');
    expect(text).not.toContain('01/06/2026');
  });

  it('rotula a data como julgamento, que vale para colegiado e para monocrática', () => {
    const html = renderItens('STF', 'Supremo Tribunal Federal', [emDoisDeJunho]);
    expect(html).toContain('Julgamento: 02/06/2026');
    expect(html).not.toContain('Sessão:');
  });
});
