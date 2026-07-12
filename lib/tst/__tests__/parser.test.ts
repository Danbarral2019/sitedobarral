// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseSumulaBlock, parseTstSumulas, splitIntoSumulaBlocks } from '../parser';

const SUMULA_1 = `Súmula nº 1 do TST
PRAZO JUDICIAL.
Observação: (mantida) - Res. 121/2003, DJ 19, 20 e 21.11.2003Tese: Quando a intimação tiver
lugar na sexta-feira, ou a publicação com efeito de intimação for feita nesse dia, o prazo judicial
será contado da segunda-feira imediata, inclusive, salvo se não houver expediente, caso em que
fluirá no dia útil que se seguir.Situação: CRIADA
Inteiro teor no formato HTML
`;

const SUMULA_6 = `Súmula nº 6 do TST
EQUIPARAÇÃO SALARIAL. ART. 461 DA CLT.
Observação: Itens I, II, VI, alínea "b", e item X cancelados por perda de eficácia a partir de
11.11.2017, pela Lei 13.467/2017, Res. 225/2025 ¿ DEJT divulgado em 30.06, 01 e
02.07.2025Tese: <s>I - Para os fins previstos no § 2º do art. 461 da CLT, só é válido o quadro de
pessoal organizado em carreira quando homologado pelo Ministério do Trabalho, excluindo-se,
apenas, dessa exigência o quadro de carreira das entidades de direito público da administração
direta, autárquica e fundacional aprovado por ato administrativo da autoridade competente.</s>
(item cancelado por perda de eficácia a partir de 11/11/2017, pela Lei 13.467/2017, Res.
225/2025 ¿ DEJT divulgado em 30.06, 01 e 02.07.2025)
<s>II - Para efeito de equiparação de salários em caso de trabalho igual, conta-se o tempo de
serviço na função e não no emprego.</s> (item cancelado por perda de eficácia a partir de
11/11/2017, pela Lei 13.467/2017, Res. 225/2025 ¿ DEJT divulgado em 30.06, 01 e 02.07.2025)
III - A equiparação salarial só é possível se o empregado e o paradigma exercerem a mesma
função, desempenhando as mesmas tarefas, não importando se os cargos têm, ou não, a
mesma denominação. (ex-OJ da SBDI-1 nº 328 - DJ 09.12.2003).
IV - É desnecessário que, ao tempo da reclamação sobre equiparação salarial, reclamante e
paradigma estejam a serviço do estabelecimento, desde que o pedido se relacione com situação
pretérita. (ex-Súmula nº 22 - RA 57/1970, DO-GB 27.11.1970).Situação: ALTERADA
Inteiro teor no formato HTML
`;

const SUMULA_8 = `Súmula nº 8 do TST
JUNTADA DE DOCUMENTO.
Observação: (mantida - Res. 121/2003, DJ 19, 20 e 21.11.2003). - <b>Entendimento reafirmado
no IRR nº 286.<br>IRR-286 JUNTADA DE DOCUMENTO NA FASE RECURSAL.
(RR-0010013-87.2024.5.03.0073, Tribunal Pleno, publicado em 03.09.2025, rel. Min. Aloysio Silva
Corrêa da Veiga)</b><br>A juntada de documentos na fase recursal só se justifica quando
provado o justo impedimento para sua oportuna apresentação ou se referir a fato posterior à
sentença.Tese: A juntada de documentos na fase recursal só se justifica quando provado o justo
impedimento para sua oportuna apresentação ou se referir a fato posterior à sentença.Situação:
CRIADA
Inteiro teor no formato HTML
`;

const SUMULA_331 = `Súmula nº 331 do TST
CONTRATO DE PRESTAÇÃO DE SERVIÇOS. LEGALIDADE.
Observação: Item I cancelado por perda de eficácia a partir de 11.11.2017, pela Lei 13.467/2017.
Res. 225/2025, DEJT divulgado em 30.06, 01 e 02.07.2025Tese: <s>I - A contratação de
trabalhadores por empresa interposta é ilegal, formando-se o vínculo diretamente com o
tomador dos serviços, salvo no caso de trabalho temporário (Lei nº 6.019, de 03.01.1974).</s>
(item I cancelado por perda de eficácia a partir de 11.11.2017, pela Lei 13.467/2017. Res.
225/2025, DEJT divulgado em 30.06, 01 e 02.07.2025)
II - A contratação irregular de trabalhador, mediante empresa interposta, não gera vínculo de
emprego com os órgãos da Administração Pública direta, indireta ou fundacional (art. 37, II, da
CF/1988).
III - Não forma vínculo de emprego com o tomador a contratação de serviços de vigilância (Lei
nº 7.102, de 20.06.1983) e de conservação e limpeza, bem como a de serviços especializados
ligados à atividade-meio do tomador, desde que inexistente a pessoalidade e a subordinação
direta.
IV - O inadimplemento das obrigações trabalhistas, por parte do empregador, implica a
responsabilidade subsidiária do tomador dos serviços quanto àquelas obrigações, desde que
haja participado da relação processual e conste também do título executivo judicial.
V - Os entes integrantes da Administração Pública direta e indireta respondem subsidiariamente,
nas mesmas condições do item IV, caso evidenciada a sua conduta culposa no cumprimento
das obrigações da Lei n.º 8.666, de 21.06.1993, especialmente na fiscalização do cumprimento
das obrigações contratuais e legais da prestadora de serviço como empregadora. A aludida
responsabilidade não decorre de mero inadimplemento das obrigações trabalhistas assumidas
pela empresa regularmente contratada.
VI - A responsabilidade subsidiária do tomador de serviços abrange todas as verbas decorrentes
da condenação referentes ao período da prestação laboral.Situação: ALTERADA
Inteiro teor no formato HTML
`;

const SUMULA_437 = `Súmula nº 437 do TST
INTERVALO INTRAJORNADA PARA REPOUSO E ALIMENTAÇÃO. APLICAÇÃO DO ART. 71 DA CLT.
Observação: Cancelada por perda de eficácia a partir de 11.11.2017, pela Lei 13.467/2017. Res.
225/2025, DEJT divulgado em 30.06, 01 e 02.07.2025Tese: I - Após a edição da Lei nº 8.923/94,
a não-concessão ou a concessão parcial do intervalo intrajornada mínimo, para repouso e
alimentação, a empregados urbanos e rurais, implica o pagamento total do período
correspondente, e não apenas daquele suprimido, com acréscimo de, no mínimo, 50% sobre o
valor da remuneração da hora normal de trabalho (art. 71 da CLT), sem prejuízo do cômputo da
efetiva jornada de labor para efeito de remuneração.
II - É inválida cláusula de acordo ou convenção coletiva de trabalho contemplando a supressão
ou redução do intervalo intrajornada porque este constitui medida de higiene, saúde e segurança
do trabalho, garantido por norma de ordem pública (art. 71 da CLT e art. 7º, XXII, da CF/1988),
infenso à negociação coletiva.
III - Possui natureza salarial a parcela prevista no art. 71, § 4º, da CLT, com redação introduzida
pela Lei nº 8.923, de 27 de julho de 1994, quando não concedido ou reduzido pelo empregador o
intervalo mínimo intrajornada para repouso e alimentação, repercutindo, assim, no cálculo de
outras parcelas salariais.
IV - Ultrapassada habitualmente a jornada de seis horas de trabalho, é devido o gozo do intervalo
intrajornada mínimo de uma hora, obrigando o empregador a remunerar o período para
descanso e alimentação não usufruído como extra, acrescido do respectivo adicional, na forma
prevista no art. 71, caput e § 4º da CLT.Situação: CANCELADA
Inteiro teor no formato HTML
`;

// Súmula mínima: só header + título, sem Observação/Tese/Situação.
const SUMULA_MINIMA = `Súmula nº 900 do TST
TÍTULO MÍNIMO.
Inteiro teor no formato HTML
`;

// Situação fora do conjunto canônico (exercita o fallback heurístico).
const SUMULA_SITUACAO_DESCONHECIDA = `Súmula nº 901 do TST
TÍTULO X.
Observação: (nota) - Res. 10/2010, DJ 01.01.2010Tese: Texto simples da tese.Situação: SUSPENSA
Inteiro teor no formato HTML
`;

// Resolução sem DJ/DEJT (tipo e divulgadoEm nulos).
const SUMULA_RES_SEM_DJ = `Súmula nº 902 do TST
TÍTULO Y.
Observação: (mantida) - Res. 50/2005Tese: Alguma tese aqui.Situação: CRIADA
Inteiro teor no formato HTML
`;

// Dois artigos CLT com mesmo número base (461 e 461-A) para o desempate localeCompare.
const SUMULA_CLT_DESEMPATE = `Súmula nº 903 do TST
JORNADA.
Observação: (mantida) - Res. 20/2020, DJ 01.01.2020Tese: Aplica-se o art. 461 da CLT e também o art. 461-A da CLT ao caso concreto.Situação: CRIADA
Inteiro teor no formato HTML
`;

// Cita Lei 14.133 e dois artigos CLT distintos (exercita extractLeiArticles e
// o ramo na≠nb do sort de extractCltArticles).
const SUMULA_REFS_LEGAIS = `Súmula nº 904 do TST
LICITAÇÃO E JORNADA.
Observação: (mantida) - Res. 30/2030, DJ 01.01.2030Tese: Conforme a Lei nº 14.133, art. 18, e a Lei nº 14.133, art. 6, e ainda o art. 71 da CLT e o art. 461 da CLT, decide-se.Situação: CRIADA
Inteiro teor no formato HTML
`;

// Observação presente, mas SEM "Tese:" (obsEnd cai em Situação).
const SUMULA_OBS_SEM_TESE = `Súmula nº 905 do TST
TÍTULO OBS.
Observação: (cancelada) - Res. 40/2040, DJ 01.01.2040Situação: CANCELADA
Inteiro teor no formato HTML
`;

// "Tese:" presente, mas SEM "Situação:" (teseEnd cai no rodapé).
const SUMULA_TESE_SEM_SITUACAO = `Súmula nº 906 do TST
TÍTULO TESE.
Observação: (mantida) - Res. 50/2050, DJ 01.01.2050Tese: Uma tese sem marcador de situação ao final.
Inteiro teor no formato HTML
`;

describe('parseSumulaBlock — campos ausentes e variações', () => {
  it('súmula mínima (sem Observação/Tese/Situação) usa defaults conservadores', () => {
    const p = parseSumulaBlock(SUMULA_MINIMA, 900, null);
    expect(p.titulo).toBe('TÍTULO MÍNIMO.');
    expect(p.observacao).toBe('');
    expect(p.tese).toBe('');
    expect(p.situacao).toBe('CRIADA'); // default quando não há "Situação:"
    expect(p.situacaoMotivo).toBeNull();
    expect(p.resolucoes).toEqual([]);
    expect(p.ano).toBeNull();
    expect(p.itens).toEqual([]);
    // Markdown cai no ramo "tese única" (sem itens) e sem seções opcionais
    expect(p.fullTextMarkdown).toContain('# Súmula nº 900 do TST');
    expect(p.fullTextMarkdown).not.toContain('## Resoluções');
  });

  it('situação não-canônica cai no default CRIADA', () => {
    const p = parseSumulaBlock(SUMULA_SITUACAO_DESCONHECIDA, 901, null);
    expect(p.situacao).toBe('CRIADA');
  });

  it('resolução sem DJ/DEJT resulta em tipo e divulgadoEm nulos', () => {
    const p = parseSumulaBlock(SUMULA_RES_SEM_DJ, 902, null);
    expect(p.resolucoes.length).toBe(1);
    expect(p.resolucoes[0].numero).toBe('50/2005');
    expect(p.resolucoes[0].tipo).toBeNull();
    expect(p.resolucoes[0].divulgadoEm).toBeNull();
    // No markdown, a resolução aparece sem o sufixo de divulgação
    expect(p.fullTextMarkdown).toContain('- Res. 50/2005');
  });

  it('ordena artigos CLT com desempate por localeCompare (461 vs 461-A)', () => {
    const p = parseSumulaBlock(SUMULA_CLT_DESEMPATE, 903, null);
    expect(p.cltArticles).toEqual(['461', '461-A']);
  });

  it('extrai artigos da Lei 14.133 e ordena CLT com números distintos', () => {
    const p = parseSumulaBlock(SUMULA_REFS_LEGAIS, 904, null);
    // Ordenado numericamente (6 antes de 18) e deduplicado
    expect(p.leiArticles).toEqual(['6', '18']);
    expect(p.cltArticles).toEqual(['71', '461']);
  });

  it('observação sem "Tese:" delimita a observação até "Situação:"', () => {
    const p = parseSumulaBlock(SUMULA_OBS_SEM_TESE, 905, null);
    expect(p.observacao).toContain('cancelada');
    expect(p.tese).toBe('');
    expect(p.situacao).toBe('CANCELADA');
  });

  it('tese sem "Situação:" delimita a tese até o rodapé e usa default CRIADA', () => {
    const p = parseSumulaBlock(SUMULA_TESE_SEM_SITUACAO, 906, null);
    expect(p.tese).toContain('Uma tese sem marcador de situação');
    expect(p.tese).not.toContain('Inteiro teor');
    expect(p.situacao).toBe('CRIADA');
  });
});

describe('splitIntoSumulaBlocks', () => {
  it('separa múltiplas súmulas no mesmo texto', () => {
    const text = `${SUMULA_1}\n${SUMULA_8}\n${SUMULA_331}`;
    const blocks = splitIntoSumulaBlocks(text);
    expect(blocks.size).toBe(3);
    expect(blocks.has(1)).toBe(true);
    expect(blocks.has(8)).toBe(true);
    expect(blocks.has(331)).toBe(true);
  });

  it('preserva o conteúdo bruto de cada bloco', () => {
    const blocks = splitIntoSumulaBlocks(SUMULA_1);
    expect(blocks.get(1)).toContain('PRAZO JUDICIAL');
    expect(blocks.get(1)).toContain('Situação: CRIADA');
  });
});

describe('parseSumulaBlock — Súmula 1 (CRIADA, simples)', () => {
  const p = parseSumulaBlock(SUMULA_1, 1, 'https://example.tst/sumula-1');

  it('extrai número, título e situação corretamente', () => {
    expect(p.numero).toBe(1);
    expect(p.titulo).toBe('PRAZO JUDICIAL.');
    expect(p.situacao).toBe('CRIADA');
    expect(p.url).toBe('https://example.tst/sumula-1');
  });

  it('captura a tese palavra-por-palavra', () => {
    expect(p.tese).toContain('Quando a intimação tiver lugar na sexta-feira');
    expect(p.tese).toContain('fluirá no dia útil que se seguir.');
  });

  it('detecta resolução 121/2003 e ano 2003', () => {
    expect(p.resolucoes.length).toBe(1);
    expect(p.resolucoes[0].numero).toBe('121/2003');
    expect(p.ano).toBe(2003);
  });

  it('sem itens romanos quando a tese é parágrafo único', () => {
    expect(p.itens).toEqual([]);
  });

  it('themes inclui situacao:CRIADA, tst e clt', () => {
    expect(p.themes).toContain('situacao:CRIADA');
    expect(p.themes).toContain('tst');
    expect(p.themes).toContain('clt');
  });
});

describe('parseSumulaBlock — Súmula 6 (ALTERADA com itens cancelados via <s>)', () => {
  const p = parseSumulaBlock(SUMULA_6, 6, null);

  it('detecta título e situação', () => {
    expect(p.titulo).toBe('EQUIPARAÇÃO SALARIAL. ART. 461 DA CLT.');
    expect(p.situacao).toBe('ALTERADA');
  });

  it('extrai 4 itens romanos com flag de cancelados em I e II', () => {
    expect(p.itens.length).toBe(4);
    const i = p.itens.find((x) => x.ordem === 'I')!;
    const ii = p.itens.find((x) => x.ordem === 'II')!;
    const iii = p.itens.find((x) => x.ordem === 'III')!;
    const iv = p.itens.find((x) => x.ordem === 'IV')!;
    expect(i.cancelled).toBe(true);
    expect(ii.cancelled).toBe(true);
    expect(iii.cancelled).toBe(false);
    expect(iv.cancelled).toBe(false);
    expect(i.texto).toContain('Para os fins previstos no § 2º do art. 461 da CLT');
    expect(iii.texto).toContain('equiparação salarial só é possível');
  });

  it('cltArticles inclui 461', () => {
    expect(p.cltArticles).toContain('461');
  });
});

describe('parseSumulaBlock — Súmula 8 (com IRR)', () => {
  const p = parseSumulaBlock(SUMULA_8, 8, null);

  it('extrai IRR nº 286 com RR e relator', () => {
    expect(p.irrs.length).toBe(1);
    const irr = p.irrs[0];
    expect(irr.numero).toBe('286');
    expect(irr.rrNumero).toContain('RR-0010013-87.2024.5.03.0073');
    expect(irr.publicadoEm).toBe('03.09.2025');
    expect(irr.relator).toContain('Aloysio Silva Corrêa da Veiga');
    expect(irr.titulo).toContain('JUNTADA DE DOCUMENTO NA FASE RECURSAL');
  });

  it('tese final é a "Tese:" canônica (não a do IRR)', () => {
    expect(p.tese).toContain('A juntada de documentos na fase recursal só se justifica');
  });
});

describe('parseSumulaBlock — Súmula 331 (terceirização — caso central para licitações)', () => {
  const p = parseSumulaBlock(SUMULA_331, 331, null);

  it('detecta os 6 itens, com item I cancelado', () => {
    expect(p.itens.length).toBe(6);
    expect(p.itens[0].ordem).toBe('I');
    expect(p.itens[0].cancelled).toBe(true);
    expect(p.itens[5].ordem).toBe('VI');
    expect(p.itens[5].cancelled).toBe(false);
  });

  it('item V cita Lei 8.666 e fiscalização — texto preservado integralmente', () => {
    const v = p.itens.find((x) => x.ordem === 'V')!;
    expect(v.texto).toContain('Lei n.º 8.666');
    expect(v.texto).toContain('fiscalização do cumprimento das obrigações');
    expect(v.cancelled).toBe(false);
  });

  it('themes inclui categorias relevantes para licitações', () => {
    expect(p.themes).toContain('contrato-prestacao-servicos');
    expect(p.themes).toContain('terceirizacao');
  });
});

describe('parseSumulaBlock — Súmula 437 (CANCELADA, todos itens)', () => {
  const p = parseSumulaBlock(SUMULA_437, 437, null);

  it('situação CANCELADA', () => {
    expect(p.situacao).toBe('CANCELADA');
  });

  it('mantém todos os 4 itens (texto preservado por valor histórico)', () => {
    expect(p.itens.length).toBe(4);
    // Nenhum item está marcado com <s> aqui — a súmula INTEIRA foi cancelada,
    // mas o texto canônico continua válido como referência histórica.
    expect(p.itens.every((it) => it.cancelled === false)).toBe(true);
    expect(p.itens[0].texto).toContain('Após a edição da Lei nº 8.923/94');
  });

  it('cltArticles inclui 71', () => {
    expect(p.cltArticles).toContain('71');
  });
});

describe('parseTstSumulas — integração múltipla', () => {
  it('parseia 5 súmulas do texto completo com mapa de URLs', () => {
    const txt = [SUMULA_1, SUMULA_6, SUMULA_8, SUMULA_331, SUMULA_437].join('\n');
    const urls = new Map<number, string>([
      [1, 'https://tst.example/1'],
      [331, 'https://tst.example/331'],
    ]);
    const all = parseTstSumulas(txt, urls);
    expect(all.length).toBe(5);
    expect(all[0].numero).toBe(1);
    expect(all[0].url).toBe('https://tst.example/1');
    expect(all[3].numero).toBe(331);
    expect(all[3].url).toBe('https://tst.example/331');
    // Súmula 6 não tem URL no mapa
    expect(all[1].url).toBeNull();
  });
});

describe('fullTextMarkdown — fidelidade', () => {
  it('Súmula 6: itens cancelados aparecem com ~~strikethrough~~ no Markdown', () => {
    const p = parseSumulaBlock(SUMULA_6, 6, null);
    expect(p.fullTextMarkdown).toContain('~~I -');
    expect(p.fullTextMarkdown).toContain('~~II -');
    expect(p.fullTextMarkdown).toContain('- III -');
  });

  it('Súmula 8: IRR aparece como bloco dedicado no Markdown', () => {
    const p = parseSumulaBlock(SUMULA_8, 8, null);
    expect(p.fullTextMarkdown).toContain('## Incidente de Recursos Repetitivos (IRR)');
    expect(p.fullTextMarkdown).toContain('IRR nº 286');
    expect(p.fullTextMarkdown).toContain('RR-0010013-87.2024.5.03.0073');
  });

  it('Súmula 331: tese íntegra com item V citando Lei 8.666 e fiscalização', () => {
    const p = parseSumulaBlock(SUMULA_331, 331, null);
    expect(p.fullTextMarkdown).toMatch(/V -.*Lei n\.º 8\.666/);
    expect(p.fullTextMarkdown).toMatch(/V -.*fiscalização do cumprimento/);
  });
});
