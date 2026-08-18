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
