import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { searchLastWeek, searchLastMonth, DOUClient, DOUSearchParams, DOUPeriod } from '@/lib/dou-api';
import {
  DOUClassifier,
  AdvancedFilters,
  DOUDocumentCategory,
  ApprovalStatus,
  DateRangePreset,
  RELEVANT_ORGAOS,
} from '@/lib/dou-classifier';
import { apiLogger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();

    const {
      searchTerm,
      sections,
      selectedOrgaos,
      customOrgao,
      datePreset,
      dateFrom,
      dateTo,
      categories,
      statuses,
      minConfidence,
      includeKeywords,
      excludeKeywords,
      maxResults,
    } = body;

    console.log('[DOU Search Filtered] Iniciando busca com filtros');
    console.log('[DOU Search Filtered] Termo:', searchTerm);
    console.log('[DOU Search Filtered] Seções:', sections);
    console.log('[DOU Search Filtered] Período:', datePreset);

    // PASSO 1: Buscar documentos na API DOU
    let results;

    if (datePreset === 'custom' && dateFrom && dateTo) {
      // Busca personalizada por data
      const client = new DOUClient();
      const params: DOUSearchParams = {
        searchTerm: searchTerm || 'licitação',
        sections: sections.length > 0 ? sections : undefined,
        period: DOUPeriod.PERSONALIZADO,
        publishFrom: new Date(dateFrom).toLocaleDateString('pt-BR').split('/').reverse().join('-'),
        publishTo: new Date(dateTo).toLocaleDateString('pt-BR').split('/').reverse().join('-'),
        maxResults: maxResults || 100,
      };
      results = await client.search(params);
    } else {
      // Busca por preset
      if (datePreset === DateRangePreset.ULTIMO_MES || datePreset === DateRangePreset.ULTIMOS_3_MESES) {
        results = await searchLastMonth(
          searchTerm || 'licitação',
          sections.length > 0 ? sections : undefined,
          maxResults || 100
        );
      } else {
        results = await searchLastWeek(
          searchTerm || 'licitação',
          sections.length > 0 ? sections : undefined,
          maxResults || 100
        );
      }
    }

    console.log(`[DOU Search Filtered] ${results.length} documentos encontrados`);

    // PASSO 2: Classificar documentos
    const classifications = DOUClassifier.classifyBatch(results);
    const stats = DOUClassifier.getStats(classifications);

    console.log('[DOU Search Filtered] Classificação concluída');
    console.log(`[DOU Search Filtered] Auto-aprovados: ${stats.autoApproved}`);
    console.log(`[DOU Search Filtered] Pendentes: ${stats.pending}`);
    console.log(`[DOU Search Filtered] Rejeitados: ${stats.autoRejected}`);

    // PASSO 3: Aplicar filtros avançados
    const advancedFilters: AdvancedFilters = {};

    // Filtro por seção (já aplicado na busca, mas vamos garantir)
    if (sections && sections.length > 0) {
      advancedFilters.sections = sections;
    }

    // Filtro por órgão
    const orgaosList: string[] = [];
    if (selectedOrgaos && selectedOrgaos.length > 0) {
      selectedOrgaos.forEach((orgKey: string) => {
        if (orgKey === 'agu') orgaosList.push(...RELEVANT_ORGAOS.AGU);
        else if (orgKey === 'tcu') orgaosList.push(...RELEVANT_ORGAOS.TCU);
        else if (orgKey === 'cgu') orgaosList.push(...RELEVANT_ORGAOS.CGU);
        else if (orgKey === 'mgi') orgaosList.push(...RELEVANT_ORGAOS.MGI);
        else if (orgKey === 'presidencia') orgaosList.push(...RELEVANT_ORGAOS.PRESIDENCIA);
      });
    }
    if (customOrgao) {
      orgaosList.push(customOrgao);
    }
    if (orgaosList.length > 0) {
      advancedFilters.orgaos = orgaosList;
    }

    // Filtro por data (se não for busca personalizada)
    if (datePreset !== 'custom' && datePreset !== DateRangePreset.ULTIMA_SEMANA) {
      const dateRange = DOUClassifier.getDateRangeFromPreset(datePreset as DateRangePreset);
      advancedFilters.dateFrom = dateRange.from;
      advancedFilters.dateTo = dateRange.to;
    } else if (datePreset === 'custom' && dateFrom && dateTo) {
      advancedFilters.dateFrom = new Date(dateFrom);
      advancedFilters.dateTo = new Date(dateTo);
    }

    // Filtro por categoria
    if (categories && categories.length > 0) {
      advancedFilters.categories = categories as DOUDocumentCategory[];
    }

    // Filtro por status
    if (statuses && statuses.length > 0) {
      advancedFilters.statuses = statuses as ApprovalStatus[];
    }

    // Filtro por confiança
    if (minConfidence && minConfidence > 0) {
      advancedFilters.minConfidence = minConfidence;
    }

    // Filtro por keywords
    if (includeKeywords) {
      advancedFilters.includeKeywords = includeKeywords
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0);
    }
    if (excludeKeywords) {
      advancedFilters.excludeKeywords = excludeKeywords
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0);
    }

    // Aplicar filtros
    const filteredResults = DOUClassifier.applyAdvancedFilters(
      results,
      classifications,
      advancedFilters
    );

    console.log(`[DOU Search Filtered] ${filteredResults.length} documentos após filtros`);

    // Diagnóstico: breakdown de status ANTES do sorting
    const statusBreakdownBefore = filteredResults.reduce((acc, result) => {
      const status = classifications.get(result)!.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('[DOU Search Filtered] 📊 Breakdown ANTES do sorting:', statusBreakdownBefore);

    // Calcular estatísticas de filtros
    const filterStats = DOUClassifier.getFilterStats(
      results.length,
      filteredResults.length,
      advancedFilters
    );

    // PASSO 4: Ordenar por prioridade (pending > auto_approved > auto_rejected)
    const statusPriority: Record<string, number> = {
      pending: 1,           // Revisão - PRIORIDADE MÁXIMA
      auto_approved: 2,     // Auto-aprovados
      auto_rejected: 3,     // Rejeitados - PRIORIDADE MÍNIMA
    };

    filteredResults.sort((a, b) => {
      const classA = classifications.get(a)!;
      const classB = classifications.get(b)!;

      // Primeiro: ordenar por status (prioridade)
      const priorityDiff = statusPriority[classA.status] - statusPriority[classB.status];
      if (priorityDiff !== 0) return priorityDiff;

      // Segundo: ordenar por confiança (maior primeiro)
      const confidenceDiff = classB.confidence - classA.confidence;
      if (confidenceDiff !== 0) return confidenceDiff;

      // Terceiro: ordenar por data (mais recente primeiro)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Diagnóstico: primeiros 10 documentos DEPOIS do sorting
    console.log('[DOU Search Filtered] 🔝 Primeiros 10 DEPOIS do sorting:');
    filteredResults.slice(0, 10).forEach((result, i) => {
      const classification = classifications.get(result)!;
      console.log(`  ${i + 1}. [${classification.status.toUpperCase()}] ${result.title.substring(0, 60)}...`);
    });

    // PASSO 5: Formatar resultados para o frontend
    const formattedResults = filteredResults.map((result) => {
      const classification = classifications.get(result)!;
      return {
        section: result.section,
        title: result.title,
        date: result.date,
        category: classification.category,
        status: classification.status,
        confidence: classification.confidence,
        hierarchyStr: result.hierarchyStr,
        abstract: result.abstract,
        href: result.href,
      };
    });

    return NextResponse.json({
      results: formattedResults,
      stats,
      filterStats,
    });
  } catch (error) {
    apiLogger.error({ err: error }, '[DOU Search Filtered] Erro:');
    return NextResponse.json(
      {
        error: 'Erro ao buscar documentos',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
