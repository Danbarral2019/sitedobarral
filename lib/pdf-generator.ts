import jsPDF from 'jspdf';

interface ConversationMessage {
  question: string;
  answer: string | null;
  createdAt: string;
  wasHelpful: boolean | null;
}

interface PDFExportOptions {
  articleNumber: string;
  articleTitle?: string;
  messages: ConversationMessage[];
  userName?: string;
  userEmail?: string;
}

/**
 * Gera PDF formatado de uma conversa sobre Lei 14.133
 */
export function generateConversationPDF(options: PDFExportOptions): void {
  const { articleNumber, articleTitle, messages, userName, userEmail } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Helper para quebrar texto
  const wrapText = (text: string, maxWidth: number): string[] => {
    return doc.splitTextToSize(text, maxWidth);
  };

  // Helper para adicionar nova página se necessário
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      addWatermark(); // Adiciona marca d'água em cada página
    }
  };

  // Marca d'água em cada página
  const addWatermark = () => {
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(
      `Gerado por ${userName || 'Usuário'} - Prof. Daniel Barral`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.setTextColor(0, 0, 0); // Reset cor
  };

  // === HEADER ===
  doc.setFillColor(37, 99, 235); // Blue-600
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Prof. Daniel Barral', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Especialista em Licitações e Contratos', pageWidth / 2, 23, {
    align: 'center',
  });

  doc.setFontSize(12);
  doc.text('Conversa sobre Lei 14.133/2021', pageWidth / 2, 32, {
    align: 'center',
  });

  yPosition = 50;

  // === INFO BOX ===
  doc.setFillColor(239, 246, 255); // Blue-50
  doc.rect(margin, yPosition, contentWidth, 35, 'F');

  doc.setDrawColor(37, 99, 235); // Blue-600
  doc.setLineWidth(0.5);
  doc.rect(margin, yPosition, contentWidth, 35);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');

  yPosition += 8;
  doc.text(`Artigo: ${articleNumber}`, margin + 5, yPosition);

  yPosition += 6;
  doc.setFont('helvetica', 'normal');
  if (articleTitle) {
    const titleLines = wrapText(articleTitle, contentWidth - 10);
    titleLines.forEach((line) => {
      doc.text(line, margin + 5, yPosition);
      yPosition += 5;
    });
  } else {
    doc.text(`Artigo ${articleNumber} da Lei 14.133/2021`, margin + 5, yPosition);
    yPosition += 5;
  }

  yPosition += 2;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Data: ${new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    margin + 5,
    yPosition
  );

  if (userName) {
    yPosition += 4;
    doc.text(`Usuário: ${userName}`, margin + 5, yPosition);
  }

  yPosition += 15;

  // === CONVERSAS ===
  messages.forEach((message, index) => {
    const messageHeight = 60; // Espaço estimado por mensagem
    checkNewPage(messageHeight);

    // Box da pergunta
    doc.setFillColor(249, 250, 251); // Gray-50
    doc.setDrawColor(229, 231, 235); // Gray-200
    doc.setLineWidth(0.3);

    const questionY = yPosition;
    doc.rect(margin, questionY, contentWidth, 15, 'FD');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99); // Gray-600
    doc.text('Pergunta:', margin + 3, questionY + 5);

    doc.setFontSize(9);
    doc.setTextColor(156, 163, 175); // Gray-400
    const dateStr = new Date(message.createdAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.text(dateStr, contentWidth + margin - 3, questionY + 5, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const questionLines = wrapText(message.question, contentWidth - 6);
    let qY = questionY + 10;
    questionLines.forEach((line) => {
      doc.text(line, margin + 3, qY);
      qY += 4;
    });

    yPosition = qY + 3;

    // Box da resposta
    if (message.answer) {
      checkNewPage(30);

      doc.setFillColor(252, 252, 253); // White/Gray-50
      doc.setDrawColor(147, 197, 253); // Blue-300
      doc.setLineWidth(0.4);

      const answerY = yPosition;
      const answerLines = wrapText(message.answer, contentWidth - 6);
      const answerHeight = Math.max(15, answerLines.length * 4 + 10);

      doc.rect(margin, answerY, contentWidth, answerHeight, 'FD');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(29, 78, 216); // Blue-700
      doc.text('Resposta da IA:', margin + 3, answerY + 5);

      // Badge de feedback
      if (message.wasHelpful !== null) {
        const feedbackText = message.wasHelpful ? '👍 Útil' : '👎 Não útil';
        const feedbackColor = message.wasHelpful ? [34, 197, 94] : [239, 68, 68]; // Green-500 / Red-500
        doc.setFontSize(8);
        doc.setTextColor(feedbackColor[0], feedbackColor[1], feedbackColor[2]);
        doc.text(feedbackText, contentWidth + margin - 3, answerY + 5, { align: 'right' });
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81); // Gray-700
      let aY = answerY + 10;
      answerLines.forEach((line) => {
        checkNewPage(5);
        doc.text(line, margin + 3, aY);
        aY += 4;
      });

      yPosition = aY + 5;
    }

    yPosition += 5; // Espaço entre mensagens
  });

  // === FOOTER INFO ===
  checkNewPage(30);
  yPosition += 10;

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, yPosition, contentWidth + margin, yPosition);
  yPosition += 8;

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128); // Gray-500
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Este documento foi gerado automaticamente pelo sistema de Chat IA do Prof. Daniel Barral.',
    margin,
    yPosition
  );
  yPosition += 5;
  doc.text(
    'As respostas são geradas por Inteligência Artificial e podem conter imprecisões.',
    margin,
    yPosition
  );
  yPosition += 5;
  doc.text('Sempre consulte a legislação oficial e documentos fonte para informações precisas.', margin, yPosition);

  yPosition += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(37, 99, 235); // Blue-600
  doc.text('www.profdanielbarral.com', margin, yPosition);

  // Adiciona marca d'água na última página
  addWatermark();

  // Download do PDF
  const fileName = `Lei14133_Art${articleNumber}_Conversa_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

/**
 * Exporta uma única conversa (pergunta/resposta atual)
 */
export function exportCurrentConversation(
  articleNumber: string,
  question: string,
  answer: string,
  articleTitle?: string,
  userName?: string
): void {
  generateConversationPDF({
    articleNumber,
    articleTitle,
    messages: [
      {
        question,
        answer,
        createdAt: new Date().toISOString(),
        wasHelpful: null,
      },
    ],
    userName,
  });
}
