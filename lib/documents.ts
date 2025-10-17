import { Document } from './types';
import { prisma } from './prisma';

/**
 * Adiciona um novo documento
 */
export async function addDocument(
  courseId: string,
  title: string,
  description: string,
  type: 'pdf' | 'doc' | 'link' | 'video',
  category: 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'outro',
  isPublic: boolean,
  url: string,
  size?: number,
  tags: string[] = []
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
    uploadedAt: dbDocument.uploadedAt,
    size: dbDocument.size || undefined,
  };
}

/**
 * Lista todos os documentos
 */
export async function listDocuments(): Promise<Document[]> {
  const dbDocuments = await prisma.document.findMany({
    orderBy: {
      uploadedAt: 'desc',
    },
  });

  return dbDocuments.map((doc) => ({
    id: doc.id,
    title: doc.title,
    description: doc.description || undefined,
    type: doc.type as 'pdf' | 'doc' | 'link' | 'video',
    url: doc.url,
    category: doc.category as 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'outro',
    courseId: doc.courseId,
    isPublic: doc.isPublic,
    tags: doc.tags ? JSON.parse(doc.tags) : [],
    uploadedAt: doc.uploadedAt,
    size: doc.size || undefined,
  }));
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

  const mapDocument = (doc: any): Document => ({
    id: doc.id,
    title: doc.title,
    description: doc.description || undefined,
    type: doc.type as 'pdf' | 'doc' | 'link' | 'video',
    url: doc.url,
    category: doc.category as 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'outro',
    courseId: doc.courseId,
    isPublic: doc.isPublic,
    tags: doc.tags ? JSON.parse(doc.tags) : [],
    uploadedAt: doc.uploadedAt,
    size: doc.size || undefined,
  });

  return {
    public: allDocs.filter(doc => doc.isPublic).map(mapDocument),
    restricted: allDocs.filter(doc => !doc.isPublic).map(mapDocument),
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
  } catch (error) {
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
    const data: any = {};

    if (updates.title !== undefined) data.title = updates.title;
    if (updates.description !== undefined) data.description = updates.description || null;
    if (updates.type !== undefined) data.type = updates.type;
    if (updates.category !== undefined) data.category = updates.category;
    if (updates.isPublic !== undefined) data.isPublic = updates.isPublic;
    if (updates.url !== undefined) data.url = updates.url;
    if (updates.size !== undefined) data.size = updates.size || null;
    if (updates.tags !== undefined) data.tags = JSON.stringify(updates.tags);

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
      uploadedAt: doc.uploadedAt,
      size: doc.size || undefined,
    };
  } catch (error) {
    return null;
  }
}
