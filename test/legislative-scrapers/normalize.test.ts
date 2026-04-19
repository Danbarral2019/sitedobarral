// @vitest-environment node

import { describe, it, expect } from 'vitest';
import {
  collapseWhitespace,
  stripDouBoilerplate,
  stripFormAnnex,
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
