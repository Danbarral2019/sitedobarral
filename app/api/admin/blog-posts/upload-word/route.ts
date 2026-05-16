import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import mammoth from 'mammoth';
import { apiLogger } from "@/lib/logger";

/**
 * Processa arquivo Word e extrai:
 * - Metadados (título, autor, data, tags, resumo)
 * - Conteúdo principal
 * - Notas de rodapé
 * - Referências bibliográficas
 * - Imagens
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo foi enviado' },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
      return NextResponse.json(
        { error: 'Apenas arquivos .doc ou .docx são aceitos' },
        { status: 400 }
      );
    }

    // Converter File para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Processar com mammoth
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (mammoth as any).convertToMarkdown(buffer, {
      styleMap: [
        // Mapear estilos do Word para Markdown
        "p[style-name='Heading 1'] => # ",
        "p[style-name='Heading 2'] => ## ",
        "p[style-name='Heading 3'] => ### ",
        "p[style-name='Citação'] => > ",
        "p[style-name='Quote'] => > ",
      ],
    });

    const markdown = result.value;
    const messages = result.messages;

    // Log de avisos (se houver)
    if (messages.length > 0) {
      console.log('[WordUpload] Avisos do mammoth:', messages);
    }

    // Extrair imagens
    const images: Array<{ name: string; base64: string }> = [];

    // Note: Para imagens, precisaríamos processar com mammoth.images
    // Por enquanto, retornamos array vazio de imagens

    // Extrair metadados e seções
    const extracted = extractMetadataAndSections(markdown);

    return NextResponse.json({
      title: extracted.title || 'Sem título',
      author: extracted.author || 'Prof. Daniel Barral',
      date: extracted.date || new Date().toISOString(),
      tags: extracted.tags,
      excerpt: extracted.excerpt || '',
      content: extracted.content,
      footnotes: extracted.footnotes,
      references: extracted.references,
      images: images,
    });

  } catch (error) {
    apiLogger.error({ err: error }, '[WordUpload] Erro ao processar arquivo:');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro ao processar arquivo Word'
      },
      { status: 500 }
    );
  }
});

/**
 * Extrai metadados e seções específicas do markdown
 */
function extractMetadataAndSections(markdown: string) {
  const lines = markdown.split('\n');

  let title = '';
  let author = '';
  let date = '';
  let tags: string[] = [];
  let excerpt = '';
  let content = '';
  let footnotes = '';
  let references = '';

  let currentSection: 'metadata' | 'content' | 'footnotes' | 'references' = 'metadata';
  const contentLines: string[] = [];
  let metadataEndIndex = 0;

  // Primeira passagem: extrair metadados
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detectar campos de metadados
    if (line.startsWith('Título:') || line.startsWith('Titulo:')) {
      title = line.replace(/^Título:|^Titulo:/, '').trim();
      metadataEndIndex = Math.max(metadataEndIndex, i);
    } else if (line.startsWith('Autor:')) {
      author = line.replace(/^Autor:/, '').trim();
      metadataEndIndex = Math.max(metadataEndIndex, i);
    } else if (line.startsWith('Data:')) {
      date = line.replace(/^Data:/, '').trim();
      metadataEndIndex = Math.max(metadataEndIndex, i);
    } else if (line.startsWith('Tags:')) {
      const tagString = line.replace(/^Tags:/, '').trim();
      tags = tagString
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      metadataEndIndex = Math.max(metadataEndIndex, i);
    } else if (line.startsWith('Resumo:')) {
      excerpt = line.replace(/^Resumo:/, '').trim();
      metadataEndIndex = Math.max(metadataEndIndex, i);

      // Continuar lendo até encontrar linha vazia ou próximo campo
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (!nextLine || nextLine.includes(':')) {
          metadataEndIndex = Math.max(metadataEndIndex, j - 1);
          break;
        }
        excerpt += ' ' + nextLine;
        metadataEndIndex = Math.max(metadataEndIndex, j);
      }
    }
  }

  // Segunda passagem: extrair conteúdo e seções especiais
  for (let i = metadataEndIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase().trim();

    // Detectar seção de Notas de Rodapé
    if (lineLower.includes('notas de rodapé') || lineLower.includes('notas')) {
      currentSection = 'footnotes';
      continue;
    }

    // Detectar seção de Referências
    if (lineLower.includes('referências bibliográficas') ||
        lineLower.includes('referências') ||
        lineLower.includes('referencias')) {
      currentSection = 'references';
      continue;
    }

    // Adicionar linha à seção apropriada
    if (currentSection === 'content') {
      contentLines.push(line);
    } else if (currentSection === 'footnotes') {
      footnotes += line + '\n';
    } else if (currentSection === 'references') {
      references += line + '\n';
    } else if (i > metadataEndIndex) {
      // Após metadados, começar conteúdo
      currentSection = 'content';
      contentLines.push(line);
    }
  }

  content = contentLines.join('\n').trim();

  // Processar notas de rodapé inline (números sobrescritos)
  content = processFootnotes(content);

  return {
    title: title.trim(),
    author: author.trim(),
    date: date.trim(),
    tags: tags,
    excerpt: excerpt.trim(),
    content: content,
    footnotes: footnotes.trim(),
    references: references.trim(),
  };
}

/**
 * Processa notas de rodapé inline, convertendo números
 * sobrescritos para formato Markdown
 */
function processFootnotes(content: string): string {
  // Detectar padrões como [1], (1), ¹, etc.
  // Converter para formato: texto[^1]

  // Números sobrescritos Unicode (¹ ² ³ etc.)
  const superscripts: Record<string, number> = {
    '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5,
    '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9, '⁰': 0,
  };

  let processed = content;

  // Substituir números sobrescritos Unicode
  for (const [char, num] of Object.entries(superscripts)) {
    const regex = new RegExp(char, 'g');
    processed = processed.replace(regex, `[^${num}]`);
  }

  // Substituir [1], [2], etc. por [^1], [^2]
  processed = processed.replace(/\[(\d+)\]/g, '[^$1]');

  return processed;
}
