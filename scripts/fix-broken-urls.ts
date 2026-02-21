/**
 * Script para corrigir URLs quebradas e descrições de documentos no banco.
 *
 * Correções:
 * 1. Portaria PGR/MPU nº 178/2023 — URL do SPA Angular → PDF direto (biblioteca MPF)
 * 2. Orientação nº 1 — Desfazimento de Bens de Informática — descrição atualizada com nota sobre MCTIC
 *
 * Uso:
 *   npx tsx scripts/fix-broken-urls.ts
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

// ============================================================================
// Correções
// ============================================================================

const fixes = [
  {
    id: '51090e64-1108-43d6-b2d7-0c5df947f313',
    label: 'Portaria PGR/MPU nº 178/2023',
    data: {
      url: 'https://biblioteca.mpf.mp.br/repositorio/bitstreams/3741588e-1b76-46e7-b79f-a4fb48513346/download',
      type: 'pdf',
    },
  },
  {
    id: '1b4d2c70-d160-4b4e-ba21-689110c26b12',
    label: 'Orientação nº 1 — Desfazimento de Bens de Informática',
    data: {
      description:
        'Orientação sobre desfazimento de bens de informática. NOTA: A competência sobre desfazimento de equipamentos eletrônicos foi transferida para o Ministério da Ciência, Tecnologia, Inovações e Comunicações (MCTIC) pelo Decreto nº 8.877/2016. Para mais informações, contate desfazimento.setel@mctic.gov.br.',
    },
  },
];

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           CORREÇÃO DE URLs E DESCRIÇÕES QUEBRADAS          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  let successCount = 0;

  for (const fix of fixes) {
    console.log(`→ ${fix.label} (${fix.id})`);

    // Verificar se o documento existe
    const doc = await prisma.document.findUnique({ where: { id: fix.id } });

    if (!doc) {
      console.log(`  ✗ ERRO: documento não encontrado no banco!\n`);
      continue;
    }

    console.log(`  Título atual: ${doc.title}`);

    // Logar o que vai mudar
    for (const [field, newValue] of Object.entries(fix.data)) {
      const oldValue = (doc as Record<string, unknown>)[field];
      console.log(`  [${field}]`);
      console.log(`    antes:  ${typeof oldValue === 'string' ? oldValue.substring(0, 100) : oldValue}`);
      console.log(`    depois: ${typeof newValue === 'string' ? newValue.substring(0, 100) : newValue}`);
    }

    // Executar update
    await prisma.document.update({
      where: { id: fix.id },
      data: fix.data,
    });

    console.log(`  ✓ Atualizado com sucesso!\n`);
    successCount++;
  }

  console.log('══════════════════════════════════════════════════════════════');
  console.log(`Resultado: ${successCount}/${fixes.length} documentos atualizados.`);

  if (successCount === fixes.length) {
    console.log('Todas as correções foram aplicadas com sucesso.');
  } else {
    console.log('ATENÇÃO: algumas correções falharam — verificar logs acima.');
  }
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
