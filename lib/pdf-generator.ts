import jsPDF from 'jspdf';

// ═══════════════════════════════════════════════════════
// Paleta — Azul Petróleo (#20364e)  ·  Site do Barral
// ═══════════════════════════════════════════════════════

const C = {
  navy:     [32, 54, 78]   as const,  // #20364e  — cor principal do site
  dark:     [20, 34, 50]   as const,  // header bg escuro
  mid:      [55, 85, 112]  as const,  // texto destaque
  light:    [100, 130, 155] as const, // texto secundário
  muted:    [160, 178, 195] as const, // texto sutil
  rule:     [200, 212, 222] as const, // linhas/bordas
  bg:       [243, 246, 249] as const, // fundo de cards
  white:    [255, 255, 255] as const,
  text:     [35, 40, 50]   as const,  // texto corpo
  textSoft: [80, 90, 105]  as const,  // texto corpo leve
  amber:    [180, 120, 20]  as const, // aviso
  amberBg:  [255, 248, 235] as const,
} as const;

type RGB = readonly [number, number, number];

// ═══════════════════════════════════════════════════════
// PDFBuilder — motor reutilizável
// ═══════════════════════════════════════════════════════

class PDFBuilder {
  doc: jsPDF;
  pw: number;       // page width
  ph: number;       // page height
  ml: number;       // margin left
  mr: number;       // margin right
  cw: number;       // content width
  y: number;        // current y
  page: number;
  userName?: string;

  constructor(userName?: string) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.pw = this.doc.internal.pageSize.getWidth();   // 210
    this.ph = this.doc.internal.pageSize.getHeight();   // 297
    this.ml = 22;
    this.mr = 22;
    this.cw = this.pw - this.ml - this.mr;  // 166
    this.y = this.ml;
    this.page = 1;
    this.userName = userName;
  }

  // --- helpers ---
  color(c: RGB) { this.doc.setTextColor(c[0], c[1], c[2]); }
  fill(c: RGB)  { this.doc.setFillColor(c[0], c[1], c[2]); }
  draw(c: RGB)  { this.doc.setDrawColor(c[0], c[1], c[2]); }
  font(style: 'normal' | 'bold' | 'italic' | 'bolditalic', size: number) {
    this.doc.setFont('helvetica', style);
    this.doc.setFontSize(size);
  }
  wrap(text: string, maxW?: number): string[] {
    return this.doc.splitTextToSize(text, maxW ?? this.cw);
  }
  /** Trunca texto para caber em maxW no font/size atuais, adicionando "..." */
  truncate(text: string, maxW: number): string {
    if (this.doc.getTextWidth(text) <= maxW) return text;
    let t = text;
    while (t.length > 10 && this.doc.getTextWidth(t + '...') > maxW) {
      t = t.slice(0, -1);
    }
    return t + '...';
  }

  needsPage(space: number) {
    return this.y + space > this.ph - 20;
  }
  newPageIfNeeded(space: number) {
    if (this.needsPage(space)) {
      this.doc.addPage();
      this.page++;
      this.y = this.ml;
    }
  }

  // --- Footer em todas as páginas ---
  addFooters() {
    const n = this.doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      this.doc.setPage(p);
      const fy = this.ph - 14;

      // Linha
      this.draw(C.rule);
      this.doc.setLineWidth(0.3);
      this.doc.line(this.ml, fy, this.pw - this.mr, fy);

      // Esquerda: branding
      this.font('normal', 7);
      this.color(C.muted);
      this.doc.text('Prof. Daniel Barral  ·  profdanielbarral.com.br', this.ml, fy + 4);

      // Direita: paginação
      this.doc.text(`${p} / ${n}`, this.pw - this.mr, fy + 4, { align: 'right' });

      // Watermark do usuário
      if (this.userName) {
        this.font('normal', 6);
        this.color(C.rule);
        this.doc.text(`Gerado para ${this.userName}`, this.pw / 2, fy + 8, { align: 'center' });
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // HEADER — faixa azul petróleo limpa
  // ═══════════════════════════════════════════════════
  drawHeader(docType: string, dateStr: string) {
    // Faixa principal
    this.fill(C.dark);
    this.doc.rect(0, 0, this.pw, 30, 'F');

    // Accent stripe
    this.fill(C.navy);
    this.doc.rect(0, 30, this.pw, 1.2, 'F');

    // Título
    this.doc.setTextColor(255, 255, 255);
    this.font('bold', 15);
    this.doc.text('PROF. DANIEL BARRAL', this.pw / 2, 12, { align: 'center' });

    // Subtítulo institucional
    this.font('normal', 8);
    this.doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    this.doc.text('Direito Administrativo  ·  Licitações e Contratos  ·  Lei 14.133/2021', this.pw / 2, 19, { align: 'center' });

    // Tipo de documento + data
    this.font('normal', 7.5);
    this.doc.setTextColor(C.light[0], C.light[1], C.light[2]);
    this.doc.text(`${docType}  ·  ${dateStr}`, this.pw / 2, 26, { align: 'center' });

    this.y = 40;
  }

  // ═══════════════════════════════════════════════════
  // SECTION LABEL — linha curta + label
  // ═══════════════════════════════════════════════════
  sectionLabel(label: string) {
    this.newPageIfNeeded(14);
    this.font('bold', 8);
    this.color(C.navy);
    this.doc.text(label.toUpperCase(), this.ml, this.y);

    const labelW = Math.min(this.doc.getTextWidth(label.toUpperCase()) + 2, 35);
    this.y += 1.5;

    // Linha accent
    this.draw(C.navy);
    this.doc.setLineWidth(0.6);
    this.doc.line(this.ml, this.y, this.ml + labelW, this.y);

    // Linha fina estendida
    this.doc.setLineWidth(0.15);
    this.draw(C.rule);
    this.doc.line(this.ml + labelW, this.y, this.pw - this.mr, this.y);

    this.y += 5;
  }

  // ═══════════════════════════════════════════════════
  // CARD — fundo + barra lateral esquerda
  // ═══════════════════════════════════════════════════
  card(text: string, options: { fontSize?: number; barColor?: RGB; textColor?: RGB } = {}) {
    const { fontSize = 10.5, barColor = C.navy, textColor = C.text } = options;
    this.font('normal', fontSize);
    const innerW = this.cw - 14;
    const lines = this.wrap(text, innerW);
    const lh = fontSize * 0.48;
    const h = lines.length * lh + 7;

    this.newPageIfNeeded(h + 4);

    // Fundo
    this.fill(C.bg);
    this.doc.roundedRect(this.ml, this.y, this.cw, h, 1.5, 1.5, 'F');

    // Barra lateral
    this.fill(barColor);
    this.doc.rect(this.ml, this.y, 3, h, 'F');

    // Texto
    this.color(textColor);
    let ty = this.y + 4.5;
    for (const line of lines) {
      this.doc.text(line, this.ml + 8, ty);
      ty += lh;
    }

    this.y += h + 5;
  }

  // ═══════════════════════════════════════════════════
  // RENDER MARKDOWN — parágrafos, bullets, subtítulos
  // ═══════════════════════════════════════════════════
  renderMarkdown(text: string, baseFontSize: number = 9.5) {
    const lines = text.split('\n');
    const innerW = this.cw - 4;
    const lh = baseFontSize * 0.46;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();

      // Linha vazia → espaço
      if (!trimmed) {
        this.y += 2.5;
        continue;
      }

      this.newPageIfNeeded(6);

      // Detectar bullet (- ou * no início)
      const bulletMatch = trimmed.match(/^[-*•]\s+(.*)/);
      if (bulletMatch) {
        const bulletText = bulletMatch[1].replace(/\*\*/g, '');
        this.font('normal', baseFontSize);
        const wrapped = this.wrap(bulletText, innerW - 8);
        this.color(C.text);

        // Bolinha do bullet
        this.fill(C.mid);
        this.doc.circle(this.ml + 3.5, this.y - 0.8, 0.7, 'F');

        for (const wl of wrapped) {
          this.newPageIfNeeded(5);
          this.doc.text(wl, this.ml + 7, this.y);
          this.y += lh;
        }
        this.y += 1;
        continue;
      }

      // Detectar item numerado
      const numMatch = trimmed.match(/^(\d+)[.)]\s+(.*)/);
      if (numMatch) {
        const numText = numMatch[2].replace(/\*\*/g, '');
        this.font('bold', baseFontSize);
        this.color(C.navy);
        this.doc.text(`${numMatch[1]}.`, this.ml + 2, this.y);

        this.font('normal', baseFontSize);
        this.color(C.text);
        const wrapped = this.wrap(numText, innerW - 10);
        for (const wl of wrapped) {
          this.newPageIfNeeded(5);
          this.doc.text(wl, this.ml + 8, this.y);
          this.y += lh;
        }
        this.y += 1;
        continue;
      }

      // Detectar subtítulo (linha curta sem ponto final, sem bullet)
      const isSubtitle = trimmed.length < 65 && !trimmed.endsWith('.') && !trimmed.endsWith(':') && !trimmed.startsWith('(');
      const isLabelLine = trimmed.endsWith(':') && trimmed.length < 60;

      if (isSubtitle || isLabelLine) {
        this.y += 2;
        this.newPageIfNeeded(8);
        this.font('bold', baseFontSize + 0.5);
        this.color(C.navy);
        const clean = trimmed.replace(/\*\*/g, '');
        const wrapped = this.wrap(clean, innerW);
        for (const wl of wrapped) {
          this.doc.text(wl, this.ml + 1, this.y);
          this.y += lh + 0.5;
        }
        this.y += 1.5;
        continue;
      }

      // Parágrafo normal
      const clean = trimmed.replace(/\*\*/g, '');
      this.font('normal', baseFontSize);
      this.color(C.text);
      const wrapped = this.wrap(clean, innerW);
      for (const wl of wrapped) {
        this.newPageIfNeeded(5);
        this.doc.text(wl, this.ml + 1, this.y);
        this.y += lh;
      }
      this.y += 1;
    }
  }

  // ═══════════════════════════════════════════════════
  // DISCLAIMER — box aviso legal
  // ═══════════════════════════════════════════════════
  drawDisclaimer() {
    this.newPageIfNeeded(28);
    this.y += 6;

    const disclaimerText =
      'Este documento foi gerado automaticamente pelo sistema de Consulta IA do Prof. Daniel Barral. ' +
      'As respostas são baseadas em Inteligência Artificial e podem conter imprecisões. ' +
      'Esta pesquisa foi realizada exclusivamente para fins acadêmicos e educacionais, não devendo ' +
      'ser utilizada para instruir processos administrativos ou requerimentos a órgãos públicos. ' +
      'Sempre consulte a legislação oficial e fontes primárias.';

    this.font('italic', 7);
    const textLines = this.wrap(disclaimerText, this.cw - 14);
    const boxH = textLines.length * 3.2 + 10;

    this.fill(C.amberBg);
    this.doc.roundedRect(this.ml, this.y, this.cw, boxH, 1.5, 1.5, 'F');

    // Barra amber
    this.fill(C.amber);
    this.doc.rect(this.ml, this.y, 2.5, boxH, 'F');

    // Label
    this.font('bold', 6.5);
    this.doc.setTextColor(C.amber[0], C.amber[1], C.amber[2]);
    this.doc.text('AVISO', this.ml + 6, this.y + 4.5);

    // Texto
    this.font('italic', 7);
    this.color(C.light);
    let dy = this.y + 9;
    for (const line of textLines) {
      this.doc.text(line, this.ml + 6, dy);
      dy += 3.2;
    }

    this.y += boxH + 4;
  }

  save(fileName: string) {
    this.addFooters();
    this.doc.save(fileName);
  }
}

// ═══════════════════════════════════════════════════════
// generateSearchResultPDF — Consulta IA
// ═══════════════════════════════════════════════════════

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

  // ── HEADER ──
  pdf.drawHeader('Consulta IA', dateStr);

  // ── CONSULTA ──
  pdf.sectionLabel('Consulta');
  pdf.card(query, { barColor: C.navy, textColor: C.text });
  pdf.y += 2;

  // ── RESPOSTA IA ──
  pdf.sectionLabel('Análise');
  pdf.renderMarkdown(answer);
  pdf.y += 6;

  // ── FUNDAMENTAÇÃO LEGAL ──
  if (legalSources && legalSources.length > 0) {
    pdf.newPageIfNeeded(20);
    pdf.sectionLabel('Fundamentação Legal');

    // Separar artigos da lei vs outros
    const leiArtigos = legalSources.filter(s => s.type === 'lei-artigo');
    const outrosLegal = legalSources.filter(s => s.type !== 'lei-artigo');

    // Artigos em grid compacto (3 colunas)
    if (leiArtigos.length > 0) {
      const colW = (pdf.cw - 4) / 3;
      const rows = Math.ceil(leiArtigos.length / 3);
      const gridH = rows * 6 + 6;

      pdf.newPageIfNeeded(gridH + 4);
      pdf.fill(C.bg);
      pdf.doc.roundedRect(pdf.ml, pdf.y, pdf.cw, gridH, 1.5, 1.5, 'F');

      pdf.font('normal', 8.5);
      pdf.color(C.navy);

      let gy = pdf.y + 4.5;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 3; c++) {
          const idx = r * 3 + c;
          if (idx >= leiArtigos.length) break;
          const x = pdf.ml + 4 + c * colW;
          pdf.doc.text(leiArtigos[idx].title, x, gy);
        }
        gy += 6;
      }

      pdf.y += gridH + 3;
    }

    // Outros atos normativos em lista compacta
    if (outrosLegal.length > 0) {
      pdf.font('normal', 8);
      pdf.color(C.textSoft);

      for (const src of outrosLegal) {
        pdf.newPageIfNeeded(6);
        const displayTitle = pdf.truncate(src.title, pdf.cw - 8);
        pdf.doc.text(`·  ${displayTitle}`, pdf.ml + 2, pdf.y);
        pdf.y += 4.5;
      }
    }

    pdf.y += 5;
  }

  // ── FONTES CONSULTADAS ──
  if (sources && sources.length > 0) {
    pdf.newPageIfNeeded(16);
    pdf.sectionLabel('Fontes Consultadas');

    const catLabel = (cat: string): string => {
      const m: Record<string, string> = {
        acordao: 'Acórdão TCU',
        'manual-tcu': 'Manual TCU',
        enunciados: 'Enunciado',
        'orientacao-normativa': 'ON AGU',
        parecer: 'Parecer',
        'parecer-vinculante': 'Parecer Vinc.',
        decor: 'DECOR',
        apostila: 'Apostila',
        'lei-artigo': 'Lei 14.133',
        'ato-normativo': 'Ato Normativo',
      };
      return m[cat] || cat;
    };

    // Largura reservada para a tag de categoria à direita
    const tagMaxW = 28;
    const titleMaxW = pdf.cw - tagMaxW - 12;

    for (let i = 0; i < sources.length; i++) {
      pdf.newPageIfNeeded(9);

      const src = sources[i];
      const num = `${i + 1}.`;
      const cat = catLabel(src.category);

      // Número
      pdf.font('bold', 8);
      pdf.color(C.mid);
      pdf.doc.text(num, pdf.ml + 1, pdf.y);

      // Título — wrap em no máximo 2 linhas
      pdf.font('normal', 8);
      pdf.color(C.text);
      const titleLines = pdf.wrap(src.title, titleMaxW);

      // Se mais de 2 linhas, truncar a segunda
      const displayLines = titleLines.slice(0, 2);
      if (titleLines.length > 2) {
        let last = displayLines[1];
        if (last.length > 3) last = last.slice(0, -3) + '...';
        displayLines[1] = last;
      }

      const tx = pdf.ml + 8;
      for (let li = 0; li < displayLines.length; li++) {
        pdf.doc.text(displayLines[li], tx, pdf.y + li * 3.8);
      }

      // Tag categoria — na primeira linha, alinhada à direita
      pdf.font('italic', 6.5);
      pdf.color(C.muted);
      pdf.doc.text(cat, pdf.pw - pdf.mr, pdf.y, { align: 'right' });

      pdf.y += displayLines.length * 3.8 + 2.5;
    }

    pdf.y += 4;
  }

  // ── REFINAMENTOS (Follow-ups) ──
  if (conversationHistory && conversationHistory.length > 2) {
    pdf.newPageIfNeeded(16);
    pdf.sectionLabel('Refinamentos');

    for (let i = 2; i < conversationHistory.length; i++) {
      const msg = conversationHistory[i];

      if (msg.role === 'user') {
        pdf.newPageIfNeeded(12);
        pdf.card(msg.content, { fontSize: 9.5, barColor: C.mid, textColor: C.text });
      } else if (msg.role === 'assistant') {
        pdf.newPageIfNeeded(10);
        pdf.renderMarkdown(msg.content, 9);
        pdf.y += 5;
      }
    }
  }

  // ── DISCLAIMER ──
  pdf.drawDisclaimer();

  // ── SALVAR ──
  pdf.save(`ConsultaIA_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ═══════════════════════════════════════════════════════
// generateConversationPDF — Chat do Artigo
// ═══════════════════════════════════════════════════════

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
  pdf.drawHeader(`Chat IA  ·  Artigo ${articleNumber}`, dateStr);

  // Info box do artigo
  const titleText = articleTitle || `Artigo ${articleNumber} da Lei 14.133/2021`;
  pdf.sectionLabel(`Artigo ${articleNumber}  ·  Lei 14.133/2021`);
  pdf.card(titleText, { barColor: C.navy, textColor: C.navy });
  pdf.y += 4;

  // Conversas
  messages.forEach((message, msgIdx) => {
    pdf.newPageIfNeeded(20);

    // Label da pergunta
    if (messages.length > 1) {
      pdf.sectionLabel(`Pergunta ${msgIdx + 1}`);
    } else {
      pdf.sectionLabel('Pergunta');
    }

    // Box da pergunta
    pdf.card(message.question, { barColor: C.navy });

    // Data
    const msgDate = new Date(message.createdAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    pdf.font('normal', 6.5);
    pdf.color(C.muted);
    pdf.doc.text(msgDate, pdf.pw - pdf.mr, pdf.y - 3, { align: 'right' });

    // Resposta
    if (message.answer) {
      pdf.newPageIfNeeded(12);
      pdf.sectionLabel('Resposta IA');

      // Feedback badge
      if (message.wasHelpful !== null) {
        const fbText = message.wasHelpful ? 'Util' : 'Nao util';
        const fbColor: RGB = message.wasHelpful ? [22, 163, 74] : [220, 38, 38];
        pdf.font('bold', 7);
        pdf.doc.setTextColor(fbColor[0], fbColor[1], fbColor[2]);
        pdf.doc.text(fbText, pdf.pw - pdf.mr, pdf.y - 7, { align: 'right' });
      }

      pdf.renderMarkdown(message.answer);
      pdf.y += 6;
    }
  });

  // Disclaimer
  pdf.drawDisclaimer();

  // Save
  pdf.save(`Lei14133_Art${articleNumber}_Conversa_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ═══════════════════════════════════════════════════════
// generateCertificatePDF — Certificado de Conclusão
// ═══════════════════════════════════════════════════════

interface CertificatePDFOptions {
  studentName: string;
  courseTitle: string;
  estimatedHours: number | null;
  certificateNumber: string;
  issuedAt: Date;
  verificationUrl: string;
}

export async function generateCertificatePDF(options: CertificatePDFOptions): Promise<ArrayBuffer> {
  const {
    studentName,
    courseTitle,
    estimatedHours,
    certificateNumber,
    issuedAt,
    verificationUrl,
  } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();   // 297
  const ph = doc.internal.pageSize.getHeight();  // 210

  // ── MOLDURA EXTERNA ──
  doc.setDrawColor(C.navy[0], C.navy[1], C.navy[2]);
  doc.setLineWidth(2);
  doc.rect(8, 8, pw - 16, ph - 16);

  // Moldura interna decorativa
  doc.setLineWidth(0.5);
  doc.rect(12, 12, pw - 24, ph - 24);

  // Linha dourada decorativa
  doc.setDrawColor(180, 150, 80);
  doc.setLineWidth(0.3);
  doc.rect(14, 14, pw - 28, ph - 28);

  // ── HEADER ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(C.navy[0], C.navy[1], C.navy[2]);
  doc.text('PROF. DANIEL BARRAL', pw / 2, 30, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(C.light[0], C.light[1], C.light[2]);
  doc.text('Direito Administrativo  ·  Licitações e Contratos  ·  Lei 14.133/2021', pw / 2, 36, { align: 'center' });

  // Linha decorativa
  doc.setDrawColor(C.navy[0], C.navy[1], C.navy[2]);
  doc.setLineWidth(0.8);
  doc.line(pw / 2 - 60, 40, pw / 2 + 60, 40);

  // ── TÍTULO ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(C.navy[0], C.navy[1], C.navy[2]);
  doc.text('CERTIFICADO DE CONCLUSÃO', pw / 2, 58, { align: 'center' });

  // ── CORPO ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(C.text[0], C.text[1], C.text[2]);
  doc.text('Certificamos que', pw / 2, 76, { align: 'center' });

  // Nome do aluno (destaque)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(C.navy[0], C.navy[1], C.navy[2]);
  doc.text(studentName, pw / 2, 90, { align: 'center' });

  // Linha sob o nome
  const nameW = doc.getTextWidth(studentName);
  doc.setDrawColor(180, 150, 80);
  doc.setLineWidth(0.4);
  doc.line(pw / 2 - nameW / 2 - 5, 93, pw / 2 + nameW / 2 + 5, 93);

  // Descrição do curso
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(C.text[0], C.text[1], C.text[2]);
  doc.text('concluiu com aproveitamento o curso', pw / 2, 104, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(C.mid[0], C.mid[1], C.mid[2]);

  // Wrap do título do curso se necessário
  const titleLines = doc.splitTextToSize(courseTitle, pw - 80);
  let ty = 116;
  for (const line of titleLines) {
    doc.text(line, pw / 2, ty, { align: 'center' });
    ty += 8;
  }

  // Carga horária
  if (estimatedHours && estimatedHours > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(C.textSoft[0], C.textSoft[1], C.textSoft[2]);
    doc.text(`com carga horária estimada de ${estimatedHours} hora${estimatedHours > 1 ? 's' : ''}`, pw / 2, ty + 4, { align: 'center' });
    ty += 10;
  }

  // Data de emissão
  const dateStr = issuedAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(C.textSoft[0], C.textSoft[1], C.textSoft[2]);
  doc.text(`Emitido em ${dateStr}`, pw / 2, ty + 8, { align: 'center' });

  // ── ASSINATURA ──
  const signY = 162;
  doc.setDrawColor(C.navy[0], C.navy[1], C.navy[2]);
  doc.setLineWidth(0.5);
  doc.line(pw / 2 - 45, signY, pw / 2 + 45, signY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(C.navy[0], C.navy[1], C.navy[2]);
  doc.text('Prof. Daniel Barral', pw / 2, signY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(C.light[0], C.light[1], C.light[2]);
  doc.text('Instrutor', pw / 2, signY + 10, { align: 'center' });

  // ── RODAPÉ: Número + QR Code ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
  doc.text(`Certificado nº ${certificateNumber}`, 24, ph - 22);
  doc.text('Verifique a autenticidade em:', 24, ph - 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(C.mid[0], C.mid[1], C.mid[2]);
  doc.text(verificationUrl, 24, ph - 14);

  // QR Code (posição inferior direita)
  try {
    const QRCode = (await import('qrcode')).default;
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 120,
      margin: 1,
      color: { dark: '#20364e', light: '#ffffff' },
    });
    doc.addImage(qrDataUrl, 'PNG', pw - 48, ph - 42, 26, 26);
  } catch {
    // Fallback: texto se QR falhar
    doc.setFontSize(6);
    doc.text('[QR Code]', pw - 35, ph - 20, { align: 'center' });
  }

  doc.setFontSize(6);
  doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
  doc.text('profdanielbarral.com.br', pw / 2, ph - 12, { align: 'center' });

  return doc.output('arraybuffer');
}

// ═══════════════════════════════════════════════════════
// exportCurrentConversation — wrapper de conveniência
// ═══════════════════════════════════════════════════════

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
