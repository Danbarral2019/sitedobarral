/**
 * AGU Document Versioning System
 *
 * Detecta e registra mudanças em documentos AGU ao longo do tempo.
 * Cria versões históricas e calcula diff entre versões.
 */

import { prisma } from '@/lib/prisma';
import type { Document, Prisma } from '@prisma/client';

export interface ChangeDetectionResult {
  hasChanges: boolean;
  changeType: 'created' | 'updated' | 'minor_update' | 'major_update' | 'no_change';
  changesSummary: string;
  changeDetails: FieldChange[];
  significanceScore: number; // 0-100
}

export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: 'added' | 'removed' | 'modified';
  significance: 'low' | 'medium' | 'high';
}

/**
 * Compara dois documentos e detecta mudanças
 */
export async function detectChanges(
  existingDoc: Document,
  newData: Partial<Document>
): Promise<ChangeDetectionResult> {
  const changes: FieldChange[] = [];

  // Campos críticos (alta importância)
  const criticalFields = ['title', 'url', 'onNumber', 'onYear'];

  // Campos importantes (média importância)
  const importantFields = ['description', 'category', 'tags', 'alternativeUrls'];

  // Campos menores (baixa importância)
  const minorFields = ['content'];

  // Comparar cada campo
  for (const [field, newValue] of Object.entries(newData)) {
    if (field in existingDoc && newValue !== undefined) {
      const oldValue = existingDoc[field as keyof Document];

      // Normalizar para comparação
      const normalizedOld = normalizeValue(oldValue);
      const normalizedNew = normalizeValue(newValue);

      if (normalizedOld !== normalizedNew) {
        const significance = criticalFields.includes(field)
          ? 'high'
          : importantFields.includes(field)
            ? 'medium'
            : 'low';

        changes.push({
          field,
          oldValue: String(oldValue ?? ''),
          newValue: String(newValue ?? ''),
          changeType: !oldValue ? 'added' : !newValue ? 'removed' : 'modified',
          significance
        });
      }
    }
  }

  // Calcular tipo de mudança e score
  const result = calculateChangeType(changes);

  return result;
}

/**
 * Normaliza valores para comparação (remove espaços, lowercase, etc)
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = String(value).trim().toLowerCase();

  // Para arrays JSON, ordenar para comparação consistente
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) {
        return JSON.stringify(arr.sort());
      }
    } catch {
      // Não é JSON válido, retornar como está
    }
  }

  return str;
}

/**
 * Calcula tipo de mudança baseado nas alterações detectadas
 */
function calculateChangeType(changes: FieldChange[]): ChangeDetectionResult {
  if (changes.length === 0) {
    return {
      hasChanges: false,
      changeType: 'no_change',
      changesSummary: 'Nenhuma mudança detectada',
      changeDetails: [],
      significanceScore: 0
    };
  }

  // Calcular score de significância (0-100)
  let significanceScore = 0;
  const highChanges = changes.filter(c => c.significance === 'high').length;
  const mediumChanges = changes.filter(c => c.significance === 'medium').length;
  const lowChanges = changes.filter(c => c.significance === 'low').length;

  significanceScore = (highChanges * 40) + (mediumChanges * 20) + (lowChanges * 5);
  significanceScore = Math.min(100, significanceScore);

  // Determinar tipo de mudança
  let changeType: ChangeDetectionResult['changeType'];
  if (highChanges > 0) {
    changeType = 'major_update';
  } else if (mediumChanges > 0) {
    changeType = 'updated';
  } else {
    changeType = 'minor_update';
  }

  // Gerar resumo de mudanças
  const changesSummary = generateChangesSummary(changes);

  return {
    hasChanges: true,
    changeType,
    changesSummary,
    changeDetails: changes,
    significanceScore
  };
}

/**
 * Gera resumo legível das mudanças
 */
function generateChangesSummary(changes: FieldChange[]): string {
  const parts: string[] = [];

  const fieldLabels: Record<string, string> = {
    title: 'Título',
    description: 'Descrição',
    url: 'URL',
    category: 'Categoria',
    tags: 'Tags',
    onNumber: 'Número da ON',
    onYear: 'Ano da ON',
    alternativeUrls: 'URLs alternativas',
    content: 'Conteúdo'
  };

  for (const change of changes) {
    const label = fieldLabels[change.field] || change.field;

    if (change.changeType === 'added') {
      parts.push(`${label} adicionado`);
    } else if (change.changeType === 'removed') {
      parts.push(`${label} removido`);
    } else {
      parts.push(`${label} alterado`);
    }
  }

  return parts.join('; ');
}

/**
 * Salva uma nova versão do documento no histórico
 */
export async function saveDocumentVersion(
  documentId: string,
  changeResult: ChangeDetectionResult,
  detectedBy: string = 'scraper'
): Promise<void> {
  // Buscar documento atual
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1
      }
    }
  });

  if (!doc) {
    throw new Error(`Documento ${documentId} não encontrado`);
  }

  // Determinar número da nova versão
  const lastVersion = doc.versions[0];
  const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

  // Marcar versão anterior como não-atual
  if (lastVersion) {
    await prisma.documentVersion.update({
      where: { id: lastVersion.id },
      data: { isCurrentVersion: false }
    });
  }

  // Criar nova versão
  await prisma.documentVersion.create({
    data: {
      documentId: doc.id,
      versionNumber: newVersionNumber,

      // Snapshot dos dados
      title: doc.title,
      description: doc.description || '',
      url: doc.url,
      urlPDF: doc.url, // Para compatibilidade
      category: doc.category,
      tags: doc.tags || '[]',
      onNumber: doc.onNumber,
      onYear: doc.onYear,
      alternativeUrls: doc.alternativeUrls,

      // Metadados de mudança
      changeType: changeResult.changeType,
      changesSummary: changeResult.changesSummary,
      changeDetails: JSON.stringify(changeResult.changeDetails),

      // Rastreamento
      detectedBy,
      isCurrentVersion: true
    }
  });

  console.log(`[Versioning] Nova versão ${newVersionNumber} criada para documento ${doc.title}`);
}

/**
 * Busca ou cria documento, detectando mudanças automaticamente
 */
export async function findOrCreateWithVersioning(
  uniqueIdentifier: { onNumber: number; onYear: number } | { title: string },
  newData: Partial<Document>,
  detectedBy: string = 'scraper'
): Promise<{ document: Document; isNew: boolean; hasChanges: boolean }> {
  // Buscar documento existente
  let existingDoc: Document | null = null;

  if ('onNumber' in uniqueIdentifier) {
    existingDoc = await prisma.document.findFirst({
      where: {
        onNumber: uniqueIdentifier.onNumber,
        onYear: uniqueIdentifier.onYear
        // Removido filtro de category - onNumber + onYear já é único
      }
    });
  } else {
    existingDoc = await prisma.document.findFirst({
      where: {
        title: {
          equals: uniqueIdentifier.title,
          mode: 'insensitive'
        }
      }
    });
  }

  // Se não existe, criar novo
  if (!existingDoc) {
    const doc = await prisma.document.create({
      data: newData as Prisma.DocumentCreateInput
    });

    // Criar primeira versão
    await saveDocumentVersion(doc.id, {
      hasChanges: true,
      changeType: 'created',
      changesSummary: 'Documento criado',
      changeDetails: [],
      significanceScore: 100
    }, detectedBy);

    return { document: doc, isNew: true, hasChanges: true };
  }

  // Documento existe - detectar mudanças
  const changeResult = await detectChanges(existingDoc, newData);

  if (changeResult.hasChanges) {
    // Atualizar documento
    const updatedDoc = await prisma.document.update({
      where: { id: existingDoc.id },
      data: newData as Prisma.DocumentUpdateInput
    });

    // Salvar nova versão
    await saveDocumentVersion(updatedDoc.id, changeResult, detectedBy);

    return { document: updatedDoc, isNew: false, hasChanges: true };
  }

  return { document: existingDoc, isNew: false, hasChanges: false };
}

/**
 * Busca histórico de versões de um documento
 */
export async function getDocumentHistory(documentId: string) {
  const versions = await prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { versionNumber: 'desc' }
  });

  return versions;
}

/**
 * Compara duas versões específicas de um documento
 */
export async function compareVersions(versionId1: string, versionId2: string) {
  const [v1, v2] = await Promise.all([
    prisma.documentVersion.findUnique({ where: { id: versionId1 } }),
    prisma.documentVersion.findUnique({ where: { id: versionId2 } })
  ]);

  if (!v1 || !v2) {
    throw new Error('Versões não encontradas');
  }

  // Comparar campos
  const changes: FieldChange[] = [];
  const fields = ['title', 'description', 'url', 'category', 'tags', 'onNumber', 'onYear'];

  for (const field of fields) {
    const val1 = v1[field as keyof typeof v1];
    const val2 = v2[field as keyof typeof v2];

    if (normalizeValue(val1) !== normalizeValue(val2)) {
      changes.push({
        field,
        oldValue: String(val1 ?? ''),
        newValue: String(val2 ?? ''),
        changeType: 'modified',
        significance: 'medium'
      });
    }
  }

  return {
    version1: v1,
    version2: v2,
    changes,
    changesSummary: generateChangesSummary(changes)
  };
}

/**
 * Estatísticas de versionamento
 */
export async function getVersioningStats() {
  const [totalVersions, documentsWithVersions, recentChanges] = await Promise.all([
    prisma.documentVersion.count(),
    prisma.documentVersion.groupBy({
      by: ['documentId'],
      _count: true
    }),
    prisma.documentVersion.findMany({
      where: {
        changeType: {
          in: ['major_update', 'updated']
        }
      },
      orderBy: { detectedAt: 'desc' },
      take: 10,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            category: true
          }
        }
      }
    })
  ]);

  return {
    totalVersions,
    documentsWithMultipleVersions: documentsWithVersions.filter(d => d._count > 1).length,
    documentsWithVersions: documentsWithVersions.length,
    recentChanges
  };
}
