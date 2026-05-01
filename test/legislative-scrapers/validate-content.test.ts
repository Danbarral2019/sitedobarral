// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { validateActContent } from '../../lib/legislative-scrapers/validate-content';

const VALID_CONTENT = `INSTRUÇÃO NORMATIVA Nº 5, DE 26 DE MAIO DE 2017 (Atualizada)

Dispõe sobre as regras e diretrizes do procedimento de contratação de serviços.

O SECRETÁRIO DE GESTÃO DO MINISTÉRIO DO PLANEJAMENTO, no uso das atribuições que lhe confere o Decreto nº 9.035, de 20 de abril de 2017, considerando o disposto na Lei nº 8.666, de 21 de junho de 1993, resolve:

CAPÍTULO I
DISPOSIÇÕES GERAIS

Art. 1º As contratações de serviços observarão, no que couber:
I - as fases de Planejamento, Seleção e Gestão;
II - os critérios e práticas de sustentabilidade.

Art. 2º Para os efeitos desta Instrução Normativa são adotadas as definições constantes do Anexo I.`;

describe('validateActContent', () => {
  describe('happy path', () => {
    it('aceita conteúdo legítimo de IN com URL correta', () => {
      const result = validateActContent({
        url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-5-de-26-de-maio-de-2017-atualizada',
        content: VALID_CONTENT.repeat(3), // garante > MIN_CONTENT_CHARS_WARN
      });
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('URLs problemáticas', () => {
    it('bloqueia URL contendo /perguntas-frequentes/', () => {
      const result = validateActContent({
        url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/perguntas-frequentes/instrucao-normativa-de-servicos-in-no-5-de-2017',
        content: VALID_CONTENT,
      });
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toMatch(/perguntas-frequentes/);
      expect(result.errors.join(' ')).toMatch(/FAQ|legislacao/);
    });

    it('bloqueia URL com /faq/', () => {
      const result = validateActContent({
        url: 'https://www.gov.br/foo/faq/in-5-2017',
        content: VALID_CONTENT,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('conteúdo FAQ disfarçado', () => {
    it('detecta abertura "1 - ASPECTOS GERAIS"', () => {
      const faq = `Instrução Normativa de Serviços - IN nº 5, de 2017

1 - ASPECTOS GERAIS

1.1 - Quais os motivadores para a revisão da Instrução Normativa nº 2, de 2008?
Em 2015, a Secretaria de Gestão (Seges)...`.repeat(20);
      const result = validateActContent({
        url: 'https://example.com/legislacao/in-5',
        content: faq,
      });
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toMatch(/FAQ/);
    });
  });

  describe('conteúdo curto demais', () => {
    it('bloqueia conteúdo abaixo de 500 chars', () => {
      const result = validateActContent({
        content: 'Texto muito curto, provavelmente um redirect quebrado.',
      });
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toMatch(/curto|chars/);
    });

    it('warna conteúdo entre 500 e 1500 chars', () => {
      const shortish = 'A'.repeat(700) + ' Art. 1º Texto. Art. 2º Texto.';
      const result = validateActContent({ content: shortish });
      expect(result.warnings.join(' ')).toMatch(/curto/);
    });

    it('bloqueia conteúdo vazio', () => {
      const result = validateActContent({ content: '' });
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toMatch(/vazio/i);
    });
  });

  describe('preâmbulo legal', () => {
    it('warna quando não detecta preâmbulo legal', () => {
      const noPreamble = 'Lorem ipsum '.repeat(200) + ' fim do texto.';
      const result = validateActContent({ content: noPreamble });
      expect(result.warnings.join(' ')).toMatch(/preâmbulo/);
    });

    it('aceita "O MINISTRO DE ESTADO" como preâmbulo', () => {
      const min = 'Cabeçalho.\n\nO MINISTRO DE ESTADO DA FAZENDA, no uso das atribuições, resolve:\n\nArt. 1º '.repeat(20);
      const result = validateActContent({ content: min });
      const preambleWarn = result.warnings.find((w) => /preâmbulo/.test(w));
      expect(preambleWarn).toBeUndefined();
    });

    it('aceita "Art. 1º" como sinal de preâmbulo presente', () => {
      const art = 'Texto inicial introdutório. ' + 'X'.repeat(700) + '\n\nArt. 1º Esta Lei estabelece normas.\n\nArt. 2º Aplica-se a:';
      const result = validateActContent({ content: art });
      const preambleWarn = result.warnings.find((w) => /preâmbulo/.test(w));
      expect(preambleWarn).toBeUndefined();
    });
  });

  describe('boilerplate residual', () => {
    it('warna se "Compartilhe:" ainda está no texto', () => {
      const result = validateActContent({
        content: VALID_CONTENT + '\n\nCompartilhe:\nFacebook Twitter',
      });
      expect(result.warnings.join(' ')).toMatch(/Compartilhe/);
    });

    it('warna se masthead DOU presente', () => {
      const result = validateActContent({
        content: 'Brasão do Brasil\nDiário Oficial da União\n' + VALID_CONTENT,
      });
      expect(result.warnings.join(' ')).toMatch(/DOU|masthead/i);
    });

    it('warna se form annex presente', () => {
      const result = validateActContent({
        content: VALID_CONTENT + '\n\n<NOME DO FISCAL TECNICO>',
      });
      expect(result.warnings.join(' ')).toMatch(/[Ff]orm annex/);
    });

    it('warna se linha com 3+ bullets vazada', () => {
      const result = validateActContent({
        content:
          VALID_CONTENT.slice(0, 200) +
          '\n• IN nº 5/2017 - hiperlink• Perguntas e Respostas• ENAP• Modelos\n' +
          VALID_CONTENT.slice(200),
      });
      expect(result.warnings.join(' ')).toMatch(/bullets|sidebar/i);
    });
  });

  describe('regressão de tamanho', () => {
    it('warna quando conteúdo novo é menos de 50% do anterior', () => {
      const previous = VALID_CONTENT.repeat(10); // ~10KB
      const current = VALID_CONTENT.repeat(2); // ~2KB
      const result = validateActContent({
        content: current,
        previousContent: previous,
      });
      expect(result.warnings.join(' ')).toMatch(/regressão|tamanho/);
    });

    it('não warna quando conteúdo cresceu', () => {
      const previous = VALID_CONTENT.repeat(2);
      const current = VALID_CONTENT.repeat(10);
      const result = validateActContent({
        content: current,
        previousContent: previous,
      });
      expect(result.warnings.join(' ')).not.toMatch(/regressão/);
    });
  });
});
