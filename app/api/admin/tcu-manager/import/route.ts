import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import { prisma } from '@/lib/prisma';
import { courses } from '@/data/courses';
import { setLeiArticles, stringifyLeiArticles } from '@/lib/lei-articles';
import { apiLogger } from "@/lib/logger";

interface DocumentToImport {
  title: string;
  description: string;
  category: string;
  course: string; // Comma-separated course slugs
  tags: string; // Comma-separated tags
  leiArticles?: string; // Comma-separated article numbers from Lei 14.133/2021
  publico: string; // 'SIM' ou 'NAO'
  url: string;
  arquivo: string;
  isDuplicate?: boolean;

  // TCU enriched data (optional)
  tcuData?: {
    enunciado: string;
    area: string;
    tema: string;
    subtema: string;
    data: string;
    dataJulgamento?: Date;
    acordao: string;
    autorTese: string;
    legislacao: string;
    outrosIndexadores: string;
    tipoProcesso: string;
  };
  enrichment?: {
    success: boolean;
    ementaCompleta?: string;
    textoCompleto?: string;
    linkPDF?: string;
    metadados?: {
      relator?: string;
      dataSessao?: string;
      orgaoJulgador?: string;
    };
  };
  classification?: {
    success: boolean;
    confianca: number;
    raciocinio: string;
  };
}

/**
 * POST /api/admin/tcu-manager/import
 * Importa documentos para o banco, pulando duplicatas automaticamente
 */
export const POST = withAdminApi(async (request) => {
  const body = await request.json();
  const { documents } = body as { documents: DocumentToImport[] };

  if (!documents || !Array.isArray(documents)) {
    throw new ValidationError('Lista de documentos inválida');
  }

  console.log(`[TCU Manager Import] Iniciando importação de ${documents.length} documentos`);

  const results = {
    total: documents.length,
    imported: 0,
    duplicates: 0,
    failed: 0,
    errors: [] as string[],
    duplicateList: [] as string[],
    importedList: [] as string[],
  };

  for (const doc of documents) {
    try {
      // Pula duplicatas marcadas
      if (doc.isDuplicate) {
        results.duplicates++;
        results.duplicateList.push(doc.title);
        console.log(`[TCU Manager Import] Duplicata pulada: ${doc.title}`);
        continue;
      }

      // Processa curso(s)
      const courseSlugs = doc.course.split(',').map(c => c.trim());
      const courseIds: string[] = [];

      for (const slug of courseSlugs) {
        const course = courses.find(c => c.slug === slug);
        if (course) {
          courseIds.push(course.id);
        } else {
          console.warn(`[TCU Manager Import] Curso não encontrado: ${slug}`);
        }
      }

      if (courseIds.length === 0) {
        results.failed++;
        results.errors.push(`${doc.title}: Nenhum curso válido encontrado`);
        continue;
      }

      // Processa tags
      const tagsArray = doc.tags
        ? doc.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      // Processa artigos da Lei 14.133/2021
      const leiArticlesArray = doc.leiArticles
        ? doc.leiArticles.split(',').map(a => a.trim()).filter(Boolean)
        : [];

      // Define campos
      const isPublic = doc.publico?.toUpperCase() === 'SIM';
      const url = doc.url || '#';

      // Determina tipo do arquivo
      let type: 'pdf' | 'doc' | 'link' | 'video' = 'link';
      if (doc.arquivo) {
        const ext = doc.arquivo.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') type = 'pdf';
        else if (['doc', 'docx'].includes(ext || '')) type = 'doc';
        else if (['mp4', 'avi', 'mov'].includes(ext || '')) type = 'video';
      }

      // Prepara dados TCU se disponíveis
      const tcuFields = doc.tcuData ? {
        tcuNumeroAcordao: doc.tcuData.acordao,
        tcuAutorTese: doc.tcuData.autorTese,
        tcuArea: doc.tcuData.area,
        tcuTema: doc.tcuData.tema,
        tcuSubtema: doc.tcuData.subtema,
        tcuLegislacao: doc.tcuData.legislacao,
        tcuIndexadores: doc.tcuData.outrosIndexadores,
        tcuTipoProcesso: doc.tcuData.tipoProcesso,
        tcuDataJulgamento: doc.tcuData.dataJulgamento,
      } : {};

      const enrichmentFields = doc.enrichment?.success ? {
        tcuLinkPDF: doc.enrichment.linkPDF,
        tcuEmentaCompleta: doc.enrichment.ementaCompleta,
        tcuTextoCompleto: doc.enrichment.textoCompleto,
        tcuRelator: doc.enrichment.metadados?.relator,
        tcuOrgaoJulgador: doc.enrichment.metadados?.orgaoJulgador,
        tcuEnriquecidoEm: new Date(),
        tcuEnriquecimentoStatus: 'success',
      } : doc.enrichment ? {
        tcuEnriquecimentoStatus: 'failed',
        tcuEnriquecimentoErro: 'Enriquecimento falhou',
      } : {};

      const classificationFields = doc.classification?.success ? {
        tcuClassificadoEm: new Date(),
        tcuRevisadoPorAdmin: true, // Foi revisado no wizard
      } : {};

      // Build metaTcu data for satellite table
      const metaTcuData: Record<string, unknown> = {};
      if (doc.tcuData) {
        if (doc.tcuData.acordao) metaTcuData.numeroAcordao = doc.tcuData.acordao;
        if (doc.tcuData.autorTese) metaTcuData.autorTese = doc.tcuData.autorTese;
        if (doc.tcuData.area) metaTcuData.area = doc.tcuData.area;
        if (doc.tcuData.tema) metaTcuData.tema = doc.tcuData.tema;
        if (doc.tcuData.subtema) metaTcuData.subtema = doc.tcuData.subtema;
        if (doc.tcuData.legislacao) metaTcuData.legislacao = doc.tcuData.legislacao;
        if (doc.tcuData.outrosIndexadores) metaTcuData.indexadores = doc.tcuData.outrosIndexadores;
        if (doc.tcuData.tipoProcesso) metaTcuData.tipoProcesso = doc.tcuData.tipoProcesso;
        if (doc.tcuData.dataJulgamento) metaTcuData.dataJulgamento = doc.tcuData.dataJulgamento;
      }
      if (doc.enrichment?.success) {
        if (doc.enrichment.linkPDF) metaTcuData.linkPDF = doc.enrichment.linkPDF;
        if (doc.enrichment.ementaCompleta) metaTcuData.ementaCompleta = doc.enrichment.ementaCompleta;
        if (doc.enrichment.textoCompleto) metaTcuData.textoCompleto = doc.enrichment.textoCompleto;
        if (doc.enrichment.metadados?.relator) metaTcuData.relator = doc.enrichment.metadados.relator;
        if (doc.enrichment.metadados?.orgaoJulgador) metaTcuData.orgaoJulgador = doc.enrichment.metadados.orgaoJulgador;
        metaTcuData.enriquecidoEm = new Date();
        metaTcuData.enriquecimentoStatus = 'success';
      } else if (doc.enrichment) {
        metaTcuData.enriquecimentoStatus = 'failed';
        metaTcuData.enriquecimentoErro = 'Enriquecimento falhou';
      }
      if (doc.classification?.success) {
        metaTcuData.classificadoEm = new Date();
        metaTcuData.revisadoPorAdmin = true;
      }

      // Cria documento para cada curso
      for (const courseId of courseIds) {
        await prisma.document.create({
          data: {
            title: doc.title,
            description: doc.description || '',
            type,
            url: doc.enrichment?.linkPDF || url, // Usa PDF do TCU se disponível
            category: doc.category,
            courseId,
            isPublic,
            tags: JSON.stringify(tagsArray),
            ...setLeiArticles(leiArticlesArray), // Artigos da Lei 14.133/2021
            aiSuggestedArticles: doc.classification?.success
              ? stringifyLeiArticles(leiArticlesArray)
              : undefined, // Salva sugestões da IA
            reviewed: true, // TCU docs já revisados
            // Dual-write: flat fields (transition) + satellite table
            ...tcuFields,
            ...enrichmentFields,
            ...classificationFields,
            ...(Object.keys(metaTcuData).length > 0 ? {
              metaTcu: {
                create: metaTcuData,
              },
            } : {}),
          },
        });
      }

      results.imported += courseIds.length;
      results.importedList.push(doc.title);
      console.log(`[TCU Manager Import] Importado: ${doc.title} (${courseIds.length} curso(s))`);

    } catch (error) {
      apiLogger.error({ err: error }, `[TCU Manager Import] Erro ao importar "${doc.title}":`);
      results.failed++;
      results.errors.push(
        `${doc.title}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      );
    }
  }

  console.log('[TCU Manager Import] Resultado:', {
    total: results.total,
    imported: results.imported,
    duplicates: results.duplicates,
    failed: results.failed,
  });

  return NextResponse.json({
    success: true,
    results,
  });

});
