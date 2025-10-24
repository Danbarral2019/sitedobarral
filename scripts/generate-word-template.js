const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType, BorderStyle, Table, TableRow, TableCell, WidthType } = require('docx');
const fs = require('fs');
const path = require('path');

// Função para criar uma linha divisória
function createDivider(text = '') {
  return new Paragraph({
    text: text || '═'.repeat(63),
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
  });
}

// Função para criar campo de metadados
function createMetadataField(label, placeholder, color = '2563EB') {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        font: 'Times New Roman',
        size: 24, // 12pt
      }),
      new TextRun({
        text: placeholder,
        font: 'Times New Roman',
        size: 24,
        color: color,
        italics: true,
      }),
    ],
    spacing: { after: 100 },
  });
}

// Criar documento
const doc = new Document({
  sections: [{
    properties: {
      page: {
        margin: {
          top: 1440,    // 1 polegada = 1440 twips
          right: 1440,
          bottom: 1440,
          left: 1440,
        },
      },
    },
    children: [
      // ==========================================
      // CABEÇALHO - METADADOS
      // ==========================================
      new Paragraph({
        text: 'TEMPLATE DE ARTIGO - PROF. DANIEL BARRAL',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),

      createDivider('METADADOS DO ARTIGO'),

      createMetadataField('Título', '[Digite o título do seu artigo aqui]'),

      createMetadataField('Autor', 'Prof. Daniel Barral', '000000'),

      createMetadataField('Data', '24/01/2025', '059669'),

      new Paragraph({
        children: [
          new TextRun({
            text: 'Tags: ',
            bold: true,
            font: 'Times New Roman',
            size: 24,
          }),
          new TextRun({
            text: '[Selecione 3-7 tags relevantes da lista abaixo, separadas por vírgula]',
            font: 'Times New Roman',
            size: 24,
            color: 'DC2626',
            italics: true,
          }),
        ],
        spacing: { after: 100 },
      }),

      // Lista de tags disponíveis
      new Paragraph({
        text: 'Tags Disponíveis:',
        bold: true,
        font: 'Times New Roman',
        size: 20,
        spacing: { before: 100, after: 50 },
      }),

      new Paragraph({
        text: 'Direito Administrativo, Direito Público, Licitações, Lei 14.133/2021, Nova Lei de Licitações, Contratações Públicas, Contratos Administrativos, Planejamento de Contratações, Diálogo Competitivo, Contratação Direta, Matriz de Riscos, ETP, PNCP, Sanções Administrativas, Gestão Pública, Administração Pública, Processo Licitatório, Gestão de Contratos, Fiscalização Contratual, Inovação em Contratações, Terceirização Pública',
        font: 'Times New Roman',
        size: 20,
        color: '6B7280',
        spacing: { after: 200 },
      }),

      createMetadataField('Resumo', '[Digite um breve resumo do artigo em 1-2 frases, explicando do que se trata e qual sua relevância]'),

      createDivider('INÍCIO DO CONTEÚDO'),

      // ==========================================
      // CONTEÚDO DO ARTIGO
      // ==========================================
      new Paragraph({
        text: '[Digite o conteúdo do seu artigo abaixo desta linha]',
        italics: true,
        color: '6B7280',
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 400 },
      }),

      // Introdução
      new Paragraph({
        text: 'Introdução',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: 'A [tema do artigo] representa um dos aspectos mais relevantes do Direito Administrativo contemporâneo. Este artigo analisa os principais desdobramentos da matéria, com base na ',
            font: 'Times New Roman',
            size: 24,
          }),
          new TextRun({
            text: 'Lei 14.133/2021',
            font: 'Times New Roman',
            size: 24,
            bold: true,
          }),
          new TextRun({
            text: '¹',
            font: 'Times New Roman',
            size: 24,
            superScript: true,
          }),
          new TextRun({
            text: ', na doutrina especializada e na jurisprudência dos tribunais superiores.',
            font: 'Times New Roman',
            size: 24,
          }),
        ],
        spacing: { after: 200 },
        alignment: AlignmentType.JUSTIFIED,
      }),

      // Primeiro Tópico
      new Paragraph({
        text: '1. Primeiro Tópico Principal',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Conforme estabelecido pela Lei 14.133/2021¹, as ',
            font: 'Times New Roman',
            size: 24,
          }),
          new TextRun({
            text: 'contratações públicas',
            font: 'Times New Roman',
            size: 24,
            bold: true,
          }),
          new TextRun({
            text: ' devem observar os princípios da legalidade, impessoalidade e eficiência. Segundo a doutrina²...',
            font: 'Times New Roman',
            size: 24,
          }),
        ],
        spacing: { after: 200 },
        alignment: AlignmentType.JUSTIFIED,
      }),

      new Paragraph({
        text: 'Use números sobrescritos (¹, ², ³) para indicar notas de rodapé.',
        font: 'Times New Roman',
        size: 20,
        color: '6B7280',
        italics: true,
        spacing: { after: 200 },
      }),

      // Subtópico
      new Paragraph({
        text: '1.1. Subtópico',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: 'Detalhamento do primeiro tópico. Utilize ',
            font: 'Times New Roman',
            size: 24,
          }),
          new TextRun({
            text: 'negrito',
            font: 'Times New Roman',
            size: 24,
            bold: true,
          }),
          new TextRun({
            text: ' para termos importantes e ',
            font: 'Times New Roman',
            size: 24,
          }),
          new TextRun({
            text: 'itálico',
            font: 'Times New Roman',
            size: 24,
            italics: true,
          }),
          new TextRun({
            text: ' para citações ou ênfase.',
            font: 'Times New Roman',
            size: 24,
          }),
        ],
        spacing: { after: 200 },
        alignment: AlignmentType.JUSTIFIED,
      }),

      // Segundo Tópico
      new Paragraph({
        text: '2. Segundo Tópico Principal',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }),

      new Paragraph({
        text: 'Desenvolvimento do segundo ponto principal do artigo. A jurisprudência do STJ³ tem se posicionado de forma reiterada sobre o tema...',
        font: 'Times New Roman',
        size: 24,
        spacing: { after: 200 },
        alignment: AlignmentType.JUSTIFIED,
      }),

      // Conclusão
      new Paragraph({
        text: 'Conclusão',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }),

      new Paragraph({
        text: 'Em síntese, verificamos que... As principais contribuições deste estudo são...',
        font: 'Times New Roman',
        size: 24,
        spacing: { after: 400 },
        alignment: AlignmentType.JUSTIFIED,
      }),

      createDivider('FIM DO CONTEÚDO'),

      // ==========================================
      // NOTAS DE RODAPÉ
      // ==========================================
      new Paragraph({
        text: 'Notas de Rodapé',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 300 },
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: '¹ ',
            font: 'Times New Roman',
            size: 22,
            bold: true,
          }),
          new TextRun({
            text: 'BRASIL. Lei nº 14.133, de 1º de abril de 2021. Estabelece normas gerais de licitação e contratação para as Administrações Públicas diretas, autárquicas e fundacionais da União, dos Estados, do Distrito Federal e dos Municípios. Diário Oficial da União, Brasília, DF, 1 abr. 2021.',
            font: 'Times New Roman',
            size: 22,
          }),
        ],
        spacing: { after: 150 },
        alignment: AlignmentType.JUSTIFIED,
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: '² ',
            font: 'Times New Roman',
            size: 22,
            bold: true,
          }),
          new TextRun({
            text: 'DI PIETRO, Maria Sylvia Zanella. Direito Administrativo. 34. ed. São Paulo: Editora Atlas, 2021, p. 456-458.',
            font: 'Times New Roman',
            size: 22,
          }),
        ],
        spacing: { after: 150 },
        alignment: AlignmentType.JUSTIFIED,
      }),

      new Paragraph({
        children: [
          new TextRun({
            text: '³ ',
            font: 'Times New Roman',
            size: 22,
            bold: true,
          }),
          new TextRun({
            text: 'SUPERIOR TRIBUNAL DE JUSTIÇA. REsp 1.234.567/DF, Relator: Ministro João Silva Santos, Segunda Turma, julgado em 15/03/2023, DJe 20/03/2023.',
            font: 'Times New Roman',
            size: 22,
          }),
        ],
        spacing: { after: 400 },
        alignment: AlignmentType.JUSTIFIED,
      }),

      createDivider(),

      // ==========================================
      // REFERÊNCIAS BIBLIOGRÁFICAS
      // ==========================================
      new Paragraph({
        text: 'Referências Bibliográficas',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 300 },
      }),

      new Paragraph({
        text: 'BRASIL. Lei nº 14.133, de 1º de abril de 2021. Estabelece normas gerais de licitação e contratação para as Administrações Públicas diretas, autárquicas e fundacionais da União, dos Estados, do Distrito Federal e dos Municípios. Diário Oficial da União, Brasília, DF, 1 abr. 2021.',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 150 },
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: 720, hanging: 720 }, // Recuo francês
      }),

      new Paragraph({
        text: 'DI PIETRO, Maria Sylvia Zanella. Direito Administrativo. 34. ed. São Paulo: Editora Atlas, 2021.',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 150 },
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: 720, hanging: 720 },
      }),

      new Paragraph({
        text: 'JUSTEN FILHO, Marçal. Comentários à Lei de Licitações e Contratos Administrativos. 18. ed. São Paulo: Revista dos Tribunais, 2019.',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 150 },
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: 720, hanging: 720 },
      }),

      new Paragraph({
        text: 'MEIRELLES, Hely Lopes. Direito Administrativo Brasileiro. 42. ed. São Paulo: Malheiros Editores, 2016.',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 150 },
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: 720, hanging: 720 },
      }),

      new Paragraph({
        text: 'SUPERIOR TRIBUNAL DE JUSTIÇA. REsp 1.234.567/DF, Relator: Ministro João Silva Santos, Segunda Turma, julgado em 15/03/2023, DJe 20/03/2023.',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 400 },
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: 720, hanging: 720 },
      }),

      createDivider('INSTRUÇÕES IMPORTANTES'),

      // ==========================================
      // INSTRUÇÕES
      // ==========================================
      new Paragraph({
        text: 'COMO USAR ESTE TEMPLATE:',
        bold: true,
        font: 'Times New Roman',
        size: 24,
        spacing: { before: 300, after: 200 },
      }),

      new Paragraph({
        text: '1. CAMPOS OBRIGATÓRIOS:',
        bold: true,
        font: 'Times New Roman',
        size: 22,
        spacing: { before: 150, after: 100 },
      }),

      new Paragraph({
        text: '   • Título, Autor, Data, Tags (3-7 tags), Resumo (1-2 frases)',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 100 },
      }),

      new Paragraph({
        text: '2. FORMATAÇÃO:',
        bold: true,
        font: 'Times New Roman',
        size: 22,
        spacing: { before: 150, after: 100 },
      }),

      new Paragraph({
        text: '   • Use "Título 1" (Ctrl+Alt+1) para seções principais',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 50 },
      }),

      new Paragraph({
        text: '   • Use "Título 2" (Ctrl+Alt+2) para subseções',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 50 },
      }),

      new Paragraph({
        text: '   • Use "Título 3" (Ctrl+Alt+3) para sub-subseções',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 50 },
      }),

      new Paragraph({
        text: '   • Use Negrito (Ctrl+N) para termos importantes',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 50 },
      }),

      new Paragraph({
        text: '   • Use Itálico (Ctrl+I) para citações ou ênfase',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 100 },
      }),

      new Paragraph({
        text: '3. NOTAS DE RODAPÉ:',
        bold: true,
        font: 'Times New Roman',
        size: 22,
        spacing: { before: 150, after: 100 },
      }),

      new Paragraph({
        text: '   • No texto: use ¹ ² ³ ou [1] [2] [3]',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 50 },
      }),

      new Paragraph({
        text: '   • Na seção "Notas de Rodapé": liste todas em ordem',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 100 },
      }),

      new Paragraph({
        text: '4. REFERÊNCIAS (Formato ABNT):',
        bold: true,
        font: 'Times New Roman',
        size: 22,
        spacing: { before: 150, after: 100 },
      }),

      new Paragraph({
        text: '   • Liste em ordem alfabética por sobrenome do autor',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 50 },
      }),

      new Paragraph({
        text: '   • Use recuo francês (primeira linha sem recuo, demais com recuo)',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 50 },
      }),

      new Paragraph({
        text: '   • Inclua todas as fontes citadas no texto',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 100 },
      }),

      new Paragraph({
        text: '5. APÓS PREENCHER:',
        bold: true,
        font: 'Times New Roman',
        size: 22,
        spacing: { before: 150, after: 100 },
      }),

      new Paragraph({
        text: '   • Salve o arquivo em formato .docx',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 50 },
      }),

      new Paragraph({
        text: '   • Acesse /admin/blog/upload-word no sistema',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 50 },
      }),

      new Paragraph({
        text: '   • Faça upload do arquivo',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 50 },
      }),

      new Paragraph({
        text: '   • Revise o preview gerado automaticamente',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 50 },
      }),

      new Paragraph({
        text: '   • Salve como rascunho ou publique',
        font: 'Times New Roman',
        size: 22,
        spacing: { after: 300 },
      }),

      createDivider(),
    ],
  }],

  // Estilos personalizados
  styles: {
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: {
          font: 'Times New Roman',
          size: 28, // 14pt
          bold: true,
          color: '1F2937',
        },
        paragraph: {
          spacing: { before: 400, after: 200 },
          alignment: AlignmentType.LEFT,
        },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: {
          font: 'Times New Roman',
          size: 26, // 13pt
          bold: true,
          color: '374151',
        },
        paragraph: {
          spacing: { before: 300, after: 150 },
          alignment: AlignmentType.LEFT,
        },
      },
      {
        id: 'Heading3',
        name: 'Heading 3',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: {
          font: 'Times New Roman',
          size: 24, // 12pt
          bold: true,
          color: '4B5563',
        },
        paragraph: {
          spacing: { before: 200, after: 100 },
          alignment: AlignmentType.LEFT,
        },
      },
      {
        id: 'Normal',
        name: 'Normal',
        run: {
          font: 'Times New Roman',
          size: 24, // 12pt
        },
        paragraph: {
          spacing: { line: 360, lineRule: 'auto' }, // Espaçamento 1.5
          alignment: AlignmentType.JUSTIFIED,
        },
      },
    ],
  },
});

// Gerar arquivo
Packer.toBuffer(doc).then((buffer) => {
  const outputPath = path.join(__dirname, '..', 'public', 'templates', 'template-artigo-blog.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log('✅ Template Word gerado com sucesso!');
  console.log(`📄 Local: ${outputPath}`);
  console.log('');
  console.log('📋 Próximos passos:');
  console.log('   1. Abra o arquivo template-artigo-blog.docx');
  console.log('   2. Verifique os estilos e formatação');
  console.log('   3. Compartilhe com os autores');
});
