/**
 * Script para extrair TODOS os Pareceres Vinculantes da AGU usando Playwright MCP
 *
 * Este script:
 * 1. Extrai todos os 215 pareceres (22 páginas)
 * 2. Analisa relevância para licitações e contratos
 * 3. Salva JSON com pareceres relevantes para importação posterior
 *
 * IMPORTANTE: Executar via Claude Code com Playwright MCP ativo
 */

interface ParecerVinculante {
  numeroCompleto: string;
  prefixo: string;
  numero: string;
  assunto: string;
  ementa: string;
  relevanciaScore: number;
  isRelevante: boolean;
  cursosRelevantes: string[];
  razaoRelevancia: string;
}

/**
 * Lista para armazenar todos os pareceres extraídos
 * (será populada via Playwright MCP)
 */
const pareceresExtraidos: ParecerVinculante[] = [];

/**
 * Análise de relevância para licitações e contratos
 */
function analyzeRelevanceForLicitacoes(assunto: string, ementa: string): {
  score: number;
  isRelevante: boolean;
  cursosRelevantes: string[];
  razao: string;
} {
  const texto = `${assunto} ${ementa}`.toLowerCase();

  let score = 0;
  const razoes: string[] = [];
  const cursos = new Set<string>();

  // Palavras-chave de alta relevância (20 pontos cada)
  const highKeywords = [
    'licitação', 'licitações', 'licitar',
    'contrato administrativo', 'contratos administrativos',
    'lei 14.133', 'lei nº 14.133', 'lei n. 14.133',
    'lei 8.666', 'lei nº 8.666', 'lei n. 8.666',
    'lei 12.462', 'regime diferenciado de contratação',
    'pregão', 'dispensa', 'inexigibilidade',
    'sanção administrativa', 'impedimento de licitar',
    'declaração de inidoneidade', 'suspensão de licitar',
    'processo licitatório', 'certame licitatório'
  ];

  highKeywords.forEach(keyword => {
    if (texto.includes(keyword)) {
      score += 20;
      razoes.push(`Menciona "${keyword}"`);

      // Mapear para cursos
      if (keyword.includes('14.133') || keyword.includes('pregão') || keyword.includes('licitação')) {
        cursos.add('1'); // Nova Lei de Licitações
      }
      if (keyword.includes('contrato')) {
        cursos.add('3'); // Gestão e Fiscalização de Contratos
      }
      if (keyword.includes('sanção') || keyword.includes('inidoneidade') || keyword.includes('impedimento')) {
        cursos.add('4'); // Processo Sancionador
      }
    }
  });

  // Palavras-chave de média relevância (10 pontos cada)
  const mediumKeywords = [
    'fornecedor', 'fornecedores', 'licitante', 'licitantes',
    'contratação pública', 'contratações públicas',
    'adjudicação', 'homologação',
    'habilitação', 'inabilitação',
    'proposta', 'propostas',
    'edital', 'editais',
    'comissão de licitação',
    'fiscalização de contrato', 'fiscal de contrato',
    'gestor de contrato', 'gestão contratual'
  ];

  mediumKeywords.forEach(keyword => {
    if (texto.includes(keyword)) {
      score += 10;
      razoes.push(`Menciona "${keyword}"`);

      if (keyword.includes('fiscal') || keyword.includes('gestor')) {
        cursos.add('3'); // Gestão e Fiscalização
      } else {
        cursos.add('1'); // Nova Lei de Licitações
      }
    }
  });

  // Palavras-chave de baixa relevância (5 pontos cada)
  const lowKeywords = [
    'administração pública',
    'interesse público',
    'princípio da legalidade',
    'princípio da moralidade',
    'processo administrativo'
  ];

  lowKeywords.forEach(keyword => {
    if (texto.includes(keyword)) {
      score += 5;
    }
  });

  // Capear score em 100
  score = Math.min(score, 100);

  // Considerar relevante se score >= 40
  const isRelevante = score >= 40;

  return {
    score,
    isRelevante,
    cursosRelevantes: Array.from(cursos),
    razao: razoes.slice(0, 3).join('; ') || 'Baixa correlação com licitações e contratos'
  };
}

/**
 * Processa e analisa todos os pareceres extraídos
 */
function processExtractedPareceres(rawData: Array<{
  numeroCompleto: string;
  assunto: string;
  ementa: string;
}>): ParecerVinculante[] {
  return rawData.map(raw => {
    // Extrair prefixo e número
    const match = raw.numeroCompleto.match(/^([A-Z]+)\s*-?\s*(\d+)$/);
    const prefixo = match ? match[1] : '';
    const numero = match ? match[2] : raw.numeroCompleto;

    // Analisar relevância
    const analysis = analyzeRelevanceForLicitacoes(raw.assunto, raw.ementa);

    return {
      numeroCompleto: raw.numeroCompleto.trim(),
      prefixo,
      numero,
      assunto: raw.assunto.trim(),
      ementa: raw.ementa.trim(),
      relevanciaScore: analysis.score,
      isRelevante: analysis.isRelevante,
      cursosRelevantes: analysis.cursosRelevantes,
      razaoRelevancia: analysis.razao
    };
  });
}

/**
 * Filtra apenas pareceres relevantes
 */
function filterRelevantPareceres(pareceres: ParecerVinculante[], minScore: number = 40): ParecerVinculante[] {
  return pareceres
    .filter(p => p.relevanciaScore >= minScore)
    .sort((a, b) => b.relevanciaScore - a.relevanciaScore);
}

// Export para uso no script de importação
export type { ParecerVinculante };
export { processExtractedPareceres, filterRelevantPareceres, analyzeRelevanceForLicitacoes };

/**
 * INSTRUÇÕES PARA CLAUDE CODE:
 *
 * 1. Navegar para: https://siscon.agu.gov.br/consultivo/vinculantes/
 *
 * 2. Para cada página (1 a 22):
 *    - Extrair todos os pareceres da tabela
 *    - Campos: numeroCompleto, assunto, ementa
 *    - Clicar em "Avançar página"
 *
 * 3. Após extrair todos, processar com processExtractedPareceres()
 *
 * 4. Filtrar relevantes com filterRelevantPareceres()
 *
 * 5. Salvar em data/pareceres-vinculantes-extraidos.json
 *
 * Exemplo de estrutura esperada:
 * [
 *   {
 *     "numeroCompleto": "JM-10",
 *     "assunto": "termo inicial licenças maternidade...",
 *     "ementa": "EMENTA: DIREITO ADMINISTRATIVO..."
 *   }
 * ]
 */

console.log(`
📋 Script de Extração de Pareceres Vinculantes AGU

Este script requer Playwright MCP para executar a extração completa.

PRÓXIMOS PASSOS:
1. Claude Code usará Playwright MCP para navegar e extrair
2. Total esperado: 215 pareceres (22 páginas × ~10 por página)
3. Análise automática de relevância para licitações/contratos
4. Salvamento de apenas pareceres relevantes (score >= 40)

Aguardando extração via Playwright MCP...
`);
