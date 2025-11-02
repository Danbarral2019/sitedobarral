/**
 * DOU Document Classifier
 *
 * Sistema de classificação automática de documentos DOU
 * para filtrar apenas documentos relevantes para o repositório.
 *
 * CRITÉRIOS DE RELEVÂNCIA:
 * - ✅ SEMPRE relevantes: Fontes AGU, Atos Normativos, Súmulas
 * - ✅ POTENCIALMENTE relevantes: Acórdãos TCU inovadores
 * - ❌ NÃO relevantes: Editais, Avisos de Licitação, Contratos, Extratos
 *
 * FILTROS AVANÇADOS:
 * - 🔍 Por seção (DO1, DO2, DO3, Extra)
 * - 🏛️ Por órgão/ministério
 * - 📅 Por data/range de datas
 */

import { DOUSearchResult } from './dou-api';
import { DOUEnrichedContent } from './dou-scraper';

/**
 * Categorias de documentos DOU
 */
export enum DOUDocumentCategory {
  // SEMPRE RELEVANTES (auto-aprovação)
  FONTE_AGU = 'fonte_agu',              // Orientações Normativas, Pareceres, Súmulas AGU
  ATO_NORMATIVO = 'ato_normativo',      // Leis, Decretos, Portarias, Instruções Normativas
  SUMULA = 'sumula',                    // Súmulas de Tribunais

  // POTENCIALMENTE RELEVANTES (revisão manual)
  ACORDAO_TCU = 'acordao_tcu',          // Acórdãos do TCU
  PARECER_ORGAO = 'parecer_orgao',      // Pareceres de outros órgãos
  RESOLUCAO = 'resolucao',              // Resoluções

  // NÃO RELEVANTES (auto-rejeição)
  EDITAL = 'edital',                    // Editais de licitação
  AVISO_LICITACAO = 'aviso_licitacao',  // Avisos de licitação
  CONTRATO = 'contrato',                // Contratos
  EXTRATO = 'extrato',                  // Extratos de contratos/termos
  OUTROS = 'outros',                    // Não classificado
}

/**
 * Status de aprovação
 */
export enum ApprovalStatus {
  AUTO_APPROVED = 'auto_approved',      // Aprovado automaticamente
  PENDING = 'pending',                  // Aguardando revisão manual
  AUTO_REJECTED = 'auto_rejected',      // Rejeitado automaticamente
  MANUALLY_APPROVED = 'manually_approved', // Aprovado manualmente
  MANUALLY_REJECTED = 'manually_rejected', // Rejeitado manualmente
}

/**
 * Resultado da classificação
 */
export interface ClassificationResult {
  category: DOUDocumentCategory;
  status: ApprovalStatus;
  confidence: number; // 0-100
  reasoning: string[];
  isRelevant: boolean;
  requiresReview: boolean;
}

/**
 * Filtros avançados para documentos DOU
 */
export interface AdvancedFilters {
  // Filtro por seção
  sections?: string[]; // ['do1', 'do2', 'do3', 'doe']

  // Filtro por órgão/ministério
  orgaos?: string[]; // Ministérios, órgãos específicos
  orgaoPattern?: string; // Regex pattern para órgão

  // Filtro por data
  dateFrom?: Date; // Data início
  dateTo?: Date; // Data fim

  // Filtro por categoria
  categories?: DOUDocumentCategory[];

  // Filtro por status
  statuses?: ApprovalStatus[];

  // Filtro por confiança
  minConfidence?: number; // 0-100

  // Filtro por palavras-chave customizadas
  includeKeywords?: string[]; // Deve conter pelo menos uma
  excludeKeywords?: string[]; // Não deve conter nenhuma
}

/**
 * Órgãos relevantes pré-definidos
 */
export const RELEVANT_ORGAOS = {
  // Executivo Federal
  PRESIDENCIA: ['presidência da república', 'presidencia da republica', 'casa civil'],
  MGI: ['ministério da gestão', 'ministerio da gestao', 'mgi'],
  AGU: ['advocacia-geral da união', 'advocacia geral da união', 'agu'],
  CGU: ['controladoria-geral da união', 'controladoria geral da união', 'cgu'],

  // Controle
  TCU: ['tribunal de contas da união', 'tribunal de contas da uniao', 'tcu'],

  // Judiciário
  STF: ['supremo tribunal federal', 'stf'],
  STJ: ['superior tribunal de justiça', 'superior tribunal de justica', 'stj'],

  // Ministérios relevantes
  FAZENDA: ['ministério da fazenda', 'ministerio da fazenda'],
  PLANEJAMENTO: ['ministério do planejamento', 'ministerio do planejamento'],

  // Lista completa para matching
  ALL: [] as string[],
};

// Inicializar lista completa
RELEVANT_ORGAOS.ALL = Object.values(RELEVANT_ORGAOS)
  .filter(arr => arr.length > 0)
  .flat();

/**
 * Presets de ranges de data
 */
export enum DateRangePreset {
  HOJE = 'hoje',
  ONTEM = 'ontem',
  ULTIMA_SEMANA = 'ultima_semana',
  ULTIMO_MES = 'ultimo_mes',
  ULTIMOS_3_MESES = 'ultimos_3_meses',
  ULTIMO_ANO = 'ultimo_ano',
}

/**
 * Classificador de documentos DOU
 */
export class DOUClassifier {
  /**
   * Palavras-chave para fontes AGU
   */
  private static readonly AGU_KEYWORDS = [
    // Advocacia-Geral da União
    'advocacia-geral da união',
    'advocacia geral da união',
    'agu',
    'orientação normativa',
    'orientacao normativa',
    'parecer agu',
    'parecer n° agu',
    'parecer da agu',
    'súmula agu',
    'sumula agu',
    'consultoria-geral da união',
    'consultoria geral da união',
    'cgu',
  ];

  /**
   * Palavras-chave para atos normativos
   */
  private static readonly ATO_NORMATIVO_KEYWORDS = [
    'lei n',
    'lei nº',
    'lei federal',
    'decreto n',
    'decreto nº',
    'decreto-lei',
    'medida provisória',
    'medida provisoria',
    'portaria n',
    'portaria nº',
    'instrução normativa',
    'instrucao normativa',
    'resolução normativa',
    'resolucao normativa',
  ];

  /**
   * Palavras-chave para súmulas
   */
  private static readonly SUMULA_KEYWORDS = [
    'súmula',
    'sumula',
    'súmula vinculante',
    'sumula vinculante',
  ];

  /**
   * Palavras-chave para acórdãos TCU
   */
  private static readonly ACORDAO_TCU_KEYWORDS = [
    'acórdão',
    'acordao',
    'acórdão tcu',
    'acordao tcu',
    'tribunal de contas da união',
    'tribunal de contas da uniao',
    'tcu',
  ];

  /**
   * Palavras-chave NÃO RELEVANTES (auto-rejeição)
   */
  private static readonly IRRELEVANT_KEYWORDS = [
    // Editais
    'edital de',
    'edital n',
    'edital nº',
    'pregão eletrônico',
    'pregao eletronico',
    'tomada de preços',
    'tomada de precos',
    'concorrência pública',
    'concorrencia publica',

    // Avisos
    'aviso de licitação',
    'aviso de licitacao',
    'aviso de',

    // Contratos e extratos
    'extrato de contrato',
    'extrato de termo',
    'extrato de aditivo',
    'contrato n',
    'contrato nº',
    'termo aditivo',
    'termo de',

    // Registros de preços
    'ata de registro de preços',
    'ata de registro de precos',
    'registro de preços',
    'registro de precos',
  ];

  /**
   * Classifica um documento DOU
   */
  static classify(
    title: string,
    abstract: string,
    enrichedContent?: DOUEnrichedContent
  ): ClassificationResult {
    const fullText = `${title} ${abstract} ${enrichedContent?.conteudo || ''}`.toLowerCase();
    const reasoning: string[] = [];
    let confidence = 0;

    // PASSO 0: Verificar PRIMEIRO se é irrelevante (prioridade máxima para evitar falsos positivos)
    if (this.containsAnyKeyword(fullText, this.IRRELEVANT_KEYWORDS)) {
      const matched = this.getMatchedKeywords(fullText, this.IRRELEVANT_KEYWORDS);
      reasoning.push(`Documento não relevante: ${matched.join(', ')}`);
      confidence = 85;

      // Determinar categoria específica
      let category = DOUDocumentCategory.OUTROS;
      if (matched.some(k => k.includes('edital'))) {
        category = DOUDocumentCategory.EDITAL;
      } else if (matched.some(k => k.includes('aviso'))) {
        category = DOUDocumentCategory.AVISO_LICITACAO;
      } else if (matched.some(k => k.includes('contrato'))) {
        category = DOUDocumentCategory.CONTRATO;
      } else if (matched.some(k => k.includes('extrato'))) {
        category = DOUDocumentCategory.EXTRATO;
      }

      return {
        category,
        status: ApprovalStatus.AUTO_REJECTED,
        confidence,
        reasoning,
        isRelevant: false,
        requiresReview: false,
      };
    }

    // PASSO 1: Verificar se é fonte AGU (SEMPRE RELEVANTE)
    if (this.containsAnyKeyword(fullText, this.AGU_KEYWORDS)) {
      reasoning.push('Documento da Advocacia-Geral da União (AGU)');
      confidence = 95;

      return {
        category: DOUDocumentCategory.FONTE_AGU,
        status: ApprovalStatus.AUTO_APPROVED,
        confidence,
        reasoning,
        isRelevant: true,
        requiresReview: false,
      };
    }

    // PASSO 2: Verificar se é ato normativo (SEMPRE RELEVANTE)
    if (this.containsAnyKeyword(fullText, this.ATO_NORMATIVO_KEYWORDS)) {
      reasoning.push('Ato normativo (Lei, Decreto, Portaria, IN)');
      confidence = 90;

      return {
        category: DOUDocumentCategory.ATO_NORMATIVO,
        status: ApprovalStatus.AUTO_APPROVED,
        confidence,
        reasoning,
        isRelevant: true,
        requiresReview: false,
      };
    }

    // PASSO 3: Verificar se é súmula (SEMPRE RELEVANTE)
    if (this.containsAnyKeyword(fullText, this.SUMULA_KEYWORDS)) {
      reasoning.push('Súmula de tribunal');
      confidence = 95;

      return {
        category: DOUDocumentCategory.SUMULA,
        status: ApprovalStatus.AUTO_APPROVED,
        confidence,
        reasoning,
        isRelevant: true,
        requiresReview: false,
      };
    }

    // PASSO 4: Verificar se é acórdão TCU (REVISÃO MANUAL)
    if (this.containsAnyKeyword(fullText, this.ACORDAO_TCU_KEYWORDS)) {
      reasoning.push('Acórdão do Tribunal de Contas da União (TCU)');
      reasoning.push('Requer revisão manual para verificar inovação');
      confidence = 70;

      return {
        category: DOUDocumentCategory.ACORDAO_TCU,
        status: ApprovalStatus.PENDING,
        confidence,
        reasoning,
        isRelevant: true,
        requiresReview: true,
      };
    }

    // PASSO 5: Não classificado - REVISÃO MANUAL
    reasoning.push('Documento não classificado automaticamente');
    reasoning.push('Requer revisão manual');
    confidence = 40;

    return {
      category: DOUDocumentCategory.OUTROS,
      status: ApprovalStatus.PENDING,
      confidence,
      reasoning,
      isRelevant: true,
      requiresReview: true,
    };
  }

  /**
   * Verifica se o texto contém alguma palavra-chave
   */
  private static containsAnyKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  }

  /**
   * Retorna as palavras-chave encontradas
   */
  private static getMatchedKeywords(text: string, keywords: string[]): string[] {
    return keywords.filter((keyword) => text.includes(keyword.toLowerCase()));
  }

  /**
   * Classifica múltiplos documentos
   */
  static classifyBatch(
    results: DOUSearchResult[],
    enrichedContents?: Map<string, DOUEnrichedContent>
  ): Map<DOUSearchResult, ClassificationResult> {
    const classifications = new Map<DOUSearchResult, ClassificationResult>();

    for (const result of results) {
      const enriched = enrichedContents?.get(result.href);
      const classification = this.classify(result.title, result.abstract, enriched);
      classifications.set(result, classification);
    }

    return classifications;
  }

  /**
   * Filtra apenas documentos aprovados automaticamente
   */
  static filterAutoApproved(
    classifications: Map<DOUSearchResult, ClassificationResult>
  ): DOUSearchResult[] {
    const approved: DOUSearchResult[] = [];

    classifications.forEach((classification, result) => {
      if (classification.status === ApprovalStatus.AUTO_APPROVED) {
        approved.push(result);
      }
    });

    return approved;
  }

  /**
   * Filtra documentos que requerem revisão manual
   */
  static filterPendingReview(
    classifications: Map<DOUSearchResult, ClassificationResult>
  ): DOUSearchResult[] {
    const pending: DOUSearchResult[] = [];

    classifications.forEach((classification, result) => {
      if (classification.requiresReview) {
        pending.push(result);
      }
    });

    return pending;
  }

  /**
   * Estatísticas de classificação
   */
  static getStats(classifications: Map<DOUSearchResult, ClassificationResult>) {
    const stats = {
      total: classifications.size,
      autoApproved: 0,
      pending: 0,
      autoRejected: 0,
      byCategory: {} as Record<DOUDocumentCategory, number>,
    };

    classifications.forEach((classification) => {
      // Contar por status
      if (classification.status === ApprovalStatus.AUTO_APPROVED) {
        stats.autoApproved++;
      } else if (classification.status === ApprovalStatus.PENDING) {
        stats.pending++;
      } else if (classification.status === ApprovalStatus.AUTO_REJECTED) {
        stats.autoRejected++;
      }

      // Contar por categoria
      if (!stats.byCategory[classification.category]) {
        stats.byCategory[classification.category] = 0;
      }
      stats.byCategory[classification.category]++;
    });

    return stats;
  }

  /**
   * 🔍 FILTROS AVANÇADOS
   */

  /**
   * Filtra documentos por seção do DOU
   */
  static filterBySection(
    results: DOUSearchResult[],
    sections: string[]
  ): DOUSearchResult[] {
    if (!sections || sections.length === 0 || sections.includes('todos')) {
      return results;
    }

    return results.filter((result) => sections.includes(result.section.toLowerCase()));
  }

  /**
   * Filtra documentos por órgão/ministério
   */
  static filterByOrgao(
    results: DOUSearchResult[],
    orgaos?: string[],
    orgaoPattern?: string
  ): DOUSearchResult[] {
    if (!orgaos && !orgaoPattern) {
      return results;
    }

    return results.filter((result) => {
      const hierarchyText = result.hierarchyStr.toLowerCase();

      // Verificar lista de órgãos
      if (orgaos && orgaos.length > 0) {
        const matchesOrgao = orgaos.some((orgao) =>
          hierarchyText.includes(orgao.toLowerCase())
        );
        if (!matchesOrgao) return false;
      }

      // Verificar regex pattern
      if (orgaoPattern) {
        try {
          const regex = new RegExp(orgaoPattern, 'i');
          if (!regex.test(hierarchyText)) return false;
        } catch (error) {
          console.warn('Invalid regex pattern:', orgaoPattern);
        }
      }

      return true;
    });
  }

  /**
   * Filtra documentos por data
   */
  static filterByDate(
    results: DOUSearchResult[],
    dateFrom?: Date,
    dateTo?: Date
  ): DOUSearchResult[] {
    if (!dateFrom && !dateTo) {
      return results;
    }

    return results.filter((result) => {
      // Converter "DD/MM/YYYY" para Date
      const [day, month, year] = result.date.split('/').map(Number);
      const docDate = new Date(year, month - 1, day);

      // Verificar range
      if (dateFrom && docDate < dateFrom) return false;
      if (dateTo && docDate > dateTo) return false;

      return true;
    });
  }

  /**
   * Filtra por categoria de classificação
   */
  static filterByCategory(
    classifications: Map<DOUSearchResult, ClassificationResult>,
    categories: DOUDocumentCategory[]
  ): DOUSearchResult[] {
    if (!categories || categories.length === 0) {
      return Array.from(classifications.keys());
    }

    const filtered: DOUSearchResult[] = [];

    classifications.forEach((classification, result) => {
      if (categories.includes(classification.category)) {
        filtered.push(result);
      }
    });

    return filtered;
  }

  /**
   * Filtra por status de aprovação
   */
  static filterByStatus(
    classifications: Map<DOUSearchResult, ClassificationResult>,
    statuses: ApprovalStatus[]
  ): DOUSearchResult[] {
    if (!statuses || statuses.length === 0) {
      return Array.from(classifications.keys());
    }

    const filtered: DOUSearchResult[] = [];

    classifications.forEach((classification, result) => {
      if (statuses.includes(classification.status)) {
        filtered.push(result);
      }
    });

    return filtered;
  }

  /**
   * Filtra por confiança mínima
   */
  static filterByConfidence(
    classifications: Map<DOUSearchResult, ClassificationResult>,
    minConfidence: number
  ): DOUSearchResult[] {
    const filtered: DOUSearchResult[] = [];

    classifications.forEach((classification, result) => {
      if (classification.confidence >= minConfidence) {
        filtered.push(result);
      }
    });

    return filtered;
  }

  /**
   * Filtra por palavras-chave customizadas
   */
  static filterByKeywords(
    results: DOUSearchResult[],
    includeKeywords?: string[],
    excludeKeywords?: string[]
  ): DOUSearchResult[] {
    return results.filter((result) => {
      const fullText = `${result.title} ${result.abstract}`.toLowerCase();

      // Verificar inclusão (deve conter pelo menos uma)
      if (includeKeywords && includeKeywords.length > 0) {
        const hasInclude = includeKeywords.some((keyword) =>
          fullText.includes(keyword.toLowerCase())
        );
        if (!hasInclude) return false;
      }

      // Verificar exclusão (não deve conter nenhuma)
      if (excludeKeywords && excludeKeywords.length > 0) {
        const hasExclude = excludeKeywords.some((keyword) =>
          fullText.includes(keyword.toLowerCase())
        );
        if (hasExclude) return false;
      }

      return true;
    });
  }

  /**
   * Aplica todos os filtros avançados
   */
  static applyAdvancedFilters(
    results: DOUSearchResult[],
    classifications: Map<DOUSearchResult, ClassificationResult>,
    filters: AdvancedFilters
  ): DOUSearchResult[] {
    let filtered = results;

    // 1. Filtrar por seção
    if (filters.sections && filters.sections.length > 0) {
      filtered = this.filterBySection(filtered, filters.sections);
    }

    // 2. Filtrar por órgão
    if (filters.orgaos || filters.orgaoPattern) {
      filtered = this.filterByOrgao(filtered, filters.orgaos, filters.orgaoPattern);
    }

    // 3. Filtrar por data
    if (filters.dateFrom || filters.dateTo) {
      filtered = this.filterByDate(filtered, filters.dateFrom, filters.dateTo);
    }

    // 4. Filtrar por palavras-chave
    if (filters.includeKeywords || filters.excludeKeywords) {
      filtered = this.filterByKeywords(
        filtered,
        filters.includeKeywords,
        filters.excludeKeywords
      );
    }

    // 5. Filtrar por categoria (requer classifications)
    if (filters.categories && filters.categories.length > 0) {
      // Criar subset de classifications apenas com filtered
      const filteredClassifications = new Map<DOUSearchResult, ClassificationResult>();
      filtered.forEach((result) => {
        const classification = classifications.get(result);
        if (classification) {
          filteredClassifications.set(result, classification);
        }
      });

      filtered = this.filterByCategory(filteredClassifications, filters.categories);
    }

    // 6. Filtrar por status
    if (filters.statuses && filters.statuses.length > 0) {
      const filteredClassifications = new Map<DOUSearchResult, ClassificationResult>();
      filtered.forEach((result) => {
        const classification = classifications.get(result);
        if (classification) {
          filteredClassifications.set(result, classification);
        }
      });

      filtered = this.filterByStatus(filteredClassifications, filters.statuses);
    }

    // 7. Filtrar por confiança mínima
    if (filters.minConfidence !== undefined) {
      const filteredClassifications = new Map<DOUSearchResult, ClassificationResult>();
      filtered.forEach((result) => {
        const classification = classifications.get(result);
        if (classification) {
          filteredClassifications.set(result, classification);
        }
      });

      filtered = this.filterByConfidence(filteredClassifications, filters.minConfidence);
    }

    return filtered;
  }

  /**
   * Helper: Converte preset de data em range
   */
  static getDateRangeFromPreset(preset: DateRangePreset): { from: Date; to: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from: Date;
    const to = today;

    switch (preset) {
      case DateRangePreset.HOJE:
        from = today;
        break;

      case DateRangePreset.ONTEM:
        from = new Date(today);
        from.setDate(from.getDate() - 1);
        break;

      case DateRangePreset.ULTIMA_SEMANA:
        from = new Date(today);
        from.setDate(from.getDate() - 7);
        break;

      case DateRangePreset.ULTIMO_MES:
        from = new Date(today);
        from.setMonth(from.getMonth() - 1);
        break;

      case DateRangePreset.ULTIMOS_3_MESES:
        from = new Date(today);
        from.setMonth(from.getMonth() - 3);
        break;

      case DateRangePreset.ULTIMO_ANO:
        from = new Date(today);
        from.setFullYear(from.getFullYear() - 1);
        break;

      default:
        from = today;
    }

    return { from, to };
  }

  /**
   * Helper: Estatísticas de filtros aplicados
   */
  static getFilterStats(
    originalCount: number,
    filteredCount: number,
    filters: AdvancedFilters
  ) {
    const appliedFilters: string[] = [];

    if (filters.sections && filters.sections.length > 0) {
      appliedFilters.push(`Seções: ${filters.sections.join(', ')}`);
    }
    if (filters.orgaos && filters.orgaos.length > 0) {
      appliedFilters.push(`Órgãos: ${filters.orgaos.length}`);
    }
    if (filters.dateFrom || filters.dateTo) {
      appliedFilters.push('Range de datas');
    }
    if (filters.categories && filters.categories.length > 0) {
      appliedFilters.push(`Categorias: ${filters.categories.length}`);
    }
    if (filters.statuses && filters.statuses.length > 0) {
      appliedFilters.push(`Status: ${filters.statuses.length}`);
    }
    if (filters.minConfidence !== undefined) {
      appliedFilters.push(`Confiança >= ${filters.minConfidence}%`);
    }
    if (filters.includeKeywords && filters.includeKeywords.length > 0) {
      appliedFilters.push(`Keywords incluídas: ${filters.includeKeywords.length}`);
    }
    if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
      appliedFilters.push(`Keywords excluídas: ${filters.excludeKeywords.length}`);
    }

    return {
      originalCount,
      filteredCount,
      removedCount: originalCount - filteredCount,
      removalRate: ((originalCount - filteredCount) / originalCount * 100).toFixed(1) + '%',
      appliedFilters,
    };
  }
}
