import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * PUT /api/admin/lei-14133/[numero]
 * Atualiza um artigo da Lei 14.133/2021 no arquivo TypeScript
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { numero: string } }
) {
  try {
    // Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { numero } = params;
    const body = await request.json();

    // Validar dados
    if (!body.ementa || !body.ementa.trim()) {
      return NextResponse.json(
        { error: 'O texto do artigo (ementa) é obrigatório' },
        { status: 400 }
      );
    }

    // Caminho do arquivo
    const filePath = join(process.cwd(), 'data', 'lei-14133-artigos.ts');

    // Ler arquivo atual
    const fileContent = readFileSync(filePath, 'utf-8');

    // Escapar caracteres especiais para uso em regex e replacement string
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapeReplacement = (str: string) => str.replace(/\$/g, '$$$$');

    // Encontrar o bloco do artigo específico usando regex
    // Padrão: "numero": { ... },
    const articlePattern = new RegExp(
      `("${escapeRegex(numero)}":\\s*\\{[^}]*?ementa:\\s*")([^"]*(?:\\\\.[^"]*)*)(")`,
      'gs'
    );

    // Verificar se o artigo existe
    if (!articlePattern.test(fileContent)) {
      return NextResponse.json(
        { error: `Artigo ${numero} não encontrado no arquivo` },
        { status: 404 }
      );
    }

    // Reset lastIndex após test()
    articlePattern.lastIndex = 0;

    // Preparar novo conteúdo (escapar caracteres especiais)
    const newEmenta = body.ementa
      .replace(/\\/g, '\\\\')      // Escapar backslashes
      .replace(/"/g, '\\"')         // Escapar aspas
      .replace(/\n/g, '\\n')        // Converter quebras de linha para \\n
      .replace(/\r/g, '');          // Remover carriage returns

    // Construir novo bloco do artigo
    const newArticleBlock = `"${numero}": {
    numero: "${numero}",
    titulo: "${body.titulo?.replace(/"/g, '\\"') || ''}",
    capituloCompleto: "${body.capituloCompleto?.replace(/"/g, '\\"') || ''}",
    ementa: "${newEmenta}",
    capitulo: "${body.capitulo?.replace(/"/g, '\\"') || ''}",${
      body.secao ? `\n    secao: "${body.secao.replace(/"/g, '\\"')}"` : ''
    }
  }`;

    // Substituir o bloco antigo pelo novo
    const updatedContent = fileContent.replace(
      new RegExp(`"${escapeRegex(numero)}":\\s*\\{[^}]*\\}`, 's'),
      newArticleBlock
    );

    // Verificar se houve mudança
    if (updatedContent === fileContent) {
      return NextResponse.json(
        { error: 'Nenhuma mudança foi feita no arquivo' },
        { status: 400 }
      );
    }

    // Salvar arquivo atualizado
    writeFileSync(filePath, updatedContent, 'utf-8');

    return NextResponse.json({
      success: true,
      message: `Artigo ${numero} atualizado com sucesso`,
      updated: {
        numero,
        title: body.titulo || '',
        characterCount: body.ementa.length
      }
    });
  } catch (error) {
    console.error('[Lei 14.133 Edit] Error:', error);
    return NextResponse.json(
      {
        error: 'Erro ao atualizar artigo',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/lei-14133/[numero]
 * Retorna um artigo específico (para preview/validação)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { numero: string } }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { numero } = params;

    // Importar dinamicamente o artigo
    const { LEI_14133_ARTIGOS } = await import('@/data/lei-14133-artigos');

    if (!LEI_14133_ARTIGOS[numero]) {
      return NextResponse.json(
        { error: `Artigo ${numero} não encontrado` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      article: LEI_14133_ARTIGOS[numero],
    });
  } catch (error) {
    console.error('[Lei 14.133 Get] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar artigo' },
      { status: 500 }
    );
  }
}
