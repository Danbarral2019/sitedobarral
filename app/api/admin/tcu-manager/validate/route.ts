import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { ensureConnection } from '@/lib/prisma';
import * as xlsx from 'xlsx';

/**
 * Extrai número e ano do acórdão do título
 * Exemplos: "AC-0516/25-P" → { numero: "0516", ano: "2025" }
 *           "Acórdão 516/2025" → { numero: "0516", ano: "2025" }
 *           "516/25" → { numero: "0516", ano: "2025" }
 */
function extractAcordaoInfo(title: string): { numero: string; ano: string } | null {
  if (!title) return null;

  // Padrões comuns de acórdãos do TCU
  const patterns = [
    /AC-?(\d+)\/(\d{2,4})/i,           // AC-0516/25-P ou AC0516/2025
    /Ac[óo]rd[ãa]o\s*(\d+)\/(\d{2,4})/i, // Acórdão 516/2025
    /(\d+)\/(\d{2,4})/,                 // 516/25
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      let numero = match[1].padStart(4, '0'); // Normaliza para 4 dígitos
      let ano = match[2];

      // Normaliza ano para 4 dígitos (25 → 2025)
      if (ano.length === 2) {
        const anoNum = parseInt(ano);
        ano = anoNum >= 0 && anoNum <= 50 ? `20${ano}` : `19${ano}`;
      }

      return { numero, ano };
    }
  }

  return null;
}

/**
 * Busca duplicatas no banco de dados
 */
async function findDuplicates(prisma: Awaited<ReturnType<typeof ensureConnection>>, titulo: string) {
  const info = extractAcordaoInfo(titulo);

  if (!info) {
    // Se não conseguir extrair número/ano, busca por título exato
    return await prisma.document.findFirst({
      where: {
        category: 'acordao',
        title: titulo,
      },
      select: {
        id: true,
        title: true,
        uploadedAt: true,
      },
    });
  }

  // Busca por número e ano normalizados
  const { numero, ano } = info;

  return await prisma.document.findFirst({
    where: {
      category: 'acordao',
      OR: [
        { title: { contains: `${numero}/${ano}` } },
        { title: { contains: `${numero}/${ano.substring(2)}` } }, // Busca também versão de ano com 2 dígitos
      ],
    },
    select: {
      id: true,
      title: true,
      uploadedAt: true,
    },
  });
}

/**
 * POST /api/admin/tcu-manager/validate
 * Valida planilha Excel e detecta duplicatas
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const prisma = await ensureConnection();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceType = formData.get('sourceType') as string || 'tcu'; // 'tcu' ou 'custom'

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    console.log('[TCU Manager Validate] Processando arquivo:', file.name, 'Tipo:', sourceType);

    // Converte file para buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Lê o Excel
    const workbook = xlsx.read(buffer, {
      type: 'buffer',
      cellDates: true,
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Converte para JSON
    let data = xlsx.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

    // Limpar nomes de colunas (trim)
    data = data.map(row => {
      const cleanedRow: Record<string, unknown> = {};
      Object.entries(row).forEach(([key, value]) => {
        cleanedRow[key.trim()] = value;
      });
      return cleanedRow;
    });

    console.log(`[TCU Manager Validate] Total de linhas: ${data.length}`);

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum dado encontrado na planilha' },
        { status: 400 }
      );
    }

    // Processa e valida cada linha
    const processedDocuments = await Promise.all(
      data.map(async (row, index) => {
        const titulo = (row['Titulo'] || row['titulo'] || row['Título'] || '') as string;
        const descricao = (row['Descricao'] || row['descricao'] || row['Descrição'] || '') as string;
        const categoria = ((row['Categoria'] || row['categoria'] || 'acordao') as string).toLowerCase();

        const errors: string[] = [];
        const warnings: string[] = [];

        // Validações básicas
        if (!titulo) {
          errors.push('Título obrigatório');
        }

        // Detecta duplicatas apenas para acórdãos
        let duplicate = null;
        if (categoria === 'acordao' && titulo) {
          duplicate = await findDuplicates(prisma, titulo);

          if (duplicate) {
            warnings.push(
              `Duplicata detectada: "${duplicate.title}" (importado em ${new Date(duplicate.uploadedAt).toLocaleDateString('pt-BR')})`
            );
          }
        }

        return {
          title: titulo,
          description: descricao,
          category: categoria,
          isValid: errors.length === 0,
          isDuplicate: !!duplicate,
          duplicateInfo: duplicate ? {
            id: duplicate.id,
            title: duplicate.title,
            uploadedAt: duplicate.uploadedAt,
          } : null,
          errors,
          warnings,
          rowIndex: index,
          rawData: row,
        };
      })
    );

    // Estatísticas
    const stats = {
      total: processedDocuments.length,
      valid: processedDocuments.filter(d => d.isValid && !d.isDuplicate).length,
      invalid: processedDocuments.filter(d => !d.isValid).length,
      duplicates: processedDocuments.filter(d => d.isDuplicate).length,
      new: processedDocuments.filter(d => d.isValid && !d.isDuplicate).length,
    };

    console.log('[TCU Manager Validate] Stats:', stats);

    return NextResponse.json({
      success: true,
      stats,
      documents: processedDocuments,
    });

  } catch (error) {
    console.error('[TCU Manager Validate] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro ao validar arquivo',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
});
