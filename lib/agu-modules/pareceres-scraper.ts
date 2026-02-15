/**
 * AGU Pareceres Vinculantes Scraper com Playwright MCP
 *
 * Realiza scraping real da página de Pareceres Vinculantes da AGU
 * usando Playwright MCP para navegar e extrair dados dinâmicos.
 *
 * URL: https://www.gov.br/agu/pt-br/composicao/cgu/cgu/pareceres-da-consultoria-geral-da-uniao/pareceres-vinculantes
 */

import type { AGUDocument } from '@/lib/agu-types';

export interface ParecerVinculanteRaw {
  numero: string;
  ano: number;
  titulo: string;
  ementa: string;
  urlPrincipal: string;
  urlPDF?: string;
  dataPublicacao?: Date;
}

/**
 * IMPORTANTE: Esta função usa Playwright MCP Tools
 *
 * Para funcionar, você precisa chamar as ferramentas MCP do Playwright:
 * 1. mcp__playwright__browser_navigate - navegar para a URL
 * 2. mcp__playwright__browser_snapshot - capturar estrutura da página
 * 3. mcp__playwright__browser_click - clicar em elementos
 * 4. mcp__playwright__browser_evaluate - extrair dados com JavaScript
 *
 * Esta função retorna instruções para Claude usar essas ferramentas.
 */
export function getPareceresScrapingInstructions(): string {
  return `
# Instruções para Scraping de Pareceres Vinculantes da AGU

## URL Base
https://www.gov.br/agu/pt-br/composicao/cgu/cgu/pareceres-da-consultoria-geral-da-uniao/pareceres-vinculantes

## Passos do Scraping

### 1. Navegar para a página
Use: mcp__playwright__browser_navigate com URL acima

### 2. Aguardar carregamento
Use: mcp__playwright__browser_wait_for com time=3 (segundos)

### 3. Capturar snapshot da página
Use: mcp__playwright__browser_snapshot para ver a estrutura

### 4. Extrair lista de pareceres
Use: mcp__playwright__browser_evaluate com função JavaScript:

\`\`\`javascript
() => {
  const pareceres = [];

  // Selecionar todos os cards/items de pareceres
  // AJUSTAR SELETORES conforme estrutura real da página
  const items = document.querySelectorAll('.parecer-item, .documento-item, article');

  items.forEach(item => {
    // Extrair dados de cada parecer
    const titulo = item.querySelector('h3, h4, .titulo')?.textContent?.trim();
    const ementa = item.querySelector('.ementa, .descricao, p')?.textContent?.trim();
    const link = item.querySelector('a')?.href;

    // Extrair número e ano do título (ex: "Parecer Vinculante n° 123/2024")
    const match = titulo?.match(/(?:Parecer|PV)\\s*(?:Vinculante)?\\s*n?[°º]?\\s*(\\d+)[\\/\\-](\\d{4})/i);

    if (match && titulo) {
      pareceres.push({
        numero: match[1],
        ano: parseInt(match[2]),
        titulo: titulo,
        ementa: ementa || '',
        urlPrincipal: link || '',
        urlPDF: item.querySelector('a[href$=".pdf"]')?.href || ''
      });
    }
  });

  return pareceres;
}
\`\`\`

### 5. Processar resultados
Para cada parecer extraído, converter para formato AGUDocument

### 6. Lidar com paginação (se houver)
- Detectar botão "Próxima página"
- Clicar e repetir passos 2-4
- Continuar até não haver mais páginas

## Estrutura Esperada

A página deve conter uma lista de pareceres, cada um com:
- Título: "Parecer Vinculante nº X/YYYY"
- Ementa: texto descritivo
- Link: URL para a página do parecer
- PDF: link direto para PDF (opcional)

## Tratamento de Erros

- Se a página não carregar: retry até 3x
- Se seletores não encontrarem nada: logar erro e tentar seletores alternativos
- Se estrutura mudar: atualizar seletores no código

## Output Esperado

Array de objetos ParecerVinculanteRaw[]
  `;
}

/**
 * Converte parecer bruto para formato AGUDocument padronizado
 */
export function convertParecerToAGUDocument(parecer: ParecerVinculanteRaw): AGUDocument {
  const fullNumber = `Parecer Vinculante nº ${parecer.numero}/${parecer.ano}`;

  return {
    tipo: 'parecer-vinculante',
    numero: parecer.numero,
    ano: parecer.ano,
    titulo: parecer.titulo || fullNumber,
    descricao: parecer.ementa || '',
    url: parecer.urlPrincipal,
    urlPDF: parecer.urlPDF,
    dataPublicacao: parecer.dataPublicacao?.toISOString(),
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
export function validateParecerData(parecer: ParecerVinculanteRaw): boolean {
  if (!parecer.numero || parecer.numero.trim() === '') {
    console.warn('[Pareceres] Número do parecer vazio');
    return false;
  }

  if (!parecer.ano || parecer.ano < 2000 || parecer.ano > new Date().getFullYear() + 1) {
    console.warn(`[Pareceres] Ano inválido: ${parecer.ano}`);
    return false;
  }

  if (!parecer.urlPrincipal || !parecer.urlPrincipal.startsWith('http')) {
    console.warn(`[Pareceres] URL inválida: ${parecer.urlPrincipal}`);
    return false;
  }

  return true;
}

/**
 * Extrai detalhes adicionais da página individual de um parecer
 *
 * IMPORTANTE: Requer navegação adicional com Playwright MCP
 */
export function getParecerDetailsScrapingInstructions(parecerUrl: string): string {
  return `
# Instruções para Extrair Detalhes de Parecer Individual

## URL do Parecer
${parecerUrl}

## Passos

### 1. Navegar para página do parecer
Use: mcp__playwright__browser_navigate

### 2. Aguardar carregamento completo
Use: mcp__playwright__browser_wait_for com time=2

### 3. Extrair detalhes completos
Use: mcp__playwright__browser_evaluate:

\`\`\`javascript
() => {
  return {
    titulo: document.querySelector('h1, .titulo-principal')?.textContent?.trim(),
    ementa: document.querySelector('.ementa, .resumo')?.textContent?.trim(),
    textoCompleto: document.querySelector('.texto-completo, .conteudo, article')?.textContent?.trim(),
    dataPublicacao: document.querySelector('.data-publicacao, time')?.textContent?.trim(),
    linkPDF: document.querySelector('a[href$=".pdf"]')?.href,
    fundamentacaoLegal: document.querySelector('.fundamentacao, .base-legal')?.textContent?.trim()
  };
}
\`\`\`

### 4. Processar e retornar
Enriquecer objeto ParecerVinculanteRaw com esses detalhes
  `;
}

/**
 * Estatísticas de scraping de pareceres
 */
export interface PareceresScrapingStats {
  totalEncontrados: number;
  totalValidos: number;
  totalInvalidos: number;
  anoMaisRecente: number;
  anoMaisAntigo: number;
  comPDF: number;
  semPDF: number;
}

export function calculatePareceresStats(pareceres: ParecerVinculanteRaw[]): PareceresScrapingStats {
  const validos = pareceres.filter(validateParecerData);
  const anos = pareceres.map(p => p.ano).filter(Boolean);

  return {
    totalEncontrados: pareceres.length,
    totalValidos: validos.length,
    totalInvalidos: pareceres.length - validos.length,
    anoMaisRecente: Math.max(...anos),
    anoMaisAntigo: Math.min(...anos),
    comPDF: pareceres.filter(p => p.urlPDF).length,
    semPDF: pareceres.filter(p => !p.urlPDF).length
  };
}

/**
 * Wrapper para uso com Playwright MCP - será implementado por Claude
 *
 * Esta função é um placeholder que será substituído por chamadas
 * diretas às ferramentas MCP do Playwright durante execução.
 */
export async function scrapePareceresWithPlaywright(): Promise<ParecerVinculanteRaw[]> {
  throw new Error(
    'Esta função requer uso de Playwright MCP Tools. ' +
    'Use getPareceresScrapingInstructions() para instruções.'
  );
}

/**
 * Exemplo de uso esperado:
 *
 * 1. Claude lê as instruções: getPareceresScrapingInstructions()
 * 2. Claude usa ferramentas MCP:
 *    - mcp__playwright__browser_navigate
 *    - mcp__playwright__browser_snapshot
 *    - mcp__playwright__browser_evaluate
 * 3. Claude processa resultados e chama convertParecerToAGUDocument()
 * 4. Claude valida com validateParecerData()
 * 5. Claude salva no banco usando findOrCreateWithVersioning()
 */
