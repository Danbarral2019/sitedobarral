/**
 * Corrige pontuação cp1252 mal decodificada em Document.content / .description.
 *
 * Bytes de Windows-1252 lidos como UTF-8 viram controles C1 (U+0080–U+009F),
 * que NÃO renderizam: as aspas e os travessões do texto simplesmente somem da
 * tela. Encontrados em 16 documentos (artigos da Lei 14.133 e decretos):
 *   U+0093 → “   U+0094 → ”   U+0096 → –
 *
 * Reusa `mapCp1252Punctuation` de `lib/legislative-scrapers/normalize.ts`, a
 * mesma tabela já aplicada no pipeline de atos.
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/fix-documentos-cp1252.ts --dry-run
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/fix-documentos-cp1252.ts
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { mapCp1252Punctuation } from '@/lib/legislative-scrapers/normalize';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');
const C1 = /[\u0080-\u009F]/;

function descreve(texto: string): string {
  const cps = [...new Set([...texto]
    .filter(ch => ch.charCodeAt(0) >= 0x80 && ch.charCodeAt(0) <= 0x9f)
    .map(ch => 'U+' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')))];
  return cps.join(' ');
}

async function main() {
  const docs = await prisma.document.findMany({
    where: { OR: [{ content: { not: null } }, { description: { not: null } }] },
    select: { id: true, title: true, category: true, content: true, description: true },
  });

  const alvos = docs.filter(d => C1.test((d.content ?? '') + (d.description ?? '')));
  console.log(`documentos analisados: ${docs.length}`);
  console.log(`com controles C1: ${alvos.length}  (dry-run=${DRY_RUN})\n`);

  let corrigidos = 0;
  let sobrou = 0;

  for (const d of alvos) {
    const antesC = d.content ?? '';
    const antesD = d.description ?? '';
    const depoisC = d.content === null ? null : mapCp1252Punctuation(antesC);
    const depoisD = d.description === null ? null : mapCp1252Punctuation(antesD);

    const mudouC = depoisC !== null && depoisC !== antesC;
    const mudouD = depoisD !== null && depoisD !== antesD;
    const restante = C1.test((depoisC ?? '') + (depoisD ?? ''));

    console.log(`  ${(d.category ?? '-').padEnd(15)} ${d.title.slice(0, 42).padEnd(44)} ${descreve(antesC + antesD)}` +
      `${restante ? '  ⚠️ SOBRA C1 após o mapeamento' : ''}`);
    if (restante) sobrou++;

    if (!DRY_RUN && (mudouC || mudouD)) {
      await prisma.document.update({
        where: { id: d.id },
        data: {
          ...(mudouC ? { content: depoisC } : {}),
          ...(mudouD ? { description: depoisD } : {}),
        },
      });
      corrigidos++;
    }
  }

  console.log(`\n${DRY_RUN ? 'seriam corrigidos' : 'corrigidos'}: ${DRY_RUN ? alvos.length : corrigidos}`);
  if (sobrou) console.log(`⚠️ ${sobrou} documento(s) ainda teriam C1 depois — investigar antes de aplicar.`);
  if (!DRY_RUN && corrigidos) {
    console.log('\n⚠️ O texto mudou: reindexar os embeddings desses documentos');
    console.log('   npx dotenv-cli -e .env.local -- npx tsx scripts/migrate-to-embeddings.ts --force');
  }
}

main()
  .catch((err) => { console.error('ERRO:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
