import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import jsPDF from 'jspdf';
import { getSiteUrl } from '@/lib/site-url';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

/**
 * Sanitiza texto para o jsPDF (Helvetica/WinANSI).
 *
 * O jsPDF default não embute fonte UTF-8, então emojis e símbolos fora do
 * WinANSI quebram o rendering — caracteres aparecem como "& þ" e o tracking
 * do font fica espaçado ("C o n s c i ê n c i a"). Substituímos os símbolos
 * comuns por equivalentes ASCII e removemos pictográficos.
 *
 * Aplicar SEMPRE em strings vindas de input externo (descrições, tags,
 * respostas IA, query do aluno) antes de passar para pdf.text.
 */
function sanitizeForPdf(text: string | null | undefined): string {
  if (!text) return '';
  return text
    // Substituições explícitas para preservar semântica
    .replace(/[✓✔☑]/g, '[OK]')
    .replace(/[✗✘☒]/g, '[X]')
    .replace(/[⚠️⚠]/g, '[!]')
    .replace(/[ℹ️ℹ]/g, '[i]')
    .replace(/[→➜➔➡]/g, '->')
    .replace(/[←⬅]/g, '<-')
    .replace(/[•·]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/…/g, '...')
    // Remove emojis/pictográficos sem equivalente
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/[\u{2300}-\u{23FF}]/gu, '')
    // Variation selectors e zero-width
    .replace(/[\u{FE00}-\u{FE0F}​-‍﻿]/gu, '')
    // Normaliza espaços (quebras simples preservadas)
    .replace(/[ \t]+/g, ' ')
    .trim();
}

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

    // 3. Recebe IDs dos documentos e contexto
    const body = await request.json();
    const { documentIds, mode = 'custom', searchContext } = body;

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
      pdf.setGState(pdf.GState({ opacity: 0.1 }));
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
        sanitizeForPdf(`Documento gerado para: ${user.name} (${user.email}) em ${new Date().toLocaleString('pt-BR')}`),
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
    pdf.text('Licitacoes e Contratos Publicos', pageWidth / 2, 60, { align: 'center' });

    // Linha separadora
    pdf.setDrawColor(0, 51, 102);
    pdf.setLineWidth(0.5);
    pdf.line(margin, 70, pageWidth - margin, 70);

    // Título do documento (varia por modo)
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    const documentTitle = mode === 'search'
      ? 'Relatorio de Pesquisa'
      : mode === 'favorites'
      ? 'Documentos Favoritos'
      : 'Documentos Selecionados';
    pdf.text(documentTitle, margin, 90);

    // Informações do aluno
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(80, 80, 80);
    pdf.text(sanitizeForPdf(`Aluno: ${user.name}`), margin, 100);
    pdf.text(sanitizeForPdf(`Email: ${user.email}`), margin, 107);

    let currentInfoY = 114;

    // Se for busca, mostra informações da pesquisa
    if (mode === 'search' && searchContext) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Pesquisa Realizada:', margin, currentInfoY);
      currentInfoY += 7;

      pdf.setFont('helvetica', 'normal');
      const queryLines = pdf.splitTextToSize(sanitizeForPdf(`"${searchContext.query}"`), maxLineWidth);
      pdf.text(queryLines, margin + 5, currentInfoY);
      currentInfoY += (queryLines.length * 5) + 5;

      const searchDate = new Date(searchContext.timestamp).toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      pdf.text(`Data da Pesquisa: ${searchDate}`, margin, currentInfoY);
      currentInfoY += 7;

      const searchTypeLabel = searchContext.searchType === 'ai' ? 'Busca Semantica com IA' : 'Busca Local';
      pdf.text(`Tipo de Busca: ${searchTypeLabel}`, margin, currentInfoY);
      currentInfoY += 7;

      // Se houver resposta da IA, adicionar em box destacado.
      // Sanitiza emojis (✓ → [OK], ⚠️ → [!] etc.) que jsPDF Helvetica não
      // renderiza — sem isso o output fica espaçado ("C o n s c i ê n c i a")
      // e com lixo "& þ".
      if (searchContext.aiResponse) {
        const sanitizedAi = sanitizeForPdf(searchContext.aiResponse);
        const aiLinesAll = pdf.splitTextToSize(sanitizedAi, maxLineWidth - 6);
        const visibleAiLines = aiLinesAll.slice(0, 6);
        const aiBoxHeight = Math.max(35, 10 + visibleAiLines.length * 5);

        pdf.setFillColor(240, 235, 255); // Roxo muito claro
        pdf.setDrawColor(147, 51, 234); // Roxo
        pdf.rect(margin, currentInfoY, maxLineWidth, aiBoxHeight, 'FD');

        pdf.setFontSize(9);
        pdf.setTextColor(76, 29, 149); // Roxo escuro
        pdf.setFont('helvetica', 'bold');
        pdf.text('ANALISE DA IA:', margin + 3, currentInfoY + 5);
        pdf.setFont('helvetica', 'normal');
        pdf.text(visibleAiLines, margin + 3, currentInfoY + 10);
        currentInfoY += aiBoxHeight + 5;
      }
    } else {
      pdf.text(sanitizeForPdf(`Data de Exportação: ${new Date().toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`), margin, currentInfoY);
      currentInfoY += 7;
    }

    pdf.text(`Total de Documentos: ${documents.length}`, margin, currentInfoY);
    currentInfoY += 10;

    // Box de aviso (altura dinâmica conforme número de linhas)
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    const avisoText = sanitizeForPdf(
      'Este documento foi gerado exclusivamente para o aluno identificado acima. E proibida a distribuicao, reproducao ou compartilhamento sem autorizacao previa.'
    );
    const avisoLines = pdf.splitTextToSize(avisoText, maxLineWidth - 6);
    const avisoBoxHeight = 10 + avisoLines.length * 5;

    pdf.setFillColor(255, 243, 205); // Amarelo claro
    pdf.setDrawColor(255, 193, 7); // Amarelo
    pdf.rect(margin, currentInfoY, maxLineWidth, avisoBoxHeight, 'FD');

    pdf.setTextColor(102, 77, 3); // Marrom
    pdf.setFont('helvetica', 'bold');
    pdf.text('ATENCAO:', margin + 3, currentInfoY + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.text(avisoLines, margin + 3, currentInfoY + 12);
    currentInfoY += avisoBoxHeight + 5;

    // Lista de documentos
    let currentY = currentInfoY + 10;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 51, 102);
    pdf.text('Lista de Documentos:', margin, currentY);

    currentY += 10;

    const categoryNames: Record<string, string> = {
      apostila: 'Apostilas e Material Didatico',
      acordao: 'Acordaos',
      parecer: 'Pareceres Juridicos',
      'parecer-vinculante': 'Pareceres Vinculantes',
      edital: 'Editais',
      artigo: 'Artigos e Doutrinas',
      'orientacao-normativa': 'Orientacoes Normativas',
      'orientacao_procedimento': 'Orientacoes de Procedimento',
      'manual-tcu': 'Manual TCU',
      'lei-artigo': 'Artigos da Lei 14.133/2021',
      'ato-normativo': 'Atos Normativos',
      'consulta_tcu': 'Respostas a Consultas TCU',
      'informativo': 'Informativos TCU',
      'enunciados': 'Enunciados (IBDA/INCP/CJF)',
      sumula: 'Sumulas TCU',
      'boa_pratica': 'Boas Praticas',
      decor: 'Pareceres DECOR',
      bibliografia: 'Bibliografia',
      outro: 'Outros Documentos',
    };

    const byCategory = new Map<string, typeof documents>();
    for (const doc of documents) {
      const cat = doc.category;
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(doc);
    }

    for (const [category, docs] of byCategory) {
      if (currentY > pageHeight - 60) {
        pdf.addPage();
        addWatermark();
        currentY = margin;
      }

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 102, 204);
      pdf.text(sanitizeForPdf(categoryNames[category] || category), margin, currentY);
      currentY += 8;

      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];

        if (currentY > pageHeight - 40) {
          pdf.addPage();
          addWatermark();
          currentY = margin;
        }

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(40, 40, 40);
        // Wrappa título longo — antes saía da página em pareceres vinculantes
        // ("ASSUNTO: Ocupação indígena do Parque Nacional Iguaçu. Ação de…").
        const titleLines = pdf.splitTextToSize(
          sanitizeForPdf((i + 1) + '. ' + doc.title),
          maxLineWidth - 6,
        );
        pdf.text(titleLines, margin + 3, currentY);
        currentY += titleLines.length * 5 + 1;

        if (doc.description) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(80, 80, 80);
          const descLines = pdf.splitTextToSize(sanitizeForPdf(doc.description), maxLineWidth - 6);
          pdf.text(descLines.slice(0, 3), margin + 6, currentY);
          currentY += (Math.min(descLines.length, 3) * 4) + 2;
        }

        if (doc.tags) {
          try {
            const tags = JSON.parse(doc.tags);
            if (Array.isArray(tags) && tags.length > 0) {
              pdf.setFontSize(8);
              pdf.setTextColor(100, 100, 100);
              pdf.text(sanitizeForPdf('Tags: ' + tags.slice(0, 5).join(', ')), margin + 6, currentY);
              currentY += 5;
            }
          } catch {
            // ignore
          }
        }

        // Se for busca e houver score de relevância, mostrar
        if (mode === 'search' && searchContext?.relevanceScores && searchContext.relevanceScores[doc.id]) {
          const relevance = searchContext.relevanceScores[doc.id];
          const relevancePercent = Math.round(relevance * 100);
          pdf.setFontSize(8);
          pdf.setTextColor(147, 51, 234); // Roxo
          pdf.setFont('helvetica', 'bold');
          pdf.text(`Relevancia: ${relevancePercent}%`, margin + 6, currentY);
          pdf.setFont('helvetica', 'normal');
          currentY += 5;
        }

        currentY += 3;
      }

      currentY += 5;
    }

    // Ultima pagina - Informacoes finais
    pdf.addPage();
    addWatermark();

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 51, 102);
    pdf.text('Informacoes Adicionais', margin, 40);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);
    const infoText = sanitizeForPdf(`Este documento contém ${documents.length} documentos selecionados pelo aluno ${user.name} na Área Restrita do site do Prof. Daniel Barral.

Para acessar o conteúdo completo dos documentos, links externos e materiais complementares, acesse a Área Restrita em:

${new URL('/area-restrita', getSiteUrl()).toString()}

Dúvidas ou suporte:
Email: contato@profdanielbarral.com.br

(c) ${new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados.`);

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
