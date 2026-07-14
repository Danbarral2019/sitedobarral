// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  decodeBest, parseOnsPage, tokenize, jaccard, containment, diffOns,
  type PageON, type DbON,
} from '../checks';

const CARD = (n: number, y: number, corpo: string, href = `https://www.in.gov.br/web/dou/-/orientacao-normativa-agu-n-${n}-de-11-de-junho-de-${y}-123`) => `
  <div class="on-card">
    <div class="on-titulo"><a href="${href}" target="_blank">Orientação Normativa ${n}/${y}</a></div>
    <div class="on-corpo"><p>${corpo}</p></div>
    <div class="on-meta">Fundamentação</div>
  </div>`;

describe('decodeBest', () => {
  it('escolhe utf-8 quando os bytes são utf-8 (evita mojibake latin-1)', () => {
    const buf = Buffer.from('Orientação de contratação', 'utf-8');
    expect(decodeBest(buf)).toBe('Orientação de contratação');
  });

  it('escolhe latin-1 quando os bytes são latin-1', () => {
    const buf = Buffer.from('Orientação de contratação', 'latin1');
    expect(decodeBest(buf)).toBe('Orientação de contratação');
  });
});

describe('parseOnsPage', () => {
  it('extrai número, ano, enunciado e link do DOU de cada card', () => {
    const html = CARD(107, 2026, 'I - No regime da Lei nº 14.133.') + CARD(90, 2024, 'A vigência do contrato.');
    const ons = parseOnsPage(html);
    expect(ons).toHaveLength(2);
    const on107 = ons.find((o) => o.key === '107/2026')!;
    expect(on107.onNumber).toBe(107);
    expect(on107.onYear).toBe(2026);
    expect(on107.enunciado).toContain('regime da Lei');
    expect(on107.douUrl).toContain('in.gov.br');
  });

  it('ignora cards sem número de ON reconhecível', () => {
    const html = '<div class="on-card"><div class="on-titulo"><a href="#">Fundamentação</a></div></div>';
    expect(parseOnsPage(html)).toHaveLength(0);
  });

  it('deixa douUrl null quando o link não é do in.gov.br', () => {
    const html = CARD(50, 2014, 'Texto.', 'https://sapiens.agu.gov.br/valida_publico?id=1');
    expect(parseOnsPage(html)[0].douUrl).toBeNull();
  });
});

describe('tokenize / jaccard', () => {
  it('normaliza acentos e retorna similaridade 1 para textos iguais', () => {
    expect(jaccard(tokenize('Contratação direta'), tokenize('contratacao direta'))).toBe(1);
  });

  it('dá similaridade baixa para textos diferentes', () => {
    expect(jaccard(tokenize('pregão eletrônico'), tokenize('dispensa de licitação'))).toBeLessThan(0.3);
  });

  it('contenção = 1 quando o texto da página está inteiro no banco (mesmo com boilerplate extra)', () => {
    const pagina = tokenize('a vigência do contrato de serviço contínuo');
    const bancoComBoilerplate = tokenize('Redação dada pela Portaria 174. a vigência do contrato de serviço contínuo. Referência: art 105. Fonte: DOU');
    expect(containment(pagina, bancoComBoilerplate)).toBe(1);
  });

  it('contenção cai quando a página traz texto novo ausente do banco', () => {
    const paginaNova = tokenize('novo entendimento sobre credenciamento eletrônico e inexigibilidade superveniente');
    const bancoAntigo = tokenize('a vigência do contrato de serviço contínuo de fornecimento');
    expect(containment(paginaNova, bancoAntigo)).toBeLessThan(0.75);
  });
});

describe('diffOns', () => {
  const page: PageON[] = [
    { key: '107/2026', onNumber: 107, onYear: 2026, enunciado: 'No regime da Lei 14.133 os serviços de engenharia consultiva são técnicos especializados de natureza intelectual', douUrl: 'x' },
    { key: '108/2026', onNumber: 108, onYear: 2026, enunciado: 'Uma orientação normativa completamente nova sobre credenciamento e procedimentos auxiliares da administração', douUrl: 'x' },
    { key: '104/2026', onNumber: 104, onYear: 2026, enunciado: 'ON de tema de pessoal excluída de propósito do acervo', douUrl: 'x' },
  ];
  const db: DbON[] = [
    { key: '107/2026', isPublic: true, content: 'No regime da Lei 14.133 os serviços de engenharia consultiva são técnicos especializados de natureza intelectual' },
    { key: '50/2014', isPublic: true, content: 'Texto da ON 50 que não está mais na página atual' },
    { key: '1/2016', isPublic: true, content: '' }, // known-absent da CNU
  ];

  it('detecta ON nova na página (ausente no banco)', () => {
    expect(diffOns(page, db).novasNaPagina).toEqual(['108/2026']);
  });

  it('NÃO sinaliza as ONs excluídas a pedido (104/106) como novas', () => {
    expect(diffOns(page, db).novasNaPagina).not.toContain('104/2026');
  });

  it('não acusa redação alterada quando o texto do banco é igual ao da página', () => {
    expect(diffOns(page, db).redacaoAlterada).toHaveLength(0);
  });

  it('acusa redação alterada quando o enunciado do banco diverge do da página', () => {
    const dbAlterado: DbON[] = [
      { key: '107/2026', isPublic: true, content: 'Redação totalmente diferente falando sobre outro assunto qualquer sem relação com engenharia consultiva ou serviços técnicos' },
    ];
    const diff = diffOns(page, dbAlterado);
    expect(diff.redacaoAlterada.map((r) => r.key)).toContain('107/2026');
  });

  it('lista ausentes da página mas ignora as sabidamente ausentes (CNU/revogadas)', () => {
    const diff = diffOns(page, db);
    expect(diff.ausentesDaPagina).toContain('50/2014');
    expect(diff.ausentesDaPagina).not.toContain('1/2016');
  });
});
