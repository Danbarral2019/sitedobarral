/**
 * Batch import de LegislativeAct a partir de JSON.
 *
 * Aceita um arquivo JSON com a estrutura:
 *   {
 *     "metadata": { ... },
 *     "legislativeActs": [
 *       {
 *         "type": "in" | "decreto" | "portaria" | "lei" | "medida-provisoria" | "ordem-servico",
 *         "number": "190",
 *         "year": 2024,
 *         "fullNumber": "IN SEGES 190/2024",
 *         "title": "...",
 *         "ementa": "...",
 *         "summary"?: "...",
 *         "issuer": "SEGES",
 *         "publishDate": "2024-12-05",
 *         "effectiveDate"?: "2025-01-01",
 *         "hierarchyLevel": 4,
 *         "leiArticles"?: ["115", "180"],
 *         "themes"?: ["terceirizacao", "jornada"],
 *         "officialUrl"?: "...",
 *         "pdfUrl"?: "..."
 *       }
 *     ]
 *   }
 *
 * Faz upsert por `fullNumber`. Atos novos são criados com `embeddingStatus='pending'`
 * para serem indexados depois por `scripts/index-legislative-acts.ts`.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-legislative-acts-batch.ts <json-path>
 *   npx dotenv -e .env.local -- npx tsx scripts/import-legislative-acts-batch.ts <json-path> --dry-run
 *
 * Exemplo:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-legislative-acts-batch.ts ins-faltantes-2026-02.json --dry-run
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface ActInput {
  type: string;
  number: string;
  year: number;
  fullNumber: string;
  title: string;
  ementa: string;
  summary?: string;
  issuer: string;
  publishDate: string;
  effectiveDate?: string;
  hierarchyLevel: number;
  leiArticles?: string[];
  themes?: string[];
  officialUrl?: string | null;
  pdfUrl?: string | null;
  content?: string | null;
  esfera?: string;
}

interface BatchInput {
  metadata?: Record<string, unknown>;
  legislativeActs: ActInput[];
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const jsonPath = args.find((a) => !a.startsWith('--'));

if (!jsonPath) {
  console.error('Uso: tsx scripts/import-legislative-acts-batch.ts <json-path> [--dry-run]');
  process.exit(1);
}

async function main() {
  const fullPath = resolve(process.cwd(), jsonPath!);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Batch Import de Atos Legislativos`);
  console.log(`  Arquivo: ${fullPath}`);
  console.log(`  ${DRY_RUN ? '🔍 MODO DRY-RUN' : '✅ MODO EXECUÇÃO'}`);
  console.log(`${'='.repeat(60)}\n`);

  const raw = readFileSync(fullPath, 'utf-8');
  const parsed: BatchInput = JSON.parse(raw);

  if (!Array.isArray(parsed.legislativeActs)) {
    console.error('JSON inválido: campo "legislativeActs" não é array');
    process.exit(1);
  }

  const acts = parsed.legislativeActs;
  console.log(`Atos no JSON: ${acts.length}\n`);

  const stats = { criados: 0, atualizados: 0, inalterados: 0, erros: 0 };

  for (const act of acts) {
    try {
      const existing = await prisma.legislativeAct.findUnique({
        where: { fullNumber: act.fullNumber },
      });

      const data = {
        type: act.type,
        number: act.number,
        year: act.year,
        title: act.title,
        ementa: act.ementa,
        summary: act.summary ?? null,
        issuer: act.issuer,
        publishDate: new Date(act.publishDate),
        effectiveDate: act.effectiveDate ? new Date(act.effectiveDate) : null,
        hierarchyLevel: act.hierarchyLevel,
        leiArticles: act.leiArticles ? JSON.stringify(act.leiArticles) : null,
        themes: act.themes ? JSON.stringify(act.themes) : null,
        officialUrl: act.officialUrl ?? null,
        pdfUrl: act.pdfUrl ?? null,
        content: act.content ?? null,
        esfera: act.esfera ?? 'federal',
      };

      if (existing) {
        // Update somente se houver mudança em ementa, summary, themes, leiArticles ou URLs
        const fieldsChanged =
          existing.ementa !== data.ementa ||
          existing.summary !== data.summary ||
          existing.themes !== data.themes ||
          existing.leiArticles !== data.leiArticles ||
          existing.officialUrl !== data.officialUrl ||
          existing.pdfUrl !== data.pdfUrl ||
          existing.title !== data.title;

        if (!fieldsChanged) {
          stats.inalterados++;
          continue;
        }

        console.log(`🔄 Atualiza: ${act.fullNumber}`);
        if (!DRY_RUN) {
          await prisma.legislativeAct.update({
            where: { id: existing.id },
            data,
          });
        }
        stats.atualizados++;
      } else {
        console.log(`✅ Cria:    ${act.fullNumber}`);
        if (!DRY_RUN) {
          await prisma.legislativeAct.create({
            data: {
              ...data,
              fullNumber: act.fullNumber,
              embeddingStatus: 'pending',
              createdBy: 'batch-import',
            },
          });
        }
        stats.criados++;
      }
    } catch (err) {
      stats.erros++;
      console.error(`❌ Erro em ${act.fullNumber}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  RESULTADO ${DRY_RUN ? '(simulado)' : ''}:`);
  console.log(`  ✅ Criados:        ${stats.criados}`);
  console.log(`  🔄 Atualizados:    ${stats.atualizados}`);
  console.log(`  ⏸️  Inalterados:    ${stats.inalterados}`);
  console.log(`  ❌ Erros:          ${stats.erros}`);
  console.log(`${'='.repeat(60)}\n`);

  if (!DRY_RUN && stats.criados > 0) {
    console.log('💡 Próximo passo: gerar embeddings dos novos atos:');
    console.log('   npx dotenv -e .env.local -- npx tsx scripts/index-legislative-acts.ts');
  }
}

main()
  .catch((err) => {
    console.error('ERRO FATAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
