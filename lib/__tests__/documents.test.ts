/**
 * Testes para lib/documents.ts
 *
 * Testa as funções de gerenciamento de documentos:
 * - addDocument, listDocuments, getDocumentsByCourse
 * - getDocumentById, deleteDocument, updateDocument
 * - fetchPendingDocuments, fetchPendingDocumentsPaginated
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do Prisma - deve vir antes dos imports
vi.mock('../prisma', () => ({
  prisma: {
    document: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Importar após o mock
import {
  addDocument,
  listDocuments,
  getDocumentsByCourse,
  getDocumentById,
  deleteDocument,
  updateDocument,
  fetchPendingDocuments,
  fetchPendingDocumentsPaginated,
} from '../documents';
import { prisma } from '../prisma';

// Cast para acessar os mocks
const mockPrisma = vi.mocked(prisma);

// Documento mock para testes
const mockDocument = {
  id: 'doc-123',
  title: 'Manual de Licitações',
  description: 'Descrição do documento',
  type: 'pdf',
  url: 'https://example.com/manual.pdf',
  category: 'apostila',
  courseId: 'course-1',
  isPublic: true,
  isCommon: false,
  tags: '["licitação","manual"]',
  leiArticles: '["Art. 1","Art. 2"]',
  uploadedAt: new Date('2024-01-15'),
  size: 1024000,
  reviewed: false,
  reviewedAt: null,
  entityType: null,
  enunciadoNumber: null,
  onNumber: null,
  onYear: null,
  content: null,
  alternativeUrls: null,
  adminNotes: null,
  douData: null,
  douSecao: null,
  douEdicao: null,
};

describe('Documents Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addDocument', () => {
    it('deve criar um documento com campos obrigatórios', async () => {
      mockPrisma.document.create.mockResolvedValue(mockDocument as never);

      const result = await addDocument(
        'course-1',
        'Manual de Licitações',
        'Descrição do documento',
        'pdf',
        'apostila',
        true,
        'https://example.com/manual.pdf'
      );

      expect(mockPrisma.document.create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('doc-123');
      expect(result.title).toBe('Manual de Licitações');
      expect(result.isPublic).toBe(true);
    });

    it('deve criar documento com tags e leiArticles', async () => {
      mockPrisma.document.create.mockResolvedValue(mockDocument as never);

      const result = await addDocument(
        'course-1',
        'Manual',
        'Descrição',
        'pdf',
        'apostila',
        true,
        'https://example.com/manual.pdf',
        1024,
        ['tag1', 'tag2'],
        ['Art. 1', 'Art. 2']
      );

      expect(result.tags).toEqual(['licitação', 'manual']);
      expect(result.leiArticles).toEqual(['Art. 1', 'Art. 2']);
    });

    it('deve criar documento com campos de ON (Orientação Normativa)', async () => {
      const docWithON = {
        ...mockDocument,
        onNumber: 42,
        onYear: 2024,
      };
      mockPrisma.document.create.mockResolvedValue(docWithON as never);

      await addDocument(
        'course-1',
        'ON 42/2024',
        'Orientação Normativa',
        'pdf',
        'orientacao-normativa',
        true,
        'https://example.com/on.pdf',
        undefined,
        [],
        [],
        undefined,
        42,
        2024
      );

      expect(mockPrisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            onNumber: 42,
            onYear: 2024,
          }),
        })
      );
    });
  });

  describe('listDocuments', () => {
    it('deve listar documentos com paginação padrão', async () => {
      mockPrisma.document.count.mockResolvedValue(100 as never);
      mockPrisma.document.findMany.mockResolvedValue([mockDocument] as never);

      const result = await listDocuments();

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(result.total).toBe(100);
      expect(result.totalPages).toBe(2);
      expect(result.documents).toHaveLength(1);
    });

    it('deve aplicar filtro de categoria', async () => {
      mockPrisma.document.count.mockResolvedValue(10 as never);
      mockPrisma.document.findMany.mockResolvedValue([mockDocument] as never);

      await listDocuments({ category: 'apostila' });

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'apostila',
          }),
        })
      );
    });

    it('deve aplicar filtro de revisão', async () => {
      mockPrisma.document.count.mockResolvedValue(5 as never);
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      await listDocuments({ reviewed: 'true' });

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reviewed: true,
          }),
        })
      );
    });

    it('deve aplicar filtro de período "today"', async () => {
      mockPrisma.document.count.mockResolvedValue(3 as never);
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      await listDocuments({ period: 'today' });

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            uploadedAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('deve aplicar filtro de período "week"', async () => {
      mockPrisma.document.count.mockResolvedValue(15 as never);
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      await listDocuments({ period: 'week' });

      expect(mockPrisma.document.findMany).toHaveBeenCalled();
    });

    it('deve aplicar filtro de período "month"', async () => {
      mockPrisma.document.count.mockResolvedValue(50 as never);
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      await listDocuments({ period: 'month' });

      expect(mockPrisma.document.findMany).toHaveBeenCalled();
    });

    it('deve respeitar paginação customizada', async () => {
      mockPrisma.document.count.mockResolvedValue(200 as never);
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      const result = await listDocuments({ page: '3', pageSize: '25' });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(25);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50, // (3-1) * 25
          take: 25,
        })
      );
    });

    it('deve limitar pageSize máximo em 200', async () => {
      mockPrisma.document.count.mockResolvedValue(500 as never);
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      const result = await listDocuments({ pageSize: '500' });

      expect(result.pageSize).toBe(200);
    });

    it('deve usar página 1 para valores inválidos', async () => {
      mockPrisma.document.count.mockResolvedValue(10 as never);
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      const result = await listDocuments({ page: 'invalid' });

      expect(result.page).toBe(1);
    });

    it('deve converter tags JSON para array', async () => {
      mockPrisma.document.count.mockResolvedValue(1 as never);
      mockPrisma.document.findMany.mockResolvedValue([mockDocument] as never);

      const result = await listDocuments();

      expect(result.documents[0].tags).toEqual(['licitação', 'manual']);
    });
  });

  describe('getDocumentsByCourse', () => {
    it('deve separar documentos públicos e restritos', async () => {
      const publicDoc = { ...mockDocument, isPublic: true };
      const restrictedDoc = { ...mockDocument, id: 'doc-456', isPublic: false };

      mockPrisma.document.findMany.mockResolvedValue([publicDoc, restrictedDoc] as never);

      const result = await getDocumentsByCourse('course-1');

      expect(result.public).toHaveLength(1);
      expect(result.restricted).toHaveLength(1);
      expect(result.public[0].isPublic).toBe(true);
      expect(result.restricted[0].isPublic).toBe(false);
    });

    it('deve retornar arrays vazios se não houver documentos', async () => {
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      const result = await getDocumentsByCourse('course-empty');

      expect(result.public).toEqual([]);
      expect(result.restricted).toEqual([]);
    });

    it('deve filtrar por courseId', async () => {
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      await getDocumentsByCourse('course-123');

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: 'course-123' },
        })
      );
    });
  });

  describe('getDocumentById', () => {
    it('deve retornar documento quando encontrado', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(mockDocument as never);

      const result = await getDocumentById('doc-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('doc-123');
      expect(result?.title).toBe('Manual de Licitações');
    });

    it('deve retornar null quando documento não existe', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null as never);

      const result = await getDocumentById('doc-inexistente');

      expect(result).toBeNull();
    });

    it('deve converter tags e leiArticles para array', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(mockDocument as never);

      const result = await getDocumentById('doc-123');

      expect(Array.isArray(result?.tags)).toBe(true);
      expect(Array.isArray(result?.leiArticles)).toBe(true);
    });
  });

  describe('deleteDocument', () => {
    it('deve retornar true quando documento é deletado', async () => {
      mockPrisma.document.delete.mockResolvedValue(mockDocument as never);

      const result = await deleteDocument('doc-123');

      expect(result).toBe(true);
      expect(mockPrisma.document.delete).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
      });
    });

    it('deve retornar false quando documento não existe', async () => {
      mockPrisma.document.delete.mockRejectedValue(new Error('Not found'));

      const result = await deleteDocument('doc-inexistente');

      expect(result).toBe(false);
    });
  });

  describe('updateDocument', () => {
    it('deve atualizar documento com sucesso', async () => {
      const updatedDoc = { ...mockDocument, title: 'Título Atualizado' };
      mockPrisma.document.update.mockResolvedValue(updatedDoc as never);

      const result = await updateDocument('doc-123', { title: 'Título Atualizado' });

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Título Atualizado');
    });

    it('deve atualizar múltiplos campos', async () => {
      const updatedDoc = {
        ...mockDocument,
        title: 'Novo Título',
        description: 'Nova Descrição',
        isPublic: false,
      };
      mockPrisma.document.update.mockResolvedValue(updatedDoc as never);

      await updateDocument('doc-123', {
        title: 'Novo Título',
        description: 'Nova Descrição',
        isPublic: false,
      });

      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Novo Título',
            description: 'Nova Descrição',
            isPublic: false,
          }),
        })
      );
    });

    it('deve converter tags para JSON ao atualizar', async () => {
      mockPrisma.document.update.mockResolvedValue(mockDocument as never);

      await updateDocument('doc-123', { tags: ['nova-tag-1', 'nova-tag-2'] });

      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: '["nova-tag-1","nova-tag-2"]',
          }),
        })
      );
    });

    it('deve retornar null quando documento não existe', async () => {
      mockPrisma.document.update.mockRejectedValue(new Error('Not found'));

      const result = await updateDocument('doc-inexistente', { title: 'Teste' });

      expect(result).toBeNull();
    });
  });

  describe('fetchPendingDocuments', () => {
    it('deve buscar documentos não revisados', async () => {
      mockPrisma.document.findMany.mockResolvedValue([mockDocument] as never);

      await fetchPendingDocuments({});

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reviewed: false,
          }),
        })
      );
    });

    it('deve aplicar filtro de categoria', async () => {
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      await fetchPendingDocuments({ category: 'parecer' });

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reviewed: false,
            category: 'parecer',
          }),
        })
      );
    });

    it('deve aplicar filtro de período "today"', async () => {
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      await fetchPendingDocuments({ period: 'today' });

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reviewed: false,
            uploadedAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('deve ordenar por uploadedAt desc', async () => {
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      await fetchPendingDocuments({});

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { uploadedAt: 'desc' },
        })
      );
    });
  });

  describe('fetchPendingDocumentsPaginated', () => {
    it('deve retornar resultado paginado', async () => {
      mockPrisma.document.count.mockResolvedValue(100 as never);
      mockPrisma.document.findMany.mockResolvedValue([mockDocument] as never);

      const result = await fetchPendingDocumentsPaginated({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(result.totalPages).toBe(2);
    });

    it('deve aplicar paginação corretamente', async () => {
      mockPrisma.document.count.mockResolvedValue(150 as never);
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      const result = await fetchPendingDocumentsPaginated({
        page: '2',
        pageSize: '30',
      });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(30);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 30, // (2-1) * 30
          take: 30,
        })
      );
    });

    it('deve filtrar apenas documentos não revisados', async () => {
      mockPrisma.document.count.mockResolvedValue(0 as never);
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      await fetchPendingDocumentsPaginated({});

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reviewed: false,
          }),
        })
      );
    });

    it('deve lidar com valores de página inválidos', async () => {
      mockPrisma.document.count.mockResolvedValue(10 as never);
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      const result = await fetchPendingDocumentsPaginated({
        page: 'invalid',
        pageSize: 'also-invalid',
      });

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    it('deve calcular totalPages corretamente', async () => {
      mockPrisma.document.count.mockResolvedValue(75 as never);
      mockPrisma.document.findMany.mockResolvedValue([] as never);

      const result = await fetchPendingDocumentsPaginated({
        pageSize: '25',
      });

      expect(result.totalPages).toBe(3); // 75 / 25 = 3
    });
  });

  describe('Edge Cases', () => {
    it('deve lidar com tags em formato CSV', async () => {
      const docWithCSVTags = {
        ...mockDocument,
        tags: 'tag1,tag2,tag3', // CSV ao invés de JSON
      };
      mockPrisma.document.findUnique.mockResolvedValue(docWithCSVTags as never);

      const result = await getDocumentById('doc-123');

      expect(result?.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('deve lidar com tags null', async () => {
      const docWithNullTags = {
        ...mockDocument,
        tags: null,
      };
      mockPrisma.document.findUnique.mockResolvedValue(docWithNullTags as never);

      const result = await getDocumentById('doc-123');

      expect(result?.tags).toEqual([]);
    });

    it('deve lidar com description null', async () => {
      const docWithNullDesc = {
        ...mockDocument,
        description: null,
      };
      mockPrisma.document.findUnique.mockResolvedValue(docWithNullDesc as never);

      const result = await getDocumentById('doc-123');

      expect(result?.description).toBeUndefined();
    });

    it('deve lidar com size null', async () => {
      const docWithNullSize = {
        ...mockDocument,
        size: null,
      };
      mockPrisma.document.findUnique.mockResolvedValue(docWithNullSize as never);

      const result = await getDocumentById('doc-123');

      expect(result?.size).toBeUndefined();
    });
  });
});
