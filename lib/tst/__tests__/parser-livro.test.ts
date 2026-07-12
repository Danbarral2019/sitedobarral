// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseLivroBlock, parseLivroText, splitLivroBlocks } from '../parser-livro';

// Fixtures extraídos do RTF real (Res. 225/2025, DEJT 30/6, 1º e 2/7/2025).
// Mantemos a formatação original com TAB no header e quebras de linha.

const SUM_1 = `SUM-1\tPRAZO JUDICIAL (mantida) – Res. 121/2003, DJ 19, 20 e 21.11.2003.
Quando a intimação tiver lugar na sexta-feira, ou a publicação com efeito de intimação for feita nesse dia, o prazo judicial será contado da segunda-feira imediata, inclusive, salvo se não houver expediente, caso em que fluirá no dia útil que se seguir.
Histórico:
Redação original - RA 28/1969, DO-GB 21.08.1969`;

// Súmula 6 (EQUIPARAÇÃO SALARIAL) com itens cancelados — formato 2025
const SUM_6 = `SUM-6\tEQUIPARAÇÃO SALARIAL. ART. 461 DA CLT (itens I, II, VI, alínea "b", e item X cancelados por perda de eficácia a partir de 11/11/2017, pela Lei 13.467/2017)  –  Res. 225/2025, DEJT divulgado em 30.06, 01 e 02.07.2025
I - Para os fins previstos no § 2º do art. 461 da CLT, só é válido o quadro de pessoal organizado em carreira quando homologado pelo Ministério do Trabalho. (item cancelado por perda de eficácia a partir de 11.11.2017, pela Lei 13.467/2017) – Res. 225/2025, DEJT divulgado em 30.06, 01 e 02.07.2025
II - Para efeito de equiparação de salários em caso de trabalho igual, conta-se o tempo de serviço na função. (item cancelado por perda de eficácia a partir de 11.11.2017, pela Lei 13.467/2017) – Res. 225/2025, DEJT divulgado em 30.06, 01 e 02.07.2025
III – A equiparação salarial só é possível se o empregado e o paradigma exercerem a mesma função.
Histórico:
Súmula mantida - Res. 121/2003, DJ 19, 20 e 21.11.2003`;

// Súmula 331 (CONTRATO DE PRESTAÇÃO DE SERVIÇOS — terceirização) — exemplo
// de ALTERADA com item I cancelado e itens VI em "VI –" com en dash
const SUM_331 = `SUM-331\tCONTRATO DE PRESTAÇÃO DE SERVIÇOS. LEGALIDADE (item I cancelado por perda de eficácia a partir de 11.11.2017, pela Lei 13.467/2017) – Res. 225/2025, DEJT divulgado em 30.06, 01 e 02.07.2025
I - A contratação de trabalhadores por empresa interposta é ilegal, formando-se o vínculo diretamente com o tomador dos serviços. (item I cancelado por perda de eficácia a partir de 11.11.2017, pela Lei 13.467/2017) – Res. 225/2025
II - A contratação irregular de trabalhador, mediante empresa interposta, não gera vínculo de emprego com os órgãos da Administração Pública (art. 37, II, da CF/1988).
V - Os entes integrantes da Administração Pública direta e indireta respondem subsidiariamente, nas mesmas condições do item IV, caso evidenciada a sua conduta culposa no cumprimento das obrigações da Lei n.º 8.666, de 21.06.1993, especialmente na fiscalização do cumprimento das obrigações contratuais e legais.
VI – A responsabilidade subsidiária do tomador de serviços abrange todas as verbas decorrentes da condenação referentes ao período da prestação laboral.
Histórico:
Súmula alterada (inciso IV) - Res. 96/2000, DJ 18, 19 e 20.09.2000`;

// Súmula 437 cancelada inteira
const SUM_437 = `SUM-437\tINTERVALO INTRAJORNADA PARA REPOUSO E ALIMENTAÇÃO. APLICAÇÃO DO ART. 71 DA CLT. (cancelada por perda de eficácia a partir de 11.11.2017, pela Lei 13.467/2017) – Res. 225/2025
I - Após a edição da Lei nº 8.923/94, a não concessão ou a concessão parcial do intervalo intrajornada mínimo implica o pagamento total do período.
Histórico:
Redação original`;

// OJ TP/OE-1 — formato sem situação inline (= CRIADA)
const OJ_TPOE_1 = `OJ-TP/OE-1\tPRECATÓRIO. CRÉDITO TRABALHISTA. PEQUENO VALOR. EMENDA CONSTITUCIONAL Nº 37/2002 (DJ 09.12.2003)
Há dispensa da expedição de precatório, na forma do art. 100, § 3º, da CF/1988, quando a execução contra a Fazenda Pública não exceder os valores definidos.`;

// OJ SBDI-1 cancelada
const OJ_SDI1_31 = `OJ-SDI1-31\tDEPÓSITO RECURSAL E CUSTAS. EMPRESA EM LIQUIDAÇÃO EXTRAJUDICIAL. SÚMULA Nº 86. NÃO PERTINÊNCIA (cancelada em decorrência da nova redação conferida à Súmula nº 86) - Res. 129/2005, DJ 20, 22 e 25.04.2005
Histórico:
Inserida em 14.03.1994`;

// OJ SBDI-1 Transitória inserida
const OJ_SDI1T_1 = `OJ-SDI1T-1\tFGTS. MULTA DE 40%. COMPLEMENTAÇÃO. INDEVIDA (inserido dispositivo) - Res. 129/2005, DJ 20, 22 e 25.04.2005
A rescisão contratual operada antes da vigência da Constituição Federal de 1988, com o pagamento da multa sobre os depósitos do FGTS no percentual de 10%, é ato jurídico perfeito.
Histórico:
Redação original do título - Inserida em 02.10.1997`;

// OJ SDC cancelada com letra minúscula no título (formato comum em SDC)
const OJ_SDC_1 = `OJ-SDC-1\tAcordo coletivo. Descumprimento. Existência de ação própria. Abusividade da greve deflagrada para substituí-la. Inserida em 27.03.1998 (cancelada) - DJ 22.06.2004
O ordenamento legal vigente assegura a via da ação de cumprimento para as hipóteses de inobservância de norma coletiva em vigor.`;

// Precedente Normativo cancelado
const PN_1 = `PN-1\t\tANTECIPAÇÃO SALARIAL TRIMESTRAL (negativo) – (cancelado pela SDC em sessão de 14.09.1998 - homologação Res. 86/1998, DJ 15.10.1998)
Não se concede antecipação salarial trimestral.`;

describe('splitLivroBlocks', () => {
  it('separa múltiplos blocos de várias séries', () => {
    const text = [SUM_1, OJ_TPOE_1, OJ_SDI1_31, PN_1].join('\n');
    const blocks = splitLivroBlocks(text);
    expect(blocks.size).toBe(4);
    expect(blocks.has('SUM-1')).toBe(true);
    expect(blocks.has('OJ-TP/OE-1')).toBe(true);
    expect(blocks.has('OJ-SDI1-31')).toBe(true);
    expect(blocks.has('PN-1')).toBe(true);
  });
});

describe('parseLivroBlock — Súmula CRIADA simples', () => {
  const p = parseLivroBlock(SUM_1, 'https://example.tst/sum-1');
  it('identifica série, número, rótulo', () => {
    expect(p.serie).toBe('sumula');
    expect(p.numero).toBe(1);
    expect(p.rotulo).toBe('SUM-1');
  });
  it('título limpo (sem situação inline)', () => {
    expect(p.titulo).toBe('PRAZO JUDICIAL');
  });
  it('situação CRIADA (mantida)', () => {
    expect(p.situacao).toBe('CRIADA');
    expect(p.situacaoMotivo).toBe('mantida');
  });
  it('tese palavra-por-palavra', () => {
    expect(p.tese).toContain('Quando a intimação tiver lugar na sexta-feira');
    expect(p.tese).toContain('fluirá no dia útil que se seguir.');
  });
  it('histórico extraído', () => {
    expect(p.historico.length).toBeGreaterThan(0);
    expect(p.historico[0].texto).toContain('Redação original');
  });
  it('url preservada do parâmetro', () => {
    expect(p.url).toBe('https://example.tst/sum-1');
  });
});

describe('parseLivroBlock — Súmula ALTERADA com itens cancelados', () => {
  const p = parseLivroBlock(SUM_6);
  it('situação ALTERADA (subset de itens cancelados)', () => {
    expect(p.situacao).toBe('ALTERADA');
    expect(p.situacaoMotivo).toContain('itens I, II');
  });
  it('itens romanos com flag cancelled em I e II', () => {
    expect(p.itens.length).toBe(3);
    const i = p.itens.find((x) => x.ordem === 'I')!;
    const ii = p.itens.find((x) => x.ordem === 'II')!;
    const iii = p.itens.find((x) => x.ordem === 'III')!;
    expect(i.cancelled).toBe(true);
    expect(ii.cancelled).toBe(true);
    expect(iii.cancelled).toBe(false);
  });
  it('cltArticles inclui 461', () => {
    expect(p.cltArticles).toContain('461');
  });
});

describe('parseLivroBlock — Súmula 331 (terceirização, item I cancelado)', () => {
  const p = parseLivroBlock(SUM_331);
  it('situação ALTERADA (subset cancelado)', () => {
    expect(p.situacao).toBe('ALTERADA');
  });
  it('detecta 4 itens, item I cancelado, item V citando Lei 8.666 e fiscalização', () => {
    expect(p.itens.length).toBe(4);
    expect(p.itens[0].cancelled).toBe(true);
    const v = p.itens.find((x) => x.ordem === 'V');
    expect(v).toBeDefined();
    expect(v!.texto).toContain('Lei n.º 8.666');
    expect(v!.texto).toContain('fiscalização do cumprimento');
  });
  it('item VI com en dash é detectado', () => {
    const vi = p.itens.find((x) => x.ordem === 'VI');
    expect(vi).toBeDefined();
  });
});

describe('parseLivroBlock — Súmula CANCELADA inteira', () => {
  const p = parseLivroBlock(SUM_437);
  it('situação CANCELADA', () => {
    expect(p.situacao).toBe('CANCELADA');
    expect(p.situacaoMotivo).toContain('cancelada por perda de eficácia');
  });
  it('itens preservados por valor histórico', () => {
    expect(p.itens.length).toBe(1);
    expect(p.itens[0].cancelled).toBe(false); // a súmula inteira foi cancelada, mas o item em si não tem marca individual
  });
});

describe('parseLivroBlock — OJ TP/OE', () => {
  const p = parseLivroBlock(OJ_TPOE_1);
  it('identifica série oj-tp-oe', () => {
    expect(p.serie).toBe('oj-tp-oe');
    expect(p.rotulo).toBe('OJ-TP/OE-1');
  });
  it('situação CRIADA (sem indicação explícita = default)', () => {
    expect(p.situacao).toBe('CRIADA');
  });
});

describe('parseLivroBlock — OJ-SDI1 cancelada', () => {
  const p = parseLivroBlock(OJ_SDI1_31);
  it('identifica série oj-sdi1', () => {
    expect(p.serie).toBe('oj-sdi1');
    expect(p.numero).toBe(31);
  });
  it('situação CANCELADA', () => {
    expect(p.situacao).toBe('CANCELADA');
  });
});

describe('parseLivroBlock — OJ-SDI1T (Transitória)', () => {
  const p = parseLivroBlock(OJ_SDI1T_1);
  it('identifica série oj-sdi1t', () => {
    expect(p.serie).toBe('oj-sdi1t');
    expect(p.numero).toBe(1);
    expect(p.rotulo).toBe('OJ-SDI1T-1');
  });
});

describe('parseLivroBlock — OJ-SDC', () => {
  const p = parseLivroBlock(OJ_SDC_1);
  it('identifica série oj-sdc', () => {
    expect(p.serie).toBe('oj-sdc');
    expect(p.situacao).toBe('CANCELADA');
  });
});

describe('parseLivroBlock — Precedente Normativo', () => {
  const p = parseLivroBlock(PN_1);
  it('identifica série pn', () => {
    expect(p.serie).toBe('pn');
    expect(p.rotulo).toBe('PN-1');
  });
  it('detecta cancelamento da SDC', () => {
    expect(p.situacao).toBe('CANCELADA');
  });
});

describe('parseLivroText — integração com mapa de URLs', () => {
  it('ordena resultados por série e número, aplicando URLs', () => {
    const text = [SUM_1, SUM_6, OJ_TPOE_1, OJ_SDI1_31, OJ_SDI1T_1, OJ_SDC_1, PN_1].join('\n');
    const urls = new Map<string, string>([
      ['SUM-1', 'https://example/sum-1'],
      ['PN-1', 'https://example/pn-1'],
    ]);
    const all = parseLivroText(text, urls);
    expect(all.length).toBe(7);
    // ordenação esperada: sumula → oj-tp-oe → oj-sdi1 → oj-sdi1t → oj-sdc → pn
    expect(all[0].serie).toBe('sumula');
    expect(all[all.length - 1].serie).toBe('pn');
    // URLs aplicadas onde batem
    expect(all.find((b) => b.rotulo === 'SUM-1')!.url).toBe('https://example/sum-1');
    expect(all.find((b) => b.rotulo === 'PN-1')!.url).toBe('https://example/pn-1');
    // Sem URL para outros
    expect(all.find((b) => b.rotulo === 'OJ-TP/OE-1')!.url).toBeNull();
  });
});

describe('parseLivroBlock — situação REVISTA', () => {
  it('detecta status "(revista)" no cabeçalho', () => {
    const bloco = `SUM-100\tTÍTULO QUALQUER (revista) – Res. 10/2010, DJ 01.01.2010
Tese da súmula revista.
Histórico:
Redação original - RA 1/1970`;
    const p = parseLivroBlock(bloco);
    expect(p.situacao).toBe('REVISTA');
    expect(p.situacaoMotivo).toBe('revista');
  });
});

describe('parseLivroBlock — extração de referências legais', () => {
  it('extrai e ordena artigos da Lei 14.133 citados', () => {
    const bloco = `SUM-200\tCONTRATAÇÃO PÚBLICA – Res. 20/2020
Aplica-se a Lei 14.133, art. 18, bem como a Lei 14.133, art. 6, à espécie.
Histórico:
Redação original`;
    const p = parseLivroBlock(bloco);
    // Set deduplica e o retorno vem ordenado numericamente
    expect(p.leiArticles).toEqual(['6', '18']);
  });

  it('extrai e ordena artigos da CLT, com desempate por localeCompare', () => {
    const bloco = `SUM-201\tJORNADA. ART. 71 DA CLT
Conforme o art. 71 da CLT e o art. 461 da CLT, além do art. 461-A da CLT.
Histórico:
Redação original`;
    const p = parseLivroBlock(bloco);
    // Ordena numericamente (71 < 461) e, no empate 461 vs 461-A, por localeCompare
    expect(p.cltArticles).toEqual(['71', '461', '461-A']);
  });
});

describe('parseLivroBlock — bloco inválido', () => {
  it('lança erro quando o cabeçalho não casa o padrão', () => {
    expect(() => parseLivroBlock('linha sem rótulo válido\ncorpo qualquer')).toThrow(
      /bloco sem cabeçalho válido/,
    );
  });
});

describe('parseLivroBlock — bloco de uma linha (sem corpo)', () => {
  it('trata cabeçalho sem quebra de linha (rest vazio)', () => {
    const p = parseLivroBlock('SUM-300\tTÍTULO CURTO – Res. 30/2030, DJ 01.01.2030');
    expect(p.rotulo).toBe('SUM-300');
    expect(p.tese).toBe('');
    expect(p.itens).toEqual([]);
    expect(p.historico).toEqual([]);
  });
});

describe('splitLivroBlocks — dedup mantém o bloco mais longo', () => {
  it('quando o mesmo rótulo aparece duas vezes, guarda o trecho maior', () => {
    const curto = `SUM-400\tref curta`;
    const longo = `SUM-400\tVERSÃO COMPLETA E MAIS LONGA DO MESMO VERBETE – Res. 40/2040
Tese detalhada com bastante conteúdo para superar o comprimento do bloco curto.`;
    // O bloco longo aparece depois; o dedup deve preferi-lo por ser maior.
    const map = splitLivroBlocks(`${curto}\n${longo}`);
    expect(map.size).toBe(1);
    expect(map.get('SUM-400')!.length).toBeGreaterThan(curto.length);
  });

  it('não substitui quando o bloco repetido é menor que o já guardado', () => {
    const curto = `SUM-401\tref curta`;
    const longo = `SUM-401\tVERSÃO COMPLETA E MAIS LONGA DO MESMO VERBETE – Res. 40/2040
Tese detalhada com bastante conteúdo para superar o comprimento do bloco curto.`;
    // Agora o longo vem primeiro; o curto seguinte não deve sobrescrevê-lo.
    const map = splitLivroBlocks(`${longo}\n${curto}`);
    expect(map.size).toBe(1);
    expect(map.get('SUM-401')!).toContain('VERSÃO COMPLETA');
  });
});
