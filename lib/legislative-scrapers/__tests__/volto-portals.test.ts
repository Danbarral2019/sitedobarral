// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { blockAwareText, stripGovbrUiNoise } from '../normalize';
import { GovBrComprasScraper } from '../govbr-compras';

/**
 * gov.br/contratamaisbrasil e gov.br/pncp rodam Plone 6 com frontend Volto,
 * que serve o corpo em `#page-document` em vez do `#parent-fieldname-text` do
 * Plone clássico, e emite o meta-bloco de datas num formato próprio
 * ("Publicado em 10/02/2025 10:02Modificado em 15/07/2026 11:59" — hora com
 * ':' em vez de 'h', "Modificado" em vez de "Atualizado", e os dois grudados
 * porque são <span> inline no mesmo <p>).
 */
describe('portais Volto (contratamaisbrasil, pncp)', () => {
  const scraper = new GovBrComprasScraper();

  describe('canHandle', () => {
    it('reconhece gov.br/contratamaisbrasil', () => {
      expect(scraper.canHandle('https://www.gov.br/contratamaisbrasil/pt-br/central-de-conteudo/editais-e-regulamentacao/instrucoes-normativas/instrucao-normativa-seges-mgi-no-52-de-10-de-fevereiro-de-2025')).toBe(true);
    });

    it('reconhece gov.br/pncp', () => {
      expect(scraper.canHandle('https://www.gov.br/pncp/pt-br/pncp/legislacao/portarias-revogadas/portaria-me-no-15-496-de-29-de-dezembro-de-2021-atualizada')).toBe(true);
    });

    it('continua reconhecendo os portais já suportados', () => {
      expect(scraper.canHandle('https://www.gov.br/compras/pt-br/x')).toBe(true);
      expect(scraper.canHandle('https://www.in.gov.br/web/dou/-/x')).toBe(true);
    });

    it('não reconhece domínio alheio', () => {
      expect(scraper.canHandle('https://exemplo.com/gov')).toBe(false);
    });
  });

  /**
   * Várias páginas do gov.br/compras trazem o MESMO id duas vezes (HTML
   * inválido — Plone servindo versão tela + versão print). `$('#id')` casa os
   * dois e o texto sai duplicado: o leitor lê a norma inteira duas vezes, e os
   * embeddings ganham chunks repetidos. Id deve ser único; o primeiro é o
   * canônico. Seletores de classe/tag seguem concatenando, porque ali vários
   * elementos são partes distintas do conteúdo.
   */
  describe('id duplicado no HTML', () => {
    // O corpo precisa passar dos 500 chars do seletor primário; abaixo disso o
    // scraper cai no fallback do <body>, que é outro caminho.
    const bloco = `<div id="parent-fieldname-text">
        <p>Art. 1º Esta Instrução Normativa dispõe sobre a matéria de que trata o Decreto nº 1.094, de 23 de março de 1994, no âmbito da administração pública federal direta, autárquica e fundacional, observados os princípios da legalidade e da eficiência.</p>
        <p>Art. 2º Os órgãos e entidades integrantes do Sistema de Serviços Gerais observarão as diretrizes estabelecidas nesta Instrução Normativa para fins de padronização dos procedimentos internos de contratação, de instrução processual e de designação dos agentes responsáveis pela fiscalização dos contratos administrativos celebrados.</p>
        <p>Art. 3º Entra em vigor na data de sua publicação.</p>
      </div>`;
    const htmlIdDuplicado = `<html><body><div>${bloco}</div><div>${bloco}</div></body></html>`;

    it('não duplica o texto quando o id aparece duas vezes', () => {
      const $ = cheerio.load(htmlIdDuplicado);
      const out = blockAwareText($('#parent-fieldname-text').first());
      expect((out.match(/Art\. 1º Esta Instrução/g) || []).length).toBe(1);
      expect((out.match(/Art\. 3º Entra em vigor/g) || []).length).toBe(1);
    });

    it('o scraper devolve o conteúdo uma única vez', async () => {
      const conteudo = (scraper as unknown as {
        extractContent: (html: string) => string;
      }).extractContent.call(scraper, htmlIdDuplicado);
      expect((conteudo.match(/Art\. 1º Esta Instrução/g) || []).length).toBe(1);
    });
  });

  describe('seletor #page-document', () => {
    it('extrai o corpo servido pelo Volto', () => {
      const $ = cheerio.load(`
        <div id="main"><main><div id="view"><div id="page-document">
          <h1>PORTARIA ME Nº 15.496, DE 29 DE DEZEMBRO DE 2021</h1>
          <p>Designa os membros titulares e suplentes.</p>
          <p>Art. 1º Designar os membros:</p>
          <p>I - representantes da União;</p>
        </div></div></main></div>`);
      const out = blockAwareText($('#page-document'));
      expect(out).toContain('PORTARIA ME Nº 15.496');
      expect(out).toContain('Art. 1º Designar');
      expect(out).not.toContain('suplentes.Art. 1º');
    });
  });

  describe('stripGovbrUiNoise — "Compartilhe:" antes do corpo', () => {
    /**
     * No Volto o bloco de compartilhamento vem logo após os metadados, ANTES
     * do corpo. A heurística de cortar do último "Compartilhe:" em diante era
     * protegida só por "não remover >90%" — numa portaria curta o corte levava
     * 89,7% e passava raspando, decepando os artigos.
     */
    it('não decepa o corpo quando "Compartilhe:" precede os artigos', () => {
      const entrada = [
        'PORTARIA ME Nº 15.496, DE 29 DE DEZEMBRO DE 2021',
        'Designa os membros titulares e suplentes do Comitê Gestor.',
        'Compartilhe:',
        'O MINISTRO DE ESTADO DA ECONOMIA, no uso de suas atribuições, resolve:',
        'Art. 1º Designar os membros titulares e suplentes.',
        'Art. 2º Fica revogada a Portaria de Pessoal nº 9.728.',
        'Art. 3º Esta Portaria entra em vigor na data de sua publicação.',
      ].join('\n');
      const out = stripGovbrUiNoise(entrada);
      expect(out).toContain('Art. 1º Designar');
      expect(out).toContain('Art. 3º Esta Portaria entra em vigor');
      expect(out).not.toMatch(/^\s*Compartilhe\s*:/m);
    });

    it('continua cortando o rodapé real (sem artigos depois)', () => {
      const entrada = [
        'Art. 1º Esta norma dispõe sobre algo relevante para o serviço público.',
        'Art. 2º Esta norma entra em vigor na data de sua publicação.',
        'FULANO DE TAL',
        'Compartilhe:',
        'Compartilhe por Facebook',
        'Compartilhe por Twitter',
        'Outros links do rodapé do portal',
      ].join('\n');
      const out = stripGovbrUiNoise(entrada);
      expect(out).toContain('Art. 2º Esta norma entra em vigor');
      expect(out).not.toContain('Compartilhe por Facebook');
      expect(out).not.toContain('Outros links do rodapé');
    });
  });

  describe('stripGovbrUiNoise — meta-bloco do Volto', () => {
    it('remove "Publicado em ... Modificado em ..." concatenados com hora HH:MM', () => {
      const entrada = [
        'Cria o Contrata+Brasil, plataforma de negócios públicos.',
        'Publicado em 10/02/2025 10:02Modificado em 15/07/2026 11:59',
        'O SECRETÁRIO DE GESTÃO E INOVAÇÃO, resolve:',
      ].join('\n');
      const out = stripGovbrUiNoise(entrada);
      expect(out).not.toContain('Publicado em');
      expect(out).not.toContain('Modificado em');
      expect(out).toContain('Cria o Contrata+Brasil');
      expect(out).toContain('O SECRETÁRIO DE GESTÃO E INOVAÇÃO');
    });

    it('remove "Modificado em" isolado', () => {
      const out = stripGovbrUiNoise('Ementa qualquer.\nModificado em 30/03/2026 10:15\nArt. 1º Algo.');
      expect(out).not.toContain('Modificado em');
      expect(out).toContain('Art. 1º Algo.');
    });

    it('não come corpo do ato que mencione datas', () => {
      const corpo = 'Art. 2º O prazo encerra em 10/02/2025 e o edital foi publicado em 9/2/2025 na forma do art. 5º.';
      expect(stripGovbrUiNoise(corpo)).toContain('Art. 2º O prazo encerra');
    });

    it('preserva o formato antigo já suportado (HHhMM / Atualizado em)', () => {
      const out = stripGovbrUiNoise('Ementa.\nPublicado em 13/09/2024 14h32\nAtualizado em 14/09/2024 10h00\nArt. 1º Algo.');
      expect(out).not.toContain('Publicado em');
      expect(out).not.toContain('Atualizado em');
      expect(out).toContain('Art. 1º Algo.');
    });
  });
});
