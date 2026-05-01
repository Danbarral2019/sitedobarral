// @vitest-environment node

import { describe, it, expect } from 'vitest';
import {
  collapseWhitespace,
  stripDouBoilerplate,
  stripFormAnnex,
  stripGovbrUiNoise,
  stripZeroWidthChars,
  dedupeBoilerplateFooter,
  normalizeScrapedText,
} from '../../lib/legislative-scrapers/normalize';

describe('collapseWhitespace', () => {
  it('colapsa múltiplas quebras de linha em \\n\\n', () => {
    expect(collapseWhitespace('A\n\n\n\nB')).toBe('A\n\nB');
  });

  it('trata linhas com apenas espaços como vazias', () => {
    expect(collapseWhitespace('A\n   \n   \nB')).toBe('A\n\nB');
  });

  it('trata linhas com NBSP (\\u00A0) como vazias', () => {
    expect(collapseWhitespace('A\n\u00A0\n\u00A0\nB')).toBe('A\n\nB');
  });

  it('preserva parágrafos separados por uma linha em branco', () => {
    expect(collapseWhitespace('A\n\nB')).toBe('A\n\nB');
  });

  it('colapsa espaços múltiplos em 1', () => {
    expect(collapseWhitespace('A    B')).toBe('A B');
  });

  it('converte NBSP (\\u00A0) inline para espaço comum', () => {
    expect(collapseWhitespace('A B')).toBe('A B');
  });

  it('colapsa runs mistos de espaço/tab/NBSP em 1 espaço', () => {
    expect(collapseWhitespace('A \t  B')).toBe('A B');
  });

  it('remove espaços nas bordas de cada linha', () => {
    expect(collapseWhitespace('  A  \n  B  ')).toBe('A\nB');
  });

  it('trim final', () => {
    expect(collapseWhitespace('\n\nA\n\n')).toBe('A');
  });
});

describe('stripDouBoilerplate', () => {
  const sample = `Brasão do Brasil

Diário Oficial da União

 Publicado em:
 30/07/2025
 |

 Edição:
 142
 |

 Seção: 1
 |

 Página:
 140

 Órgão:
 Ministério da Gestão e da Inovação em Serviços Públicos/Secretaria de Governo Digital

Instrução Normativa SGD/MGI Nº 86, DE 25 DE JULHO DE 2025

Altera a Instrução Normativa SGD/MGI nº 6, de 29 de março de 2023...

Art. 3º Esta Instrução Normativa entra em vigor em 1º de agosto de 2025.

ROGÉRIO SOUZA MASCARENHAS

Este conteúdo não substitui o publicado na versão certificada.

 Borda do rodapé

 Logo da Imprensa`;

  it('remove masthead com "Brasão do Brasil" até fim da linha "Órgão:..."', () => {
    const out = stripDouBoilerplate(sample);
    expect(out).not.toContain('Brasão do Brasil');
    expect(out).not.toContain('Diário Oficial da União');
    expect(out).not.toContain('Secretaria de Governo Digital');
  });

  it('remove footer "Borda do rodapé" e "Logo da Imprensa"', () => {
    const out = stripDouBoilerplate(sample);
    expect(out).not.toContain('Borda do rodapé');
    expect(out).not.toContain('Logo da Imprensa');
  });

  it('preserva "Este conteúdo não substitui" (rodapé DOU legítimo)', () => {
    const out = stripDouBoilerplate(sample);
    expect(out).toContain('Este conteúdo não substitui');
  });

  it('preserva o texto normativo propriamente dito', () => {
    const out = stripDouBoilerplate(sample);
    expect(out).toContain('Instrução Normativa SGD/MGI Nº 86');
    expect(out).toContain('Art. 3º Esta Instrução Normativa');
    expect(out).toContain('ROGÉRIO SOUZA MASCARENHAS');
  });

  it('é no-op quando não há marker de masthead', () => {
    const plainText = 'Art. 1º Esta é uma norma.\n\nArt. 2º Segue a regra.';
    expect(stripDouBoilerplate(plainText)).toBe(plainText);
  });
});

describe('stripFormAnnex', () => {
  it('corta a partir da primeira ocorrência de "<NOME DO FISCAL TECNICO>"', () => {
    const input = 'Art. 1º Conteúdo.\n\nArt. 2º Mais conteúdo.\n\nDocumento assinado eletronicamente\n<NOME DO FISCAL TECNICO>\nFiscal Técnico';
    const out = stripFormAnnex(input);
    expect(out).toContain('Art. 1º Conteúdo.');
    expect(out).toContain('Art. 2º Mais conteúdo.');
    expect(out).not.toContain('<NOME DO FISCAL TECNICO>');
    expect(out).not.toContain('Fiscal Técnico');
  });

  it('detecta variações do placeholder', () => {
    const input1 = 'Texto\n<NOME DO GESTOR>\nx';
    const input2 = 'Texto\n<NOME DO PREPOSTO>\nx';
    expect(stripFormAnnex(input1)).not.toContain('<NOME DO GESTOR>');
    expect(stripFormAnnex(input2)).not.toContain('<NOME DO PREPOSTO>');
  });

  it('preserva rodapé DOU se aparecer ANTES do form annex', () => {
    const input = 'Art. 1º Texto.\n\nEste texto não substitui o publicado no DOU\n\nDocumento assinado eletronicamente\n<NOME DO FISCAL TECNICO>';
    const out = stripFormAnnex(input);
    expect(out).toContain('Este texto não substitui');
    expect(out).not.toContain('<NOME DO FISCAL TECNICO>');
  });

  it('é no-op quando não há placeholder', () => {
    const input = 'Art. 1º Norma sem anexo.\n\nEste texto não substitui...';
    expect(stripFormAnnex(input)).toBe(input);
  });
});

// ─── stripGovbrUiNoise ────────────────────────────────────────────────────
// Regression: case real reportado pelo user em 2026-04-25 — IN SEGES 412/2025
// e Portaria SGD/MGI 6.680/2024 vinham com "Info" no topo e
// "Compartilhe: / Compartilhe por Facebook ..." no fim.

describe('stripGovbrUiNoise', () => {
  it('remove "Info" solto no topo (breadcrumb Plone)', () => {
    const input = 'Info\n\nINSTRUÇÃO NORMATIVA Nº 1\n\nArt. 1º';
    const out = stripGovbrUiNoise(input);
    expect(out.startsWith('Info')).toBe(false);
    expect(out).toContain('INSTRUÇÃO NORMATIVA');
  });

  it('corta "Compartilhe:" e botões de social no final', () => {
    const input = [
      'Art. 1º Norma A.',
      'Art. 2º Norma B.',
      'Este conteúdo não substitui o publicado no Diário Oficial da União - DOU',
      '',
      'Compartilhe:',
      '',
      'Compartilhe por Facebook',
      'Compartilhe por Twitter',
      'Compartilhe por LinkedIn',
      'Compartilhe por WhatsApp',
      'link para Copiar para área de transferência',
    ].join('\n');
    const out = stripGovbrUiNoise(input);
    expect(out).toContain('Este conteúdo não substitui');
    expect(out).not.toContain('Compartilhe por Facebook');
    expect(out).not.toContain('Compartilhe:');
  });

  it('REGRESSION: NÃO corta o conteúdo todo se "Compartilhe:" aparece no início', () => {
    // Caso real: gov.br/compras renderiza "Compartilhe:" tanto no header
    // quanto no rodapé. Se cortássemos da PRIMEIRA ocorrência, perderíamos
    // o ato inteiro (era esse o bug original detectado em 2026-04-25).
    const input = [
      'Compartilhe:',
      'Compartilhe por Facebook',
      '',
      'INSTRUÇÃO NORMATIVA Nº 5/2017',
      'Art. 1º A presente IN dispõe sobre serviços terceirizados...',
      'Art. 2º Aplicação subsidiária da CLT.',
      'ROBERTO POJO',
      'Este conteúdo não substitui o publicado no DOU',
      '',
      'Compartilhe:',
      'Compartilhe por Facebook',
    ].join('\n');
    const out = stripGovbrUiNoise(input);
    expect(out).toContain('Art. 1º A presente IN');
    expect(out).toContain('ROBERTO POJO');
    expect(out).toContain('Este conteúdo não substitui');
    // O último "Compartilhe:" e abaixo somem
    const matches = out.match(/Compartilhe:/g);
    // Idealmente 0 (corte do final removeu todos), mas se sobrou só o header tudo bem
    expect(matches?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('é no-op quando não há "Info" nem "Compartilhe:"', () => {
    const input = 'Art. 1º Texto normal\n\nArt. 2º Continuação';
    expect(stripGovbrUiNoise(input)).toBe(input);
  });

  it('preserva tamanho do conteúdo quando só remove footer', () => {
    const body = 'Art. 1º '.repeat(200);
    const input = body + '\n\nCompartilhe:\nCompartilhe por Facebook';
    const out = stripGovbrUiNoise(input);
    expect(out.length).toBeGreaterThanOrEqual(body.length - 5);
    expect(out.length).toBeLessThan(input.length);
  });

  it('remove lista de anexos vazada do gov.br (linha com 3+ bullets •)', () => {
    const input =
      'Dispõe sobre as regras...\n\n' +
      '• IN nº 5/2017 - hiperlink• Perguntas e Respostas• Apresentação da IN - ENAP• Apresentação da Planilha de Custos\n\n' +
      'O SECRETÁRIO DE GESTÃO, no uso das atribuições, resolve:';
    const out = stripGovbrUiNoise(input);
    expect(out).not.toContain('• IN nº 5/2017');
    expect(out).not.toContain('Perguntas e Respostas');
    expect(out).toContain('O SECRETÁRIO DE GESTÃO');
    expect(out).toContain('Dispõe sobre as regras');
  });

  it('remove metadados gov.br inline "Publicado em.../Compartilhe:" entre ementa e corpo', () => {
    // Padrão real visto em IN SEGES/MGI 52/2025, IN SEGES 460/2025, Portaria SEGES 15.496/2021
    const input =
      'Dispõe sobre o Sistema de Cadastramento Unificado de Fornecedores (Sicaf), e dá outras providências.' +
      'Publicado em 05/11/2025 09:54' +
      'Modificado em 12/11/2025 16:48' +
      'Compartilhe:' +
      'O SECRETÁRIO DE GESTÃO E INOVAÇÃO, no uso das atribuições, resolve:';
    const out = stripGovbrUiNoise(input);
    expect(out).not.toContain('Publicado em 05/11/2025');
    expect(out).not.toContain('Modificado em 12/11/2025');
    expect(out).not.toContain('Compartilhe');
    expect(out).toContain('Dispõe sobre o Sistema');
    expect(out).toContain('outras providências');
    expect(out).toContain('O SECRETÁRIO DE GESTÃO');
  });

  it('lida com o bloco quando aparece só "Compartilhe:" inline, sem "Publicado em"', () => {
    const input = 'Texto da ementa.Compartilhe:O SECRETÁRIO, resolve:';
    const out = stripGovbrUiNoise(input);
    expect(out).not.toContain('Compartilhe');
    expect(out).toContain('Texto da ementa');
    expect(out).toContain('O SECRETÁRIO');
  });

  it('preserva linha com 1-2 bullets (legítima)', () => {
    const input =
      'I - primeiro item; e\n' +
      '• marcador único usado no texto\n' +
      '• segundo bullet\n' +
      'continuação do parágrafo.';
    const out = stripGovbrUiNoise(input);
    expect(out).toContain('marcador único');
    expect(out).toContain('segundo bullet');
  });
});

describe('stripZeroWidthChars', () => {
  it('remove ZWSP (U+200B)', () => {
    expect(stripZeroWidthChars('contratados;​b)')).toBe('contratados;b)');
  });

  it('remove ZWNJ (U+200C), ZWJ (U+200D), BOM (U+FEFF), WJ (U+2060)', () => {
    expect(stripZeroWidthChars('A‌B‍C﻿D⁠E')).toBe('ABCDE');
  });

  it('remove runs múltiplos do mesmo char invisível', () => {
    expect(stripZeroWidthChars('Dimens​​​​ionamento')).toBe('Dimensionamento');
  });

  it('é no-op em texto sem zero-width chars', () => {
    const input = 'Art. 1º Texto normal sem invisíveis.';
    expect(stripZeroWidthChars(input)).toBe(input);
  });
});

describe('dedupeBoilerplateFooter', () => {
  it('remove ocorrências anteriores e mantém apenas a última', () => {
    const input = [
      'Art. 1º Texto normativo.',
      '',
      'Este texto não substitui o publicado no DOU de 26.10.2021',
      '',
      'Anexo I do ato.',
      '',
      'Este texto não substitui o publicado no DOU de 26.10.2021',
    ].join('\n');
    const out = dedupeBoilerplateFooter(input);
    expect(out).toContain('Anexo I do ato');
    // Apenas 1 ocorrência da frase deve permanecer
    expect(out.match(/Este texto não substitui/g)?.length).toBe(1);
  });

  it('cobre variação que continua na linha de baixo', () => {
    const input = [
      'Conteúdo principal.',
      '',
      'Este texto não substitui o',
      'publicado no DOU de 4.7.2023',
      '',
      'Errata publicada depois.',
      '',
      'Este texto não substitui o',
      'publicado no DOU de 4.7.2023',
    ].join('\n');
    const out = dedupeBoilerplateFooter(input);
    expect(out).toContain('Errata publicada depois');
    expect(out.match(/Este texto não substitui/g)?.length).toBe(1);
  });

  it('é no-op com 0 ou 1 ocorrência', () => {
    const zero = 'Art. 1º Sem rodapé DOU.';
    expect(dedupeBoilerplateFooter(zero)).toBe(zero);
    const one = 'Art. 1º Texto.\n\nEste texto não substitui o publicado no DOU de 1.1.2024';
    expect(dedupeBoilerplateFooter(one)).toBe(one);
  });
});

describe('normalizeScrapedText (pipeline completo)', () => {
  it('retorna string vazia para null/undefined/""', () => {
    expect(normalizeScrapedText(null)).toBe('');
    expect(normalizeScrapedText(undefined)).toBe('');
    expect(normalizeScrapedText('')).toBe('');
  });

  it('é no-op em texto já limpo', () => {
    const clean = 'Art. 1º Esta Lei dispõe sobre normas gerais.\n\nArt. 2º Aplica-se a todos os entes.';
    expect(normalizeScrapedText(clean)).toBe(clean);
  });

  it('aplica collapseWhitespace + remove "Compartilhe:" em texto gov.br', () => {
    const input = 'Info\n\nArt. 1º   Esta IN aplica-se a contratos.\n\nArt. 2º Norma geral.\n\nCompartilhe: Facebook Twitter LinkedIn';
    const out = normalizeScrapedText(input);
    expect(out).not.toContain('Info');
    expect(out).not.toContain('Compartilhe');
    expect(out).not.toContain('   '); // colapsa runs de 3+ espaços
    expect(out).toContain('Esta IN');
    expect(out).toContain('aplica-se a contratos');
    expect(out).toContain('Norma geral');
  });

  it('remove masthead DOU + footer "Borda do rodapé"', () => {
    const input = 'Brasão do Brasil\nDiário Oficial da União\nPublicado em: 25/04/2026\nÓrgão: Ministério\nPortaria nº 1234, de 25 de abril de 2026\n\nArt. 1º Conteúdo do ato.\n\nBorda do rodapé\nLogo da Imprensa';
    const out = normalizeScrapedText(input);
    expect(out).toContain('Portaria nº 1234');
    expect(out).toContain('Art. 1º Conteúdo do ato');
    expect(out).not.toContain('Brasão do Brasil');
    expect(out).not.toContain('Borda do rodapé');
  });

  it('preserva "Este conteúdo não substitui..."', () => {
    const input = 'Art. 1º Norma X.\n\nEste conteúdo não substitui o publicado no Diário Oficial.\n\nCompartilhe: Facebook';
    const out = normalizeScrapedText(input);
    expect(out).toContain('Este conteúdo não substitui');
    expect(out).not.toContain('Compartilhe');
  });

  it('é idempotente — aplicar duas vezes dá o mesmo resultado', () => {
    const input = 'Info\n\nArt. 1º  Texto.\n\n\n\nCompartilhe: X';
    const once = normalizeScrapedText(input);
    const twice = normalizeScrapedText(once);
    expect(twice).toBe(once);
  });

  it('converte NBSP inline para espaço comum no pipeline', () => {
    const input = 'Art. 1º Esta IN aplica-se a contratos.';
    const out = normalizeScrapedText(input);
    expect(out).not.toMatch(/ /);
    expect(out).toBe('Art. 1º Esta IN aplica-se a contratos.');
  });

  it('remove zero-width chars no pipeline', () => {
    const input = 'Art. 8º Previamente​ ao pagamento';
    const out = normalizeScrapedText(input);
    expect(out).toBe('Art. 8º Previamente ao pagamento');
    expect(out).not.toMatch(/[​‌‍﻿⁠]/);
  });

  it('deduplica rodapé "Este texto não substitui" no pipeline', () => {
    const input = [
      'Art. 1º Texto da lei.',
      '',
      'Este texto não substitui o publicado no DOU de 16.9.2024',
      '',
      'Anexo posterior.',
      '',
      'Este texto não substitui o publicado no DOU de 16.9.2024',
    ].join('\n');
    const out = normalizeScrapedText(input);
    expect(out.match(/Este texto não substitui/g)?.length).toBe(1);
    expect(out).toContain('Anexo posterior');
  });
});
