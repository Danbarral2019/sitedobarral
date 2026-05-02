/**
 * CLI wrapper do sync CONUNI. Lógica vive em lib/conuni-sync.ts (compartilhada
 * com o cron Vercel /api/cron/sync-conuni).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/sync-conuni.ts             # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/sync-conuni.ts --apply
 *   npx dotenv -e .env.local -- npx tsx scripts/sync-conuni.ts --refetch   # força redownload da API
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import {
  syncConuni,
  fetchConuniApi,
  classifyCategory,
  matchExisting,
  buildContent,
  buildTitle,
  buildExternalUrl,
  vigenciaLabel,
  type ConuniItem,
} from '../lib/conuni-sync';

const SNAPSHOT_DIR = path.join(process.cwd(), 'data');
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, 'conuni-snapshot.json');

const APPLY = process.argv.includes('--apply');
const REFETCH = process.argv.includes('--refetch') || !fs.existsSync(SNAPSHOT_PATH);

async function loadSnapshot(): Promise<ConuniItem[]> {
  if (REFETCH) {
    console.log('Fetching CONUNI API...');
    const items = await fetchConuniApi();
    if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify({ erro: 'OK', info: items }, null, 2));
    console.log(`Snapshot salvo em ${SNAPSHOT_PATH} (${items.length} itens)\n`);
    return items;
  }
  console.log(`Lendo snapshot cacheado: ${SNAPSHOT_PATH}`);
  const data = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
  return data.info;
}

async function dryRun(items: ConuniItem[]) {
  const existing = await prisma.document.findMany({
    where: { category: { in: ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'] } },
    select: { id: true, title: true, category: true, content: true, url: true, aiClassification: true },
  });
  console.log(`Items CONUNI: ${items.length}`);
  console.log(`Existentes: ${existing.length}\n`);

  const matchedIds = new Set<string>();
  let insert = 0, update = 0, skip = 0;
  const reclassif: Record<string, number> = {};

  for (const item of items) {
    const remaining = existing.filter((e) => !matchedIds.has(e.id));
    const matched = matchExisting(item, remaining);
    const newCat = classifyCategory(item);

    if (!matched) {
      insert++;
      continue;
    }
    matchedIds.add(matched.id);
    const newContent = buildContent(item);
    const newUrl = buildExternalUrl(item);
    const newTitle = buildTitle(item);
    if (matched.category === newCat && matched.content === newContent && matched.url === newUrl && matched.title === newTitle) {
      skip++;
    } else {
      update++;
      if (matched.category !== newCat) {
        const t = `${matched.category}→${newCat}`;
        reclassif[t] = (reclassif[t] || 0) + 1;
      }
    }
  }

  const orphans = existing.filter((e) => !matchedIds.has(e.id)).length;
  const revogados = items.filter((i) => i.vigencia !== 1).length;

  console.log('=== Plano ===');
  console.log(`Insert: ${insert}, Update: ${update}, Skip: ${skip}`);
  console.log(`Reclassificações:`, reclassif);
  console.log(`Órfãos preservados: ${orphans}`);
  console.log(`Marcados como revogado/modificado/outro: ${revogados}`);
  console.log(`\n[DRY-RUN] Use --apply pra executar.`);
}

async function main() {
  const tag = APPLY ? '[APPLY]' : '[DRY-RUN]';
  console.log(`${tag} Sync CONUNI\n`);
  const items = await loadSnapshot();

  if (!APPLY) {
    await dryRun(items);
    return;
  }

  const result = await syncConuni(prisma, items);
  console.log('=== Resultado ===');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error('Erro fatal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
