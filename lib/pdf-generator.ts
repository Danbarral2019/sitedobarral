import jsPDF from 'jspdf';

// ===========================
// Brand Palette (azul petróleo #20364e)
// ===========================
const BRAND = {
  950: [8, 13, 17],
  900: [14, 24, 33],
  800: [20, 34, 48],
  700: [26, 44, 63],
  600: [32, 54, 78],    // principal
  500: [58, 90, 115],
  400: [93, 129, 153],
  300: [141, 168, 192],
  200: [179, 197, 213],
  100: [217, 226, 234],
  50: [240, 244, 247],
} as const;

const ACCENT = {
  green: [22, 163, 74],    // para tags positivas
  amber: [217, 119, 6],    // para avisos
  red: [220, 38, 38],      // para erros
} as const;

type RGB = readonly [number, number, number];

// ===========================
// Shared PDF Utilities
// ===========================

class PDFBuilder {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  yPosition: number;
  pageNumber: number;
  userName?: string;

  constructor(userName?: string) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 20;
    this.contentWidth = this.pageWidth - 2 * this.margin;
    this.yPosition = this.margin;
    this.pageNumber = 1;
    this.userName = userName;
  }

  wrap(text: string, maxWidth?: number): string[] {
    return this.doc.splitTextToSize(text, maxWidth || this.contentWidth);
  }

  setColor(rgb: RGB) {
    this.doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  }

  setFill(rgb: RGB) {
    this.doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  }

  setDraw(rgb: RGB) {
    this.doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  }

  checkNewPage(requiredSpace: number) {
    if (this.yPosition + requiredSpace > this.pageHeight - 22) {
      this.doc.addPage();
      this.pageNumber++;
      this.yPosition = this.margin;
    }
  }

  addFooterToAllPages() {
    const total = this.doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      this.doc.setPage(p);
      this.drawFooter(p, total);
    }
  }

  private drawFooter(page: number, total: number) {
    const y = this.pageHeight - 15;

    // Linha separadora
    this.setDraw(BRAND[200]);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margin, y - 3, this.pageWidth - this.margin, y - 3);

    // Esquerda: branding
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'normal');
    this.setColor(BRAND[400]);
    this.doc.text('Prof. Daniel Barral  |  profdanielbarral.com.br', this.margin, y);

    // Direita: paginação
    this.doc.text(`${page} / ${total}`, this.pageWidth - this.margin, y, { align: 'right' });

    // Watermark do usuário
    if (this.userName) {
      this.doc.setFontSize(6);
      this.setColor(BRAND[200]);
      this.doc.text(
        `Gerado para ${this.userName}`,
        this.pageWidth / 2,
        this.pageHeight - 8,
        { align: 'center' }
      );
    }
  }

  // === HEADER UNIVERSAL ===
  drawHeader(subtitle: string) {
    // Faixa principal
    this.setFill(BRAND[700]);
    this.doc.rect(0, 0, this.pageWidth, 34, 'F');

    // Faixa accent
    this.setFill(BRAND[500]);
    this.doc.rect(0, 34, this.pageWidth, 1.5, 'F');

    // Detalhe decorativo lateral
    this.setFill(BRAND[400]);
    this.doc.rect(0, 0, 4, 35.5, 'F');

    // Logo/Título
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PROF. DANIEL BARRAL', this.pageWidth / 2, 14, { align: 'center' });

    // Subtítulo institucional
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.setColor(BRAND[200]);
    this.doc.text('Direito Administrativo  •  Licitações e Contratos  •  Lei 14.133/2021', this.pageWidth / 2, 22, {
      align: 'center',
    });

    // Subtítulo do documento
    this.doc.setFontSize(8);
    this.setColor(BRAND[300]);
    this.doc.text(subtitle, this.pageWidth / 2, 30, { align: 'center' });

    this.yPosition = 44;
  }

  // === SECTION LABEL ===
  drawSectionLabel(label: string, color: RGB = BRAND[600]) {
    this.doc.setFontSize(7.5);
    this.doc.setFont('helvetica', 'bold');
    this.setColor(color);
    this.doc.text(label.toUpperCase(), this.margin, this.yPosition);

    this.yPosition += 2;
    this.setDraw(color);
    this.doc.setLineWidth(0.6);
    this.doc.line(this.margin, this.yPosition, this.margin + 30, this.yPosition);

    // Linha fina estendida
    this.doc.setLineWidth(0.15);
    this.setDraw(BRAND[200]);
    this.doc.line(this.margin + 30, this.yPosition, this.pageWidth - this.margin, this.yPosition);

    this.yPosition += 5;
  }

  // === CARD BOX (fundo + barra lateral) ===
  drawCard(
    content: () => number,
    options: { barColor?: RGB; bgColor?: RGB; barWidth?: number } = {}
  ) {
    const { barColor = BRAND[600], bgColor = BRAND[50], barWidth = 3 } = options;
    const startY = this.yPosition;

    // Calcular altura do conteúdo
    const height = content();

    // Desenhar fundo e barra (retroativamente)
    // jsPDF não suporta z-order, então desenhamos primeiro
    // Vamos usar uma abordagem diferente: pré-calcular
    this.setFill(bgColor);
    this.doc.roundedRect(this.margin, startY, this.contentWidth, height, 2, 2, 'F');
    this.setFill(barColor);
    this.doc.rect(this.margin, startY, barWidth, height, 'F');
  }

  // === RENDER MARKDOWN-LIKE TEXT ===
  renderFormattedText(text: string, fontSize: number = 9.5) {
    // Parse simples de markdown: bullets, numeração, parágrafos
    const paragraphs = text.split('\n');
    const innerMargin = this.margin + 2;
    const innerWidth = this.contentWidth - 4;

    paragraphs.forEach((para) => {
      const trimmed = para.trim();
      if (!trimmed) {
        this.yPosition += 2;
        return;
      }

      this.checkNewPage(6);

      // Detectar bullet points
      const bulletMatch = trimmed.match(/^[-•]\s+(.*)/);
      const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.*)/);

      if (bulletMatch) {
        const bulletText = bulletMatch[1].replace(/\*\*/g, '');
        const lines = this.wrap(bulletText, innerWidth - 8);

        this.doc.setFontSize(fontSize);
        this.doc.setFont('helvetica', 'normal');
        this.setColor(BRAND[700]);

        // Bullet dot
        this.setFill(BRAND[500]);
        this.doc.circle(innerMargin + 2, this.yPosition - 1, 0.8, 'F');

        lines.forEach((line, i) => {
          this.checkNewPage(5);
          this.doc.text(line, innerMargin + 6, this.yPosition);
          this.yPosition += 4.5;
        });
      } else if (numberedMatch) {
        const numText = numberedMatch[2].replace(/\*\*/g, '');
        const numLabel = `${numberedMatch[1]}.`;
        const lines = this.wrap(numText, innerWidth - 10);

        this.doc.setFontSize(fontSize);
        this.doc.setFont('helvetica', 'bold');
        this.setColor(BRAND[600]);
        this.doc.text(numLabel, innerMargin + 1, this.yPosition);

        this.doc.setFont('helvetica', 'normal');
        this.setColor(BRAND[700]);
        lines.forEach((line) => {
          this.checkNewPage(5);
          this.doc.text(line, innerMargin + 7, this.yPosition);
          this.yPosition += 4.5;
        });
      } else {
        // Parágrafo normal — renderizar com negrito inline
        const cleanText = trimmed.replace(/\*\*/g, '');
        const lines = this.wrap(cleanText, innerWidth);

        this.doc.setFontSize(fontSize);
        this.doc.setFont('helvetica', 'normal');
        this.setColor([40, 40, 45]);
        lines.forEach((line) => {
          this.checkNewPage(5);
          this.doc.text(line, innerMargin, this.yPosition);
          this.yPosition += 4.5;
        });
      }
    });
  }

  // === DISCLAIMER ===
  drawDisclaimer() {
    this.checkNewPage(30);
    this.yPosition += 4;

    // Caixa de aviso
    const disclaimerText =
      'Este documento foi gerado automaticamente pelo sistema de Consulta IA do Prof. Daniel Barral. ' +
      'As respostas são geradas por Inteligência Artificial e podem conter imprecisões. ' +
      'Esta pesquisa foi realizada exclusivamente para fins acadêmicos e educacionais, não devendo ' +
      'este documento ser utilizado para instruir processos administrativos ou requerimentos a ' +
      'qualquer órgão público. Sempre consulte a legislação oficial e fontes primárias.';

    const lines = this.wrap(disclaimerText, this.contentWidth - 12);
    const boxHeight = lines.length * 3.5 + 10;

    this.setFill(BRAND[50]);
    this.doc.roundedRect(this.margin, this.yPosition, this.contentWidth, boxHeight, 2, 2, 'F');

    // Barra lateral amber
    this.doc.setFillColor(ACCENT.amber[0], ACCENT.amber[1], ACCENT.amber[2]);
    this.doc.rect(this.margin, this.yPosition, 3, boxHeight, 'F');

    // Label
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(ACCENT.amber[0], ACCENT.amber[1], ACCENT.amber[2]);
    this.doc.text('AVISO', this.margin + 6, this.yPosition + 5);

    // Texto
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'italic');
    this.setColor(BRAND[400]);
    let dY = this.yPosition + 10;
    lines.forEach((line) => {
      this.doc.text(line, this.margin + 6, dY);
      dY += 3.5;
    });

    this.yPosition += boxHeight + 6;
  }

  save(fileName: string) {
    this.addFooterToAllPages();
    this.doc.save(fileName);
  }
}

// ===========================
// Conversation PDF (Article Chat)
// ===========================

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

export function generateConversationPDF(options: PDFExportOptions): void {
  const { articleNumber, articleTitle, messages, userName } = options;

  const pdf = new PDFBuilder(userName);

  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Header
  pdf.drawHeader(`Chat IA  •  Artigo ${articleNumber}  •  ${dateStr}`);

  // Info box do artigo
  const titleText = articleTitle || `Artigo ${articleNumber} da Lei 14.133/2021`;
  const titleLines = pdf.wrap(titleText, pdf.contentWidth - 16);
  const infoBoxHeight = titleLines.length * 5 + 14;

  pdf.setFill(BRAND[50]);
  pdf.doc.roundedRect(pdf.margin, pdf.yPosition, pdf.contentWidth, infoBoxHeight, 2, 2, 'F');
  pdf.setFill(BRAND[600]);
  pdf.doc.rect(pdf.margin, pdf.yPosition, 3, infoBoxHeight, 'F');

  pdf.doc.setFontSize(7.5);
  pdf.doc.setFont('helvetica', 'bold');
  pdf.setColor(BRAND[500]);
  pdf.doc.text(`ARTIGO ${articleNumber}  •  LEI 14.133/2021`, pdf.margin + 7, pdf.yPosition + 5);

  pdf.doc.setFontSize(10);
  pdf.doc.setFont('helvetica', 'normal');
  pdf.setColor(BRAND[700]);
  let tY = pdf.yPosition + 11;
  titleLines.forEach((line) => {
    pdf.doc.text(line, pdf.margin + 7, tY);
    tY += 5;
  });

  pdf.yPosition += infoBoxHeight + 10;

  // Conversas
  messages.forEach((message, msgIdx) => {
    pdf.checkNewPage(25);

    // Label da pergunta
    if (messages.length > 1) {
      pdf.drawSectionLabel(`Pergunta ${msgIdx + 1}`);
    } else {
      pdf.drawSectionLabel('Pergunta');
    }

    // Box da pergunta
    const questionLines = pdf.wrap(message.question, pdf.contentWidth - 16);
    const qBoxHeight = questionLines.length * 5 + 8;

    pdf.setFill(BRAND[50]);
    pdf.doc.roundedRect(pdf.margin, pdf.yPosition, pdf.contentWidth, qBoxHeight, 2, 2, 'F');
    pdf.setFill(BRAND[600]);
    pdf.doc.rect(pdf.margin, pdf.yPosition, 3, qBoxHeight, 'F');

    pdf.doc.setFontSize(10);
    pdf.doc.setFont('helvetica', 'normal');
    pdf.setColor(BRAND[700]);
    let qY = pdf.yPosition + 5.5;
    questionLines.forEach((line) => {
      pdf.doc.text(line, pdf.margin + 7, qY);
      qY += 5;
    });

    // Data
    const msgDate = new Date(message.createdAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    pdf.doc.setFontSize(6.5);
    pdf.setColor(BRAND[300]);
    pdf.doc.text(msgDate, pdf.pageWidth - pdf.margin - 4, pdf.yPosition + 5.5, { align: 'right' });

    pdf.yPosition += qBoxHeight + 6;

    // Resposta
    if (message.answer) {
      pdf.checkNewPage(15);
      pdf.drawSectionLabel('Resposta IA', BRAND[500]);

      // Feedback badge
      if (message.wasHelpful !== null) {
        const fbText = message.wasHelpful ? '✓ Útil' : '✗ Não útil';
        const fbColor = message.wasHelpful ? ACCENT.green : ACCENT.red;
        pdf.doc.setFontSize(7);
        pdf.doc.setTextColor(fbColor[0], fbColor[1], fbColor[2]);
        pdf.doc.text(fbText, pdf.pageWidth - pdf.margin, pdf.yPosition - 7, { align: 'right' });
      }

      pdf.renderFormattedText(message.answer);
      pdf.yPosition += 6;
    }
  });

  // Disclaimer
  pdf.drawDisclaimer();

  // Save
  pdf.save(`Lei14133_Art${articleNumber}_Conversa_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ===========================
// Search Result PDF Export
// ===========================

interface SearchResultPDFSource {
  title: string;
  category: string;
  url?: string;
}

interface SearchResultLegalSource {
  type: string;
  title: string;
  url?: string;
}

interface SearchResultPDFOptions {
  query: string;
  answer: string;
  sources?: SearchResultPDFSource[];
  legalSources?: SearchResultLegalSource[];
  userName?: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export function generateSearchResultPDF(options: SearchResultPDFOptions): void {
  const { query, answer, sources, legalSources, userName, conversationHistory } = options;

  const pdf = new PDFBuilder(userName);

  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Header
  pdf.drawHeader(`Consulta IA  •  ${dateStr}`);

  // === PERGUNTA ===
  pdf.drawSectionLabel('Consulta');

  const questionLines = pdf.wrap(query, pdf.contentWidth - 16);
  const qBoxHeight = questionLines.length * 5.5 + 8;

  pdf.setFill(BRAND[50]);
  pdf.doc.roundedRect(pdf.margin, pdf.yPosition, pdf.contentWidth, qBoxHeight, 2, 2, 'F');
  pdf.setFill(BRAND[600]);
  pdf.doc.rect(pdf.margin, pdf.yPosition, 3, qBoxHeight, 'F');

  pdf.doc.setFontSize(10.5);
  pdf.doc.setFont('helvetica', 'normal');
  pdf.setColor(BRAND[700]);
  let qY = pdf.yPosition + 5.5;
  questionLines.forEach((line) => {
    pdf.doc.text(line, pdf.margin + 7, qY);
    qY += 5.5;
  });

  pdf.yPosition += qBoxHeight + 10;

  // === RESPOSTA IA ===
  pdf.checkNewPage(20);
  pdf.drawSectionLabel('Análise IA', BRAND[500]);

  pdf.renderFormattedText(answer);
  pdf.yPosition += 8;

  // === FUNDAMENTAÇÃO LEGAL ===
  if (legalSources && legalSources.length > 0) {
    pdf.checkNewPage(20);
    pdf.drawSectionLabel('Fundamentação Legal', BRAND[600]);

    legalSources.forEach((source) => {
      pdf.checkNewPage(10);

      const typeLabel = source.type === 'lei-artigo' ? '⚖' : '📋';
      const titleLines = pdf.wrap(source.title, pdf.contentWidth - 14);

      // Cada fonte como mini-card
      const itemHeight = titleLines.length * 4 + 5;
      pdf.setFill(BRAND[50]);
      pdf.doc.roundedRect(pdf.margin + 1, pdf.yPosition, pdf.contentWidth - 2, itemHeight, 1.5, 1.5, 'F');

      pdf.doc.setFontSize(8.5);
      pdf.doc.setFont('helvetica', 'normal');
      pdf.setColor(BRAND[700]);

      let lY = pdf.yPosition + 4;
      titleLines.forEach((line, i) => {
        pdf.doc.text(i === 0 ? `${typeLabel}  ${line}` : `     ${line}`, pdf.margin + 4, lY);
        lY += 4;
      });

      pdf.yPosition += itemHeight + 2;
    });

    pdf.yPosition += 4;
  }

  // === FONTES CONSULTADAS ===
  if (sources && sources.length > 0) {
    pdf.checkNewPage(20);
    pdf.drawSectionLabel('Fontes Consultadas');

    sources.forEach((source, idx) => {
      pdf.checkNewPage(12);

      const catLabel = getCategoryLabel(source.category);
      const sourceTitle = `${idx + 1}. ${source.title}`;
      const titleLines = pdf.wrap(sourceTitle, pdf.contentWidth - 6);

      pdf.doc.setFontSize(8.5);
      pdf.doc.setFont('helvetica', 'normal');
      pdf.setColor(BRAND[700]);

      titleLines.forEach((line) => {
        pdf.checkNewPage(5);
        pdf.doc.text(line, pdf.margin + 3, pdf.yPosition);
        pdf.yPosition += 4;
      });

      // Categoria tag
      pdf.doc.setFontSize(6.5);
      pdf.doc.setFont('helvetica', 'italic');
      pdf.setColor(BRAND[400]);
      pdf.doc.text(catLabel, pdf.margin + 3, pdf.yPosition);
      pdf.yPosition += 5;
    });

    pdf.yPosition += 4;
  }

  // === REFINAMENTOS (Follow-ups) ===
  if (conversationHistory && conversationHistory.length > 2) {
    pdf.checkNewPage(20);
    pdf.drawSectionLabel('Refinamentos');

    for (let i = 2; i < conversationHistory.length; i++) {
      const msg = conversationHistory[i];

      if (msg.role === 'user') {
        pdf.checkNewPage(15);

        const fqLines = pdf.wrap(msg.content, pdf.contentWidth - 16);
        const fqHeight = fqLines.length * 5 + 8;

        pdf.setFill(BRAND[50]);
        pdf.doc.roundedRect(pdf.margin, pdf.yPosition, pdf.contentWidth, fqHeight, 2, 2, 'F');
        pdf.setFill(BRAND[500]);
        pdf.doc.rect(pdf.margin, pdf.yPosition, 3, fqHeight, 'F');

        pdf.doc.setFontSize(9.5);
        pdf.doc.setFont('helvetica', 'normal');
        pdf.setColor(BRAND[700]);
        let fqY = pdf.yPosition + 5;
        fqLines.forEach((line) => {
          pdf.doc.text(line, pdf.margin + 7, fqY);
          fqY += 5;
        });

        pdf.yPosition += fqHeight + 5;
      } else if (msg.role === 'assistant') {
        pdf.checkNewPage(10);
        pdf.renderFormattedText(msg.content, 9);
        pdf.yPosition += 6;
      }
    }
  }

  // Disclaimer
  pdf.drawDisclaimer();

  // Save
  pdf.save(`ConsultaIA_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ===========================
// Helpers
// ===========================

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    acordao: 'Acórdão TCU',
    'manual-tcu': 'Manual TCU',
    enunciados: 'Enunciado',
    'orientacao-normativa': 'Orientação Normativa',
    parecer: 'Parecer',
    'parecer-vinculante': 'Parecer Vinculante',
    decor: 'DECOR',
    apostila: 'Apostila',
    'lei-artigo': 'Lei 14.133/2021',
    'ato-normativo': 'Ato Normativo',
  };
  return labels[category] || category;
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
