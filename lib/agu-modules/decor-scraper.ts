/**
 * AGU DECOR Scraper com Playwright MCP
 *
 * Realiza scraping dos Despachos do Consultor-Geral da União (DECOR)
 * usando Playwright MCP para navegar e extrair dados dinâmicos.
 *
 * URL: https://www.gov.br/agu/pt-br/composicao/cgu/cgu/despachos-do-consultor-geral-da-uniao-decor
 */

import type { AGUDocument } from '@/lib/agu-types';

export interface DECORRaw {
  numero: string;
  ano: number;
  titulo: string;
  ementa: string;
  urlPrincipal: string;
  urlPDF?: string;
  dataPublicacao?: Date;
  assunto?: string;
}

/**
 * IMPORTANTE: Esta função usa Playwright MCP Tools
 *
 * Instruções para scraping com MCP do Playwright
 */
export function getDECORScrapingInstructions(): string {
  return `
# Instruções para Scraping de DECOR (Despachos do Consultor-Geral)

## URL Base
https://www.gov.br/agu/pt-br/composicao/cgu/cgu/despachos-do-consultor-geral-da-uniao-decor

## Passos do Scraping

### 1. Navegar para a página
Use: mcp__playwright__browser_navigate com URL acima

### 2. Aguardar carregamento
Use: mcp__playwright__browser_wait_for com time=3 (segundos)

### 3. Capturar snapshot da página
Use: mcp__playwright__browser_snapshot para ver a estrutura

### 4. Detectar estrutura da listagem
A página pode ter diferentes formatos:
- Tabela HTML com linhas
- Lista de cards/artigos
- Accordion/expansível
- Links diretos

### 5. Extrair lista de DECOR
Use: mcp__playwright__browser_evaluate com função JavaScript:

\`\`\`javascript
() => {
  const decors = [];

  // OPÇÃO 1: Se for tabela
  const rows = document.querySelectorAll('table tr, .table-row');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td, .cell');
    if (cells.length >= 2) {
      const numeroTexto = cells[0]?.textContent?.trim();
      const assunto = cells[1]?.textContent?.trim();
      const link = row.querySelector('a')?.href;

      // Extrair número e ano (ex: "DECOR 123/2024" ou "123/2024")
      const match = numeroTexto?.match(/(?:DECOR)?\\s*(\\d+)[\\/\\-](\\d{4})/i);

      if (match) {
        decors.push({
          numero: match[1],
          ano: parseInt(match[2]),
          titulo: numeroTexto || \`DECOR \${match[1]}/\${match[2]}\`,
          ementa: assunto || '',
          assunto: assunto || '',
          urlPrincipal: link || '',
          urlPDF: row.querySelector('a[href$=".pdf"]')?.href || ''
        });
      }
    }
  });

  // OPÇÃO 2: Se for lista de links
  if (decors.length === 0) {
    const links = document.querySelectorAll('a[href*="decor"], a[href*="despacho"]');
    links.forEach(link => {
      const texto = link.textContent?.trim();
      const match = texto?.match(/(?:DECOR|Despacho)?\\s*(\\d+)[\\/\\-](\\d{4})/i);

      if (match) {
        decors.push({
          numero: match[1],
          ano: parseInt(match[2]),
          titulo: texto || \`DECOR \${match[1]}/\${match[2]}\`,
          ementa: link.getAttribute('title') || '',
          urlPrincipal: link.href,
          urlPDF: link.href.endsWith('.pdf') ? link.href : ''
        });
      }
    });
  }

  // OPÇÃO 3: Se for accordion/expansível
  if (decors.length === 0) {
    const items = document.querySelectorAll('.accordion-item, details, .expandable');
    items.forEach(item => {
      const header = item.querySelector('summary, .accordion-header, h3');
      const content = item.querySelector('.accordion-body, .content');
      const texto = header?.textContent?.trim();
      const match = texto?.match(/(?:DECOR)?\\s*(\\d+)[\\/\\-](\\d{4})/i);

      if (match) {
        decors.push({
          numero: match[1],
          ano: parseInt(match[2]),
          titulo: texto || \`DECOR \${match[1]}/\${match[2]}\`,
          ementa: content?.textContent?.trim() || '',
          urlPrincipal: item.querySelector('a')?.href || window.location.href + '#decor-' + match[1],
          urlPDF: item.querySelector('a[href$=".pdf"]')?.href || ''
        });
      }
    });
  }

  return decors;
}
\`\`\`

### 6. Processar resultados
Para cada DECOR extraído, converter para formato AGUDocument

### 7. Lidar com paginação (se houver)
- Detectar botão "Próxima página" ou "Carregar mais"
- Clicar e repetir passos 2-5
- Continuar até não haver mais páginas

## Estrutura Esperada

A página pode conter DECOR em diversos formatos:
- Tabela: Número | Assunto | Link
- Lista: Links para cada DECOR
- Accordion: Título expansível com conteúdo

## Tratamento de Erros

- Se a página não carregar: retry até 3x
- Se nenhum seletor funcionar: tentar todos os formatos (tabela, lista, accordion)
- Se estrutura mudar: adaptar seletores dinamicamente

## Output Esperado

Array de objetos DECORRaw[]
  `;
}

/**
 * Converte DECOR bruto para formato AGUDocument padronizado
 */
export function convertDECORToAGUDocument(decor: DECORRaw): AGUDocument {
  const fullNumber = `DECOR nº ${decor.numero}/${decor.ano}`;

  return {
    tipo: 'parecer-conuni',
    numero: decor.numero,
    ano: decor.ano,
    titulo: decor.titulo || fullNumber,
    descricao: decor.ementa || decor.assunto || '',
    url: decor.urlPrincipal,
    urlPDF: decor.urlPDF,
    dataPublicacao: decor.dataPublicacao?.toISOString(),
    tags: [],
    temas: [],
    isRelevante: false,

    // Análise de relevância
    relevanciaScore: 0, // Será calculado por analyzeRelevance()
    cursosIds: [],
  };
}

/**
 * Valida se os dados extraídos estão completos
 */
export function validateDECORData(decor: DECORRaw): boolean {
  if (!decor.numero || decor.numero.trim() === '') {
    console.warn('[DECOR] Número do DECOR vazio');
    return false;
  }

  if (!decor.ano || decor.ano < 2000 || decor.ano > new Date().getFullYear() + 1) {
    console.warn(`[DECOR] Ano inválido: ${decor.ano}`);
    return false;
  }

  if (!decor.urlPrincipal || !decor.urlPrincipal.startsWith('http')) {
    console.warn(`[DECOR] URL inválida: ${decor.urlPrincipal}`);
    return false;
  }

  return true;
}

/**
 * Extrai detalhes adicionais da página individual de um DECOR
 *
 * IMPORTANTE: Requer navegação adicional com Playwright MCP
 */
export function getDECORDetailsScrapingInstructions(decorUrl: string): string {
  return `
# Instruções para Extrair Detalhes de DECOR Individual

## URL do DECOR
${decorUrl}

## Passos

### 1. Navegar para página do DECOR
Use: mcp__playwright__browser_navigate

### 2. Aguardar carregamento completo
Use: mcp__playwright__browser_wait_for com time=2

### 3. Extrair detalhes completos
Use: mcp__playwright__browser_evaluate:

\`\`\`javascript
() => {
  return {
    titulo: document.querySelector('h1, .titulo-principal')?.textContent?.trim(),
    ementa: document.querySelector('.ementa, .resumo, .assunto')?.textContent?.trim(),
    textoCompleto: document.querySelector('.texto-completo, .conteudo, article')?.textContent?.trim(),
    dataPublicacao: document.querySelector('.data-publicacao, time')?.textContent?.trim(),
    linkPDF: document.querySelector('a[href$=".pdf"]')?.href,
    assunto: document.querySelector('.assunto, .tema')?.textContent?.trim(),
    fundamentacaoLegal: document.querySelector('.fundamentacao, .base-legal')?.textContent?.trim(),
    // DECOR pode ter pareceres relacionados
    pareceresRelacionados: Array.from(document.querySelectorAll('.parecer-relacionado a')).map(a => ({
      titulo: a.textContent?.trim(),
      url: a.href
    }))
  };
}
\`\`\`

### 4. Processar e retornar
Enriquecer objeto DECORRaw com esses detalhes
  `;
}

/**
 * Estatísticas de scraping de DECOR
 */
export interface DECORScrapingStats {
  totalEncontrados: number;
  totalValidos: number;
  totalInvalidos: number;
  anoMaisRecente: number;
  anoMaisAntigo: number;
  comPDF: number;
  semPDF: number;
  comAssunto: number;
  semAssunto: number;
}

export function calculateDECORStats(decors: DECORRaw[]): DECORScrapingStats {
  const validos = decors.filter(validateDECORData);
  const anos = decors.map(d => d.ano).filter(Boolean);

  return {
    totalEncontrados: decors.length,
    totalValidos: validos.length,
    totalInvalidos: decors.length - validos.length,
    anoMaisRecente: Math.max(...anos),
    anoMaisAntigo: Math.min(...anos),
    comPDF: decors.filter(d => d.urlPDF).length,
    semPDF: decors.filter(d => !d.urlPDF).length,
    comAssunto: decors.filter(d => d.assunto && d.assunto.trim() !== '').length,
    semAssunto: decors.filter(d => !d.assunto || d.assunto.trim() === '').length
  };
}

/**
 * Wrapper para uso com Playwright MCP - será implementado por Claude
 *
 * Esta função é um placeholder que será substituído por chamadas
 * diretas às ferramentas MCP do Playwright durante execução.
 */
export async function scrapeDECORWithPlaywright(): Promise<DECORRaw[]> {
  throw new Error(
    'Esta função requer uso de Playwright MCP Tools. ' +
    'Use getDECORScrapingInstructions() para instruções.'
  );
}

/**
 * Exemplo de uso esperado:
 *
 * 1. Claude lê as instruções: getDECORScrapingInstructions()
 * 2. Claude usa ferramentas MCP:
 *    - mcp__playwright__browser_navigate
 *    - mcp__playwright__browser_snapshot
 *    - mcp__playwright__browser_evaluate
 * 3. Claude processa resultados e chama convertDECORToAGUDocument()
 * 4. Claude valida com validateDECORData()
 * 5. Claude salva no banco usando findOrCreateWithVersioning()
 */

/**
 * Detecta padrão da estrutura HTML da página de DECOR
 * Útil para adaptar seletores automaticamente
 */
export function detectDECORPageStructure(): string {
  return `
Use: mcp__playwright__browser_evaluate

\`\`\`javascript
() => {
  const estrutura = {
    temTabela: !!document.querySelector('table'),
    temListaLinks: document.querySelectorAll('a[href*="decor"]').length > 0,
    temAccordion: !!document.querySelector('.accordion, details'),
    totalLinks: document.querySelectorAll('a').length,
    totalTabelas: document.querySelectorAll('table').length,
    classes: Array.from(document.body.classList),
    primeiroH1: document.querySelector('h1')?.textContent?.trim()
  };

  return estrutura;
}
\`\`\`

Com base no resultado, escolher estratégia de extração:
- Se temTabela: usar seletores de tabela
- Se temListaLinks: extrair de links
- Se temAccordion: expandir e extrair de accordion
  `;
}
