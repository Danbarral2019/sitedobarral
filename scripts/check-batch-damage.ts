/**
 * Verifica se o batch import zerou campos opcionais (themes, leiArticles, content)
 * dos 29 atos atualizados de ins-faltantes-2026-02.json.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface ActInput {
  fullNumber: string;
  themes?: string[];
  leiArticles?: string[];
  content?: string | null;
  summary?: string;
}

async function main() {
  const raw = readFileSync('ins-faltantes-2026-02.json', 'utf-8');
  const parsed = JSON.parse(raw) as { legislativeActs: ActInput[] };

  console.log(`\n=== Auditoria pós-batch ins-faltantes-2026-02 ===`);
  console.log(`Atos no JSON: ${parsed.legislativeActs.length}\n`);

  let jsonHasThemes = 0;
  let jsonHasLeiArts = 0;
  let jsonHasContent = 0;
  let dbThemesLost = 0;
  let dbLeiArtsLost = 0;
  let dbContentLost = 0;
  const lostThemes: { fn: string; before: string }[] = [];

  for (const a of parsed.legislativeActs) {
    if (a.themes?.length) jsonHasThemes++;
    if (a.leiArticles?.length) jsonHasLeiArts++;
    if (a.content && a.content.length > 50) jsonHasContent++;

    const db = await prisma.legislativeAct.findUnique({
      where: { fullNumber: a.fullNumber },
      select: { themes: true, leiArticles: true, leiArticlesArr: true, content: true },
    });
    if (!db) continue;

    // Se JSON não tem mas DB ficou null, foi zerado pelo batch
    if (!a.themes?.length && db.themes === null) {
      // Não dá pra saber se ANTES tinha sem backup, só inferir
      // Vamos só listar atos atualmente sem themes
      lostThemes.push({ fn: a.fullNumber, before: '?' });
      dbThemesLost++;
    }
    if (!a.leiArticles?.length && db.leiArticles === null) dbLeiArtsLost++;
    if ((!a.content || a.content.length < 50) && (!db.content || db.content.length < 50)) dbContentLost++;
  }

  console.log('JSON tem:');
  console.log(`  themes:       ${jsonHasThemes}/${parsed.legislativeActs.length}`);
  console.log(`  leiArticles:  ${jsonHasLeiArts}/${parsed.legislativeActs.length}`);
  console.log(`  content:      ${jsonHasContent}/${parsed.legislativeActs.length}`);
  console.log('');
  console.log('DB ficou sem (potencialmente zerados — sem backup pra confirmar):');
  console.log(`  themes:       ${dbThemesLost}`);
  console.log(`  leiArticles:  ${dbLeiArtsLost}`);
  console.log(`  content:      ${dbContentLost}`);

  // Sample dos zerados
  if (lostThemes.length > 0) {
    console.log('\nAtos do JSON que agora estão sem themes no DB (pode ter sido zerado):');
    for (const l of lostThemes.slice(0, 15)) console.log(`  - ${l.fn}`);
    if (lostThemes.length > 15) console.log(`  ... +${lostThemes.length - 15}`);
  }

  // Confirma se Decreto 12.174 (atualizado pelo batch atos-pendentes-2026-04.json) tem themes
  const dec = await prisma.legislativeAct.findUnique({
    where: { fullNumber: 'Decreto 12.174/2024' },
    select: { themes: true, content: true, leiArticles: true, leiArticlesArr: true },
  });
  console.log(`\nDecreto 12.174/2024 (sample do outro batch):`);
  console.log(`  themes:      ${dec?.themes ?? 'null'}`);
  console.log(`  leiArticles: ${dec?.leiArticles ?? 'null'}`);
  console.log(`  content len: ${dec?.content?.length ?? 0}`);

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
