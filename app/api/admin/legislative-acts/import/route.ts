import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { scrapeAndIndexAct } from '@/lib/legislative-scrapers/scrape-and-index';
import { validateActContent } from '@/lib/legislative-scrapers/validate-content';
import { normalizeScrapedText } from '@/lib/legislative-scrapers/normalize';
import { getHierarchyLevel } from '@/lib/legislative-acts/hierarchy';
import { setLeiArticles } from '@/lib/lei-articles';
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/admin/legislative-acts/import
 * Importa atos normativos em massa via CSV
 */
export const POST = withAdminApi(async (request, ctx) => {
  const body = await request.json();
  const { csvData } = body;

  if (!csvData || !Array.isArray(csvData)) {
    throw new ValidationError('Dados CSV inválidos');
  }

  const results = {
    success: 0,
    errors: [] as Array<{ row: number; error: string; data: Record<string, unknown> }>,
    skipped: 0
  };

  // Processar cada linha do CSV (pular header)
  // (hierarchyLevel calculado via getHierarchyLevel importada — fonte canônica.)
  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];

    try {
      // Validar campos obrigatórios (índices do array CSV)
      const [
        type,           // 0
        number,         // 1
        year,           // 2
        title,          // 3
        ementa,         // 4
        summary,        // 5
        issuer,         // 6
        publishDate,    // 7
        effectiveDate,  // 8
        leiArticles,    // 9
        officialUrl,    // 10
        pdfUrl          // 11
      ] = row;

      // Validações
      if (!type || !number || !year || !title || !ementa || !issuer || !publishDate) {
        results.errors.push({
          row: i + 1,
          error: 'Campos obrigatórios faltando (Tipo, Número, Ano, Título, Ementa, Órgão, Data Publicação)',
          data: row
        });
        continue;
      }

      // Validar tipo
      const validTypes = ['decreto', 'portaria', 'in', 'ordem-servico', 'lei', 'medida-provisoria'];
      if (!validTypes.includes(type.toLowerCase())) {
        results.errors.push({
          row: i + 1,
          error: `Tipo inválido: ${type}. Use: decreto, portaria, in, ordem-servico, lei, medida-provisoria`,
          data: row
        });
        continue;
      }

      // Processar artigos da Lei 14.133
      let leiArticlesArray = null;
      if (leiArticles && leiArticles.trim()) {
        leiArticlesArray = leiArticles
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }

      // Gerar fullNumber
      const typeLabel: Record<string, string> = {
        'decreto': 'Decreto',
        'portaria': 'Portaria',
        'in': 'IN SEGES',
        'ordem-servico': 'Ordem de Serviço',
        'lei': 'Lei',
        'medida-provisoria': 'Medida Provisória'
      };
      const fullNumber = `${typeLabel[type.toLowerCase()]} ${number}/${year}`;

      // Verificar se já existe
      const existing = await prisma.legislativeAct.findUnique({
        where: { fullNumber }
      });

      if (existing) {
        results.skipped++;
        continue; // Pular duplicatas
      }

      // Normalizar ementa antes de validar/salvar (NBSP, zero-width, edges)
      const normalizedEmenta = normalizeScrapedText(ementa.trim());

      // Validar formatação da ementa. CSV não traz content (esse vem do
      // scrape pós-create), então só validamos ementa aqui.
      const validation = validateActContent({
        url: officialUrl?.trim() || null,
        content: '',
        ementa: normalizedEmenta,
      });
      // Filtra erros que dependem do content (vamos scrape em seguida).
      const ementaErrors = validation.errors.filter(
        (e) => /Ementa|ementa/.test(e),
      );
      if (ementaErrors.length > 0) {
        results.errors.push({
          row: i + 1,
          error: `Ementa inválida: ${ementaErrors.join('; ')}`,
          data: row as Record<string, unknown>,
        });
        continue;
      }

      // Criar ato normativo
      const newAct = await prisma.legislativeAct.create({
        data: {
          type: type.toLowerCase(),
          number: number.toString(),
          year: parseInt(year),
          fullNumber,
          title: title.trim(),
          ementa: normalizedEmenta,
          summary: summary?.trim() || null,
          issuer: issuer.trim(),
          publishDate: new Date(publishDate),
          effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
          hierarchyLevel: getHierarchyLevel(type.toLowerCase()),
          ...setLeiArticles(leiArticlesArray ?? null),
          officialUrl: officialUrl?.trim() || null,
          pdfUrl: pdfUrl?.trim() || null,
          createdBy: ctx.user.email
        }
      });

      // Scrape + index se tem officialUrl
      if (officialUrl?.trim()) {
        try {
          await scrapeAndIndexAct(newAct.id);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
          apiLogger.error({ err: err }, `[Import CSV] Erro scrape+index ${newAct.id}:`);
        }
      }

      results.success++;

    } catch (error: unknown) {
      apiLogger.error({ err: error }, `Erro na linha ${i + 1}:`);
      results.errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: row as Record<string, unknown>
      });
    }
  }

  // Invalidate cache if any acts were imported
  if (results.success > 0) {
    CacheInvalidation.legislativeActs().catch(console.error);
  }

  return NextResponse.json({
    success: true,
    results: {
      total: csvData.length - 1, // Excluir header
      imported: results.success,
      skipped: results.skipped,
      errors: results.errors.length,
      errorDetails: results.errors
    }
  });
});
