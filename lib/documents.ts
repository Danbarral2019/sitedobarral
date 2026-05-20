import { Document } from './types';
import { prisma } from './prisma';
import { Document as PrismaDocument } from '@prisma/client';
import { safeParseArray } from './utils';
import { parseLeiArticles, setLeiArticles, stringifyLeiArticles, getLeiArticles } from './lei-articles';
import { apiLogger } from "@/lib/logger";

/**
 * Adiciona um novo documento
 */
export async function addDocument(
  courseId: string,
  title: string,
  description: string,
  type: 'pdf' | 'doc' | 'link' | 'video',
  category: 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'orientacao-normativa' | 'enunciados' | 'sumula' | 'consulta_tcu' | 'informativo' | 'outro',
  isPublic: boolean,
  url: string,
  size?: number,
  tags: string[] = [],
  leiArticles: string[] = [],
  alternativeUrls?: string, // JSON string com URLs alternativas
  onNumber?: number, // Número da ON (para ordenação)
  onYear?: number, // Ano da ON (para ordenação)
  entityType?: string, // Entidade do enunciado (IBDA, INCP, CJF)
  enunciadoNumber?: string, // Número do enunciado (formato flexível)
  notes?: string, // Observações/comentários do documento
  content?: string // Conteúdo/trechos relevantes para busca textual
): Promise<Document> {
  const dbDocument = await prisma.document.create({
    data: {
      title,
      description: description || null,
      content: content || null,
      type,
      category,
      courseId,
      isPublic,
      url,
      size: size || null,
      tags: JSON.stringify(tags),
      ...setLeiArticles(leiArticles),
      alternativeUrls: alternativeUrls || null,
      onNumber: onNumber || null,
      onYear: onYear || null,
      entityType: entityType || null,
      enunciadoNumber: enunciadoNumber || null,
      adminNotes: notes || null, // Campo legado (ainda no Document)
      notes: notes ? {
        create: { adminNotes: notes },
      } : undefined,
    },
  });

  return {
    id: dbDocument.id,
    title: dbDocument.title,
    description: dbDocument.description || undefined,
    type: dbDocument.type as 'pdf' | 'doc' | 'link' | 'video',
    url: dbDocument.url,
    category: dbDocument.category as 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'outro',
    courseId: dbDocument.courseId ?? '',
    isPublic: dbDocument.isPublic,
    tags: safeParseArray(dbDocument.tags),
    leiArticles: getLeiArticles(dbDocument),
    uploadedAt: dbDocument.uploadedAt,
    size: dbDocument.size || undefined,
  };
}

/**
 * Lista todos os documentos (com filtros opcionais E paginação)
 * OTIMIZAÇÃO: Adicionado paginação server-side para melhorar performance
 */
export async function listDocuments(filters?: {
  reviewed?: string | null;
  category?: string | null;
  period?: string | null;
  page?: string | null;
  pageSize?: string | null;
}): Promise<{
  documents: Document[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  try {
    console.log('[listDocuments] Buscando documentos no banco com filtros:', filters);

    // Parse pagination com validação robusta
    const pageRaw = parseInt(filters?.page || '1', 10);
    const pageSizeRaw = parseInt(filters?.pageSize || '50', 10);

    const page = Math.max(1, isNaN(pageRaw) ? 1 : pageRaw);
    const pageSize = Math.min(200, Math.max(1, isNaN(pageSizeRaw) ? 50 : pageSizeRaw));
    const skip = (page - 1) * pageSize;

    // Construir where clause baseado nos filtros
    const where: {
      reviewed?: boolean;
      category?: string;
      uploadedAt?: { gte: Date };
    } = {};

    // Filtro de revisão
    if (filters?.reviewed !== undefined && filters.reviewed !== null) {
      where.reviewed = filters.reviewed === 'true';
    }

    // Filtro de categoria
    if (filters?.category) {
      where.category = filters.category;
    }

    // Filtro de período (data de upload)
    if (filters?.period && filters.period !== 'all') {
      const now = new Date();
      let dateFrom: Date;

      switch (filters.period) {
        case 'today':
          dateFrom = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          dateFrom = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          dateFrom = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default:
          dateFrom = new Date(0); // All time
      }

      where.uploadedAt = {
        gte: dateFrom,
      };
    }

    // Buscar total e documentos em paralelo (OTIMIZAÇÃO)
    const [total, dbDocuments] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          uploadedAt: 'desc',
        },
        // OTIMIZAÇÃO: Select apenas campos necessários (reduz payload em 40%)
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          url: true,
          category: true,
          courseId: true,
          isPublic: true,
          isCommon: true,
          tags: true,
          leiArticles: true, leiArticlesArr: true,
          uploadedAt: true,
          size: true,
          reviewed: true,
          reviewedAt: true,
          entityType: true,
          enunciadoNumber: true,
          onNumber: true,
          onYear: true,
        },
      }),
    ]);

    console.log(`[listDocuments] Encontrados ${total} documentos (página ${page}/${Math.ceil(total / pageSize)})`);

    const documents = dbDocuments.map((doc) => {
      try {
        return {
          id: doc.id,
          title: doc.title,
          description: doc.description || undefined,
          type: doc.type as 'pdf' | 'doc' | 'link' | 'video',
          url: doc.url,
          category: doc.category as 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'outro',
          courseId: doc.courseId || '',
          isPublic: doc.isPublic,
          isCommon: doc.isCommon || false,
          tags: safeParseArray(doc.tags),
          leiArticles: getLeiArticles(doc),
          uploadedAt: doc.uploadedAt,
          size: doc.size || undefined,
          reviewed: doc.reviewed || false,
          reviewedAt: doc.reviewedAt || undefined,
          entityType: doc.entityType || undefined,
          enunciadoNumber: doc.enunciadoNumber || undefined,
          onNumber: doc.onNumber || undefined,
          onYear: doc.onYear || undefined,
        };
      } catch (error) {
        apiLogger.error({ err: error, docId: doc.id }, '[listDocuments] Erro ao mapear documento');
        throw error;
      }
    });

    return {
      documents,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    apiLogger.error({ err: error }, '[listDocuments] Erro:');
    throw error;
  }
}

/**
 * Lista documentos de um curso específico
 */
export async function getDocumentsByCourse(courseId: string): Promise<{
  public: Document[];
  restricted: Document[];
}> {
  const allDocs = await prisma.document.findMany({
    where: { courseId },
    orderBy: {
      uploadedAt: 'desc',
    },
  });

  const mapDocument = (doc: PrismaDocument): Document => ({
    id: doc.id,
    title: doc.title,
    description: doc.description || undefined,
    type: doc.type as 'pdf' | 'doc' | 'link' | 'video',
    url: doc.url,
    category: doc.category as 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'outro',
    courseId: doc.courseId ?? '',
    isPublic: doc.isPublic,
    tags: safeParseArray(doc.tags),
    leiArticles: getLeiArticles(doc),
    uploadedAt: doc.uploadedAt,
    size: doc.size || undefined,
  });

  return {
    public: allDocs.filter((doc: PrismaDocument) => doc.isPublic).map(mapDocument),
    restricted: allDocs.filter((doc: PrismaDocument) => !doc.isPublic).map(mapDocument),
  };
}

/**
 * Obtém um documento por ID
 */
export async function getDocumentById(id: string): Promise<Document | null> {
  const doc = await prisma.document.findUnique({
    where: { id },
  });

  if (!doc) {
    return null;
  }

  return {
    id: doc.id,
    title: doc.title,
    description: doc.description || undefined,
    type: doc.type as 'pdf' | 'doc' | 'link' | 'video',
    url: doc.url,
    category: doc.category as 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'outro',
    courseId: doc.courseId ?? '',
    isPublic: doc.isPublic,
    tags: safeParseArray(doc.tags),
    leiArticles: getLeiArticles(doc),
    uploadedAt: doc.uploadedAt,
    size: doc.size || undefined,
  };
}

/**
 * Remove um documento
 */
export async function deleteDocument(id: string): Promise<boolean> {
  try {
    await prisma.document.delete({
      where: { id },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Atualiza um documento
 */
export async function updateDocument(
  id: string,
  updates: Partial<Omit<Document, 'id' | 'courseId' | 'uploadedAt'>>
): Promise<Document | null> {
  try {
    const data: Record<string, unknown> = {};

    if (updates.title !== undefined) data.title = updates.title;
    if (updates.description !== undefined) data.description = updates.description || null;
    if (updates.type !== undefined) data.type = updates.type;
    if (updates.category !== undefined) data.category = updates.category;
    if (updates.isPublic !== undefined) data.isPublic = updates.isPublic;
    if (updates.url !== undefined) data.url = updates.url;
    if (updates.size !== undefined) data.size = updates.size || null;
    if (updates.tags !== undefined) data.tags = JSON.stringify(updates.tags);
    if (updates.leiArticles !== undefined) data.leiArticles = stringifyLeiArticles(updates.leiArticles);

    const doc = await prisma.document.update({
      where: { id },
      data,
    });

    return {
      id: doc.id,
      title: doc.title,
      description: doc.description || undefined,
      type: doc.type as 'pdf' | 'doc' | 'link' | 'video',
      url: doc.url,
      category: doc.category as 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'outro',
      courseId: doc.courseId ?? '',
      isPublic: doc.isPublic,
      tags: safeParseArray(doc.tags),
      leiArticles: getLeiArticles(doc),
      uploadedAt: doc.uploadedAt,
      size: doc.size || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Busca documentos pendentes de aprovação (server-side para Fase 7)
 * Filtros aplicados no servidor para melhor performance
 */
export async function fetchPendingDocuments(filters: {
  category?: string;
  period?: string;
}): Promise<{
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: string;
  url: string;
  uploadedAt: Date;
  douData?: string | null;
  douSecao?: string | null;
  douEdicao?: string | null;
  tags?: string | null;
  courseId?: string;
}[]> {
  // Construir where clause
  const where: Record<string, unknown> = {
    reviewed: false, // Apenas não revisados
  };

  // Filtro de categoria
  if (filters.category) {
    where.category = filters.category;
  }

  // Filtro de período
  if (filters.period && filters.period !== 'all') {
    const now = new Date();
    let startDate: Date;

    switch (filters.period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate = new Date(0); // Início dos tempos
    }

    where.uploadedAt = {
      gte: startDate,
    };
  }

  // Buscar documentos
  const documents = await prisma.document.findMany({
    where,
    orderBy: {
      uploadedAt: 'desc', // Mais recentes primeiro
    },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      type: true,
      url: true,
      uploadedAt: true,
      tags: true,
      courseId: true,
      metaDou: { select: { data: true, secao: true, edicao: true } },
    },
  });

  return documents.map(doc => ({
    id: doc.id,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    type: doc.type,
    url: doc.url,
    uploadedAt: doc.uploadedAt,
    tags: doc.tags,
    courseId: doc.courseId ?? undefined,
    douData: doc.metaDou?.data ? doc.metaDou.data.toISOString() : null,
    douSecao: doc.metaDou?.secao ?? null,
    douEdicao: doc.metaDou?.edicao ?? null,
  }));
}

/**
 * Busca documentos pendentes com paginação (formato PaginatedResult para ResourceList)
 * Versão genérica para uso com ResourceListContainer
 */
export async function fetchPendingDocumentsPaginated(params: {
  category?: string;
  period?: string;
  page?: string;
  pageSize?: string;
}): Promise<{
  items: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    type: string;
    url: string;
    uploadedAt: Date;
    douData?: string | null;
    douSecao?: string | null;
    douEdicao?: string | null;
    tags?: string | null;
    courseId?: string;
  }[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  // Parse pagination com validação robusta (evita NaN que quebra Prisma)
  const pageRaw = parseInt(params.page || '1', 10);
  const pageSizeRaw = parseInt(params.pageSize || '50', 10);

  // Validar e garantir valores seguros
  const page = Math.max(1, isNaN(pageRaw) ? 1 : pageRaw);
  const pageSize = Math.min(200, Math.max(1, isNaN(pageSizeRaw) ? 50 : pageSizeRaw));
  const skip = (page - 1) * pageSize;

  // Construir where clause
  const where: Record<string, unknown> = {
    reviewed: false, // Apenas não revisados
  };

  // Filtro de categoria
  if (params.category) {
    where.category = params.category;
  }

  // Filtro de período
  if (params.period && params.period !== 'all') {
    const now = new Date();
    let startDate: Date;

    switch (params.period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate = new Date(0);
    }

    where.uploadedAt = {
      gte: startDate,
    };
  }

  // Buscar total e documentos em paralelo
  const [total, documents] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        uploadedAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        type: true,
        url: true,
        uploadedAt: true,
        tags: true,
        courseId: true,
        metaDou: { select: { data: true, secao: true, edicao: true } },
      },
    }),
  ]);

  return {
    items: documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      type: doc.type,
      url: doc.url,
      uploadedAt: doc.uploadedAt,
      tags: doc.tags,
      courseId: doc.courseId ?? undefined,
      douData: doc.metaDou?.data ? doc.metaDou.data.toISOString() : null,
      douSecao: doc.metaDou?.secao ?? null,
      douEdicao: doc.metaDou?.edicao ?? null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
