import { Document } from './types';
import { prisma } from './prisma';
import { Document as PrismaDocument } from '@prisma/client';
import { safeParseArray } from './utils';

/**
 * Adiciona um novo documento
 */
export async function addDocument(
  courseId: string,
  title: string,
  description: string,
  type: 'pdf' | 'doc' | 'link' | 'video',
  category: 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'orientacao-normativa' | 'enunciados' | 'outro',
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
      leiArticles: JSON.stringify(leiArticles),
      alternativeUrls: alternativeUrls || null,
      onNumber: onNumber || null,
      onYear: onYear || null,
      entityType: entityType || null,
      enunciadoNumber: enunciadoNumber || null,
      adminNotes: notes || null, // Campo correto no schema
    },
  });

  return {
    id: dbDocument.id,
    title: dbDocument.title,
    description: dbDocument.description || undefined,
    type: dbDocument.type as 'pdf' | 'doc' | 'link' | 'video',
    url: dbDocument.url,
    category: dbDocument.category as 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'outro',
    courseId: dbDocument.courseId,
    isPublic: dbDocument.isPublic,
    tags: safeParseArray(dbDocument.tags),
    leiArticles: safeParseArray(dbDocument.leiArticles),
    uploadedAt: dbDocument.uploadedAt,
    size: dbDocument.size || undefined,
  };
}

/**
 * Lista todos os documentos (com filtros opcionais)
 */
export async function listDocuments(filters?: {
  reviewed?: string | null;
  category?: string | null;
  period?: string | null;
}): Promise<Document[]> {
  try {
    console.log('[listDocuments] Buscando documentos no banco com filtros:', filters);

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

    const dbDocuments = await prisma.document.findMany({
      where,
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    console.log('[listDocuments] Encontrados', dbDocuments.length, 'documentos');

    return dbDocuments.map((doc: PrismaDocument) => {
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
          tags: safeParseArray(doc.tags),
          leiArticles: safeParseArray(doc.leiArticles),
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
        console.error('[listDocuments] Erro ao mapear documento:', doc.id, error);
        throw error;
      }
    });
  } catch (error) {
    console.error('[listDocuments] Erro:', error);
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
    courseId: doc.courseId,
    isPublic: doc.isPublic,
    tags: safeParseArray(doc.tags),
    leiArticles: safeParseArray(doc.leiArticles),
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
    courseId: doc.courseId,
    isPublic: doc.isPublic,
    tags: safeParseArray(doc.tags),
    leiArticles: safeParseArray(doc.leiArticles),
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
    if (updates.leiArticles !== undefined) data.leiArticles = JSON.stringify(updates.leiArticles);

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
      courseId: doc.courseId,
      isPublic: doc.isPublic,
      tags: safeParseArray(doc.tags),
      leiArticles: safeParseArray(doc.leiArticles),
      uploadedAt: doc.uploadedAt,
      size: doc.size || undefined,
    };
  } catch {
    return null;
  }
}
