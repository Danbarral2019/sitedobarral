/**
 * Script para atualizar títulos de atos legislativos
 *
 * Substitui títulos formais (ex: "Decreto nº 12.807, de 29 de dezembro de 2025")
 * por títulos descritivos curtos gerados por IA (ex: "Atualização dos Valores da Lei 14.133").
 *
 * Usage:
 *   npx tsx scripts/update-act-titles.ts              # Executar atualizações
 *   npx tsx scripts/update-act-titles.ts --dry-run    # Simular sem alterar
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

// ===========================
// Configuration
// ===========================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.0-flash';
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES_MS = 2000;

// Pattern to detect formal act titles: contains "nº" and a date like "de ... de 20..."
const FORMAL_TITLE_PATTERN = /nº\s+[\d.]+.*de\s+\d{1,2}\s+de\s+\w+\s+de\s+20\d{2}/i;

// ===========================
// Gemini Client
// ===========================

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada. Defina a variável de ambiente.');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

async function generateDescriptiveTitle(ementa: string): Promise<string> {
  const prompt = `Com base na ementa abaixo de um ato normativo brasileiro, gere um título CURTO e descritivo (3-8 palavras) que resuma o assunto principal. Não inclua o número do ato nem datas. O título deve ser substantivo (ex: 'Diálogo Competitivo', 'Registro de Preços', 'Pesquisa de Preços'). Ementa: ${ementa}`;

  const model = getGenAI().getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 100,
    },
  });

  const result = await model.generateContent(prompt);
  const response = result.response.text().trim();

  // Clean up: remove quotes, periods, markdown bold, and extra whitespace
  return response
    .replace(/\*\*/g, '')
    .replace(/^["'""]+|["'""]+$/g, '')
    .replace(/\.+$/, '')
    .trim();
}

// ===========================
// Helpers
// ===========================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasFormalTitle(title: string): boolean {
  return FORMAL_TITLE_PATTERN.test(title);
}

// ===========================
// Main
// ===========================

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Atualização de Títulos de Atos Legislativos`);
  console.log(`  ${DRY_RUN ? '[DRY-RUN] Simulação sem alterações' : '[EXECUCAO] Alterações serão salvas'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Query all acts that have formal-style titles
  const allActs = await prisma.legislativeAct.findMany({
    select: {
      id: true,
      title: true,
      ementa: true,
      fullNumber: true,
    },
    orderBy: { publishDate: 'asc' },
  });

  // Filter to only those with formal titles
  const actsToUpdate = allActs.filter((act) => hasFormalTitle(act.title));

  console.log(`Total de atos no banco: ${allActs.length}`);
  console.log(`Atos com título formal (a atualizar): ${actsToUpdate.length}`);
  console.log(`Atos já com título descritivo: ${allActs.length - actsToUpdate.length}\n`);

  if (actsToUpdate.length === 0) {
    console.log('Nenhum ato precisa de atualização. Encerrando.\n');
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < actsToUpdate.length; i += BATCH_SIZE) {
    const batch = actsToUpdate.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(actsToUpdate.length / BATCH_SIZE);

    console.log(`--- Lote ${batchNum}/${totalBatches} ---`);

    for (const act of batch) {
      try {
        if (!act.ementa || act.ementa.trim().length === 0) {
          console.log(`  [SKIP] ${act.fullNumber} — sem ementa`);
          continue;
        }

        const newTitle = await generateDescriptiveTitle(act.ementa);

        console.log(`  ${act.fullNumber}`);
        console.log(`    Antigo: ${act.title}`);
        console.log(`    Novo:   ${newTitle}`);

        if (!DRY_RUN) {
          await prisma.legislativeAct.update({
            where: { id: act.id },
            data: { title: newTitle },
          });
          console.log(`    -> Atualizado`);
        } else {
          console.log(`    -> [DRY-RUN] Não alterado`);
        }

        updated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  [ERRO] ${act.fullNumber}: ${message}`);
        errors++;
      }
    }

    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < actsToUpdate.length) {
      console.log(`  Aguardando ${DELAY_BETWEEN_BATCHES_MS}ms antes do próximo lote...\n`);
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  RESULTADO:`);
  console.log(`  Atualizados: ${updated}`);
  console.log(`  Erros: ${errors}`);
  console.log(`  Total processado: ${actsToUpdate.length}`);
  console.log(`${'='.repeat(60)}\n`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Erro fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
