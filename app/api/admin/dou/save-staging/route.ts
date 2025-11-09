import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/dou/save-staging
 *
 * Salva documento DOU da busca filtrada na tabela DOUStagingDocument
 * para permitir aprovação/rejeição posterior.
 *
 * Body:
 * {
 *   title: string;
 *   abstract: string;
 *   fullContent?: string;
 *   url: string;
 *   section: string;
 *   publishDate: string;      // DD/MM/YYYY
 *   category: string;
 *   confidence: number;
 *   hierarchyStr: string;
 *   approvalStatus: string;
 * }
 *
 * Returns:
 * {
 *   id: string;               // ID do DOUStagingDocument criado
 *   existing: boolean;        // true se documento já existia
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse do body
    const body = await request.json();
    const {
      title,
      abstract,
      fullContent,
      url,
      section,
      publishDate,
      category,
      confidence,
      hierarchyStr,
      approvalStatus,
    } = body;

    // 3. Validações básicas
    if (!title || !url || !section || !publishDate) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: title, url, section, publishDate' },
        { status: 400 }
      );
    }

    // 4. Verificar se documento já existe (por URL)
    const existing = await prisma.dOUStagingDocument.findFirst({
      where: { url },
    });

    if (existing) {
      // Documento já salvo - retornar ID existente
      return NextResponse.json({
        id: existing.id,
        existing: true,
      });
    }

    // 5. Criar novo documento staging
    const stagingDoc = await prisma.dOUStagingDocument.create({
      data: {
        douId: url, // Usar URL como identificador único temporário
        title,
        abstract,
        fullContent: fullContent || null,
        url,
        section,
        publishDate,
        page: null,
        edition: null,
        category,
        confidence,
        hierarchyStr,
        approvalStatus,
        reasoning: JSON.stringify([]), // Vazio por padrão
        imported: false,
        createdAt: new Date(),
      },
    });

    return NextResponse.json({
      id: stagingDoc.id,
      existing: false,
    });

  } catch (error) {
    console.error('[DOU Save Staging] Error:', error);
    return NextResponse.json(
      {
        error: 'Erro ao salvar documento temporário',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
