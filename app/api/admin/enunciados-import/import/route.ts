import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

interface EnunciadoMetadata {
  numeroPropostaPublica?: string;
  artigos: string[];
  keywords: string[];
}

interface EnunciadoClassification {
  success: boolean;
  titulo: string;
  descricao: string;
  categoria: string;
  cursos: string[];
  tags: string[];
  artigos: string[];
  confianca: number;
  raciocinio: string;
}

interface EnunciadoToImport {
  numero: number;
  titulo: string;
  texto: string;
  fonte: string;
  metadados: EnunciadoMetadata;
  classification?: EnunciadoClassification;
}

/**
 * POST /api/admin/enunciados-import/import
 * Importa enunciados extraídos em lote para o banco de dados
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { enunciados, fonte } = body as {
      enunciados: EnunciadoToImport[];
      fonte: string;
    };

    if (!Array.isArray(enunciados) || enunciados.length === 0) {
      return NextResponse.json(
        { error: 'Array de enunciados vazio ou inválido' },
        { status: 400 }
      );
    }

    console.log(`[Enunciados Import] Importando ${enunciados.length} enunciados da fonte: ${fonte}`);

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    // Importa cada enunciado
    for (const enunciado of enunciados) {
      try {
        // Usar dados da classificação se disponíveis, senão usar padrões
        const classification = enunciado.classification;
        const title = classification?.titulo || `${fonte} - Enunciado ${enunciado.numero}`;
        const description = classification?.descricao || enunciado.texto.substring(0, 200);
        const category = classification?.categoria || 'enunciado';
        const courseIds = classification?.cursos || ['1']; // Default: Nova Lei de Licitações
        const tags = classification?.tags || [];
        const artigos = classification?.artigos || enunciado.metadados.artigos || [];

        // Combina tags com artigos e keywords
        const allTags = [
          ...tags,
          ...artigos.map(art => `art-${art}`),
          ...enunciado.metadados.keywords.slice(0, 5), // Limita keywords
          fonte.toLowerCase().replace('.pdf', ''),
        ];

        // Remove duplicatas
        const uniqueTags = [...new Set(allTags)];

        // Cria documento no banco
        const document = await prisma.document.create({
          data: {
            title,
            description,
            type: 'link', // Enunciados são do tipo 'link' inicialmente
            url: '', // Será preenchido depois se necessário
            category,
            isPublic: false, // Enunciados geralmente são restritos
            tags: JSON.stringify(uniqueTags),
            courseId: courseIds[0], // Usa o primeiro curso
            uploadedAt: new Date(),
          },
        });

        // Se tiver mais de um curso, cria entradas adicionais
        for (let i = 1; i < courseIds.length; i++) {
          await prisma.document.create({
            data: {
              title,
              description,
              type: 'link',
              url: '',
              category,
              isPublic: false,
              tags: JSON.stringify(uniqueTags),
              courseId: courseIds[i],
              uploadedAt: new Date(),
            },
          });
        }

        imported++;
        console.log(`[Enunciados Import] ✅ Importado: ${title}`);

      } catch (docError) {
        failed++;
        const errorMsg = `Enunciado ${enunciado.numero}: ${docError instanceof Error ? docError.message : 'Erro desconhecido'}`;
        errors.push(errorMsg);
        console.error(`[Enunciados Import] ❌ ${errorMsg}`);
      }
    }

    console.log(`[Enunciados Import] Concluído: ${imported} importados, ${failed} falharam`);

    return NextResponse.json(
      {
        success: true,
        imported,
        failed,
        total: enunciados.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[Enunciados Import] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao importar enunciados' },
      { status: 500 }
    );
  }
});
