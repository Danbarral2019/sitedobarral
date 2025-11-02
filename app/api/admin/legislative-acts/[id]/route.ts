import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';

/**
 * GET /api/admin/legislative-acts/[id]
 * Busca um ato normativo específico por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar se é admin
    const adminCheck = await verifyAdmin(request);
    if (adminCheck.error) {
      return adminCheck.response;
    }

    const act = await prisma.legislativeAct.findUnique({
      where: { id: params.id }
    });

    if (!act) {
      return NextResponse.json(
        { error: 'Ato normativo não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ act });

  } catch (error) {
    console.error('Erro ao buscar ato normativo:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar ato normativo' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/legislative-acts/[id]
 * Atualiza um ato normativo existente
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar se é admin
    const adminCheck = await verifyAdmin(request);
    if (adminCheck.error) {
      return adminCheck.response;
    }

    const body = await request.json();

    // Verificar se o ato existe
    const existing = await prisma.legislativeAct.findUnique({
      where: { id: params.id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Ato normativo não encontrado' },
        { status: 404 }
      );
    }

    // Construir dados de atualização
    const updateData: Record<string, unknown> = {};

    if (body.type !== undefined) updateData.type = body.type;
    if (body.number !== undefined) updateData.number = body.number;
    if (body.year !== undefined) updateData.year = parseInt(body.year);
    if (body.fullNumber !== undefined) updateData.fullNumber = body.fullNumber;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.ementa !== undefined) updateData.ementa = body.ementa;
    if (body.summary !== undefined) updateData.summary = body.summary || null;
    if (body.issuer !== undefined) updateData.issuer = body.issuer;
    if (body.publishDate !== undefined) updateData.publishDate = new Date(body.publishDate);
    if (body.effectiveDate !== undefined) {
      updateData.effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : null;
    }
    if (body.hierarchyLevel !== undefined) updateData.hierarchyLevel = body.hierarchyLevel;
    if (body.leiArticles !== undefined) {
      updateData.leiArticles = body.leiArticles ? JSON.stringify(body.leiArticles) : null;
    }
    if (body.officialUrl !== undefined) updateData.officialUrl = body.officialUrl || null;
    if (body.pdfUrl !== undefined) updateData.pdfUrl = body.pdfUrl || null;
    if (body.content !== undefined) updateData.content = body.content || null;

    // Atualizar ato normativo
    const act = await prisma.legislativeAct.update({
      where: { id: params.id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      act
    });

  } catch (error: unknown) {
    console.error('Erro ao atualizar ato normativo:', error);

    // Erro de unique constraint (fullNumber duplicado)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe outro ato normativo com este número/ano' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao atualizar ato normativo' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/legislative-acts/[id]
 * Exclui um ato normativo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar se é admin
    const adminCheck = await verifyAdmin(request);
    if (adminCheck.error) {
      return adminCheck.response;
    }

    // Verificar se o ato existe
    const existing = await prisma.legislativeAct.findUnique({
      where: { id: params.id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Ato normativo não encontrado' },
        { status: 404 }
      );
    }

    // Excluir ato normativo
    await prisma.legislativeAct.delete({
      where: { id: params.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Ato normativo excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir ato normativo:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir ato normativo' },
      { status: 500 }
    );
  }
}
