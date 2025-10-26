import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import jsPDF from 'jspdf';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

/**
 * POST: Gera PDF com marca d'água contendo documentos selecionados
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticação
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verifica JWT
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;
    const userEmail = payload.email as string;

    // 2. Busca informações do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // 3. Recebe IDs dos documentos
    const body = await request.json();
    const { documentIds } = body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Lista de documentos inválida' },
        { status: 400 }
      );
    }

    // 4. Busca documentos
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
      },
      orderBy: {
        category: 'asc',
      },
    });

    if (documents.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum documento encontrado' },
        { status: 404 }
      );
    }

    // 5. Gera PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxLineWidth = pageWidth - (margin * 2);

    // Função para adicionar marca d'água em todas as páginas
    const addWatermark = () => {
      pdf.saveGraphicsState();
      pdf.setGState(new pdf.GState({ opacity: 0.1 }));
      pdf.setFontSize(60);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        'Prof. Daniel Barral',
        pageWidth / 2,
        pageHeight / 2,
        {
          align: 'center',
          angle: 45,
        }
      );
      pdf.restoreGraphicsState();

      // Info do aluno no rodapé (pequeno e discreto)
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Documento gerado para: ${user.name} (${user.email}) em ${new Date().toLocaleString('pt-BR')}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    };

    // Página de capa
    addWatermark();

    pdf.setFontSize(28);
    pdf.setTextColor(0, 51, 102); // Azul escuro
    pdf.setFont('helvetica', 'bold');
    pdf.text('Prof. Daniel Barral', pageWidth / 2, 50, { align: 'center' });

    pdf.setFontSize(16);
    pdf.setTextColor(60, 60, 60);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Licitações e Contratos Públicos', pageWidth / 2, 60, { align: 'center' });

    // Linha separadora
    pdf.setDrawColor(0, 51, 102);
    pdf.setLineWidth(0.5);
    pdf.line(margin, 70, pageWidth - margin, 70);

    // Informações do aluno
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Documentos Selecionados', margin, 90);

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Aluno: ${user.name}`, margin, 100);
    pdf.text(`Email: ${user.email}`, margin, 107);
    pdf.text(`Data de Exportação: ${new Date().toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`, margin, 114);
    pdf.text(`Total de Documentos: ${documents.length}`, margin, 121);

    // Box de aviso
    pdf.setFillColor(255, 243, 205); // Amarelo claro
    pdf.setDrawColor(255, 193, 7); // Amarelo
    pdf.rect(margin, 130, maxLineWidth, 25, 'FD');

    pdf.setFontSize(9);
    pdf.setTextColor(102, 77, 3); // Marrom
    pdf.setFont('helvetica', 'bold');
    pdf.text('⚠️ ATENÇÃO:', margin + 3, 137);
    pdf.setFont('helvetica', 'normal');
    const avisoText = 'Este documento foi gerado exclusivamente para o aluno identificado acima. É proibida a distribuição, reprodução ou compartilhamento sem autorização prévia.';
    const avisoLines = pdf.splitTextToSize(avisoText, maxLineWidth - 6);
    pdf.text(avisoLines, margin + 3, 143);

    // Lista de documentos
    let currentY = 170;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 51, 102);
    pdf.text('Lista de Documentos:', margin, currentY);

    currentY += 10;

    // Organiza documentos por categoria
    const byCategory: Record<string, typeof documents> = {};
    documents.forEach(doc => {
      if (!byCategory[doc.category]) {
        byCategory[doc.category] = [];
      }
      byCategory[doc.category].push(doc);
    });

    // Mapeamento de nomes de categorias
    const categoryNames: Record<string, string> = {
      'apostila': 'Apostilas e Material Didático',
      'acordao': 'Acórdãos',
      'parecer': 'Pareceres Jurídicos',
      'edital': 'Editais',
      'artigo': 'Artigos e Doutrinas',
      'orientacao-normativa': 'Orientações Normativas',
      'outro': 'Outros Documentos',
    };

    for (const [category, docs] of Object.entries(byCategory)) {
      // Verifica se precisa de nova página
      if (currentY > pageHeight - 60) {
        pdf.addPage();
        addWatermark();
        currentY = margin;
      }

      // Categoria
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 102, 204);
      pdf.text(`📁 ${categoryNames[category] || category}`, margin, currentY);
      currentY += 8;

      // Documentos da categoria
      docs.forEach((doc, index) => {
        // Verifica se precisa de nova página
        if (currentY > pageHeight - 40) {
          pdf.addPage();
          addWatermark();
          currentY = margin;
        }

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(40, 40, 40);
        pdf.text(`${index + 1}. ${doc.title}`, margin + 3, currentY);
        currentY += 6;

        if (doc.description) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(80, 80, 80);
          const descLines = pdf.splitTextToSize(doc.description, maxLineWidth - 6);
          pdf.text(descLines.slice(0, 3), margin + 6, currentY); // Max 3 linhas
          currentY += (Math.min(descLines.length, 3) * 4) + 2;
        }

        // Tags se existirem
        if (doc.tags) {
          try {
            const tags = JSON.parse(doc.tags);
            if (Array.isArray(tags) && tags.length > 0) {
              pdf.setFontSize(8);
              pdf.setTextColor(100, 100, 100);
              pdf.text(`Tags: ${tags.slice(0, 5).join(', ')}`, margin + 6, currentY);
              currentY += 5;
            }
          } catch {
            // Ignora erro de parse
          }
        }

        currentY += 3;
      });

      currentY += 5;
    });

    // Última página - Informações finais
    pdf.addPage();
    addWatermark();

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 51, 102);
    pdf.text('Informações Adicionais', margin, 40);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);
    const infoText = `Este documento contém ${documents.length} documentos selecionados pelo aluno ${user.name} na Área Restrita do site do Prof. Daniel Barral.

Para acessar o conteúdo completo dos documentos, links externos e materiais complementares, acesse a Área Restrita em:

https://www.profdanielbarral.com.br/area-restrita

Dúvidas ou suporte:
Email: contato@profdanielbarral.com.br

© ${new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados.`;

    const infoLines = pdf.splitTextToSize(infoText, maxLineWidth);
    pdf.text(infoLines, margin, 50);

    // 6. Gera buffer do PDF
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));

    // 7. Retorna PDF como download
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="documentos-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[Export PDF] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar PDF' },
      { status: 500 }
    );
  }
}
