import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import * as xlsx from 'xlsx';
import type { PrismaClient } from '@prisma/client';

/**
 * Remove códigos HTML e tags de links dos textos da planilha TCU
 * Exemplos:
 *   '<a href="..." target="_blank">Acórdão 1.519/2017</a>' → 'Acórdão 1.519/2017'
 *   '<a href="...">Lei 8.666/1993</a>' → 'Lei 8.666/1993'
 */
function cleanHtmlTags(text: string): string {
  if (!text) return '';

  return text
    // Remove tags <a> mas mantém o texto interno
    .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
    // Remove outras tags HTML se houver
    .replace(/<[^>]+>/g, '')
    // Remove múltiplos espaços
    .replace(/\s+/g, ' ')
    // Remove espaços no início e fim
    .trim();
}

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
      const numero = match[1].padStart(4, '0'); // Normaliza para 4 dígitos
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
async function findDuplicates(prisma: PrismaClient, titulo: string) {
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

    // Detecta nomes de colunas da planilha
    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    console.log('[TCU Manager Validate] Colunas detectadas:', columns);

    // Processa e valida cada linha
    const processedDocuments = await Promise.all(
      data.map(async (row, index) => {
        // === EXTRAI TODAS AS 10 COLUNAS DA PLANILHA TCU ===

        // 1. Enunciado (texto principal - resumo do acórdão)
        const enunciadoRaw = (
          row['Enunciado'] || row['enunciado'] || row['ENUNCIADO'] || ''
        ) as string;
        const enunciado = cleanHtmlTags(enunciadoRaw);

        // 2. Área temática
        const areaRaw = (
          row['Área'] || row['Area'] || row['area'] || row['ÁREA'] || row['AREA'] || ''
        ) as string;
        const area = cleanHtmlTags(areaRaw);

        // 3. Tema
        const temaRaw = (
          row['Tema'] || row['tema'] || row['TEMA'] || ''
        ) as string;
        const tema = cleanHtmlTags(temaRaw);

        // 4. Subtema
        const subtemaRaw = (
          row['Subtema'] || row['subtema'] || row['SUBTEMA'] || ''
        ) as string;
        const subtema = cleanHtmlTags(subtemaRaw);

        // 5. Data do julgamento
        const dataStr = (
          row['Data'] || row['data'] || row['DATA'] || ''
        ) as string;

        let dataJulgamento: Date | null = null;
        if (dataStr) {
          try {
            // Tenta parsear data (formato esperado: DD/MM/YYYY)
            const [dia, mes, ano] = dataStr.split('/');
            if (dia && mes && ano) {
              dataJulgamento = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
            }
          } catch {
            console.warn(`[TCU Validate] Erro ao parsear data: ${dataStr}`);
          }
        }

        // 6. Número do Acórdão (identificador principal)
        const acordaoRaw = (
          row['Acórdão'] || row['Acordao'] || row['acordao'] || row['ACÓRDÃO'] || row['ACORDAO'] || ''
        ) as string;
        const acordao = cleanHtmlTags(acordaoRaw);

        // 7. Autor da tese
        const autorTeseRaw = (
          row['Autor da tese'] || row['autor da tese'] || row['AUTOR DA TESE'] ||
          row['Autor'] || row['autor'] || ''
        ) as string;
        const autorTese = cleanHtmlTags(autorTeseRaw);

        // 8. Legislação citada
        const legislacaoRaw = (
          row['Legislação'] || row['Legislacao'] || row['legislacao'] ||
          row['LEGISLAÇÃO'] || row['LEGISLACAO'] || ''
        ) as string;
        const legislacao = cleanHtmlTags(legislacaoRaw);

        // 9. Outros indexadores (tags)
        const outrosIndexadoresRaw = (
          row['Outros indexadores'] || row['outros indexadores'] || row['OUTROS INDEXADORES'] ||
          row['Indexadores'] || row['indexadores'] || ''
        ) as string;
        const outrosIndexadores = cleanHtmlTags(outrosIndexadoresRaw);

        // 10. Tipo do processo
        const tipoProcessoRaw = (
          row['Tipo do processo'] || row['tipo do processo'] || row['TIPO DO PROCESSO'] ||
          row['Tipo'] || row['tipo'] || ''
        ) as string;
        const tipoProcesso = cleanHtmlTags(tipoProcessoRaw);

        // === PREPARA DADOS PARA O DOCUMENTO ===

        // Título: combina número do acórdão com início do enunciado
        const titulo = acordao || enunciado.substring(0, 100) + (enunciado.length > 100 ? '...' : '');

        // Descrição: usa o enunciado completo
        const descricao = enunciado;

        // Categoria: sempre 'acordao' para documentos do TCU
        const categoria = 'acordao';

        const errors: string[] = [];
        const warnings: string[] = [];

        // === VALIDAÇÕES BÁSICAS ===

        // Validação 1: Enunciado é obrigatório (informação principal)
        if (!enunciado || enunciado.trim().length === 0) {
          errors.push('Enunciado obrigatório (campo principal do resumo do acórdão)');
        }

        // Validação 2: Número do acórdão é obrigatório (identificador)
        if (!acordao || acordao.trim().length === 0) {
          errors.push('Número do acórdão obrigatório (campo "Acórdão")');
        }

        // === DETECÇÃO DE DUPLICATAS ===
        let duplicate = null;
        if (categoria === 'acordao' && acordao) {
          // Busca por número do acórdão (mais preciso)
          duplicate = await findDuplicates(prisma, acordao);

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
          rawData: row, // Dados originais completos da planilha
          // Dados estruturados da planilha TCU (todas as 10 colunas)
          tcuData: {
            enunciado,
            area,
            tema,
            subtema,
            data: dataStr,
            dataJulgamento,
            acordao,
            autorTese,
            legislacao,
            outrosIndexadores,
            tipoProcesso,
          },
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
