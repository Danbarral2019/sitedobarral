import { Document } from './types';
import { prisma } from './prisma';
import { Document as PrismaDocument } from '@prisma/client';

/**
 * Adiciona um novo documento
 */
export async function addDocument(
  courseId: string,
  title: string,
  description: string,
  type: 'pdf' | 'doc' | 'link' | 'video',
  category: 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'orientacao-normativa' | 'outro',
  isPublic: boolean,
  url: string,
  size?: number,
  tags: string[] = [],
  leiArticles: string[] = [],
  alternativeUrls?: string, // JSON string com URLs alternativas
  onNumber?: number, // Número da ON (para ordenação)
  onYear?: number // Ano da ON (para ordenação)
): Promise<Document> {
  const dbDocument = await prisma.document.create({
    data: {
      title,
      description: description || null,
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
    tags: dbDocument.tags ? JSON.parse(dbDocument.tags) : [],
    leiArticles: dbDocument.leiArticles ? JSON.parse(dbDocument.leiArticles) : [],
    uploadedAt: dbDocument.uploadedAt,
    size: dbDocument.size || undefined,
  };
}

/**
 * Lista todos os documentos
 */
export async function listDocuments(): Promise<Document[]> {
  try {
    console.log('[listDocuments] Buscando documentos no banco...');
    const dbDocuments = await prisma.document.findMany({
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
          courseId: doc.courseId,
          isPublic: doc.isPublic,
          tags: doc.tags ? JSON.parse(doc.tags) : [],
          leiArticles: doc.leiArticles ? JSON.parse(doc.leiArticles) : [],
          uploadedAt: doc.uploadedAt,
          size: doc.size || undefined,
          reviewed: doc.reviewed || false,
          reviewedAt: doc.reviewedAt || undefined,
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
    tags: doc.tags ? JSON.parse(doc.tags) : [],
    leiArticles: doc.leiArticles ? JSON.parse(doc.leiArticles) : [],
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
    tags: doc.tags ? JSON.parse(doc.tags) : [],
    leiArticles: doc.leiArticles ? JSON.parse(doc.leiArticles) : [],
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
      tags: doc.tags ? JSON.parse(doc.tags) : [],
      leiArticles: doc.leiArticles ? JSON.parse(doc.leiArticles) : [],
      uploadedAt: doc.uploadedAt,
      size: doc.size || undefined,
    };
  } catch {
    return null;
  }
}
